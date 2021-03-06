import { Component } from '@angular/core';
import { Http } from '@angular/http';
import { Observable } from "rxjs";
import { Pipeline } from './model/pipeline';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})

export class AppComponent {
  private pipelines: Pipeline[] = [];

  constructor(private http: Http) {
    this.http.get('http://localhost:8000/hosts.json')
      .map(result => result.json())
      .subscribe(hosts => {
        this.initPipelines(hosts);
      });
  }

  private addHost(host, pipelines) {
    return pipelines.map( pipeline => {
      pipeline.host = host;
      return pipeline
    });
  }

  private concatPipelineAndStatus = (pipeline: Pipeline, status: any) => {
    pipeline.setStatus(status.status);
    pipeline.setTimeStamp(status.timeStamp);
    return pipeline
  };

  private concatPipelineAndMetrics = (pipeline, metrics) => { pipeline.metrics = metrics; return pipeline;}

  initPipelines(hosts: string[]) {
    this.pipelines = [];

    Observable.from(hosts)
      .flatMap(host => this.getPipelines(host), this.addHost)
      .flatMap( pipelinesData => Observable.from(pipelinesData))
      .map( rawData => new Pipeline(rawData) )
      .flatMap( (pipeline: Pipeline) => this.getStatus(pipeline), this.concatPipelineAndStatus)
      .flatMap( (pipeline: Pipeline) => this.getMetrics(pipeline), this.concatPipelineAndMetrics)
      .subscribe( (pipeline: Pipeline) => {
        this.pipelines.push(pipeline);
        this.intervalMetric(pipeline);
      });

  }

  intervalMetric(pipeline){
    setInterval( () => {
      this.getMetrics(pipeline).subscribe(metrics => pipeline.metrics = metrics);
    }, 5000);
  }

  private getPipelines(host: String){
    const url = `http://localhost:8000/api?host=${host}&path=/pipelines`;
    return this.http.get(url).map( result => {
      return result.json();
    });
  }

  private getMetrics(pipeline: Pipeline){
    const host = pipeline.host;
    const id = pipeline.pipelineId;

    const url = `http://localhost:8000/api?host=${host}&path=/pipeline/${id}/metrics`;
    return this.http.get(url).map( result => this.parseMetrics( result.text()? result.json(): ""));
  }

  private getStatus(pipeline: Pipeline){
    const host = pipeline.host;
    const id = pipeline.pipelineId;
    const url = `http://localhost:8000/api?host=${host}&path=/pipeline/${id}/status`;
    return this.http.get(url).map( result => {
      return result.json()
    }).map( status => {
      if ( status.metrics ){
        status.metrics = JSON.parse( status.metrics );
      }
      return status;
    })
  }

  private parseMetrics(metrics: any){
    if ( metrics ){
      // TODO find another way localestring
      return {
        "counter": {
          "input": metrics['counters']['pipeline.batchInputRecords.counter']['count'].toLocaleString(),
          "output": metrics['counters']['pipeline.batchOutputRecords.counter']['count'].toLocaleString(),
          "error": metrics['counters']['pipeline.batchErrorRecords.counter']['count'].toLocaleString()
        },
        "errorRate": {
          "1m": metrics['meters']['pipeline.batchErrorRecords.meter']['m1_rate'].toFixed(1),
          "5m": metrics['meters']['pipeline.batchErrorRecords.meter']['m5_rate'].toFixed(1),
          "1h": metrics['meters']['pipeline.batchErrorRecords.meter']['h1_rate'].toFixed(1),
          "24h": metrics['meters']['pipeline.batchErrorRecords.meter']['h24_rate'].toFixed(1)
        },
        "recordRate": {
          "1m": (metrics['meters']['pipeline.batchInputRecords.meter']['m1_rate'] * 60 | 0).toLocaleString(),
          "5m": (metrics['meters']['pipeline.batchInputRecords.meter']['m5_rate'] * 60 * 5 | 0).toLocaleString(),
          "1h": (metrics['meters']['pipeline.batchInputRecords.meter']['h1_rate'] * 60 * 60 | 0).toLocaleString(),
          "24h": (metrics['meters']['pipeline.batchInputRecords.meter']['h24_rate'] * 60 * 60 * 24 | 0).toLocaleString()
        },
        "jvm": {
          "heapUsed": (metrics['gauges']['jvm.memory.total.used']['value'] / 1024 / 1024 | 0) + 'MB'
        }
      };
    }else{
      // console.log(metrics['counters']['pipeline.batchInputRecords.counter']['count']);
      return {
        "counter": {
          "input": "N/A",
          "output": "N/A",
          "error": "N/A"
        },
        "errorRate": {
          "1m": "N/A",
          "5m": "N/A",
          "1h": "N/A",
          "24h": "N/A"
        },
        "recordRate": {
          "1m": "N/A",
          "5m": "N/A",
          "1h": "N/A",
          "24h": "N/A"
        },
        "jvm": {
          "heapUsed": "N/A"
        }
      };
    }
  }
}

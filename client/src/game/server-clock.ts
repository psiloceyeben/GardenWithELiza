/** Estimate server epoch time using monotonic elapsed time between snapshots.
 * Network transit latency remains; local wall-clock adjustments do not affect it.
 */
export class ServerClock {
  private epoch:number;
  private anchor:number;
  constructor(private monotonic=()=>performance.now(),initialEpoch=Date.now()){
    this.epoch=initialEpoch;this.anchor=monotonic();
  }
  sample(epoch:number):void {
    if(!Number.isFinite(epoch)||epoch<0)return;
    this.epoch=epoch;this.anchor=this.monotonic();
  }
  now():number{return this.epoch+Math.max(0,this.monotonic()-this.anchor);}
}

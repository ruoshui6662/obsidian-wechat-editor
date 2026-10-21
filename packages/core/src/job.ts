import type { Account, Article, BlockOverrides, LayoutSettings, PreparedAsset, RenderedArticle, ImageGeometry } from './types';
import { LayoutError } from './types';
export interface Snapshot { id:string;article:Article;layout:LayoutSettings;overrides:BlockOverrides;account:Account;revision:string }
export interface JobEvent {type:'downloading'|'checking'|'preparing'|'uploading'|'writing'|'copied'|'cancelled'|'failed';done?:number;total?:number;message?:string;code?:string;occurrenceIds?:string[]}
export interface JobDependencies {
 verifyAccount?(account:Account,signal:AbortSignal):Promise<void>;
 prepare(snapshot:Snapshot,signal:AbortSignal):Promise<PreparedAsset[]>;
 upload(asset:PreparedAsset,account:Account,signal:AbortSignal):Promise<string>;
 render(snapshot:Snapshot,sources:ReadonlyMap<string,string>,geometry:ReadonlyMap<string,ImageGeometry>):RenderedArticle;
 writeClipboard(rendered:RenderedArticle):Promise<void>;
 isCurrent(snapshot:Snapshot):boolean;
 onEvent(event:JobEvent):void;
}
export function abortable<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{
 return new Promise((resolve,reject)=>{
  const abort=()=>{cleanup();reject(new LayoutError('cancelled','已取消本次复制。'));};
  const cleanup=()=>signal.removeEventListener('abort',abort);
  if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});
  promise.then(v=>{cleanup();resolve(v)},e=>{cleanup();reject(e)});
 });
}
export class CopyJobController {
 private active:AbortController|null=null;private cache=new Map<string,string>();
 constructor(private deps:JobDependencies){}
 cancel():void{this.active?.abort();}
 clearCache():void{this.cache.clear();}
 async run(snapshot:Snapshot,parentSignal?:AbortSignal):Promise<RenderedArticle>{
  this.cancel();const controller=new AbortController();this.active=controller;const {signal}=controller;const abort=()=>controller.abort();parentSignal?.addEventListener('abort',abort,{once:true});if(parentSignal?.aborted)abort();
  const check=()=>{if(signal.aborted)throw new LayoutError('cancelled','已取消本次复制。');if(!this.deps.isCurrent(snapshot))throw new LayoutError('stale-snapshot','文章、样式或公众号已变化，请重新复制。');};
  try{
   check();this.deps.onEvent({type:'checking'});
   if(this.deps.verifyAccount)await abortable(this.deps.verifyAccount(snapshot.account,signal),signal);check();
   const errors=snapshot.article.diagnostics.filter(d=>d.severity==='error');if(errors.length)throw new LayoutError(errors[0].code,errors.map(d=>d.message).join('\n'));
   this.deps.onEvent({type:'preparing'});const assets=await abortable(this.deps.prepare(snapshot,signal),signal);check();
   const sources=new Map<string,string>(),geometry=new Map<string,ImageGeometry>();let done=0;
   for(const asset of assets){
    check();this.deps.onEvent({type:'uploading',done,total:assets.length});
    const key=snapshot.account.id+':'+asset.key;let url=this.cache.get(key);
    if(!url){url=await abortable(this.deps.upload(asset,snapshot.account,signal),signal);if(!/^https?:\/\/mmbiz\.qpic\.cn\//i.test(url))throw new LayoutError('invalid-image-url','上传未返回有效的微信图片地址。',asset.occurrenceIds);this.cache.set(key,url);}
    check();for(const id of asset.occurrenceIds){sources.set(id,url);if(asset.geometry)geometry.set(id,asset.geometry);}done++;this.deps.onEvent({type:'uploading',done,total:assets.length});
   }
   const missing=snapshot.article.images.filter(i=>!sources.has(i.occurrenceId));if(missing.length)throw new LayoutError('missing-prepared-image','有图片尚未准备完成，未复制。',missing.map(i=>i.occurrenceId));
   check();if(this.deps.verifyAccount)await abortable(this.deps.verifyAccount(snapshot.account,signal),signal);check();const rendered=this.deps.render(snapshot,sources,geometry);check();
   const renderErrors=rendered.diagnostics.filter(d=>d.severity==='error');if(renderErrors.length)throw new LayoutError(renderErrors[0].code,renderErrors.map(d=>d.message).join('\n'),renderErrors.flatMap(d=>d.occurrenceId?[d.occurrenceId]:[]));
   this.deps.onEvent({type:'writing'});await this.deps.writeClipboard(rendered);check();
   this.deps.onEvent({type:'copied',message:'图文已复制，到公众号粘贴。'});return rendered;
  }catch(e){
   const error=e instanceof LayoutError?e:new LayoutError('copy-failed',e instanceof Error?e.message:'复制失败，请重试。');
   this.deps.onEvent({type:error.code==='cancelled'?'cancelled':'failed',code:error.code,message:error.message,occurrenceIds:error.occurrenceIds});throw error;
  }finally{parentSignal?.removeEventListener('abort',abort);if(this.active===controller)this.active=null;}
 }
}

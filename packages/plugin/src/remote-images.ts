import {abortable} from '../../core/src/job';
import {posix} from 'node:path';
import {parseArticle} from '../../core/src/parse';
import {LayoutError} from '../../core/src/types';
import {inspectImage} from './vault-assets';
export interface RemoteImagesPort {directory:string;numberOffset?:number;signal?:AbortSignal;progress?(done:number,total:number):void;isCurrent():boolean;download(url:string):Promise<Uint8Array>;save(path:string,bytes:Uint8Array):Promise<void>}
export async function localizeRemoteImages(source:string,sourcePath:string,port:RemoteImagesPort):Promise<{source:string;count:number}>{
 const article=parseArticle(source,sourcePath),remote=article.images.map((ref,index)=>({ref,number:index+1+(port.numberOffset??0)})).filter(({ref})=>/^https?:\/\//i.test(ref.source));
 if(!remote.length)return{source,count:0};
 const check=()=>{if(port.signal?.aborted)throw new LayoutError('cancelled','已取消本次复制。');if(!port.isCurrent())throw new LayoutError('stale-snapshot','文章已变化，请重新下载网络图片。');};
 const wait=<T>(promise:Promise<T>)=>port.signal?abortable(promise,port.signal):promise;
 check();port.progress?.(0,remote.length);
 const originals=new Map<string,Uint8Array>(),plans:Array<{from:number;to:number;text:string;path:string;bytes:Uint8Array}>=[];
 for(const {ref,number}of remote){
  check();if(!ref.markupRange)throw new LayoutError('image-position',`无法准确定位图${number}，未修改原文。`,[ref.occurrenceId]);
  try{
   let bytes=originals.get(ref.source);if(!bytes){bytes=await wait(port.download(ref.source));originals.set(ref.source,bytes);}check();
   const info=inspectImage(bytes),extension=({'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp'} as Record<string,string>)[info.mime];
   const path=posix.join(port.directory,`图${number}.${extension}`);
   const link=posix.relative(posix.dirname(sourcePath),path).replace(/[%<>#?|]/g,c=>encodeURIComponent(c));
   let alt=ref.alt.replace(/\r?\n/g,' ')+(ref.width?`|${ref.width}${ref.height?'x'+ref.height:''}`:'');
   if(article.blocks.find(b=>b.key===ref.blockKey)?.kind==='table')alt=alt.replace(/(?<!\\)\|/g,'\\|');
   plans.push({...ref.markupRange,text:`![${alt}](<${link}>)`,path,bytes});port.progress?.(plans.length,remote.length);
  }catch(error){if(error instanceof LayoutError&&['stale-snapshot','cancelled'].includes(error.code))throw error;throw new LayoutError('image-download',`图${number}下载失败：${error instanceof LayoutError?error.message:'无法读取网络图片，请保存到本地后替换。'}`,[ref.occurrenceId]);}
 }
 check();for(const plan of plans){check();await wait(port.save(plan.path,plan.bytes));}check();
 let result=source;for(const plan of [...plans].sort((a,b)=>b.from-a.from))result=result.slice(0,plan.from)+plan.text+result.slice(plan.to);
 return{source:result,count:plans.length};
}

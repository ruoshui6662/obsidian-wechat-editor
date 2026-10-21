import type {RenderedArticle} from '../../core/src/types';
import {LayoutError} from '../../core/src/types';
interface ClipboardPort {write(items:ClipboardItem[]):Promise<void>;Item:typeof ClipboardItem}
interface TextClipboardPort {nativeWrite?:(text:string)=>void;browserWrite?:(text:string)=>Promise<void>}
export async function writeTextClipboard(text:string,port?:TextClipboardPort):Promise<void>{
 const api=port??{nativeWrite:(value:string)=>require('electron').clipboard.writeText(value),browserWrite:(value:string)=>navigator.clipboard.writeText(value)};
 if(api.nativeWrite){try{api.nativeWrite(text);return;}catch{/* Fall back when Electron's clipboard API is unavailable. */}}
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  if(!api.browserWrite)throw Error('Clipboard unavailable');
  await Promise.race([api.browserWrite(text),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Clipboard timeout')),3000);})]);
 }catch{throw new LayoutError('clipboard-write','自动复制失败，请选中下方配对信息后手动复制。');}
 finally{if(timer)clearTimeout(timer);}
}
export async function writeRichClipboard(rendered:RenderedArticle,port?:ClipboardPort):Promise<void>{
 const html=rendered.html.replace(/\sdata-wx-(?:block|image)="[^"]*"/g,'');
 try{
  const api=port??{write:(items:ClipboardItem[])=>navigator.clipboard.write(items),Item:ClipboardItem};
  await api.write([new api.Item({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([rendered.text],{type:'text/plain'})})]);
 }catch{
  if(!port){try{require('electron').clipboard.write({html,text:rendered.text});return;}catch{}}
  throw new LayoutError('clipboard-write','剪贴板写入失败，请点击“复制图文”重试。');
 }
}

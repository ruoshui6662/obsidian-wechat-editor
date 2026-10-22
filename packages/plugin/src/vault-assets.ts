import {abortable} from '../../core/src/job';
import { createHash } from 'node:crypto';
import { posix, relative, isAbsolute } from 'node:path';
import type { Article, ImageRef, ImageStyle, PreparedAsset, ImageGeometry } from '../../core/src/types';
import { LayoutError } from '../../core/src/types';
import {needsImageBake} from '../../core/src/image-appearance';
import { normalizeImage } from '../../core/src/styles';
export interface VaultPort { listFiles():string[]; readBinary(path:string):Promise<Uint8Array>; rootRealPath?:string; realPath?(path:string):Promise<string> }
export type AssetReader=(ref:ImageRef)=>Promise<{bytes:Uint8Array;filename:string}>;
export type EffectRenderer=(bytes:Uint8Array,mime:string,style:ImageStyle,displayWidth?:number)=>Promise<{bytes:Uint8Array;mime:string;geometry?:ImageGeometry}>;
export const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
export async function resolveVaultAsset(ref:ImageRef,sourcePath:string,vault:VaultPort):Promise<{bytes:Uint8Array;filename:string}>{
 let source:string;try{source=ref.literalPath?ref.source:decodeURIComponent(ref.source);}catch{throw new LayoutError('invalid-path','图片路径编码不正确。',[ref.occurrenceId]);}
 if(source.includes('\0')||/^[a-z][a-z0-9+.-]*:/i.test(source)||source.startsWith('/')||source.includes('\\'))throw new LayoutError('outside-vault','图片必须位于当前 Vault 内。',[ref.occurrenceId]);
 const path=posix.normalize(posix.join(posix.dirname(sourcePath),source));
 if(path==='..'||path.startsWith('../'))throw new LayoutError('outside-vault','图片路径超出当前 Vault。',[ref.occurrenceId]);
 const files=vault.listFiles();let selected=files.includes(path)?path:files.includes(source)?source:undefined;
 if(!selected&&!source.includes('/')){
  const candidates=files.filter(f=>posix.basename(f)===source);
  if(candidates.length>1)throw new LayoutError('ambiguous-image',`找到多张同名图片 ${source}，请填写目录。`,[ref.occurrenceId]);
  selected=candidates[0];
 }
 if(!selected)throw new LayoutError('missing-image',`找不到图片：${source}`,[ref.occurrenceId]);
 if(vault.realPath&&vault.rootRealPath){const real=await vault.realPath(selected);const rel=relative(vault.rootRealPath,real);if(rel==='..'||rel.startsWith('../')||isAbsolute(rel))throw new LayoutError('outside-vault','图片软链接指向 Vault 外部。',[ref.occurrenceId]);}
 return {bytes:await vault.readBinary(selected),filename:posix.basename(selected)};
}
export function inspectImage(bytes:Uint8Array):{mime:string;width:number;height:number}{
 if(bytes.byteLength>10*1024*1024)throw new LayoutError('image-too-large','图片超过本地处理上限 10 MiB。');
 const b=Buffer.from(bytes);let mime='',width=0,height=0;
 if(b.length>=24&&b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))){mime='image/png';width=b.readUInt32BE(16);height=b.readUInt32BE(20);}
 else if(b.length>=10&&/^GIF8[79]a/.test(b.toString('ascii',0,6))){mime='image/gif';width=b.readUInt16LE(6);height=b.readUInt16LE(8);}
 else if(b.length>=4&&b[0]===255&&b[1]===216){
  mime='image/jpeg';let p=2;
  while(p+4<b.length){if(b[p]!==255){p++;continue;}const marker=b[p+1];if(marker===0xda||marker===0xd9)break;if(marker===0xd8||marker===0x01||(marker>=0xd0&&marker<=0xd7)){p+=2;continue;}
   const len=b.readUInt16BE(p+2);if(len<2||p+len+2>b.length)break;
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&len>=7){height=b.readUInt16BE(p+5);width=b.readUInt16BE(p+7);break;}p+=len+2;
  }
 }else if(b.length>=30&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'){
  mime='image/webp';const tag=b.toString('ascii',12,16);
  if(tag==='VP8X'){if(b[20]&2)throw new LayoutError('animated-webp','暂不支持动画 WebP，请改用 GIF，避免丢失动画。');width=b.readUIntLE(24,3)+1;height=b.readUIntLE(27,3)+1;}
  else if(tag==='VP8 '&&b.length>=30){width=b.readUInt16LE(26)&0x3fff;height=b.readUInt16LE(28)&0x3fff;}
  else if(tag==='VP8L'&&b[20]===0x2f){width=1+(((b[22]&0x3f)<<8)|b[21]);height=1+(((b[24]&0xf)<<10)|(b[23]<<2)|(b[22]>>6));}
 }
 if(!mime||!width||!height)throw new LayoutError('unsupported-image','图片格式不支持或文件已损坏，请使用 PNG、JPEG、GIF 或静态 WebP。');
 if(width*height>24_000_000)throw new LayoutError('image-pixels','图片像素超过本地处理上限 2400 万。');
 return {mime,width,height};
}
export async function prepareAssets(article:Article,read:AssetReader,styles:ReadonlyMap<string,ImageStyle>,effects:EffectRenderer,readingWidth?:(ref:ImageRef,naturalWidth:number)=>number,signal?:AbortSignal):Promise<PreparedAsset[]>{
 const check=()=>{if(signal?.aborted)throw new LayoutError('cancelled','已取消本次复制。');};const wait=<T>(promise:Promise<T>)=>signal?abortable(promise,signal):promise;
 const result=new Map<string,PreparedAsset>();const originals=new Map<string,Promise<{bytes:Uint8Array;filename:string}>>();
 for(const ref of article.images){
  try{
   check();const sourceKey=(ref.literalPath?'literal:':'url:')+ref.source;
   if(!originals.has(sourceKey))originals.set(sourceKey,read(ref));
   let {bytes,filename}=await wait(originals.get(sourceKey)!);check();const info=inspectImage(bytes);let mime=info.mime;let geometry:ImageGeometry|undefined;
   const style=normalizeImage(styles.get(ref.occurrenceId));
   if(needsImageBake(style)&&ref.mode==='block'&&mime!=='image/gif'){const output=await wait(effects(bytes,mime,style,readingWidth?.(ref,info.width)));check();geometry=output.geometry;bytes=output.bytes;mime=output.mime;inspectImage(bytes);filename=filename.replace(/\.[^.]*$/,'')+'.png';}
   const key=digest(bytes);const existing=result.get(key);
   if(existing)existing.occurrenceIds.push(ref.occurrenceId);else result.set(key,{key,bytes,mime,filename,...(geometry?{geometry}:{}),occurrenceIds:[ref.occurrenceId]});
  }catch(e){if(e instanceof LayoutError){if(!e.occurrenceIds.length)e.occurrenceIds=[ref.occurrenceId];throw e;}throw new LayoutError('image-read',`图片处理失败：${ref.source}`,[ref.occurrenceId]);}
 }
 return [...result.values()];
}

import type {ImageStyle,ImageGeometry} from '../../core/src/types';
import {normalizeImage} from '../../core/src/styles';
import {LayoutError} from '../../core/src/types';
export function effectBounds(width:number,height:number,style:ImageStyle){const p=imageEffectPlan(width,height,style,width);return{width:p.width,height:p.height,padding:p.padding};}
export function imageEffectPlan(width:number,height:number,style:ImageStyle,displayWidth=Math.min(width,375)){
 const s=normalizeImage(style),bodyWidth=Math.min(width,Math.ceil(displayWidth*2)),scale=bodyWidth/displayWidth,bodyHeight=Math.max(1,Math.round(height*bodyWidth/width));
 // Keep the photo's aspect ratio: shadows and paragraph gaps belong to HTML.
 return {bodyWidth,bodyHeight,scale,padding:0,width:bodyWidth,height:bodyHeight,radius:s.radius*scale,borderWidth:s.borderWidth*scale};
}
export async function renderImageEffect(bytes:Uint8Array,mime:string,style:ImageStyle,displayWidth?:number):Promise<{bytes:Uint8Array;mime:string;geometry?:ImageGeometry}>{
 if(mime==='image/gif')return{bytes,mime};
 const s=normalizeImage(style),bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:mime}));
 try{
  const bounds=imageEffectPlan(bitmap.width,bitmap.height,s,displayWidth);
  if(bounds.width*bounds.height>24_000_000)throw new LayoutError('image-pixels','图片效果像素过大，请缩小原图。');
  const canvas=document.createElement('canvas');canvas.width=bounds.width;canvas.height=bounds.height;const ctx=canvas.getContext('2d');
  if(!ctx)throw new LayoutError('image-canvas','无法处理图片效果，请关闭“固定圆角、边框与底色”后重试。');
  const w=bounds.bodyWidth,h=bounds.bodyHeight,r=Math.min(bounds.radius,w/2,h/2);
  const layer=document.createElement('canvas');layer.width=w;layer.height=h;const image=layer.getContext('2d');
  if(!image)throw new LayoutError('image-canvas','无法生成图片外观，请重试。');
  image.save();image.beginPath();image.roundRect(0,0,w,h,r);image.clip();
  if(s.backgroundMode==='solid'){image.fillStyle=s.background;image.fillRect(0,0,w,h);}
  image.drawImage(bitmap,0,0,w,h);image.restore();
  if(bounds.borderWidth){const b=Math.min(bounds.borderWidth,w,h);image.strokeStyle=s.borderColor;image.lineWidth=b;image.beginPath();image.roundRect(b/2,b/2,w-b,h-b,Math.max(0,r-b/2));image.stroke();}
  ctx.drawImage(layer,0,0);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new LayoutError('image-canvas','图片效果生成失败。')),'image/png'));
  return{bytes:new Uint8Array(await blob.arrayBuffer()),mime:'image/png',geometry:{naturalWidth:bitmap.width,paddingRatio:bounds.padding/w}};
 }finally{bitmap.close();}
}

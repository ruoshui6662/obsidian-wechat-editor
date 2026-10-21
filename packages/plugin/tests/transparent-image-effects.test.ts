// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {renderImageEffect,imageEffectPlan} from '../src/image-effects';
import {normalizeImage} from '../../core/src/styles';
function canvasHarness(){
 const canvases:any[]=[],bitmap={width:1200,height:600,close:vi.fn()};vi.stubGlobal('createImageBitmap',vi.fn(async()=>bitmap));
 const create=document.createElement.bind(document);vi.spyOn(document,'createElement').mockImplementation(((tag:string)=>{
  if(tag!=='canvas')return create(tag);const ctx:any={beginPath:vi.fn(),roundRect:vi.fn(),fill:vi.fn(),fillRect:vi.fn(),save:vi.fn(),clip:vi.fn(),drawImage:vi.fn(),restore:vi.fn(),stroke:vi.fn()};const canvas:any={width:0,height:0,ctx,getContext:()=>ctx,toBlob:(done:any)=>done({arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer})};canvases.push(canvas);return canvas;
 }) as any);return{canvases,bitmap};
}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it('independentSoftnessAndOffsetDetermineRasterGeometryAndPadding',()=>{
 const plan=imageEffectPlan(1200,600,normalizeImage({shadow:6,shadowOpacity:12,shadowBlur:40,shadowOffsetY:10}),343);expect(plan.shadowBlur/plan.scale).toBe(40);expect(plan.shadowOffsetY/plan.scale).toBe(10);expect(plan.shadowOpacity).toBe(12);expect(plan.padding/plan.scale).toBeGreaterThanOrEqual(70);
});
it('preserveModeDrawsAnAlphaLayerWithoutFillingItWhite',async()=>{
 const h=canvasHarness(),style=normalizeImage({radius:4,shadow:6,shadowOpacity:12,shadowBlur:11,shadowOffsetY:1.5,backgroundMode:'preserve'});const result=await renderImageEffect(new Uint8Array([1]),'image/png',style,343);expect(h.canvases).toHaveLength(2);const [output,layer]=h.canvases;expect(layer.ctx.fillRect).not.toHaveBeenCalled();expect(layer.ctx.fill).not.toHaveBeenCalled();expect(layer.ctx.drawImage.mock.calls[0][0]).toBe(h.bitmap);expect(output.ctx.fill).not.toHaveBeenCalled();expect(output.ctx.drawImage.mock.calls[0][0]).toBe(layer);expect(output.ctx.shadowColor).toBe('rgba(0,0,0,0.12)');expect(output.ctx.shadowBlur).toBe(22);expect(output.ctx.shadowOffsetY).toBe(3);expect(result.geometry?.naturalWidth).toBe(1200);expect(h.bitmap.close).toHaveBeenCalledOnce();
});
it('solidCardFillsOnlyItsClippedImageLayerAndRetainsIndependentShadow',async()=>{
 const h=canvasHarness();await renderImageEffect(new Uint8Array([1]),'image/png',normalizeImage({radius:8,shadow:12,shadowOpacity:14,shadowBlur:20,shadowOffsetY:3,backgroundMode:'solid',background:'#ffeedd',borderWidth:1}),343);const [output,layer]=h.canvases;expect(layer.ctx.fillRect).toHaveBeenCalledOnce();expect(layer.ctx.fillStyle).toBe('#ffeedd');expect(layer.ctx.clip).toHaveBeenCalled();expect(layer.ctx.stroke).toHaveBeenCalled();expect(output.ctx.shadowColor).toBe('rgba(0,0,0,0.14)');expect(output.ctx.shadowOffsetY).toBe(6);
});
it('gifPassesThroughWithoutAllocatingAStaticCanvas',async()=>{
 const h=canvasHarness(),bytes=new Uint8Array([1]);expect(await renderImageEffect(bytes,'image/gif',normalizeImage({shadow:6}),343)).toEqual({bytes,mime:'image/gif'});expect(h.canvases).toHaveLength(0);expect(createImageBitmap).not.toHaveBeenCalled();
});

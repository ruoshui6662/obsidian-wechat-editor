// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import {parseArticle} from '../../core/src/parse';
import {renderArticle} from '../../core/src/render';
import {DEFAULT_LAYOUT,normalizeImage} from '../../core/src/styles';
import {softShadow} from '../../core/src/image-appearance';
import {prepareAssets} from '../src/vault-assets';
import {imageEffectPlan} from '../src/image-effects';
it('shadowOnlyKeepsOriginalPhotoBytesInsteadOfUploadingAPaddedPNG',async()=>{
 const bytes=await readFile('fixtures/vault/照片.jpg'),article=parseArticle('文字\n\n![[照片.jpg]] ^pic\n\n下一段','稿.md');
 const effects=vi.fn(async()=>({bytes:new Uint8Array([...bytes,1]),mime:'image/png'}));
 const assets=await prepareAssets(article,async()=>({bytes,filename:'照片.jpg'}),new Map([['img-0',normalizeImage({shadow:6,bakeEffects:true})]]),effects);
 expect(effects).not.toHaveBeenCalled();expect(assets[0].bytes).toEqual(bytes);expect(assets[0].mime).toBe('image/jpeg');expect(assets[0].filename).toBe('照片.jpg');
});
it('evenLargeCustomShadowsCannotAddBlankCanvasAroundRoundedPhotos',()=>{
 const p=imageEffectPlan(1200,600,normalizeImage({radius:4,shadow:30,shadowBlur:80,shadowOffsetY:24,bakeEffects:true}),343);
 expect(p.padding).toBe(0);expect(p.width).toBe(p.bodyWidth);expect(p.height).toBe(p.bodyHeight);
});
it('bakedAndOriginalPhotosBothUseAnEdgeShadowWithoutNegativeSizeCompensation',()=>{
 const article=parseArticle('上一段\n\n![[照片.jpg]] ^pic\n\n下一段','稿.md'),sources=new Map([['img-0','https://mmbiz.qpic.cn/photo']]);
 for(const bake of [false,true]){
  const style=normalizeImage({alignment:'justify',leftInset:16,rightInset:16,shadow:6,...softShadow(6),radius:4,bakeEffects:bake});
  const root=document.createElement('div');root.innerHTML=renderArticle(article,{...DEFAULT_LAYOUT,sidePadding:16},sources,{pic:{image:style}},bake?new Map([['img-0',{naturalWidth:1200,paddingRatio:0}]]):new Map()).html;
  const img=root.querySelector('img')!;expect(img.style.boxShadow).toBe('0 1px 8px rgba(0,0,0,0.1)');expect(img.style.width).toBe('100%');expect(img.style.maxWidth).toBe('100%');expect(img.style.margin).toBe('');expect(img.style.padding).toBe('');expect(root.querySelector('[data-wx-photo]')).toBeNull();
  expect(root.querySelectorAll('p')).toHaveLength(3);expect(root.querySelectorAll('p')[1].style.marginTop).toBe('28px');expect(root.querySelectorAll('p')[2].style.marginTop).toBe('28px');
  expect(root.querySelectorAll('p')[2].textContent).toBe('下一段');
 }
});

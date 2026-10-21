// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {imageEffectPlan} from '../src/image-effects';
import {imageReadingWidth} from '../../core/src/image-geometry';
import {parseArticle} from '../../core/src/parse';
import {renderArticle} from '../../core/src/render';
import {DEFAULT_IMAGE,DEFAULT_LAYOUT} from '../../core/src/styles';
const style={...DEFAULT_IMAGE,alignment:'justify' as const,leftInset:16,rightInset:16,radius:8,shadow:6,bakeEffects:true};
it('uses reading pixels for effects regardless of original resolution',()=>{
 for(const width of [300,1200,2400]){const p=imageEffectPlan(width,width/2,style,343);expect(p.radius/p.scale).toBeCloseTo(8);expect(p.shadowBlur/p.scale).toBeCloseTo(12);expect(p.shadowOffsetY/p.scale).toBeCloseTo(3);expect(p.bodyWidth).toBeLessThanOrEqual(width);expect(p.bodyWidth).toBeLessThanOrEqual(686);expect(p.padding/p.scale).toBeGreaterThanOrEqual(18);}
});
it('reading width respects article margins, nesting, Markdown width and small originals',()=>{
 for(const [source,expected]of [['![[图.png]]',343],['> ![[图.png]]',280],['- ![[图.png]]',287],['![[图.png|120]]',120]] as const){const a=parseArticle(source,'稿.md'),s={...style,alignment:'left' as const};expect(imageReadingWidth(a,a.images[0],{...DEFAULT_LAYOUT,sidePadding:16},s,{},1200)).toBe(expected);}
 const a=parseArticle('![[图.png]]','稿.md');expect(imageReadingWidth(a,a.images[0],DEFAULT_LAYOUT,{...style,alignment:'left'}, {},100)).toBe(100);expect(imageReadingWidth(a,a.images[0],DEFAULT_LAYOUT,style,{},100)).toBe(343);
});
it('baked transparent bounds do not shrink the photograph layout box',()=>{
 const a=parseArticle('![[图.png]] ^pic','稿.md');const html=renderArticle(a,DEFAULT_LAYOUT,new Map([['img-0','https://mmbiz.qpic.cn/p']]),{pic:{image:style}},new Map([['img-0',{naturalWidth:1200,paddingRatio:18/343}]])).html;
 const root=document.createElement('div');root.innerHTML=html;const img=root.querySelector('img')!;expect(img.parentElement!.dataset.wxPhoto).toBe('');expect(img.parentElement!.style.width).toBe('100%');expect(img.style.maxWidth).toBe('none');expect(parseFloat(img.style.width)).toBeGreaterThan(100);expect(parseFloat(img.style.marginLeft)).toBeLessThan(0);
});
it('unbaked and GIF images retain their ordinary rendering contract',()=>{
 const a=parseArticle('![[动图.gif]] ^pic','稿.md');const root=document.createElement('div');root.innerHTML=renderArticle(a,DEFAULT_LAYOUT,new Map([['img-0','https://mmbiz.qpic.cn/p']]),{pic:{image:style}}).html;expect(root.querySelector('[data-wx-photo]')).toBeNull();expect(root.querySelector('img')!.style.boxShadow).toContain('rgba');
});

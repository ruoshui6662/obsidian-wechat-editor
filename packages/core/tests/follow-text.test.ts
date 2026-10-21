import {expect,it} from 'vitest';
import {JSDOM} from 'jsdom';
import {parseArticle} from '../src/parse';
import {renderArticle} from '../src/render';
import {DEFAULT_LAYOUT,imageInsets,mergeImageStyles,normalizeImage} from '../src/styles';
import {imageReadingWidth} from '../src/image-geometry';
import {loadSettings} from '../../plugin/src/settings';
it('absoluteWhitespaceRemainsEightRegardlessOfBodyInset',()=>{
 const s=normalizeImage({alignment:'justify',leftInset:8,rightInset:8});expect(imageInsets(s,16)).toEqual({left:8,right:8});expect(imageInsets(s,32)).toEqual({left:8,right:8});
});
it('followTextUsesBodyEdgesAndReadingWidthWithOrWithoutShadow',()=>{
 const article=parseArticle('正文\n\n![[图.png]] ^pic','稿.md');
 for(const side of [8,16,32])for(const shadow of [0,6]){
  const s=normalizeImage({alignment:'text',leftInset:8,rightInset:8,widthPercent:55,shadow} as any),layout={...DEFAULT_LAYOUT,sidePadding:side};expect(imageInsets(s,side)).toEqual({left:side,right:side});expect(imageReadingWidth(article,article.images[0],layout,s)).toBe(375-side*2);
  const d=new JSDOM(renderArticle(article,layout,new Map([['img-0','https://mmbiz.qpic.cn/a']]),{pic:{image:s}}).html).window.document,img=d.querySelector('img')!;expect(img.style.width).toBe('100%');expect(img.parentElement!.style.marginLeft).toBe('0px');expect(img.parentElement!.style.marginRight).toBe('0px');expect(img.parentElement!.style.textAlign).toBe('left');
 }
});
it('followModeRoundTripsButExplicitLocalInsetsCanStillOverrideTheArticleDefault',()=>{
 const saved=loadSettings({notes:{'稿.md':{overrides:{'*':{image:{alignment:'text',leftInset:null,rightInset:null,marginLeft:0,marginRight:0,shadow:6}},pic:{image:{leftInset:8}}}}},templates:[{id:'t',name:'正文对齐',imageDefault:{alignment:'text'}}]});expect(saved.notes['稿.md'].overrides['*'].image!.alignment).toBe('justify');expect(saved.templates[0].imageDefault!.alignment).toBe('justify');
 const local=mergeImageStyles(saved.notes['稿.md'].overrides['*'].image,saved.notes['稿.md'].overrides.pic.image);expect(local.alignment).toBe('justify');expect(imageInsets(local,16)).toEqual({left:8,right:16});
 expect(mergeImageStyles(saved.notes['稿.md'].overrides['*'].image,{shadow:12}).alignment).toBe('justify');
});

it('legacyTemplateClearsDormantInsetsButLaterLocalOverridesStillWin',()=>{
 const saved=loadSettings({templates:[{id:'t',name:'旧模板',imageDefault:{alignment:'text'}}]});
 const template=saved.templates[0].imageDefault!;
 expect(template).toMatchObject({alignment:'justify',leftInset:null,rightInset:null,marginLeft:0,marginRight:0});
 const base={alignment:'justify' as const,leftInset:8,rightInset:24};
 expect(imageInsets(mergeImageStyles(base,template),16)).toEqual({left:16,right:16});
 expect(imageInsets(mergeImageStyles(base,{alignment:'text'} as any,{leftInset:8}),16)).toEqual({left:8,right:16});
 expect(imageInsets(mergeImageStyles({alignment:'justify',leftInset:8,rightInset:24}),16)).toEqual({left:8,right:24});
});

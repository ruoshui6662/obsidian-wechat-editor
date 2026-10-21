import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { parseArticle } from '../src/parse';
import { DEFAULT_LAYOUT, normalizeLayout } from '../src/styles';
import { renderArticle } from '../src/render';
const body=(s:string)=>new JSDOM(s).window.document.body;
describe('export rendering',()=>{
 it('repeatedImageOccurrencesKeepIndependentIndentAndLayout',()=>{
  const a=parseArticle('![[图.png]] ^first\n\n![[图.png]] ^second','稿.md');
  const out=body(renderArticle(a,{...DEFAULT_LAYOUT,sidePadding:16},new Map(a.images.map(i=>[i.occurrenceId,'https://mmbiz.qpic.cn/shared'])),{first:{image:{marginLeft:12,marginRight:24,widthPercent:65,shadow:8}},second:{image:{marginLeft:0,marginRight:8,widthPercent:40}}}).html);
  const [one,two]=out.querySelectorAll('img');const first=one.parentElement!,second=two.parentElement!;
  expect(first.style.marginLeft).toBe('12px');expect(first.style.marginRight).toBe('24px');expect(second.style.marginLeft).toBe('0px');expect(second.style.marginRight).toBe('8px');
  expect(one.style.width).toBe('65%');expect(two.style.width).toBe('40%');expect(one.style.boxShadow).not.toBe('');expect(two.style.boxShadow).toBe('');
  expect(first.parentElement!.style.marginLeft).toBe('16px');expect(one.src).toBe(two.src);
 });
 it('horizontalInsetSurvivesRemovalOfTheOuterArticleWrapper',()=>{
  const article=parseArticle('第一段\n\n第二段\n\n## 标题\n\n- 列表\n\n> 引用\n\n| 表 |\n|---|\n| 格 |\n\n```js\ncode\n```\n\n---\n\n![[图.png]]','稿.md');
  const el=body(renderArticle(article,{...DEFAULT_LAYOUT,sidePadding:16},new Map([['img-0','https://mmbiz.qpic.cn/test']])).html);
  const root=el.firstElementChild!;root.replaceWith(...root.childNodes);
  const blocks=Array.from(el.children) as HTMLElement[];
  expect(blocks.length).toBeGreaterThan(6);
  for(const block of blocks){expect(block.style.marginLeft,block.outerHTML).toBe('16px');expect(block.style.marginRight,block.outerHTML).toBe('16px');}
  expect(el.querySelector('li [data-wx-block]')!.getAttribute('style')).toContain('margin-left:0px');
  expect(el.querySelector<HTMLParagraphElement>('blockquote p')!.style.marginLeft).toBe('0px');
 });
 it('paragraphSpacingUsesExplicitInlineMarginsAndKeepsZeroSelectable',()=>{
  const article=parseArticle('第一段 ^one\n\n第二段 ^two','稿.md');
  const el=body(renderArticle(article,{...DEFAULT_LAYOUT,spacingMode:'manual',paragraphBefore:4,paragraphAfter:28},new Map(),{two:{text:{paragraphAfter:0}}}).html);
  const [first,second]=el.querySelectorAll('p');
  expect(first.getAttribute('style')).toContain('margin-top:4px;');expect(first.getAttribute('style')).toContain('margin-bottom:28px;');
  expect(second.style.marginBottom).toBe('0px');expect(el.querySelectorAll('p')).toHaveLength(2);
 });
 it('nestedBlocksDoNotMultiplyArticleInset',()=>{
  const el=body(renderArticle(parseArticle('> - 引用中的列表\n>\n> | 表 |\n> |---|\n> | 格 |','稿.md'),{...DEFAULT_LAYOUT,sidePadding:16},new Map()).html);
  expect(el.querySelector('blockquote')!.style.marginLeft).toBe('16px');expect(el.querySelector('ul')!.style.marginLeft).toBe('0px');
  expect(el.querySelector('table')!.style.width).toBe('100%');expect(el.querySelector<HTMLElement>('blockquote [data-wx-block]')!.style.marginLeft).toBe('0px');
 });
 it('optionalTitleSharesInsetWithoutAddingOuterPadding',()=>{
  const el=body(renderArticle(parseArticle('# 标题\n\n正文','稿.md'),{...DEFAULT_LAYOUT,includeTitle:true,sidePadding:16},new Map()).html);
  expect(el.querySelector('h1')!.style.marginLeft).toBe('16px');expect(el.firstElementChild!.getAttribute('style')).toContain('padding:0');
 });
 it('tablesAndListsCarryTheirPreviewStylesInline',()=>{const a=parseArticle('| 左 | 右 |\n|:---|---:|\n| 文 | 字 |\n\n3. 项目\n4. 项目二','稿.md');const el=body(renderArticle(a,DEFAULT_LAYOUT,new Map()).html);expect(el.querySelector('table')!.style.borderCollapse).toBe('collapse');expect(el.querySelector('table')!.style.width).toBe('100%');expect(el.querySelector('td')!.style.border).toBe('1px solid rgb(221, 221, 221)');expect(el.querySelector('td')!.style.padding).toBe('6px');expect(el.querySelectorAll('th')[1].style.textAlign).toBe('right');expect(el.querySelector('ol')!.start).toBe(3);expect(el.querySelector('li')!.style.marginBottom).toBe('6px');});
 it('tightListParagraphsUseBalancedStyledWrappers',()=>{const a=parseArticle('- 第一个 ^item\n- 第二个','稿.md');const html=renderArticle(a,DEFAULT_LAYOUT,new Map(),{item:{text:{fontSize:20}}}).html;const el=body(html);expect(html.match(/<p\b/g)?.length??0).toBe(html.match(/<\/p>/g)?.length??0);expect(el.querySelector('li [data-wx-block]')!.getAttribute('style')).toContain('font-size:20px');expect(el.querySelectorAll('li')).toHaveLength(2);});
 it('unregisteredImageProducesBlockingDiagnosticAndVisiblePlaceholder',()=>{const a=parseArticle('![[图.png]]','稿.md');a.images=[];const result=renderArticle(a,DEFAULT_LAYOUT,new Map());expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({code:'untracked-image',severity:'error'})]));expect(body(result.html).textContent).toContain('未识别的图片');});
 it('defaultBodyMatchesSpec',()=>{
  const el=body(renderArticle(parseArticle('你好 **重点**','稿.md'),DEFAULT_LAYOUT,new Map()).html);
  const p=el.querySelector('p')!;
  expect(p.style.fontSize).toBe('16px');expect(p.style.lineHeight).toBe('1.8');expect(p.style.color).toBe('rgb(51, 51, 51)');expect(p.style.marginBottom).toBe('24px');
  expect(p.style.marginLeft).toBe('8px');expect(p.style.marginRight).toBe('8px');expect(el.querySelector('strong')!.textContent).toBe('重点');
 });
 it('sameSourceDifferentWidth',()=>{
  const a=parseArticle('![[图.png|480]]\n\n![[图.png|240]]','稿.md');
  const out=body(renderArticle(a,DEFAULT_LAYOUT,new Map(a.images.map(i=>[i.occurrenceId,'https://mmbiz.qpic.cn/test']))).html);
  expect([...out.querySelectorAll('img')].map(i=>i.style.width)).toEqual(['480px','240px']);
 });
 it('inlineEmojiIsNotFullWidth',()=>{
  const a=parseArticle('你好 ![[emoji.png]] 世界','稿.md');const img=body(renderArticle(a,DEFAULT_LAYOUT,new Map([['img-0','https://mmbiz.qpic.cn/emoji']])).html).querySelector('img')!;
  expect(img.style.display).toBe('inline-block');expect(img.style.height).toBe('1.5em');expect(img.style.width).toBe('auto');
 });
 it('nestedImagesStayInsideListAndQuote',()=>{
  const a=parseArticle('- ![[a.png]]\n\n> ![[b.png]]','稿.md');const el=body(renderArticle(a,DEFAULT_LAYOUT,new Map(a.images.map(i=>[i.occurrenceId,'https://mmbiz.qpic.cn/i']))).html);
  expect(el.querySelector('li img')).not.toBeNull();expect(el.querySelector('blockquote img')).not.toBeNull();
 });
 it('unsafeLinkIsNotEmitted',()=>{
  const a=parseArticle('[普通外链](https://example.com) [微信](https://mp.weixin.qq.com/s/ok)\n\n<script>alert(1)</script>','稿.md');
  const el=body(renderArticle(a,DEFAULT_LAYOUT,new Map()).html);
  expect(el.querySelector('script')).toBeNull();expect([...el.querySelectorAll('a')].map(x=>x.href)).toEqual(['https://mp.weixin.qq.com/s/ok']);
 });
 it('localImageOverrideWinsAndTitleIsOptional',()=>{
  const a=parseArticle('# 稿\n\n![[a.png|480]] ^pic','稿.md');
  const out=body(renderArticle(a,{...DEFAULT_LAYOUT,includeTitle:true},new Map([['img-0','https://mmbiz.qpic.cn/i']]),{pic:{image:{widthPercent:40}}}).html);
  expect(out.querySelector('h1')!.textContent).toBe('稿');expect(out.querySelector('img')!.style.width).toBe('40%');expect(out.textContent).not.toContain('^pic');
 });
 it('normalizesOutOfRangeAndNonFiniteSettings',()=>{
  const s=normalizeLayout({fontSize:999,lineHeight:NaN,textColor:'red;display:none',sidePadding:-8});
  expect(s.fontSize).toBe(50);expect(s.lineHeight).toBe(1.8);expect(s.textColor).toBe('#333333');expect(s.sidePadding).toBe(0);
 });
 it('emojiExcludedFromApplyAll',()=>{
  const a=parseArticle('文字 ![[e.png]]\n\n![[图.png]]','稿.md');const el=body(renderArticle(a,DEFAULT_LAYOUT,new Map(a.images.map(i=>[i.occurrenceId,'https://mmbiz.qpic.cn/i'])),{'*':{image:{shadow:8,radius:8}}}).html);
  const [emoji,image]=el.querySelectorAll('img');expect(emoji.style.boxShadow).toBe('');expect(image.style.boxShadow).not.toBe('');expect(image.style.borderRadius).toBe('8px');
 });
});
it('justifiedImageFillsOnlyItsInsetAreaAndOverridesMarkdownAndCustomWidths',()=>{
 const article=parseArticle('![[图.png|240]] ^fill\n\n![[图.png|160]] ^other','稿.md');const settings={...DEFAULT_LAYOUT,sidePadding:8};const output=body(renderArticle(article,settings,new Map([['img-0','https://mmbiz.qpic.cn/i'],['img-1','https://mmbiz.qpic.cn/i']]),{fill:{image:{alignment:'justify',widthPercent:40,marginLeft:16,marginRight:24}},other:{image:{widthPercent:65}}}).html);const [filled,other]=output.querySelectorAll('img');expect(filled.style.width).toBe('100%');expect(filled.style.height).toBe('auto');expect(filled.style.display).toBe('block');expect(filled.parentElement!.style.marginLeft).toBe('16px');expect(filled.parentElement!.style.marginRight).toBe('24px');expect(filled.parentElement!.parentElement!.style.marginLeft).toBe('8px');expect(other.style.width).toBe('65%');
});
it('applyAllJustificationStillKeepsInlineImagesInTextFlow',()=>{
 const article=parseArticle('文字 ![[表情.png]]\n\n![[图片.gif|160]]','稿.md');const el=body(renderArticle(article,DEFAULT_LAYOUT,new Map(article.images.map(image=>[image.occurrenceId,'https://mmbiz.qpic.cn/i'])),{'*':{image:{alignment:'justify',marginLeft:16,marginRight:16}}}).html);const [inline,image]=el.querySelectorAll('img');expect(inline.style.width).toBe('auto');expect(inline.style.display).toBe('inline-block');expect(image.style.width).toBe('100%');expect(image.parentElement!.style.marginLeft).toBe('16px');
});
it('wechatNumericRangesAndCustomIndentArePreservedInExportAndNormalization',()=>{
 const layout=normalizeLayout({...DEFAULT_LAYOUT,fontSize:50,sidePadding:48,firstLineIndent:1.5,lineHeight:1.85,letterSpacing:.8,paragraphBefore:40,paragraphAfter:48});expect(layout).toMatchObject({fontSize:50,sidePadding:48,firstLineIndent:1.5});const out=body(renderArticle(parseArticle('## 标题\n\n正文','稿.md'),layout,new Map()).html),p=out.querySelector('p')!;expect(p.style.fontSize).toBe('50px');expect(p.style.marginLeft).toBe('48px');expect(p.style.textIndent).toBe('1.5em');expect(p.style.marginTop).toBe('40px');expect(p.style.marginBottom).toBe('48px');expect(parseFloat(out.querySelector('h2')!.style.fontSize)).toBeGreaterThanOrEqual(50);
});
it('optionalArticleTitleDoesNotShrinkBelowANewlySupportedLargeBodySize',()=>{
 const el=body(renderArticle(parseArticle('# 标题\n\n正文','标题.md'),{...DEFAULT_LAYOUT,fontSize:50,includeTitle:true},new Map()).html);expect(parseFloat(el.querySelector('h1')!.style.fontSize)).toBeGreaterThanOrEqual(50);
});
it('matchingTextAndImageInsetsShareTheSameEdgesInsteadOfAddingTogether',()=>{
 const article=parseArticle('正文\n\n![[图.png]] ^pic','稿.md');
 const layout={...DEFAULT_LAYOUT,textAlign:'justify' as const,sidePadding:16};
 const el=body(renderArticle(article,layout,new Map([['img-0','https://mmbiz.qpic.cn/i']]),{pic:{image:{alignment:'justify',marginLeft:16,marginRight:16,leftInset:16,rightInset:16} as any}}).html);
 const img=el.querySelector('img')!,frame=img.parentElement!,paragraph=frame.parentElement!;
 expect(parseFloat(paragraph.style.marginLeft)+parseFloat(frame.style.marginLeft)).toBe(16);
 expect(parseFloat(paragraph.style.marginRight)+parseFloat(frame.style.marginRight)).toBe(16);
 expect(img.style.width).toBe('100%');
});
it('absoluteImageInsetsAllowZeroAndAsymmetryWithoutChangingInlineEmoji',()=>{
 const article=parseArticle('文字 ![[表情.png]]\n\n![[图.png]] ^pic','稿.md');
 const el=body(renderArticle(article,{...DEFAULT_LAYOUT,sidePadding:16},new Map(article.images.map(i=>[i.occurrenceId,'https://mmbiz.qpic.cn/i'])),{pic:{image:{alignment:'justify',leftInset:0,rightInset:24} as any}}).html);
 const [inline,img]=el.querySelectorAll('img'),frame=img.parentElement!,paragraph=frame.parentElement!;
 expect(parseFloat(paragraph.style.marginLeft)+parseFloat(frame.style.marginLeft)).toBe(0);
 expect(parseFloat(paragraph.style.marginRight)+parseFloat(frame.style.marginRight)).toBe(24);
 expect(inline.style.display).toBe('inline-block');expect(inline.style.width).toBe('auto');
});
it('imageOnlyHeadingsUseTheSameInsetWithoutTextDecorationAddingAnotherOffset',()=>{
 const article=parseArticle('## ![[图.png]] ^pic','稿.md');
 const el=body(renderArticle(article,{...DEFAULT_LAYOUT,themeId:'technology',sidePadding:16},new Map([['img-0','https://mmbiz.qpic.cn/i']]),{pic:{image:{alignment:'justify',leftInset:16,rightInset:16}}}).html);
 const heading=el.querySelector('h2')!,frame=el.querySelector('img')!.parentElement!;
 expect(parseFloat(heading.style.marginLeft)+parseFloat(heading.style.paddingLeft||'0')+parseFloat(heading.style.borderLeftWidth||'0')+parseFloat(frame.style.marginLeft)).toBe(16);
 expect(parseFloat(heading.style.marginRight)+parseFloat(frame.style.marginRight)).toBe(16);
 const legacy=body(renderArticle(article,{...DEFAULT_LAYOUT,themeId:'technology',sidePadding:16},new Map([['img-0','https://mmbiz.qpic.cn/i']])).html),oldHeading=legacy.querySelector('h2')!,oldFrame=legacy.querySelector('img')!.parentElement!;
 expect(oldHeading.style.borderLeftWidth).toBe('3px');expect(oldHeading.style.paddingLeft).toBe('12px');expect(oldFrame.style.marginLeft).toBe('0px');
});

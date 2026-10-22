import {expect,it} from 'vitest';
import {JSDOM} from 'jsdom';
import type {LayoutSettings} from '../src/types';
import {parseArticle} from '../src/parse';
import {renderArticle} from '../src/render';
import {DEFAULT_LAYOUT,normalizeLayout} from '../src/styles';
import {loadSettings} from '../../plugin/src/settings';
import {ARTICLE_THEMES} from '../src/themes';
const layout:LayoutSettings={...DEFAULT_LAYOUT,spacingMode:'smart' as const,paragraphBefore:0,paragraphAfter:28,headingBefore:28,headingAfter:12};
function render(source:string,overrides:any={},settings:LayoutSettings=layout){const article=parseArticle(source,'稿.md');return new JSDOM(renderArticle(article,settings,new Map(article.images.map(i=>[i.occurrenceId,'https://mmbiz.qpic.cn/a'])),overrides).html).window.document;}
it('defaultBodyAndPictureTransitionsUseOne28pxGapAcrossBuiltInThemes',()=>{
 for(const settings of [normalizeLayout(),...ARTICLE_THEMES.map(t=>t.layout)]){
  const d=render('第一行\n同段下一行\n\n第二段\n\n![[图.png]]\n\n第三段',{},settings),paragraphs=[...d.querySelectorAll('p')];
  expect(paragraphs[0].querySelectorAll('br')).toHaveLength(1);expect(paragraphs[0].style.lineHeight).toBe(String(settings.lineHeight));
  expect(paragraphs.slice(1).map(p=>p.style.marginTop)).toEqual(['28px','28px','28px']);expect(paragraphs.slice(0,-1).map(p=>p.style.marginBottom)).toEqual(['0px','0px','0px']);expect(d.querySelector('img')!.parentElement!.style.marginTop).toBe('0px');expect(d.querySelector('img')!.parentElement!.style.marginBottom).toBe('0px');
 }
});
it('smartSpacingAssignsOneGapBetweenBodyHeadingAndBody',()=>{
 const d=render('前文\n\n### 小标题\n\n后文'),[before,after]=d.querySelectorAll('p'),h=d.querySelector('h3')!;expect(before.style.marginBottom).toBe('0px');expect(h.style.marginTop).toBe('28px');expect(h.style.marginBottom).toBe('0px');expect(after.style.marginTop).toBe('12px');expect(after.style.marginBottom).toBe('28px');
});
it('extractedTitleSharesHeadingSpacingWithTheFollowingBodyOrHeading',()=>{
 const settings={...layout,includeTitle:true,paragraphAfter:48,headingBefore:64,headingAfter:8};
 const body=render('# 稿\n\n正文',{},settings);expect(body.querySelector('h1')!.style.marginBottom).toBe('0px');expect(body.querySelector('p')!.style.marginTop).toBe('8px');
 const heading=render('# 稿\n\n### 次标题\n\n正文',{},settings);expect(heading.querySelector('h1')!.style.marginBottom).toBe('0px');expect(heading.querySelector('h3')!.style.marginTop).toBe('64px');
 const only=render('# 稿',{},settings);expect(only.querySelector('h1')!.style.marginTop).toBe('0px');expect(only.querySelector('h1')!.style.marginBottom).toBe('8px');
 const manual=render('# 稿\n\n正文',{}, {...settings,spacingMode:'manual'});expect(manual.querySelector('h1')!.style.marginBottom).toBe('48px');
});
it('pictureParagraphUsesPictureSpacingOnceAndKeepsHorizontalEdges',()=>{
 const d=render('前文\n\n![[图.png]] ^pic\n\n后文',{pic:{image:{alignment:'justify',leftInset:16,rightInset:16,marginBefore:12,marginAfter:20}}});const [before,picture,after]=d.querySelectorAll('p'),frame=d.querySelector('img')!.parentElement!;expect(before.style.marginBottom).toBe('0px');expect(picture.style.marginTop).toBe('28px');expect(picture.style.marginBottom).toBe('0px');expect(frame.style.marginTop).toBe('0px');expect(frame.style.marginBottom).toBe('0px');expect(after.style.marginTop).toBe('20px');expect(frame.style.marginLeft).toBe(`${16-layout.sidePadding}px`);
});
it('multiplePicturesKeepOneInternalGapWithoutAddingParagraphSpacing',()=>{
 const d=render('![[一.png]]\n![[二.png]]\n\n文字');const frames=[...d.querySelectorAll('img')].map(i=>i.parentElement!);expect(frames[0].style.marginTop).toBe('0px');expect(frames[0].style.marginBottom).toBe('0px');expect(frames[1].style.marginTop).toBe('28px');expect(frames[1].style.marginBottom).toBe('0px');expect(d.querySelectorAll('p')[1].style.marginTop).toBe('28px');
});
it('firstHeadingStartsWithoutExtraBlankAndExplicitZeroStillMeansZero',()=>{
 const d=render('### 开头\n\n正文 ^p\n\n### 后标题 ^h',{p:{text:{paragraphAfter:0}},h:{text:{paragraphBefore:0,paragraphAfter:0}}});const [first,last]=d.querySelectorAll('h3');expect(first.style.marginTop).toBe('0px');expect(last.style.marginTop).toBe('0px');expect(last.style.marginBottom).toBe('0px');
});
it('manualModeRetainsIndependentTextAndPictureMargins',()=>{
 const d=render('正文\n\n![[图.png]]',{}, {...layout,spacingMode:'manual'});const [body,picture]=d.querySelectorAll('p');expect(body.style.marginBottom).toBe('28px');expect(picture.style.marginBottom).toBe('28px');expect(d.querySelector('img')!.parentElement!.style.marginTop).toBe('28px');
});
it('nestedBlocksAndInlineEmojiKeepTheirOwnStructure',()=>{
 const d=render('前文\n\n> 引用\n>\n> ![[图.png]]\n\n- 列表 ![[表情.png]]\n\n| 表头 |\n|---|\n| 内容 |\n\n### 末标题');expect(d.querySelector<HTMLElement>('blockquote')!.style.marginTop).toBe('28px');expect(d.querySelector<HTMLElement>('blockquote p')!.style.marginBottom).toBe('28px');expect(d.querySelector('blockquote img')!.parentElement!.style.marginTop).toBe('28px');expect(d.querySelector<HTMLImageElement>('li img')!.style.display).toBe('inline-block');expect(d.querySelectorAll('td')).toHaveLength(1);expect(d.querySelector('h3')!.style.marginTop).toBe('28px');
});
it('spacingDefaultsAndCustomRulesSurviveSettingsAndSchemeRoundTrip',()=>{
 expect(normalizeLayout()).toMatchObject({spacingMode:'smart',headingBefore:28,headingAfter:12});expect(normalizeLayout({headingBefore:999,headingAfter:-1} as any)).toMatchObject({headingBefore:64,headingAfter:0});const settings=loadSettings({notes:{'稿.md':{layout:{spacingMode:'manual',headingBefore:32,headingAfter:16},overrides:{}}},templates:[{id:'t',name:'个人方案',layout:{spacingMode:'smart',headingBefore:24,headingAfter:8}}]});expect(settings.notes['稿.md'].layout).toMatchObject({spacingMode:'manual',headingBefore:32,headingAfter:16});expect(settings.templates[0].layout).toMatchObject({spacingMode:'smart',headingBefore:24,headingAfter:8});
});

it('upgradesSaved24pxDefaultsOnceWithoutChangingOtherTypographyOrCustomGaps',()=>{
 const s=loadSettings({layout:{paragraphAfter:24,lineHeight:1.75},notes:{'稿.md':{layout:{paragraphAfter:24},overrides:{'*':{image:{marginBefore:24,marginAfter:24}},pic:{image:{marginBefore:24,marginAfter:24}},custom:{image:{marginBefore:12,marginAfter:36}},text:{text:{paragraphAfter:24}}}}},templates:[{id:'t',name:'方案',layout:{paragraphAfter:24},imageDefault:{marginBefore:24,marginAfter:24}}]});
 expect(s.layout).toMatchObject({paragraphBefore:0,paragraphAfter:28,lineHeight:1.75,headingAfter:12});expect(s.notes['稿.md'].layout!.paragraphAfter).toBe(28);
 for(const key of ['*','pic'])expect(s.notes['稿.md'].overrides[key].image).toMatchObject({marginBefore:28,marginAfter:28});
 expect(s.notes['稿.md'].overrides.custom.image).toMatchObject({marginBefore:12,marginAfter:36});expect(s.notes['稿.md'].overrides.text.text!.paragraphAfter).toBe(28);
 expect(s.templates[0].layout.paragraphAfter).toBe(28);expect(s.templates[0].imageDefault).toMatchObject({marginBefore:28,marginAfter:28});
 s.layout.paragraphAfter=24;s.notes['稿.md'].overrides.pic.image!.marginBefore=24;
 const reloaded=loadSettings(JSON.parse(JSON.stringify(s)));expect(reloaded.layout.paragraphAfter).toBe(24);expect(reloaded.notes['稿.md'].overrides.pic.image!.marginBefore).toBe(24);
});

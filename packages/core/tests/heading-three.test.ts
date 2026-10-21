import {expect,it} from 'vitest';
import {JSDOM} from 'jsdom';
import {parseArticle} from '../src/parse';
import {renderArticle} from '../src/render';
import {DEFAULT_LAYOUT,normalizeLayout,imageContainerInset} from '../src/styles';
import {loadSettings} from '../../plugin/src/settings';
const doc=(source:string,layout=DEFAULT_LAYOUT)=>new JSDOM(renderArticle(parseArticle(source,'稿.md'),layout,new Map()).html).window.document;
it('thirdLevelHeadingDefaultsTo18pxIndependentlyOfBodySizeAndKeepsHeadingLevels',()=>{
 const d=doc('## 二级标题\n\n### 三级标题\n\n正文',{...DEFAULT_LAYOUT,fontSize:15});expect(d.querySelector('h3')!.style.fontSize).toBe('18px');expect(d.querySelector('p')!.style.fontSize).toBe('15px');expect(d.querySelector('h2')!.style.fontSize).toBe('20px');expect(d.querySelector('h3')!.style.fontWeight).toBe('600');
});
it.each(['daily','technology','warm'] as const)('thirdLevelHeadingUsesBlueCutSegmentsInEveryTheme: %s',themeId=>{
 const d=doc('### 标题 **重点**',{...DEFAULT_LAYOUT,themeId});const h=d.querySelector('h3')!,bar=h.querySelector<HTMLElement>('[data-wx-heading-bar]')!;expect(bar).not.toBeNull();expect(bar.style.width).toBe('4px');expect(bar.style.height).toBe('16px');expect(bar.style.backgroundColor).toBe('');const pieces=[...bar.children] as HTMLElement[];expect(pieces).toHaveLength(3);expect(pieces.map(p=>p.style.height)).toEqual(['6px','4px','2px']);expect(pieces.map(p=>p.style.backgroundColor)).toEqual(['rgb(52, 120, 246)','rgb(107, 157, 249)','rgb(155, 189, 251)']);expect(pieces.map(p=>p.style.marginTop)).toEqual(['0px','2px','2px']);expect(pieces.every(p=>p.style.display==='block'&&p.style.borderRadius==='1px')).toBe(true);expect(h.style.paddingLeft).toBe('12px');expect(bar.style.marginLeft).toBe('-12px');expect(bar.style.marginRight).toBe('8px');expect(bar.getAttribute('aria-hidden')).toBe('true');expect(d.querySelector('style')).toBeNull();expect(h.textContent).toBe('标题 重点');
});
it('customSizeAndBarOffRoundTripThroughExistingSettingsAndTemplates',()=>{
 const raw={notes:{'稿.md':{layout:{h3FontSize:22,h3AccentBar:false},overrides:{}}},templates:[{id:'t',name:'标题方案',layout:{h3FontSize:20,h3AccentBar:false}}]};const saved=loadSettings(JSON.parse(JSON.stringify(raw)));expect(saved.notes['稿.md'].layout).toMatchObject({h3FontSize:22,h3AccentBar:false});expect(saved.templates[0].layout).toMatchObject({h3FontSize:20,h3AccentBar:false});const d=doc('### 标题',normalizeLayout(saved.notes['稿.md'].layout));expect(d.querySelector('h3')!.style.fontSize).toBe('22px');expect(d.querySelector('[data-wx-heading-bar]')).toBeNull();expect(d.querySelector('h3')!.style.paddingLeft).toBe('');
});
it('oldSettingsGetSafeHeadingDefaultsAndInvalidValuesAreClamped',()=>{
 expect(loadSettings({layout:{fontSize:15}}).layout).toMatchObject({h3FontSize:18,h3AccentBar:true});expect(normalizeLayout({h3FontSize:999,h3AccentBar:'false'} as any)).toMatchObject({h3FontSize:50,h3AccentBar:true});expect(normalizeLayout({h3FontSize:NaN} as any).h3FontSize).toBe(18);
});
it('imageOnlyHeadingsDoNotGainAnEmptyDecorativeLineButTextWithEmojiKeepsTheBar',()=>{
 const d=doc('### ![[图.png]]\n\n### 标题 ![[表情.png]]');const [image,text]=d.querySelectorAll('h3');expect(!!image.querySelector('[data-wx-heading-bar]')).toBe(false);expect(image.style.paddingLeft).toBe('');const a=parseArticle('### ![[图.png]] ^pic','稿.md'),layout={...DEFAULT_LAYOUT,sidePadding:16};expect(imageContainerInset(a.blocks[0],layout)).toEqual({left:16,right:16});const aligned=new JSDOM(renderArticle(a,layout,new Map([['img-0','https://mmbiz.qpic.cn/a']]),{pic:{image:{alignment:'justify',leftInset:16,rightInset:16}}}).html).window.document;expect(aligned.querySelector('img')!.parentElement!.style.marginLeft).toBe('0px');expect(aligned.querySelector('img')!.parentElement!.style.marginRight).toBe('0px');expect(text.querySelector('[data-wx-heading-bar]')).not.toBeNull();expect(text.querySelector('img')!.style.display).toBe('inline-block');
});

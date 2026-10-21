import {expect,it} from 'vitest';
import {JSDOM} from 'jsdom';
import {normalizeLayout} from '../src/styles';
import {parseArticle} from '../src/parse';
import {renderArticle} from '../src/render';

it('themeSurvivesNormalizationAndUnsafeThemeIdsAreDropped',()=>{
 expect(normalizeLayout({themeId:'technology'} as any)).toHaveProperty('themeId','technology');
 expect(normalizeLayout({themeId:'<style>bad</style>'} as any)).not.toHaveProperty('themeId');
});
it('themeDecoratesHeadingsQuotesTablesAndCodeWithExportableInlineStyles',()=>{
 const article=parseArticle('## 产品观察\n\n正文 **重点**\n\n> 引用\n\n- 列表\n\n| 参数 |\n|---|\n| 数值 |\n\n```js\nhello\n```','稿.md');
 const html=renderArticle(article,normalizeLayout({themeId:'technology'} as any),new Map()).html;
 const document=new JSDOM(html).window.document;
 expect(document.querySelector('h2')!.style.borderLeft).toContain('rgb(35, 74, 119)');
 expect(document.querySelector('blockquote')!.style.background).toBe('rgb(241, 246, 252)');
 expect(document.querySelector('th')!.style.background).toBe('rgb(241, 246, 252)');
 expect(document.querySelector('strong')!.style.color).toBe('rgb(35, 74, 119)');
 expect(document.querySelector('pre')!.style.background).toBe('rgb(241, 246, 252)');
 expect(document.querySelector('style')).toBeNull();
});
it('localHeadingColorIsValidatedBeforeOverridingThemeAccent',()=>{
 const article=parseArticle('## 标题 ^heading','稿.md'),layout=normalizeLayout({themeId:'technology'} as any);
 const bad=renderArticle(article,layout,new Map(),{heading:{text:{textColor:'red;background:hotpink' as any}}}).html;
 expect(bad).not.toContain('hotpink');
 const good=new JSDOM(renderArticle(article,layout,new Map(),{heading:{text:{textColor:'#123456'}}}).html).window.document;
 expect(good.querySelector('h2')!.style.color).toBe('rgb(18, 52, 86)');
});

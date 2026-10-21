import {it,expect} from 'vitest';
import {normalizeLayout,textCSS,DEFAULT_LAYOUT} from '../src/styles';
import type {LayoutSettings} from '../src/types';
import {parseArticle} from '../src/parse';
import {renderArticle} from '../src/render';
it.each([['system','system-ui'],['source-han-serif','Source Han Serif SC'],['sans','PingFang SC'],['serif','Songti SC']])('font %s survives normalization and reaches exported inline CSS', (font,family)=>{
 const layout=normalizeLayout({fontFamily:font as LayoutSettings['fontFamily']});expect(layout.fontFamily).toBe(font);expect(textCSS(layout)).toContain(family);
 const result=renderArticle(parseArticle('第一段\n\n> 引用\n\n| 表 |\n|---|\n| 内容 |','稿.md'),layout,new Map());expect(result.html).toContain('font-family:');expect(result.html).toContain(family);
});
it('invalidFontCannotInjectCSSOrChangeExistingDefault',()=>{
 for(const font of ['serif;display:none','__proto__','toString',null,99])expect(normalizeLayout({fontFamily:font as any}).fontFamily).toBe(DEFAULT_LAYOUT.fontFamily);
 expect(DEFAULT_LAYOUT.fontFamily).toBe('sans');
});

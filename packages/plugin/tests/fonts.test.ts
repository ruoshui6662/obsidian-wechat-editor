// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {LayoutPanel} from '../src/view';
import {loadSettings} from '../src/settings';
import {DEFAULT_LAYOUT} from '../../core/src/styles';
import {parseArticle} from '../../core/src/parse';
it('newFontsSurviveSettingsRoundTripForNotesTemplatesAndLocalOverrides',()=>{
 const input={layout:{fontFamily:'system'},notes:{'稿.md':{layout:{fontFamily:'source-han-serif'},overrides:{one:{text:{fontFamily:'source-han-serif'}}}}},templates:[{id:'a',name:'方案',layout:{fontFamily:'source-han-serif'}}]};const saved=loadSettings(JSON.parse(JSON.stringify(input)));expect(saved.layout.fontFamily).toBe('system');expect(saved.notes['稿.md'].layout!.fontFamily).toBe('source-han-serif');expect(saved.notes['稿.md'].overrides.one.text!.fontFamily).toBe('source-han-serif');expect(saved.templates[0].layout.fontFamily).toBe('source-han-serif');
});
it('fontSelectorAddsSystemAndSourceHanAndExplainsLocalFontFallback',()=>{
 const root=document.createElement('div'),changeLayout=vi.fn(),p=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},getPairingInfo:async()=>'{}',copyPairing:async()=>{},changeLayout,refresh:()=>{}});const state={article:parseArticle('正文','稿.md'),layout:DEFAULT_LAYOUT,overrides:{},sources:new Map(),account:null,pairingReady:false};p.setState(state);const select=root.querySelector<HTMLSelectElement>('[data-setting=fontFamily]')!;expect([...select.options].map(o=>o.textContent)).toEqual(['系统默认','系统黑体','系统宋体','思源宋体']);select.value='source-han-serif';select.dispatchEvent(new Event('change'));expect(changeLayout).toHaveBeenCalledWith({fontFamily:'source-han-serif'});p.setState({...state,layout:{...DEFAULT_LAYOUT,fontFamily:'source-han-serif' as any}});const hint=root.querySelector<HTMLElement>('[data-font-hint]')!;expect(hint.hidden).toBe(false);expect(hint.textContent).toContain('本机');expect(hint.textContent).toContain('回退');p.showPage('preview');expect(root.querySelector('.wx-paper')!.shadowRoot!.querySelector('p')!.style.fontFamily).toContain('Source Han Serif SC');p.destroy();
});

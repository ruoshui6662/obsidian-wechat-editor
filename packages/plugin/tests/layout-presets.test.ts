// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {LayoutPanel,type PanelState} from '../src/view';
import {DEFAULT_LAYOUT} from '../../core/src/styles';
import {parseArticle} from '../../core/src/parse';
import {loadSettings} from '../src/settings';
const panels:LayoutPanel[]=[];
afterEach(()=>{panels.splice(0).forEach(p=>p.destroy());document.body.replaceChildren();});
function setup(){const root=document.createElement('div');document.body.append(root);let state:PanelState={article:parseArticle('正文','稿.md'),layout:DEFAULT_LAYOUT,overrides:{},sources:new Map(),account:null,pairingReady:false};const changed=vi.fn(patch=>{state={...state,layout:{...state.layout,...patch}};p.setState(state);});const p=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},getPairingInfo:async()=>'{}',copyPairing:async()=>{},changeLayout:changed,refresh:()=>{}});panels.push(p);p.setState(state);return{p,root,changed,state:()=>state};}
it.each([
 ['fontSize',[10,11,12,13,14,15,16,17,18,19,20,24,28,32,36]],
 ['sidePadding',[0,8,16,32,48]],
 ['paragraphBefore',[0,8,16,24,32,40,48]],
 ['paragraphAfter',[0,8,16,24,32,40,48]],
 ['letterSpacing',[0,.5,1,2]],
 ['lineHeight',[1,1.5,1.75,2,2.5,3]],
 ['firstLineIndent',[0,2]],
]as const)('%s provides screenshot values plus manual entry', (key,values)=>{
 const s=setup(),select=s.root.querySelector<HTMLSelectElement>(`[data-number-select=${key}]`)!;expect(select).not.toBeNull();expect([...select.options].map(o=>o.value)).toEqual([...values.map(String),'manual']);select.value=String(values[values.length-1]);select.dispatchEvent(new Event('change'));expect(s.changed).toHaveBeenCalledWith({[key]:values[values.length-1]});expect(s.root.querySelector<HTMLElement>(`[data-number-input=${key}]`)!.hidden).toBe(true);
});
it('manualFontSizeAccepts50pxAndSurvivesStateRefreshPageSwitchAndSettingsReload',()=>{
 const s=setup(),select=s.root.querySelector<HTMLSelectElement>('[data-number-select=fontSize]')!;select.value='manual';select.dispatchEvent(new Event('change'));const input=s.root.querySelector<HTMLInputElement>('[data-setting=fontSize]')!;expect(document.activeElement).toBe(input);input.value='50';input.dispatchEvent(new Event('input'));expect(s.state().layout.fontSize).toBe(50);s.p.setState({...s.state(),account:{id:'a',name:'刷新'}});expect(s.root.querySelector('[data-setting=fontSize]')).toBe(input);s.p.showPage('preview');expect(s.root.querySelector('.wx-paper')!.shadowRoot!.querySelector('p')!.style.fontSize).toBe('50px');s.p.showPage('editor');expect(input.value).toBe('50');const restored=loadSettings({notes:{'稿.md':{layout:s.state().layout,overrides:{}}}});expect(restored.notes['稿.md'].layout!.fontSize).toBe(50);
});
it('fractionalManualValuesAreRetainedWithoutUnitConfusionAndEmptyIsNotZero',()=>{
 const s=setup();for(const [key,value]of [['lineHeight',1.85],['letterSpacing',.8],['firstLineIndent',1.5]]){const select=s.root.querySelector<HTMLSelectElement>(`[data-number-select=${key}]`)!;select.value='manual';select.dispatchEvent(new Event('change'));const input=s.root.querySelector<HTMLInputElement>(`[data-setting=${key}]`)!;input.value=String(value);input.dispatchEvent(new Event('input'));input.value='';input.dispatchEvent(new Event('input'));input.dispatchEvent(new Event('change'));expect(input.value).toBe(String(value));}const loaded=loadSettings({notes:{'稿.md':{layout:s.state().layout,overrides:{}}}});expect(loaded.notes['稿.md'].layout).toMatchObject({lineHeight:1.85,letterSpacing:.8,firstLineIndent:1.5});
});
it('manualModeResetsToTheNewNotesValueWithoutCarryingThePreviousNoteUI',()=>{
 const s=setup();s.p.setState({...s.state(),layout:{...DEFAULT_LAYOUT,fontSize:23}});expect(s.root.querySelector<HTMLSelectElement>('[data-number-select=fontSize]')!.value).toBe('manual');s.p.setState({...s.state(),article:parseArticle('另一篇','另一篇.md'),layout:DEFAULT_LAYOUT});expect(s.root.querySelector<HTMLSelectElement>('[data-number-select=fontSize]')!.value).toBe('16');expect(s.root.querySelector<HTMLElement>('[data-number-input=fontSize]')!.hidden).toBe(true);
});
it('switchingNotesDiscardsTheOldFocusedDraftBeforeManualEntryInTheNewNote',()=>{
 const s=setup();s.p.setState({...s.state(),layout:{...DEFAULT_LAYOUT,fontSize:23}});const select=s.root.querySelector<HTMLSelectElement>('[data-number-select=fontSize]')!;select.value='manual';select.dispatchEvent(new Event('change'));const input=s.root.querySelector<HTMLInputElement>('[data-setting=fontSize]')!;input.value='27';s.p.setState({...s.state(),article:parseArticle('另一篇','另一篇.md'),layout:DEFAULT_LAYOUT});select.value='manual';select.dispatchEvent(new Event('change'));expect(input.value).toBe('16');input.value='';input.dispatchEvent(new Event('change'));expect(input.value).toBe('16');
});
it('localIndentSelectorCanDisplayTheGlobalCustomIndent',()=>{
 const s=setup();s.p.setState({...s.state(),layout:{...DEFAULT_LAYOUT,firstLineIndent:1.5}});s.p.selectBlock('block-0',null);expect(s.root.querySelector<HTMLSelectElement>('[data-setting=localIndent]')!.value).toBe('1.5');
});
it('thirdLevelHeadingControlsOffer18pxManualValuesAndBarStylesWithLivePreview',()=>{
 const s=setup(),select=s.root.querySelector<HTMLSelectElement>('[data-number-select=h3FontSize]')!;expect(select).not.toBeNull();expect([...select.options].map(o=>o.value)).toEqual(['16','18','20','22','24','manual']);expect(select.value).toBe('18');select.value='manual';select.dispatchEvent(new Event('change'));const input=s.root.querySelector<HTMLInputElement>('[data-setting=h3FontSize]')!;input.value='19';input.dispatchEvent(new Event('input'));expect(s.state().layout.h3FontSize).toBe(19);const bar=s.root.querySelector<HTMLSelectElement>('[data-setting=h3AccentBar]')!;expect(bar).not.toBeNull();expect([...bar.options].map(o=>o.textContent)).toEqual(['蓝色分段','无装饰']);bar.value='false';bar.dispatchEvent(new Event('change'));expect(s.changed).toHaveBeenCalledWith({h3AccentBar:false});s.p.setState({...s.state(),article:parseArticle('### 测试标题','稿.md')});s.p.showPage('preview');expect(s.root.querySelector('.wx-paper')!.shadowRoot!.querySelector('h3')!.style.fontSize).toBe('19px');expect(s.root.querySelector('.wx-paper')!.shadowRoot!.querySelector('[data-wx-heading-bar]')).toBeNull();
});
it('spacingControlsOfferAutomaticAndManualRulesAndIndependentHeadingGaps',()=>{
 const s=setup(),mode=s.root.querySelector<HTMLSelectElement>('[data-setting=spacingMode]')!;expect(mode).not.toBeNull();mode.value='manual';mode.dispatchEvent(new Event('change'));expect(s.changed).toHaveBeenCalledWith({spacingMode:'manual'});for(const [key,value]of [['headingBefore','32'],['headingAfter','16']]){const select=s.root.querySelector<HTMLSelectElement>(`[data-number-select=${key}]`)!;expect(select).not.toBeNull();select.value=value;select.dispatchEvent(new Event('change'));expect(s.changed).toHaveBeenCalledWith({[key]:Number(value)});}
});

// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {LayoutPanel,type PanelState} from '../src/view';
import {PresetNumberControl} from '../src/controls';
import {DEFAULT_LAYOUT} from '../../core/src/styles';
import {parseArticle} from '../../core/src/parse';
const panels:LayoutPanel[]=[];
afterEach(()=>{panels.splice(0).forEach(p=>p.destroy());document.body.replaceChildren();});
function setup(){
 const root=document.createElement('div');document.body.append(root);const changed=vi.fn();const p=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},getPairingInfo:async()=>'{}',copyPairing:async()=>{},changeLayout:changed,refresh:()=>{},changeBlock:async()=>{}});panels.push(p);
 const state:PanelState={article:parseArticle('正文\n\n![[附件/配图.png]] ^a','稿.md'),layout:DEFAULT_LAYOUT,overrides:{},sources:new Map(),account:{id:'a',name:'测试'},pairingReady:true};p.setState(state);return{root,p,state,changed};
}
it('manualEntryReplacesTheSelectInItsOriginalRowAndEnterCommits',()=>{
 const root=document.createElement('div');document.body.append(root);const changed=vi.fn(),control=new PresetNumberControl(root,'字号','fontSize',16,[14,16,18],10,50,changed,{presentation:'select',unit:'px'});
 const select=root.querySelector<HTMLSelectElement>('[data-number-select]')!;select.value='manual';select.dispatchEvent(new Event('change'));expect(select.hidden).toBe(true);expect(control.input.parentElement!.parentElement).toBe(select.parentElement);expect(document.activeElement).toBe(control.input);control.input.value='23';control.input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));expect(changed).toHaveBeenCalledWith(23);
 root.querySelector<HTMLButtonElement>('[data-number-manual]')!.click();expect(select.hidden).toBe(false);select.value='18';select.dispatchEvent(new Event('change'));expect(changed).toHaveBeenLastCalledWith(18);
});
it('advancedTextFieldsStayMountedAndDisclosuresSurviveSelectionAndTabChanges',()=>{
 const s=setup(),settings=s.root.querySelector<HTMLDetailsElement>('.wx-settings')!,more=s.root.querySelector<HTMLDetailsElement>('[data-text-more]');expect(more).not.toBeNull();expect(more!.open).toBe(false);const spacing=more!.querySelector('[data-setting=letterSpacing]');expect(spacing).not.toBeNull();expect(more!.querySelector('[data-setting=firstLineIndent]')).not.toBeNull();expect(more!.querySelector('[data-setting=textAlign]')).not.toBeNull();expect(more!.querySelector('[data-setting=includeTitle]')).not.toBeNull();more!.open=true;settings.open=false;s.p.selectImage('img-0');expect(settings.open).toBe(false);s.p.showPage('preview');s.p.setState({...s.state,account:{id:'a',name:'新账号'}});s.p.showPage('editor');expect(more!.open).toBe(true);expect(more!.querySelector('[data-setting=letterSpacing]')).toBe(spacing);
});
it('imageCardShowsScopeWithoutRequiringAFilenamePicker',()=>{
 const s=setup();expect(s.root.querySelector('[data-image-picker]')).toBeNull();expect(s.root.querySelector('[data-selection-title]')!.textContent).toBe('图片排版');s.p.selectImage('img-0');expect(s.root.querySelector('[data-image-scope]')!.textContent).toContain('仅这张');
});
it('effectSummaryAndAutomaticWidthReflectActualValuesWithoutASecondToggle',()=>{
 const s=setup();s.p.selectImage('img-0');const details=s.root.querySelector<HTMLDetailsElement>('[data-image-effects]');expect(details).not.toBeNull();expect(details!.open).toBe(false);s.p.setState({...s.state,overrides:{a:{image:{radius:8,shadow:12,alignment:'justify',widthPercent:55}}}});expect(s.root.querySelector('[data-image-effect-summary]')!.textContent).toContain('圆角 8 px');expect(s.root.querySelector('[data-image-effect-summary]')!.textContent).toContain('阴影 12');expect(s.root.querySelector('[data-image-width-status]')).toBeNull();expect(s.root.querySelector('[data-setting=imageWidth]')!.closest<HTMLElement>('.wx-field')!.hidden).toBe(true);expect(s.root.querySelector('[data-image-preset=floating]')!.getAttribute('aria-pressed')).toBe('false');details!.open=true;s.p.setState({...s.state,overrides:{a:{image:{radius:8,shadow:12}}}});expect(details!.open).toBe(true);expect(s.root.querySelector('[data-setting=imageWidth]')!.closest<HTMLElement>('.wx-field')!.hidden).toBe(false);expect(details!.querySelector('[data-setting=borderWidth]')).not.toBeNull();expect(details!.querySelector('[data-setting=marginBefore]')).toBeNull();expect(s.root.querySelector('[data-setting=marginBefore]')!.closest('section')!.getAttribute('aria-label')).toBe('尺寸与位置');
});
it('footerOffersLightweightSavedStateAndReadableErrorDetailsAcrossPages',()=>{
 const s=setup();expect(s.root.querySelector('[role=status]')!.textContent).toContain('已保存');const error='磁盘无法保存。'.repeat(60);s.p.setState({...s.state,saveError:error});const details=s.root.querySelector<HTMLDetailsElement>('[data-status-details]');expect(details).not.toBeNull();expect(details!.textContent).toContain(error);s.p.showPage('preview');expect(s.root.querySelector<HTMLButtonElement>('[data-action=retry-save]')!.hidden).toBe(false);expect(s.root.querySelector('[data-status-details]')).toBe(details);
});
it('schemeActionsUseANativeMenuAndStaleMenuActionsCannotTargetAnotherNote',async()=>{
 const {Menu}=await import('../../../tests/helpers/obsidian');const root=document.createElement('div');document.body.append(root);const edit=vi.fn(),remove=vi.fn();const p=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},getPairingInfo:async()=>'{}',copyPairing:async()=>{},changeLayout:()=>{},refresh:()=>{},editTemplate:edit,deleteTemplate:remove});panels.push(p);const template={id:'daily',name:'日常',layout:DEFAULT_LAYOUT,headerMarkdown:'',footerMarkdown:''},state:PanelState={article:parseArticle('正文','稿.md'),layout:DEFAULT_LAYOUT,overrides:{},sources:new Map(),account:null,pairingReady:false,templateId:'daily',templates:[template]};p.setState(state);root.querySelector<HTMLButtonElement>('[data-action=more]')!.click();const menu=Menu.latest!;expect(menu.items.map(i=>i.title)).toEqual(['编辑头尾内容','恢复主题','删除方案…']);expect(remove).not.toHaveBeenCalled();p.setState({...state,article:parseArticle('另一篇','其他.md')});menu.items[2].click();expect(remove).not.toHaveBeenCalled();root.querySelector<HTMLButtonElement>('[data-action=more]')!.click();Menu.latest!.items[2].click();expect(remove).toHaveBeenCalledWith('daily');
});
it('imageEffectsDisclosureRemainsOpenWhenSelectingAnotherImageAndReturning',()=>{
 const s=setup();s.p.setState({...s.state,article:parseArticle('![[A.png]] ^a\n\n![[B.png]] ^b','稿.md')});s.p.selectImage('img-0');s.root.querySelector<HTMLDetailsElement>('[data-image-effects]')!.open=true;s.p.selectImage('img-1');expect(s.root.querySelector<HTMLDetailsElement>('[data-image-effects]')!.open).toBe(true);s.p.selectImage('img-0');expect(s.root.querySelector<HTMLDetailsElement>('[data-image-effects]')!.open).toBe(true);
});
it('longErrorDetailsHaveAnExplicitKeyboardScrollingAndSelectionTarget',()=>{
 const s=setup();s.p.setState({...s.state,saveError:'错误详情。'.repeat(120)});const details=s.root.querySelector<HTMLDetailsElement>('[data-status-details]')!;details.open=true;const message=details.querySelector<HTMLElement>('[data-status-message]')!;expect(message.tabIndex).toBe(0);expect(message.getAttribute('aria-label')).toBe('完整状态信息');message.focus();expect(document.activeElement).toBe(message);
});

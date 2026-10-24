// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {LayoutPanel,type PanelHost,type PanelState} from '../src/view';
import {parseArticle} from '../../core/src/parse';
import {DEFAULT_LAYOUT} from '../../core/src/styles';
import {Menu} from '../../../tests/helpers/obsidian';
const panels:LayoutPanel[]=[];
afterEach(()=>{panels.splice(0).forEach(p=>p.destroy());document.body.replaceChildren();});
function setup(host:Partial<PanelHost>={}){
 const root=document.createElement('div');document.body.append(root);const p=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},getPairingInfo:async()=>'{}',copyPairing:async()=>{},changeLayout:()=>{},refresh:()=>{},...host});panels.push(p);
 const state:PanelState={article:parseArticle('![[图.png]] ^a\n\n![[图.png]] ^b','稿.md'),layout:DEFAULT_LAYOUT,overrides:{},sources:new Map(),account:null,pairingReady:true};p.setState(state);return{root,p,state};
}
it('fiveBuiltinsShareTheExistingSchemeEntryAndPreviewRemainsArticleOnly',()=>{
 const apply=vi.fn(),s=setup({applyArticleTheme:apply});const select=s.root.querySelector<HTMLSelectElement>('[data-template]')!;
 expect([...select.options].filter(o=>o.value.startsWith('theme:')).map(o=>o.text)).toEqual(['日常简洁','极简留白','科技蓝','宋韵阅读','温暖手记']);
 select.value='theme:technology';select.dispatchEvent(new Event('change'));expect(apply).toHaveBeenCalledWith('technology');
 expect(s.root.querySelector('[data-page=preview] select')).toBeNull();
});
it('imageDefaultsAndClickedImageUseOneInspectorWithoutAnOccurrencePicker',async()=>{
 const all=vi.fn().mockResolvedValue(true),local=vi.fn().mockResolvedValue(undefined),s=setup({changeAllImages:all,changeBlock:local});
 expect(s.root.querySelector('[data-image-picker]')).toBeNull();expect(s.root.querySelector('[data-image-scope]')!.textContent).toContain('整篇图片');
 const radius=s.root.querySelector<HTMLInputElement>('[data-setting=radius]')!;radius.value='8';radius.dispatchEvent(new Event('input'));await vi.waitFor(()=>expect(all).toHaveBeenCalledWith(expect.objectContaining({radius:8}),'default'));
 await vi.waitFor(()=>expect(s.root.querySelector('[data-image-status]')!.textContent).toContain('已保存'));s.p.selectImage('img-1');expect(s.root.querySelector('[data-image-scope]')!.textContent).toContain('当前图片');
 const shadow=s.root.querySelector<HTMLInputElement>('[data-image-shadow-toggle]')!;shadow.checked=true;shadow.dispatchEvent(new Event('change'));await vi.waitFor(()=>expect(local).toHaveBeenCalledWith('block-2',expect.objectContaining({image:expect.objectContaining({shadow:6})})));
 await vi.waitFor(()=>expect(s.root.querySelector('[data-image-status]')!.textContent).toContain('已保存'));s.root.querySelector<HTMLButtonElement>('[data-action=image-defaults]')!.click();expect(s.root.querySelector('[data-image-scope]')!.textContent).toContain('整篇图片');
});
it('defaultPromotionIsExplicitAndDetachedButtonsCannotApplyToAnotherImage',async()=>{
 const apply=vi.fn().mockResolvedValue(true),s=setup({changeAllImages:apply});s.p.selectImage('img-0');const detached=s.root.querySelector<HTMLButtonElement>('[data-action=apply-images]')!;
 s.p.selectImage('img-1');detached.click();expect(apply).not.toHaveBeenCalled();s.root.querySelector<HTMLButtonElement>('[data-action=apply-images]')!.click();await vi.waitFor(()=>expect(apply).toHaveBeenCalledWith(expect.any(Object),'default'));
});
it('builtinSelectionCanKeepHeaderFooterAssociationWithoutShowingTheOldSchemeAsSelected',()=>{
 const s=setup();s.p.setState({...s.state,layout:{...DEFAULT_LAYOUT,themeId:'technology'},templateId:'own',themeOverride:true,templates:[{id:'own',name:'个人方案',layout:DEFAULT_LAYOUT,headerMarkdown:'头部',footerMarkdown:''}]});
 expect(s.root.querySelector<HTMLSelectElement>('[data-template]')!.value).toBe('theme:technology');expect(s.root.querySelector('[data-header-summary]')!.textContent).toBe('已设置');
});
it('commonImageLayoutsFollowTheExistingGlobalAndSingleImageScope',async()=>{
 const all=vi.fn().mockResolvedValue(true),local=vi.fn().mockResolvedValue(undefined),s=setup({changeAllImages:all,changeBlock:local});
 const toggle=s.root.querySelector<HTMLInputElement>('[data-image-shadow-toggle]')!;toggle.checked=true;toggle.dispatchEvent(new Event('change'));await vi.waitFor(()=>expect(all).toHaveBeenCalledWith(expect.objectContaining({shadow:6}),'default'));expect(local).not.toHaveBeenCalled();
 await vi.waitFor(()=>expect(s.root.querySelector('[data-image-status]')!.textContent).toContain('已保存'));s.p.selectImage('img-1');const off=s.root.querySelector<HTMLInputElement>('[data-image-shadow-toggle]')!;off.checked=false;off.dispatchEvent(new Event('change'));await vi.waitFor(()=>expect(local).toHaveBeenCalledWith('block-2',{image:expect.objectContaining({shadow:0})}));expect(all).toHaveBeenCalledTimes(1);
});

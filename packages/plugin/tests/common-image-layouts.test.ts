// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {ImageInspector} from '../src/image-inspector';
import WechatLayoutPlugin from '../src/main';
import {loadSettings} from '../src/settings';
import {normalizeImage,DEFAULT_LAYOUT} from '../../core/src/styles';
import {parseArticle} from '../../core/src/parse';
import {renderArticle} from '../../core/src/render';
const inspectors:ImageInspector[]=[];
function chooseJustify(root:HTMLElement){const align=root.querySelector<HTMLSelectElement>('[data-setting=imageAlign]')!;align.value='justify';align.dispatchEvent(new Event('change'));}
afterEach(()=>{inspectors.splice(0).forEach(p=>p.dispose());document.body.replaceChildren();});
function inspector(gif=false){
 const root=document.createElement('div');document.body.append(root);let style=normalizeImage({alignment:'center',widthPercent:55,radius:12,shadow:12,background:'#f2e6d9',borderWidth:1,borderColor:'#aaaaaa'});const writes:any[]=[];
 const p=new ImageInspector(root,gif,{change:async patch=>{writes.push(patch);style=normalizeImage({...style,...patch});p.sync(style,'',16);},stateChanged:()=>{}});p.sync(style,'',16);inspectors.push(p);return{root,p,writes,style:()=>style,click:(id:string)=>{const toggle=root.querySelector<HTMLInputElement>('[data-image-shadow-toggle]')!;toggle.checked=id!=='follow-text-plain';toggle.dispatchEvent(new Event('change'));}};
}
it('shadowOptionsKeepImageGeometryAndColors',async()=>{
 const s=inspector();expect(s.root.querySelectorAll('[data-image-shadow-toggle]')).toHaveLength(1);s.click('follow-text-shadow');await vi.waitFor(()=>expect(s.style()).toMatchObject({alignment:'center',marginLeft:0,marginRight:0,shadow:6,bakeEffects:false}));expect(s.style()).toMatchObject({radius:12,background:'#f2e6d9',borderWidth:1,borderColor:'#aaaaaa',widthPercent:55});expect(String(s.root.querySelector<HTMLInputElement>('[data-image-shadow-toggle]')!.checked)).toBe('true');
});
it('turningOffShadowKeepsFollowingTheBodyEdges',async()=>{
 const s=inspector();chooseJustify(s.root);s.click('follow-text-shadow');await vi.waitFor(()=>expect(s.style().shadow).toBe(6));s.click('follow-text-plain');await vi.waitFor(()=>expect(s.style()).toMatchObject({shadow:0,alignment:'justify'}));
 const article=parseArticle('正文\n\n![[图.png]] ^pic','稿.md');const html=renderArticle(article,{...DEFAULT_LAYOUT,sidePadding:16},new Map([['img-0','https://mmbiz.qpic.cn/a']]),{pic:{image:s.style()}}).html;const paper=document.createElement('div');paper.innerHTML=html;expect(paper.querySelectorAll('p')[1].style.marginLeft).toBe('16px');expect(paper.querySelector('img')!.parentElement!.style.marginLeft).toBe('0px');expect(String(!s.root.querySelector<HTMLInputElement>('[data-image-shadow-toggle]')!.checked)).toBe('true');
});
it('manualSpacingDoesNotDeselectIndependentShadowOption',async()=>{
 const s=inspector();s.click('follow-text-shadow');await vi.waitFor(()=>expect(s.style().shadow).toBe(6));const select=s.root.querySelector<HTMLSelectElement>('[data-number-select=marginLeft]')!;select.value='24';select.dispatchEvent(new Event('change'));await vi.waitFor(()=>expect(s.style().leftInset).toBe(24));expect(s.root.querySelector<HTMLInputElement>('[data-image-shadow-toggle]')!.checked).toBe(true);
});
it('globalTextChangeOverridesTheSameOldLocalParameterButKeepsImagesAndOtherTextParameters',async()=>{
 const plugin=new WechatLayoutPlugin({} as any,{} as any);plugin.activeNote={path:'稿.md',extension:'md'} as any;plugin.settings=loadSettings({notes:{'稿.md':{layout:{fontSize:15,lineHeight:1.8},overrides:{a:{text:{fontSize:21,lineHeight:2,textColor:'#112233'},image:{leftInset:8,shadow:6}},b:{text:{fontSize:25},image:{leftInset:16,shadow:0}}}}}});plugin.article=parseArticle('段落甲 ^a\n\n段落乙 ^b','稿.md');plugin.refresh=async()=>{};
 plugin.host().changeLayout({fontSize:18,lineHeight:1.75});await vi.waitFor(()=>expect(plugin.state().saving).toBe(false));const state=plugin.state();const paper=document.createElement('div');paper.innerHTML=renderArticle(state.article!,state.layout,state.sources,state.overrides).html;
 expect([...paper.querySelectorAll('p')].every(p=>p.style.fontSize==='18px'&&p.style.lineHeight==='1.75')).toBe(true);expect(plugin.noteSettings().overrides.a.text).toEqual({textColor:'#112233'});expect(plugin.noteSettings().overrides.b.image).toMatchObject({leftInset:16,shadow:0});expect(plugin.noteSettings().overrides.a.image).toMatchObject({leftInset:8,shadow:6});
 const reloaded=loadSettings(JSON.parse(JSON.stringify(plugin.settings)));expect(reloaded.notes['稿.md'].layout).toMatchObject({fontSize:18,lineHeight:1.75});expect(reloaded.notes['稿.md'].overrides.a.text?.fontSize).toBeUndefined();
});
it('followTextShadowShortcutKeepsTheBodyEdgeAndAppearanceChangesCannotMoveIt',async()=>{
 const s=inspector();chooseJustify(s.root);s.click('follow-text-shadow');await vi.waitFor(()=>expect(s.style()).toMatchObject({alignment:'justify',shadow:6,bakeEffects:false}));expect(s.root.querySelector<HTMLInputElement>('[data-image-inherit-inset]')!.checked).toBe(true);expect(s.root.querySelector<HTMLSelectElement>('[data-number-select=marginLeft]')!.value).toBe('16');expect(s.root.querySelector('[data-image-layout=inset8-shadow]')).toBeNull();
 const radius=s.root.querySelector<HTMLInputElement>('[data-setting=radius]')!;radius.value='4';radius.dispatchEvent(new Event('input'));await vi.waitFor(()=>expect(s.style().alignment).toBe('justify'));expect(s.style().shadow).toBe(6);
 s.p.sync(s.style(),'图',32);expect(s.root.querySelector<HTMLSelectElement>('[data-number-select=marginLeft]')!.value).toBe('32');expect(s.root.querySelector<HTMLSelectElement>('[data-number-select=marginRight]')!.value).toBe('32');
});
it('editingOneInsetKeepsJustifyAndTheOtherVisibleEdge',async()=>{
 const s=inspector();chooseJustify(s.root);s.click('follow-text-shadow');await vi.waitFor(()=>expect(s.style().alignment).toBe('justify'));
 const select=s.root.querySelector<HTMLSelectElement>('[data-number-select=marginLeft]')!;select.value='8';select.dispatchEvent(new Event('change'));await vi.waitFor(()=>expect(s.style()).toMatchObject({alignment:'justify',leftInset:8,rightInset:16,shadow:6}));expect(s.root.querySelector<HTMLSelectElement>('[data-setting=imageAlign]')!.selectedOptions[0].textContent).toBe('两端对齐');
});
it('justifiedGifKeepsAnimationAndDoesNotBakeStaticEffects',async()=>{
 const s=inspector(true);chooseJustify(s.root);s.click('follow-text-shadow');await vi.waitFor(()=>expect(s.style()).toMatchObject({alignment:'justify',shadow:6,bakeEffects:false}));
});
it('imageControlsUseFourStandardAlignmentsWithoutDuplicateWidthOrPresetRows',async()=>{
 const s=inspector(),align=s.root.querySelector<HTMLSelectElement>('[data-setting=imageAlign]')!;expect([...align.options].map(o=>o.textContent)).toEqual(['左对齐','居中对齐','右对齐','两端对齐']);expect(s.root.querySelector('[data-image-width-status]')).toBeNull();expect(s.root.querySelector('[data-image-preset]')).toBeNull();expect(s.root.querySelector('[data-setting=radius]')!.closest('details')).toBe(s.root.querySelector('[data-image-effects]'));
 align.value='justify';align.dispatchEvent(new Event('change'));await vi.waitFor(()=>expect(s.style().alignment).toBe('justify'));const side=s.root.querySelector<HTMLSelectElement>('[data-number-select=marginLeft]')!;side.value='8';side.dispatchEvent(new Event('change'));await vi.waitFor(()=>expect(s.style().leftInset).toBe(8));expect(align.value).toBe('justify');
});
it('shadowShortcutOnlyChangesShadowAndKeepsExistingAlignmentWidthAndInsets',async()=>{
 const s=inspector();s.click('follow-text-shadow');await vi.waitFor(()=>expect(s.style().shadow).toBe(6));expect(s.style()).toMatchObject({alignment:'center',widthPercent:55,marginLeft:0,marginRight:0});
});

// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import type {PanelState} from '../src/view';
import {LayoutPanelHarness as LayoutPanel} from '../../../tests/helpers/layout-panel';
import {parseArticle} from '../../core/src/parse';
import {DEFAULT_LAYOUT,normalizeImage} from '../../core/src/styles';
import {loadSettings} from '../src/settings';
function setup(source='![[图.png]] ^pic\n\n![[图.png]] ^other'){
 const root=document.createElement('div');document.body.append(root);const writes:any[]=[];let fail=false;
 const state:PanelState={article:parseArticle(source,'稿.md'),layout:DEFAULT_LAYOUT,overrides:{},sources:new Map([['img-0','https://mmbiz.qpic.cn/a'],['img-1','https://mmbiz.qpic.cn/a']]),account:{id:'a',name:'测试号'},pairingReady:true};
 const p=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},getPairingInfo:async()=>'{}',copyPairing:async()=>{},changeLayout:()=>{},refresh:()=>{},changeBlock:async(key,patch)=>{
  if(fail)throw Error('写入失败');const b=state.article!.blocks.find(b=>b.key===key)!;writes.push({id:b.blockId,patch});state.overrides[b.blockId!]={image:{...state.overrides[b.blockId!]?.image,...patch.image}};p.setState({...state});return b.blockId;
 }});p.setState(state);
 const select=(index=0)=>p.selectImage(state.article!.images[index].occurrenceId);
 const set=(key:string,value:string)=>{const input=root.querySelector<HTMLInputElement>(`[data-selected-controls] [data-setting="${key}"]`)!;expect(input,key).not.toBeNull();input.value=value;input.dispatchEvent(new Event('input'));input.dispatchEvent(new Event('change'));};
 return{root,p,state,writes,select,set,fail:(value:boolean)=>{fail=value}};
}
it('imageSelectionOpensAnInspectorForTheSelectedOccurrence',()=>{
 const s=setup();s.select(1);expect(s.root.querySelector<HTMLDetailsElement>('.wx-selected')!.open).toBe(true);expect(s.root.querySelector('[data-selection-title]')?.textContent).toContain('图片');expect(s.root.querySelector('[data-image-name]')?.textContent).toContain('图.png');
 expect(s.root.querySelector<HTMLElement>('[data-image-scope]')!.dataset.selectedImage).toBe('img-1');s.p.destroy();
});
it('imageIndentAndShadowOnlyAffectTheSelectedOccurrence',async()=>{
 const s=setup();s.select();s.set('marginLeft','16');s.set('marginRight','24');s.set('shadow','10');s.set('widthPercent','55');
 await vi.waitFor(()=>expect(s.state.overrides.pic?.image).toMatchObject({leftInset:16,rightInset:24,shadow:10,bakeEffects:true,widthPercent:55}));
 expect(s.root.querySelector<HTMLSelectElement>('[data-setting=imageWidth]')!.value).toBe('custom');
 expect(s.state.overrides.other).toBeUndefined();expect(s.root.querySelector('[data-image-status]')?.textContent).toContain('已保存');s.p.destroy();
});
it('accountUpdatesDoNotReplaceFocusedImageControls',()=>{
 const s=setup();s.select();const input=s.root.querySelector<HTMLInputElement>('[data-setting=shadow]');expect(input).not.toBeNull();input!.focus();s.p.setState({...s.state,account:{id:'a',name:'刷新账号'}});
 expect(s.root.querySelector('[data-setting=shadow]')).toBe(input);expect(document.activeElement).toBe(input);s.p.destroy();
});
it('imagePresetBakesStaticEffectsAndOriginalResetsAllLocalDecoration',async()=>{
 const s=setup();s.select();const floating=s.root.querySelector<HTMLButtonElement>('[data-image-preset=floating]');expect(floating).not.toBeNull();floating!.click();
 await vi.waitFor(()=>expect(s.state.overrides.pic?.image).toMatchObject({shadow:12,radius:8,bakeEffects:true}));
 s.set('marginLeft','32');await vi.waitFor(()=>expect(s.state.overrides.pic?.image?.leftInset).toBe(32));s.root.querySelector<HTMLButtonElement>('[data-image-preset=original]')!.click();
 await vi.waitFor(()=>expect(s.state.overrides.pic?.image).toMatchObject({leftInset:32,shadow:0,radius:0,bakeEffects:false}));s.p.destroy();
});
it('imageSaveErrorRemainsNearControlsAndCanBeRetried',async()=>{
 const s=setup();s.select();s.fail(true);s.set('shadow','8');await vi.waitFor(()=>expect(s.root.querySelector('[data-image-status]')?.textContent).toContain('写入失败'));
 s.p.setState({...s.state});expect(s.root.querySelector('[data-image-status]')?.textContent).toContain('写入失败');s.fail(false);s.root.querySelector<HTMLButtonElement>('[data-action=retry-image]')!.click();
 await vi.waitFor(()=>expect(s.state.overrides.pic?.image?.shadow).toBe(8));s.p.destroy();
});
it('gifPresetKeepsAnimationInsteadOfRequestingStaticBaking',async()=>{
 const s=setup('![[动画.gif]] ^pic');s.select();const floating=s.root.querySelector<HTMLButtonElement>('[data-image-preset=floating]');expect(floating).not.toBeNull();floating!.click();
 await vi.waitFor(()=>expect(s.state.overrides.pic?.image?.shadow).toBe(12));expect(s.state.overrides.pic?.image?.bakeEffects).toBe(false);expect(s.root.querySelector('[data-image-hint]')?.textContent).toContain('GIF');s.p.destroy();
});
it('multipleImagesInOneBlockExplainHowToStyleThemIndividually',()=>{
 const s=setup('![[一.png]] ![[二.png]]');s.select(1);expect(s.root.querySelector('[data-selected-controls]')?.textContent).toContain('单独一段');expect(s.root.querySelector('[data-setting=shadow]')).toBeNull();s.p.destroy();
});
it('imageIndentSurvivesSettingsRoundTripAndIsBounded',()=>{
 const saved=loadSettings({notes:{'稿.md':{overrides:{pic:{image:{marginLeft:16,marginRight:24}}}}}});expect(saved.notes['稿.md'].overrides.pic.image).toMatchObject({marginLeft:16,marginRight:24});
 expect(normalizeImage({marginLeft:-10,marginRight:999})).toMatchObject({marginLeft:0,marginRight:96});
});
it('justifyModeUsesSideWhitespaceAndRestoresCustomWidthWhenLeavingIt',async()=>{
 const s=setup();s.select();s.set('widthPercent','55');await vi.waitFor(()=>expect(s.state.overrides.pic?.image?.widthPercent).toBe(55));const align=s.root.querySelector<HTMLSelectElement>('[data-setting=imageAlign]')!;expect([...align.options].map(o=>o.textContent)).toContain('两端对齐');align.value='justify';align.dispatchEvent(new Event('change'));s.set('marginLeft','16');s.set('marginRight','24');await vi.waitFor(()=>expect(s.state.overrides.pic?.image).toMatchObject({alignment:'justify',widthPercent:55,leftInset:16,rightInset:24}));const width=s.root.querySelector<HTMLInputElement>('[data-setting=widthPercent]')!,widthMode=s.root.querySelector<HTMLSelectElement>('[data-setting=imageWidth]')!;expect(width.disabled).toBe(true);expect(width.value).toBe('100');expect(widthMode.disabled).toBe(true);expect(s.root.querySelector('[data-image-layout-hint]')!.textContent).toContain('留白');align.value='center';align.dispatchEvent(new Event('change'));await vi.waitFor(()=>expect(s.state.overrides.pic?.image?.alignment).toBe('center'));expect(width.disabled).toBe(false);expect(width.value).toBe('55');expect(s.state.overrides.other).toBeUndefined();s.p.destroy();
});
it('justifiedImageSettingsSurviveReloadWithIndependentSideWhitespace',()=>{
 const input={notes:{'稿.md':{overrides:{pic:{image:{alignment:'justify',marginLeft:16,marginRight:24}}}}}};const loaded=loadSettings(JSON.parse(JSON.stringify(input)));expect(loaded.notes['稿.md'].overrides.pic.image).toMatchObject({alignment:'justify',marginLeft:16,marginRight:24});
});
it('sideWhitespacePresetsSaveIndependentlyWithoutOpeningManualInputs',async()=>{
 const s=setup();s.select();for(const [key,value]of [['marginLeft','16'],['marginRight','24']]){const select=s.root.querySelector<HTMLSelectElement>(`[data-number-select=${key}]`)!;expect(select).not.toBeNull();select.value=value;select.dispatchEvent(new Event('change'));}await vi.waitFor(()=>expect(s.state.overrides.pic?.image).toMatchObject({leftInset:16,rightInset:24}));expect(s.state.overrides.other).toBeUndefined();for(const [key,value]of [['marginLeft','16'],['marginRight','24']]){expect(s.root.querySelector<HTMLSelectElement>(`[data-number-select=${key}]`)!.value).toBe(value);expect(s.root.querySelector<HTMLElement>(`[data-number-input=${key}]`)!.hidden).toBe(true);}s.p.destroy();
});
it('manualWhitespaceStartsFromCurrentValueAndSurvivesStateUpdates',async()=>{
 const s=setup();s.select();const select=s.root.querySelector<HTMLSelectElement>('[data-number-select=marginLeft]')!;select.value='16';select.dispatchEvent(new Event('change'));await vi.waitFor(()=>expect(s.state.overrides.pic?.image?.leftInset).toBe(16));const writes=s.writes.length;s.root.querySelector<HTMLButtonElement>('[data-number-manual=marginLeft]')!.click();const input=s.root.querySelector<HTMLInputElement>('[data-setting=marginLeft]')!;expect(input.value).toBe('16');expect(document.activeElement).toBe(input);expect(s.writes).toHaveLength(writes);s.set('marginLeft','22');await vi.waitFor(()=>expect(s.state.overrides.pic?.image?.leftInset).toBe(22));s.p.setState({...s.state,account:{id:'a',name:'刷新账号'}});expect(s.root.querySelector('[data-setting=marginLeft]')).toBe(input);expect(input.value).toBe('22');expect(s.root.querySelector<HTMLElement>('[data-number-input=marginLeft]')!.hidden).toBe(false);s.p.destroy();
});
it('existingCustomWhitespaceAutomaticallyShowsManualInputAndCanReturnToAPreset',async()=>{
 const s=setup();s.state.overrides.pic={image:{marginLeft:20}};s.p.setState({...s.state});s.select();expect(s.root.querySelector<HTMLElement>('[data-number-input=marginLeft]')!.hidden).toBe(false);expect(s.root.querySelector<HTMLInputElement>('[data-setting=marginLeft]')!.value).toBe('28');s.root.querySelector<HTMLButtonElement>('[data-number-manual=marginLeft]')!.click();const select=s.root.querySelector<HTMLSelectElement>('[data-number-select=marginLeft]')!;select.value='8';select.dispatchEvent(new Event('change'));await vi.waitFor(()=>expect(s.state.overrides.pic?.image?.leftInset).toBe(8));expect(s.root.querySelector<HTMLElement>('[data-number-input=marginLeft]')!.hidden).toBe(true);s.root.querySelector<HTMLButtonElement>('[data-number-manual=marginLeft]')!.click();s.set('marginLeft','0');await vi.waitFor(()=>expect(s.state.overrides.pic?.image?.leftInset).toBe(0));s.p.destroy();
});
it('noEffectPreservesImageLayoutAndOnlyRemovesDecoration',async()=>{
 const s=setup();s.select();s.set('marginLeft','16');s.set('marginRight','24');s.set('widthPercent','55');s.root.querySelector<HTMLButtonElement>('[data-image-preset=floating]')!.click();await vi.waitFor(()=>expect(s.state.overrides.pic?.image?.shadow).toBe(12));
 const button=s.root.querySelector<HTMLButtonElement>('[data-image-preset=original]')!;expect(button.textContent).toBe('原图');button.click();await vi.waitFor(()=>expect(s.state.overrides.pic?.image).toMatchObject({leftInset:16,rightInset:24,widthPercent:55,radius:0,shadow:0,borderWidth:0,bakeEffects:false}));
 expect(s.root.querySelector('[data-setting=imageWidth]')!.closest('section')!.getAttribute('aria-label')).toBe('尺寸与位置');s.p.destroy();
});
it('manualWidthRemainsVisibleWhileTypingAPresetValue',async()=>{
 const s=setup();s.select();const mode=s.root.querySelector<HTMLSelectElement>('[data-setting=imageWidth]')!;mode.value='custom';mode.dispatchEvent(new Event('change'));const input=s.root.querySelector<HTMLInputElement>('[data-setting=widthPercent]')!;expect(document.activeElement).toBe(input);s.set('widthPercent','40');await vi.waitFor(()=>expect(s.state.overrides.pic?.image?.widthPercent).toBe(40));expect(input.closest<HTMLElement>('.wx-field')!.hidden).toBe(false);expect(document.activeElement).toBe(input);s.p.destroy();
});

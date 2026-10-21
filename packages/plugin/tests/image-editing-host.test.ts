// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import WechatLayoutPlugin from '../src/main';
import {LayoutPanelHarness as LayoutPanel} from '../../../tests/helpers/layout-panel';
import {loadSettings} from '../src/settings';
import {parseArticle} from '../../core/src/parse';
import {renderArticle} from '../../core/src/render';
import {DEFAULT_IMAGE} from '../../core/src/styles';
afterEach(()=>vi.unstubAllGlobals());
async function setup(){
 let source='![[表情.png]]\n\n![[表情.png]]';const bytes=await readFile('fixtures/vault/表情.png');let urls=0;
 vi.stubGlobal('URL',class extends URL{static createObjectURL(){return 'blob:test-'+urls++;}static revokeObjectURL(){}});
 const plugin=new WechatLayoutPlugin({} as any,{} as any);plugin.settings=loadSettings({});plugin.activeNote={path:'稿.md',extension:'md'} as any;
 plugin.getEditor=()=>({getValue:()=>source,offsetToPos:(offset:number)=>({line:0,ch:offset}),replaceRange:(text:string,from:{ch:number},to:{ch:number})=>{source=source.slice(0,from.ch)+text+source.slice(to.ch);}} as any);
 plugin.vaultPort=async()=>({listFiles:()=>['表情.png'],readBinary:async()=>bytes});plugin.effectRenderer=async()=>({bytes,mime:'image/png'});
 await plugin.refresh();const root=document.createElement('div');document.body.append(root);const panel=new LayoutPanel(root,plugin.host());(plugin as any).views.add({panel});panel.setState(plugin.state());
 panel.selectImage('img-0');
 const shadow=root.querySelector<HTMLInputElement>('[data-setting=shadow]')!;
 return{plugin,panel,root,shadow,source:()=>source,edit:(value:string)=>{shadow.value=value;shadow.dispatchEvent(new Event('input'));}};
}
it('firstImageEditAddsOneIdAndKeepsTheInspectorBoundDuringRapidChanges',async()=>{
 const s=await setup();expect(s.shadow).not.toBeNull();s.edit('8');s.edit('16');
 await vi.waitFor(()=>{const id=s.plugin.article!.blocks[0].blockId!;expect(s.plugin.settings.notes['稿.md'].overrides[id]?.image?.shadow).toBe(16);});
 expect(s.source().match(/\^wx-/g)).toHaveLength(1);expect(s.plugin.article!.blocks[1].blockId).toBeUndefined();expect(s.root.querySelector('[data-setting=shadow]')).toBe(s.shadow);
 expect(s.root.querySelector<HTMLElement>('[data-image-scope]')!.dataset.selectedImage).toBe('img-0');s.panel.destroy();
});
it('failedFirstSaveCanRetryWithoutAddingAnotherBlockId',async()=>{
 const s=await setup();let fail=true;s.plugin.saveData=async()=>{if(fail)throw Error('磁盘不可写')};s.edit('8');
 await vi.waitFor(()=>expect(s.root.querySelector('[data-image-status]')?.textContent).toContain('磁盘不可写'));fail=false;s.root.querySelector<HTMLButtonElement>('[data-action=retry-image]')!.click();
 await vi.waitFor(()=>expect(s.root.querySelector('[data-image-status]')?.textContent).toContain('已保存'));expect(s.source().match(/\^wx-/g)).toHaveLength(1);s.panel.destroy();
});
it('switchingImagesWaitsForPendingStyleWritesInsteadOfDroppingThem',async()=>{
 const s=await setup();s.edit('8');s.edit('16');s.panel.selectImage('img-1');
 await vi.waitFor(()=>{const id=s.plugin.article!.blocks[0].blockId!;expect(s.plugin.settings.notes['稿.md'].overrides[id]?.image?.shadow).toBe(16);});
 expect(s.plugin.article!.blocks[1].blockId).toBeUndefined();s.panel.destroy();
});
it('noteSwitchDuringSourceReadCannotWriteStylesIntoTheNextNote',async()=>{
 const s=await setup();let finish!:(value:string)=>void;s.plugin.readSource=()=>new Promise(resolve=>{finish=resolve});const changing=s.plugin.changeBlock(s.plugin.article!.blocks[0].key,{image:{shadow:8}});
 s.plugin.activeNote={path:'另一篇.md',extension:'md'} as any;s.plugin.article=parseArticle(s.source(),'另一篇.md');finish(s.source());
 await expect(changing).rejects.toThrow(/变化/);expect(s.plugin.settings.notes['另一篇.md']).toBeUndefined();expect(s.source()).not.toContain('^wx-');s.panel.destroy();
});
it('stalePreviewCannotEditANewlyOpenedNoteWithIdenticalContent',async()=>{
 const s=await setup();s.plugin.activeNote={path:'另一篇.md',extension:'md'} as any;
 await expect(s.plugin.changeBlock(s.plugin.article!.blocks[0].key,{image:{shadow:8}})).rejects.toThrow(/选择|变化/);
 expect(s.plugin.settings.notes['另一篇.md']).toBeUndefined();expect(s.source()).not.toContain('^wx-');s.panel.destroy();
});
it('applyToAllReplacesImageOverridesButPreservesTextOverrides',async()=>{
 const s=await setup();s.plugin.settings.notes['稿.md'].overrides={a:{text:{fontSize:19},image:{shadow:0,marginLeft:32}},b:{image:{radius:24}}};
 await s.plugin.changeAllImages({...DEFAULT_IMAGE,shadow:12,bakeEffects:false},'all');
 const overrides=s.plugin.settings.notes['稿.md'].overrides;expect(overrides.a).toEqual({text:{fontSize:19}});expect(overrides.b).toBeUndefined();expect(overrides['*'].image).toMatchObject({shadow:12,marginLeft:0});s.panel.destroy();
});
it('imageControlsUseTheSame16pxEdgesAsTextInTheActualHostRender',async()=>{
 const s=await setup();s.plugin.host().changeLayout({sidePadding:16,textAlign:'justify'});
 const align=s.root.querySelector<HTMLSelectElement>('[data-setting=imageAlign]')!;align.value='justify';align.dispatchEvent(new Event('change'));
 for(const side of ['marginLeft','marginRight']){const select=s.root.querySelector<HTMLSelectElement>(`[data-number-select=${side}]`)!;select.value='16';select.dispatchEvent(new Event('change'));}
 await vi.waitFor(()=>{const id=s.plugin.article!.blocks[0].blockId!;expect(s.plugin.noteSettings().overrides[id]?.image).toMatchObject({leftInset:16,rightInset:16});});
 await vi.waitFor(()=>expect(s.root.querySelector('[data-image-status]')!.textContent).toContain('已保存'));
 const state=s.plugin.state(),container=document.createElement('div');container.innerHTML=renderArticle(state.article!,state.layout,state.sources,state.overrides).html;
 const image=container.querySelector('img')!,frame=image.parentElement!,paragraph=frame.parentElement!;
 expect(parseFloat(frame.style.marginLeft)+parseFloat(paragraph.style.marginLeft)).toBe(16);expect(parseFloat(frame.style.marginRight)+parseFloat(paragraph.style.marginRight)).toBe(16);
 const loaded=loadSettings(JSON.parse(JSON.stringify(s.plugin.settings)));const id=s.plugin.article!.blocks[0].blockId!;expect(loaded.notes['稿.md'].overrides[id].image).toMatchObject({leftInset:16,rightInset:16});expect(s.plugin.article!.blocks[1].blockId).toBeUndefined();s.panel.destroy();
});

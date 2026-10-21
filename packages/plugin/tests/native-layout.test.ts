// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {TFile,MarkdownView} from 'obsidian';
import WechatLayoutPlugin from '../src/main';
import {nativeWorkspace} from '../../../tests/helpers/native-workspace';
const VIEW='wechat-layout-workspace',plugins:WechatLayoutPlugin[]=[];
afterEach(()=>{plugins.splice(0).forEach(p=>p.unload());document.body.replaceChildren();vi.restoreAllMocks();});
async function setup(){
 const source='第一段\n\n![[图.png]] ^pic',file=Object.assign(new TFile(),{path:'稿.md',extension:'md'});const container=document.createElement('div');document.body.append(container);const ws=nativeWorkspace(container,file);
 const plugin=new WechatLayoutPlugin({workspace:ws.workspace,vault:{on:()=>({}),getAbstractFileByPath:(path:string)=>path===file.path?file:null}} as any,{version:'test'} as any);ws.register(plugin);plugin.getEditor=()=>({getValue:()=>source} as any);plugin.vaultPort=async()=>({listFiles:()=>[],readBinary:async()=>{throw Error('No fixture bytes')}});vi.spyOn(plugin as any,'startBridge').mockResolvedValue(undefined);await plugin.onload();plugins.push(plugin);return{plugin,ws,source,file};
}
it('opensOneFunctionalWorkspaceWithoutSplittingOrReplacingTheMarkdownEditor',async()=>{
 const {plugin,ws}=await setup();await plugin.openView();const leaves=ws.workspace.getLeavesOfType(VIEW);expect(leaves).toHaveLength(1);expect(ws.workspace.getLeavesOfType('wechat-layout-controls')).toHaveLength(0);expect(ws.workspace.getLeavesOfType('wechat-layout-preview')).toHaveLength(0);expect(ws.splits).toHaveLength(0);expect(ws.leaves).toContain(ws.editor);expect(ws.editor.type).toBe('markdown');expect(leaves[0].view.getDisplayText()).toBe('公众号图文排版');const root=leaves[0].view.contentEl;expect(root.querySelector('[data-page-tab=editor]')).not.toBeNull();expect(root.querySelector('[data-page=preview]').hidden).toBe(true);
});
it('previewImageClickDoesNotRevealParametersOrNavigate',async()=>{
 const {plugin,ws}=await setup();await plugin.openView();await plugin.refresh();const leaf=ws.workspace.getLeavesOfType(VIEW)[0],root=leaf.view.contentEl;root.querySelector('[data-page-tab=preview]').click();root.querySelector('.wx-paper').shadowRoot.querySelector('img').click();await Promise.resolve();expect(leaf.view.panel.currentPage).toBe('preview');expect(root.querySelector('[data-image-scope]')!.textContent).toBe('文章默认');
});
it('changingControlsUsesTheSameRendererWhenPreviewIsOpened',async()=>{
 const {plugin,ws}=await setup();await plugin.openView();await plugin.refresh();const root=ws.workspace.getLeavesOfType(VIEW)[0].view.contentEl,input=root.querySelector('[data-setting=paragraphAfter]');input.value='28';input.dispatchEvent(new Event('input'));root.querySelector('[data-page-tab=preview]').click();const paragraphs=root.querySelector('.wx-paper').shadowRoot.querySelectorAll('p');expect(paragraphs[0].style.marginBottom).toBe('0px');expect(paragraphs[1].style.marginTop).toBe('28px');
});
it('repeatedAndConcurrentOpeningReuseTheOneWorkspace',async()=>{
 const {plugin,ws}=await setup();await Promise.all([plugin.openView(),plugin.openView()]);await plugin.openView();expect(ws.workspace.getLeavesOfType(VIEW)).toHaveLength(1);expect(ws.splits).toHaveLength(0);
});
it('mergesLegacyControlAndPreviewLeavesAndPreservesOtherLeaves',async()=>{
 const {plugin,ws}=await setup();const controls=ws.workspace.getLeaf('tab'),preview=ws.workspace.getLeaf('tab'),other=ws.workspace.getRightLeaf();await controls.setViewState({type:'wechat-layout-controls',state:{sourcePath:'稿.md'}});await preview.setViewState({type:'wechat-layout-preview',state:{sourcePath:'稿.md'}});await plugin.openView();expect(ws.workspace.getLeavesOfType(VIEW)).toHaveLength(1);expect(ws.workspace.getLeavesOfType('wechat-layout-controls')).toHaveLength(0);expect(ws.workspace.getLeavesOfType('wechat-layout-preview')).toHaveLength(0);expect(ws.leaves).toContain(ws.editor);expect(ws.leaves).toContain(other);expect(ws.splits).toHaveLength(0);
});
it('restoresALegacySidebarPreviewAsOneWorkspaceAtStartup',async()=>{
 const {plugin,ws}=await setup();const old=ws.workspace.getRightLeaf();await old.setViewState({type:'wechat-layout-preview'});ws.ready();await vi.waitFor(()=>expect(ws.workspace.getLeavesOfType(VIEW)).toHaveLength(1));expect(ws.splits).toHaveLength(0);expect(ws.workspace.getLeavesOfType('wechat-layout-preview')).toHaveLength(0);
});
it('nativeViewStateRemembersTheSourceAndSelectedFunctionalPage',async()=>{
 const {plugin,ws}=await setup();await plugin.openView();await plugin.refresh();const view=ws.workspace.getLeavesOfType(VIEW)[0].view;view.panel.showPage('preview');expect(view.getState()).toMatchObject({sourcePath:'稿.md',page:'preview'});plugin.activeNote=null;plugin.article=null;await view.setState({sourcePath:'稿.md',page:'preview'},{});expect(plugin.article).toMatchObject({sourcePath:'稿.md'});expect(view.panel.currentPage).toBe('preview');
});
it('restoredViewStateDoesNotReplaceAnAlreadyActiveNote',async()=>{
 const {plugin,ws}=await setup();await plugin.openView();const view=ws.workspace.getLeavesOfType(VIEW)[0].view,active=Object.assign(new TFile(),{path:'正在写.md',extension:'md'});plugin.activeNote=active;await view.setState({sourcePath:'稿.md'},{});expect(plugin.activeNote).toBe(active);
});
it('legacyStartupFindsTheSourceInAnInactiveMarkdownTab',async()=>{
 const {plugin,ws}=await setup(),sourceFile=plugin.activeNote!;ws.editor.view=Object.assign(new MarkdownView(ws.editor),{file:sourceFile,containerEl:document.createElement('div')});ws.workspace.getActiveFile=()=>null;plugin.activeNote=null;plugin.article=null;await ws.workspace.getRightLeaf().setViewState({type:'wechat-layout-preview'});ws.ready();await vi.waitFor(()=>expect(plugin.article).toMatchObject({sourcePath:'稿.md'}));expect(plugin.activeNote).toBe(sourceFile);
});
it('unloadingDuringOpenDoesNotCreateAnotherView',async()=>{
 const {plugin,ws}=await setup();const get=ws.workspace.getRightLeaf;let resume!:()=>void;const blocked=new Promise<void>(resolve=>{resume=resolve});ws.workspace.getRightLeaf=()=>{const leaf=get(),set=leaf.setViewState;leaf.setViewState=async(state:any)=>{await set(state);await blocked;};return leaf;};const opening=plugin.openView();await vi.waitFor(()=>expect(ws.workspace.getLeavesOfType(VIEW)).toHaveLength(1));plugin.unload();resume();await opening;expect(ws.workspace.getLeavesOfType(VIEW)).toHaveLength(0);expect(ws.splits).toHaveLength(0);
});
it('savedSourceInADeferredLegacyViewTakesPriorityOverAnotherMarkdownTab',async()=>{
 const {plugin,ws}=await setup(),other=Object.assign(new TFile(),{path:'别的文章.md',extension:'md'});ws.editor.view=Object.assign(new MarkdownView(ws.editor),{file:other,containerEl:document.createElement('div')});ws.workspace.getActiveFile=()=>null;plugin.activeNote=null;plugin.article=null;const saved=ws.workspace.getLeaf('tab');saved.type='wechat-layout-preview';saved.savedState={sourcePath:'稿.md'};saved.isDeferred=true;ws.ready();await vi.waitFor(()=>expect(plugin.article).toMatchObject({sourcePath:'稿.md'}));expect(plugin.activeNote).not.toBe(other);await vi.waitFor(()=>expect(ws.workspace.getLeavesOfType(VIEW)).toHaveLength(1));
});
it('nativeImageClickInPreviewRecordsSelectionWithoutRevealingOrChangingThePage',async()=>{
 const {plugin,ws,file,source}=await setup();await plugin.openView();await plugin.refresh();const leaf=ws.workspace.getLeavesOfType(VIEW)[0];leaf.view.panel.showPage('preview');const reveal=vi.spyOn(ws.workspace,'revealLeaf');await plugin.openNativeImage({file,source,occurrenceId:'img-0'} as any);expect(leaf.view.panel.currentPage).toBe('preview');expect(reveal).not.toHaveBeenCalled();leaf.view.panel.showPage('editor');expect(leaf.view.contentEl.querySelector('[data-setting=shadow]')).not.toBeNull();
});
it('copyWaitsForLayoutPersistenceAndFailedSavesRemainRetryable',async()=>{
 const {plugin}=await setup();await plugin.refresh();let fail=true;plugin.persist=async()=>{if(fail)throw Error('磁盘不可用');};plugin.host().changeLayout({fontSize:18});expect(plugin.state().saving).toBe(true);await expect(plugin.copy()).rejects.toThrow('保存');await vi.waitFor(()=>expect(plugin.state().saveError).toContain('磁盘不可用'));expect(plugin.state().saving).toBe(false);fail=false;plugin.host().retrySave!();await vi.waitFor(()=>{expect(plugin.state().saveError).toBe('');expect(plugin.state().saving).toBe(false);});
});
it('failedApplyAllImagesIsGuardedBySharedSaveStateUntilRetry',async()=>{
 const {plugin}=await setup();await plugin.refresh();plugin.persist=async()=>{throw Error('无法保存图片方案');};await expect(plugin.changeAllImages({shadow:12})).rejects.toThrow('无法保存图片方案');expect(plugin.state().saveError).toContain('无法保存图片方案');await expect(plugin.copy()).rejects.toThrow('保存');plugin.persist=async()=>{};plugin.host().retrySave!();await vi.waitFor(()=>{expect(plugin.state().saving).toBe(false);expect(plugin.state().saveError).toBe('');});
});
it('templateDeletionRequiresConfirmationAndKeepsTheCapturedTargetAfterNoteSwitch',async()=>{
 const {Modal}=await import('../../../tests/helpers/obsidian');const {plugin,file}=await setup();plugin.settings.templates=['a','b'].map(id=>({id,name:`方案${id}`,layout:plugin.settings.layout,headerMarkdown:'',footerMarkdown:''}));plugin.settings.notes[file.path]={templateId:'a',overrides:{}};plugin.settings.notes['另一篇.md']={templateId:'b',overrides:{}};plugin.settings.notes['旧文章.md']={templateId:'a',overrides:{}};
 plugin.host().deleteTemplate!('a');const cancelled=Modal.latest!;expect(cancelled.contentEl.textContent).toContain('方案a');expect(cancelled.contentEl.textContent).toContain('2 篇笔记');cancelled.contentEl.querySelector<HTMLButtonElement>('[data-action=cancel-delete]')!.click();expect(plugin.settings.templates).toHaveLength(2);
 plugin.host().deleteTemplate!('a');const confirmed=Modal.latest!;plugin.activeNote=Object.assign(new TFile(),{path:'另一篇.md',extension:'md'});confirmed.contentEl.querySelector<HTMLButtonElement>('[data-action=confirm-delete]')!.click();await vi.waitFor(()=>expect(plugin.settings.templates.map(t=>t.id)).toEqual(['b']));expect(plugin.settings.notes['另一篇.md'].templateId).toBe('b');expect(plugin.settings.notes[file.path].templateId).toBeUndefined();expect(plugin.settings.notes['旧文章.md'].templateId).toBeUndefined();
});
it('savingASchemeAfterSwitchingNotesAssignsItToTheOriginalNote',async()=>{
 const {Modal}=await import('../../../tests/helpers/obsidian');const {plugin,file}=await setup();plugin.settings.notes[file.path]={overrides:{}};plugin.settings.notes['另一篇.md']={overrides:{},templateId:'other'};plugin.editTemplate(true);const modal=Modal.latest!,name=modal.contentEl.querySelector('input')!;name.value='我的方案';plugin.activeNote=Object.assign(new TFile(),{path:'另一篇.md',extension:'md'});modal.contentEl.querySelector<HTMLButtonElement>('.mod-cta')!.click();await vi.waitFor(()=>expect(plugin.settings.notes[file.path].templateId).toBeTruthy());expect(plugin.settings.notes['另一篇.md'].templateId).toBe('other');
});

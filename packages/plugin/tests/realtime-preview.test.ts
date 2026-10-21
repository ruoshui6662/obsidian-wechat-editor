// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import WechatLayoutPlugin from '../src/main';
import {LayoutPanel} from '../src/view';
import {loadSettings} from '../src/settings';
import {TFile} from 'obsidian';
import {nativeWorkspace} from '../../../tests/helpers/native-workspace';
const cleanups:Array<()=>void>=[];
afterEach(()=>{cleanups.splice(0).forEach(clean=>clean());vi.unstubAllGlobals();document.body.replaceChildren();});
async function setup(){
 const bytes=await readFile('fixtures/vault/表情.png');let source='旧正文\n\n![[表情.png]] ^pic',sequence=0;const revoked:string[]=[];
 vi.stubGlobal('URL',class extends URL{static createObjectURL(){return 'blob:preview-'+sequence++;}static revokeObjectURL(url:string){revoked.push(url);}});
 const plugin=new WechatLayoutPlugin({} as any,{} as any);plugin.settings=loadSettings({notes:{'稿.md':{overrides:{pic:{image:{bakeEffects:true,shadow:8}}}}}});plugin.activeNote={path:'稿.md',extension:'md'} as any;plugin.readSource=async()=>source;
 const port={listFiles:()=>['表情.png'],readBinary:async()=>bytes};plugin.vaultPort=async()=>port;const effects=vi.fn(async():Promise<{bytes:Uint8Array;mime:string}>=>({bytes,mime:'image/png'}));plugin.effectRenderer=effects;
 await plugin.refresh();const root=document.createElement('div');document.body.append(root);const panel=new LayoutPanel(root,plugin.host());(plugin as any).views.add({panel});panel.setState(plugin.state());panel.showPage('preview');cleanups.push(()=>{plugin.onunload();panel.destroy();});
 return{plugin,root,panel,port,effects,bytes,revoked,setSource:(value:string)=>{source=value;plugin.invalidate();},paper:()=>root.querySelector('.wx-paper')!.shadowRoot!};
}
it('typingPublishesNewTextWithoutWaitingForImageWorkOrClickingPreview',async()=>{
 const s=await setup();let release!:(value:typeof s.port)=>void;const waiting=new Promise<typeof s.port>(resolve=>{release=resolve});s.plugin.vaultPort=()=>waiting;s.setSource('刚输入的新正文\n\n![[表情.png]] ^pic');const refresh=s.plugin.refresh();
 try{await vi.waitFor(()=>expect(s.paper().textContent).toContain('刚输入的新正文'));expect(s.panel.currentPage).toBe('preview');}
 finally{release(s.port);await refresh;}
});
it('textEditsReusePreparedImagesInsteadOfBakingThemAgainOnEveryKeystroke',async()=>{
 const s=await setup();expect(s.effects).toHaveBeenCalledTimes(1);s.setSource('改动一\n\n![[表情.png]] ^pic');await s.plugin.refresh();s.setSource('改动二\n\n![[表情.png]] ^pic');await s.plugin.refresh();
 expect(s.paper().textContent).toContain('改动二');expect(s.effects).toHaveBeenCalledTimes(1);
});
it('overlappingTypingSharesImageWorkAndOnlyPublishesTheNewestText',async()=>{
 const s=await setup();let release!:(value:{bytes:Uint8Array;mime:string})=>void;const pending=new Promise<{bytes:Uint8Array;mime:string}>(resolve=>{release=resolve});s.effects.mockImplementation(()=>pending);
 s.setSource('输入一\n\n![[表情.png]] ^pic');const first=s.plugin.refresh({forceAssets:true});await vi.waitFor(()=>expect(s.effects).toHaveBeenCalledTimes(2));
 s.setSource('输入二\n\n![[表情.png]] ^pic');const second=s.plugin.refresh();
 try{await vi.waitFor(()=>expect(s.paper().textContent).toContain('输入二'));expect(s.effects).toHaveBeenCalledTimes(2);}
 finally{release({bytes:s.bytes,mime:'image/png'});await Promise.all([first,second]);}
 expect(s.paper().textContent).toContain('输入二');expect(s.paper().textContent).not.toContain('输入一');expect(s.effects).toHaveBeenCalledTimes(2);expect(s.paper().querySelector('img')!.getAttribute('src')).not.toBe('');
});
it('explicitRefreshRebuildsAssetsAndRemovingImagesReleasesTheirUrls',async()=>{
 const s=await setup(),before=s.plugin.state().sources.get('img-0')!;await s.plugin.refresh({forceAssets:true});const after=s.plugin.state().sources.get('img-0')!;
 expect(s.effects).toHaveBeenCalledTimes(2);expect(after).not.toBe(before);expect(s.revoked).toContain(before);
 s.setSource('只保留文字');await s.plugin.refresh();expect(s.paper().textContent).toContain('只保留文字');expect(s.paper().querySelector('img')).toBeNull();expect(s.revoked).toContain(after);
});
it('sameSourceInlineAndBlockImagesUseDifferentPreparedVariants',async()=>{
 const s=await setup();await s.plugin.changeAllImages({bakeEffects:true,shadow:8},'default');
 s.setSource('表情 ![[表情.png]]\n\n![[表情.png]] ^pic');await s.plugin.refresh({forceAssets:true});
 const [inline,block]=s.paper().querySelectorAll('img');expect(inline.style.display).toBe('inline-block');expect(inline.src).not.toBe(block.src);expect(s.effects).toHaveBeenCalledTimes(2);
});
it('failedImagesLeaveNewTextVisibleAndRetryWithoutACachedRejection',async()=>{
 const s=await setup();let fail=true;s.plugin.vaultPort=async()=>({...s.port,readBinary:async()=>{if(fail)throw Error('图片暂不可读');return s.bytes;}});
 s.setSource('文字已经更新\n\n![[表情.png]] ^pic');await s.plugin.refresh({forceAssets:true});expect(s.paper().textContent).toContain('文字已经更新');expect(s.plugin.state().diagnostics).toContain('图片暂不可读');
 fail=false;await s.plugin.refresh();expect(s.paper().querySelector('img')!.getAttribute('src')).not.toBe('');expect(s.plugin.state().diagnostics).not.toContain('图片暂不可读');
});
it('unloadDuringImageProcessingDoesNotAllocateOrPublishALateUrl',async()=>{
 const s=await setup();let release!:(value:{bytes:Uint8Array;mime:string})=>void;const pending=new Promise<{bytes:Uint8Array;mime:string}>(resolve=>{release=resolve});s.effects.mockImplementation(()=>pending);
 s.setSource('处理中\n\n![[表情.png]] ^pic');const refresh=s.plugin.refresh({forceAssets:true});await vi.waitFor(()=>expect(s.effects).toHaveBeenCalledTimes(2));s.plugin.onunload();release({bytes:s.bytes,mime:'image/png'});await refresh;
 expect(s.root.children).toHaveLength(0);expect(s.revoked).toEqual(['blob:preview-0']);
});
it('nativeTypingAndAttachmentEventsRefreshAnOpenPreviewWithoutChangingTabs',async()=>{
 let source='原文字\n\n![[表情.png]] ^pic',sequence=0;const bytes=await readFile('fixtures/vault/表情.png');vi.stubGlobal('URL',class extends URL{static createObjectURL(){return 'blob:events-'+sequence++;}static revokeObjectURL(){}});
 const file=Object.assign(new TFile(),{path:'稿.md',extension:'md'}),events=new Map<string,Function>(),container=document.createElement('div');document.body.append(container);const ws=nativeWorkspace(container,file);
 Object.assign(ws.workspace,{on:(name:string,callback:Function)=>{events.set(name,callback);return{};}});
 const plugin=new WechatLayoutPlugin({workspace:ws.workspace,vault:{on:(name:string,callback:Function)=>{events.set(name,callback);return{};}}} as any,{version:'test'} as any);ws.register(plugin);plugin.getEditor=()=>({getValue:()=>source} as any);plugin.vaultPort=async()=>({listFiles:()=>['表情.png'],readBinary:async()=>bytes});vi.spyOn(plugin as any,'startBridge').mockResolvedValue(undefined);
 await plugin.onload();cleanups.push(()=>plugin.unload());await plugin.openView();await plugin.refresh();const view=ws.workspace.getLeavesOfType('wechat-layout-workspace')[0].view;view.panel.showPage('preview');const paper=()=>view.contentEl.querySelector('.wx-paper').shadowRoot;
 source='持续输入的新文字\n\n![[表情.png]] ^pic';events.get('editor-change')!({getValue:()=>source},{file});await vi.waitFor(()=>expect(paper().textContent).toContain('持续输入的新文字'));expect(view.panel.currentPage).toBe('preview');
 const before=plugin.state().sources.get('img-0');events.get('modify')!(Object.assign(new TFile(),{path:'表情.png',extension:'png'}));await vi.waitFor(()=>expect(plugin.state().sources.get('img-0')).not.toBe(before));await vi.waitFor(()=>expect(paper().querySelector('img').getAttribute('src')).toBe(plugin.state().sources.get('img-0')));expect(view.panel.currentPage).toBe('preview');
});
it('previewUsesAnExplicitMobileReadingFrameIndependentOfPanelWidth',async()=>{
 const s=await setup();const frame=s.root.querySelector<HTMLElement>('[data-reading-width]');expect(frame).not.toBeNull();expect(frame!.dataset.readingWidth).toBe('375');expect(s.root.querySelector('.wx-preview-caption')?.textContent).toContain('375');expect(s.root.querySelector('.wx-paper')!.getAttribute('style')).toContain('375px');
});
it('previewRetainsBakedPhotoGeometryAcrossTextRefreshes',async()=>{
 const s=await setup(),geometry={naturalWidth:1200,paddingRatio:0.05};s.effects.mockResolvedValue({bytes:s.bytes,mime:'image/png',geometry} as any);await s.plugin.refresh({forceAssets:true});expect(s.plugin.state().geometry?.get('img-0')).toEqual(geometry);expect(s.paper().querySelector('[data-wx-photo]')).not.toBeNull();const count=s.effects.mock.calls.length;s.setSource('修改正文\n\n![[表情.png]] ^pic');await s.plugin.refresh();expect(s.effects).toHaveBeenCalledTimes(count);expect(s.plugin.state().geometry?.get('img-0')).toEqual(geometry);
});
it('scalesTheReferenceFrameToAvailableContentWidthAndCleansUp',async()=>{
 const observers:Array<{run:()=>void;disconnect:ReturnType<typeof vi.fn>}>=[];vi.stubGlobal('ResizeObserver',class{disconnect=vi.fn();constructor(run:()=>void){observers.push({run,disconnect:this.disconnect});}observe(){}});
 const s=await setup(),scroll=s.root.querySelector<HTMLElement>('.wx-preview-scroll')!,paper=s.root.querySelector<HTMLElement>('.wx-paper')!,frame=s.root.querySelector<HTMLElement>('.wx-reading-frame')!;scroll.style.padding='16px';Object.defineProperty(scroll,'clientWidth',{value:332,configurable:true});observers.forEach(o=>o.run());expect(frame.style.width).toBe('300px');expect(Number(paper.style.zoom)).toBeCloseTo(300/375);expect(paper.style.width).toBe('375px');s.panel.destroy();expect(observers.every(o=>o.disconnect.mock.calls.length)).toBe(true);expect(()=>observers.forEach(o=>o.run())).not.toThrow();
});
it('everyNewAppearanceParameterInvalidatesItsBakedPreviewWhileTextEditsStillReuseIt',async()=>{
 const s=await setup();await s.plugin.changeAllImages({shadow:8,bakeEffects:true},'all');let calls=s.effects.mock.calls.length;
 for(const patch of [{shadowOpacity:10},{shadowBlur:20},{shadowOffsetY:4},{backgroundMode:'preserve' as const}]){await s.plugin.changeAllImages(patch,'default');expect(s.effects).toHaveBeenCalledTimes(++calls);}
 s.setSource('仅改正文\n\n![[表情.png]] ^pic');await s.plugin.refresh();expect(s.effects).toHaveBeenCalledTimes(calls);
});

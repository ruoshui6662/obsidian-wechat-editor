// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import * as obsidian from 'obsidian';
import WechatLayoutPlugin from '../src/main';
import {loadSettings} from '../src/settings';
const png=await readFile('fixtures/vault/表情.png');
afterEach(()=>vi.restoreAllMocks());
function setup(){
 let source='前文\n\n![](https://mmbiz.qpic.cn/a/640?wx_fmt=png)\n^pic\n\n后文';
 const saved=new Map<string,ArrayBuffer>(),folders=new Set<string>(['文章']);const file=Object.assign(new obsidian.TFile(),{path:'文章/稿.md',extension:'md'});
 const editor={getValue:()=>source,getCursor:()=>({line:0,ch:0}),setCursor:()=>{},replaceRange:(text:string,from:{line:number;ch:number},to:{line:number;ch:number})=>{const lines=source.split('\n');const offset=(p:typeof from)=>lines.slice(0,p.line).reduce((n,l)=>n+l.length+1,0)+p.ch;source=source.slice(0,offset(from))+text+source.slice(offset(to));},offsetToPos:(n:number)=>{const parts=source.slice(0,n).split('\n');return{line:parts.length-1,ch:parts.at(-1)!.length};}};
 const vault={getAbstractFileByPath:(p:string)=>folders.has(p)?{path:p}:null,createFolder:async(p:string)=>{folders.add(p);},createBinary:async(p:string,bytes:ArrayBuffer)=>{if(saved.has(p))throw Error('exists');saved.set(p,bytes);}};
 const plugin=new WechatLayoutPlugin({vault} as any,{version:'test'} as any);plugin.settings=loadSettings({notes:{[file.path]:{overrides:{pic:{image:{shadow:6}}}}}});plugin.activeNote=file;plugin.getEditor=()=>editor as any;plugin.readSource=async()=>source;plugin.refresh=vi.fn().mockResolvedValue(undefined);
 vi.spyOn(obsidian,'requestUrl').mockResolvedValue({status:200,arrayBuffer:png.buffer.slice(png.byteOffset,png.byteOffset+png.byteLength)} as any);
 return{plugin,saved,source:()=>source,edit:(s:string)=>{source=s}};
}
it('writes named local attachments and rewrites only image markup preserving style block IDs',async()=>{
 const s=setup();expect(await s.plugin.downloadNetworkImages()).toBe(1);expect([...s.saved.keys()][0]).toMatch(/^文章\/附件\/稿\/网络图片-[a-f0-9-]+\/图1\.png$/);expect(s.source()).not.toContain('https://');expect(s.source()).toContain('^pic');expect(s.plugin.settings.notes['文章/稿.md'].overrides.pic.image?.shadow).toBe(6);expect(await s.plugin.downloadNetworkImages()).toBe(0);
});
it('copy localizes links before constructing upload snapshot',async()=>{
 const s=setup();s.plugin.article={} as any;s.plugin.bridge={getAccount:()=>({id:'a',name:'公众号'})} as any;let snapshot:any;s.plugin.controller={run:async(value:any)=>{snapshot=value;},cancel:()=>{}} as any;
 await s.plugin.copy();expect(snapshot.article.images[0].source).not.toMatch(/^https?:/);expect(snapshot.article.blocks.find((b:any)=>b.blockId==='pic')).toBeDefined();expect(s.saved.size).toBe(1);
});
it('does not overwrite typing performed while a remote download is pending',async()=>{
 const s=setup();let resolve!:(r:any)=>void;vi.mocked(obsidian.requestUrl).mockImplementation((()=>new Promise(r=>{resolve=r})) as any);const pending=s.plugin.downloadNetworkImages();await vi.waitFor(()=>expect(resolve).toBeDefined());s.edit('用户刚刚输入的新文');resolve({status:200,arrayBuffer:png.buffer.slice(png.byteOffset,png.byteOffset+png.byteLength)});await expect(pending).rejects.toThrow(/变化/);expect(s.source()).toBe('用户刚刚输入的新文');expect(s.saved.size).toBe(0);
});
it('does not copy another article if the active note changes while localization refreshes',async()=>{
 const s=setup();s.plugin.article={} as any;s.plugin.bridge={getAccount:()=>({id:'a',name:'公众号'})} as any;const run=vi.fn();s.plugin.controller={run,cancel:()=>{}} as any;s.plugin.refresh=async()=>{s.plugin.activeNote={path:'另一篇.md',extension:'md'} as any;};await expect(s.plugin.copy()).rejects.toThrow(/变化/);expect(run).not.toHaveBeenCalled();
});
it('aborts if the same TFile is moved or renamed during download',async()=>{
 const s=setup();let resolve!:(r:any)=>void;vi.mocked(obsidian.requestUrl).mockImplementation((()=>new Promise(r=>{resolve=r})) as any);const pending=s.plugin.downloadNetworkImages();await vi.waitFor(()=>expect(resolve).toBeDefined());s.plugin.activeNote!.path='别处/稿.md';resolve({status:200,arrayBuffer:png.buffer.slice(png.byteOffset,png.byteOffset+png.byteLength)});await expect(pending).rejects.toThrow(/变化/);expect(s.source()).toContain('https://');expect(s.saved.size).toBe(0);
});
it('numbers body after template header images and saves template images locally during copy preparation',async()=>{
 const s=setup();s.plugin.settings.templates=[{id:'t',name:'方案',layout:s.plugin.settings.layout,headerMarkdown:'![](https://example.org/header)',footerMarkdown:'![](https://example.org/footer)'}];s.plugin.settings.notes['文章/稿.md'].templateId='t';await s.plugin.downloadNetworkImages();expect([...s.saved.keys()][0]).toMatch(/图2\.png$/);
 s.plugin.vaultPort=async()=>({listFiles:()=>[...s.saved.keys()],readBinary:async p=>new Uint8Array(s.saved.get(p)!)});s.plugin.effectRenderer=async bytes=>({bytes,mime:'image/png'});
 const {parseArticle}=await import('../../core/src/parse');const article=s.plugin.expandArticle(parseArticle(s.source(),'文章/稿.md'));const assets=await(s.plugin as any).prepare({article,layout:s.plugin.settings.layout,overrides:{},account:{id:'a',name:'公众号'}});expect(assets.length).toBeGreaterThan(0);expect([...s.saved.keys()].map(p=>p.split('/').at(-1))).toEqual(['图2.png','图1.png','图3.png']);
});
it('template attachment creation does not cancel its own running copy through native vault create events',async()=>{
 const s=setup(),events=new Map<string,Function>(),app=s.plugin.app as any;s.edit('正文');
 const {nativeWorkspace}=await import('../../../tests/helpers/native-workspace');const {CopyJobController}=await import('../../core/src/job');
 const container=document.createElement('div');document.body.append(container);const ws=nativeWorkspace(container,s.plugin.activeNote!);app.workspace=ws.workspace;ws.register(s.plugin);app.vault.on=(name:string,callback:Function)=>{events.set(name,callback);return{};};
 const createFolder=app.vault.createFolder,createBinary=app.vault.createBinary;app.vault.createFolder=async(path:string)=>{await createFolder(path);events.get('create')!({path});};app.vault.createBinary=async(path:string,bytes:ArrayBuffer)=>{await createBinary(path,bytes);events.get('create')!(Object.assign(new obsidian.TFile(),{path,extension:'png'}));};
 vi.spyOn(s.plugin as any,'startBridge').mockResolvedValue(undefined);await s.plugin.onload();s.plugin.settings=loadSettings({templates:[{id:'t',name:'方案',headerMarkdown:'![](https://example.org/header)',footerMarkdown:''}],notes:{'文章/稿.md':{templateId:'t',overrides:{}}}});s.plugin.article={} as any;s.plugin.bridge={getAccount:()=>({id:'a',name:'公众号'}),stop:async()=>{}} as any;s.plugin.vaultPort=async()=>({listFiles:()=>[],readBinary:async()=>{throw Error('unexpected')}});s.plugin.effectRenderer=async bytes=>({bytes,mime:'image/png'});
 let copied=false;s.plugin.controller=new CopyJobController({prepare:value=>(s.plugin as any).prepare(value),upload:async()=> 'https://mmbiz.qpic.cn/own',render:()=>({html:'正文',text:'正文',diagnostics:[]}),writeClipboard:async()=>{copied=true;},isCurrent:value=>value.revision===String(s.plugin.version),onEvent:()=>{}});
 try{await s.plugin.copy();expect(copied).toBe(true);expect(s.saved.size).toBe(1);const before=s.plugin.version;events.get('create')!(Object.assign(new obsidian.TFile(),{path:'外部图片.png',extension:'png'}));expect(s.plugin.version).toBe(before);s.plugin.article=s.plugin.expandArticle((await import('../../core/src/parse')).parseArticle('![[新配图.png]]','文章/稿.md'));events.get('create')!(Object.assign(new obsidian.TFile(),{path:'文章/新配图.png',extension:'png'}));expect(s.plugin.version).toBe(before+1);}finally{s.plugin.unload();container.remove();}
});
it('cancelDuringNetworkDownloadStopsImmediatelyWithoutChangingNoteOrStartingUploads',async()=>{
 const s=setup();s.plugin.article={} as any;s.plugin.bridge={getAccount:()=>({id:'a',name:'公众号'})} as any;const run=vi.fn(),cancel=vi.fn();s.plugin.controller={run,cancel} as any;
 let release!:(r:any)=>void;vi.mocked(obsidian.requestUrl).mockImplementation((()=>new Promise(r=>release=r)) as any);
 const pending=s.plugin.copy(),result=pending.catch(e=>e);await vi.waitFor(()=>expect(release).toBeDefined());s.plugin.host().cancel();const outcome=await Promise.race([result,new Promise(resolve=>setTimeout(()=>resolve('still pending'),50))]);expect(outcome).toMatchObject({code:'cancelled'});
 release({status:200,arrayBuffer:png.buffer.slice(png.byteOffset,png.byteOffset+png.byteLength)});await result;await new Promise(resolve=>setTimeout(resolve,0));expect(s.saved.size).toBe(0);expect(s.source()).toContain('https://');expect(run).not.toHaveBeenCalled();
});
it('cancelDuringAttachmentSaveKeepsSavedFilesButNeverRewritesTheNote',async()=>{
 const s=setup();s.plugin.article={} as any;s.plugin.bridge={getAccount:()=>({id:'a',name:'公众号'})} as any;const run=vi.fn();s.plugin.controller={run,cancel:()=>{}} as any;
 let release!:()=>void;const app=s.plugin.app as any,save=app.vault.createBinary;app.vault.createBinary=async(path:string,bytes:ArrayBuffer)=>{await save(path,bytes);await new Promise<void>(resolve=>release=resolve);};
 const pending=s.plugin.copy(),result=pending.catch(e=>e);await vi.waitFor(()=>expect(release).toBeDefined());s.plugin.host().cancel();release();expect(await result).toMatchObject({code:'cancelled'});expect(s.saved.size).toBe(1);expect(s.source()).toContain('https://');expect(run).not.toHaveBeenCalled();
});
it('cancelDuringFolderCreationDoesNotStartAnotherFileWrite',async()=>{
 const s=setup();s.plugin.article={} as any;s.plugin.bridge={getAccount:()=>({id:'a',name:'公众号'})} as any;s.plugin.controller={run:vi.fn(),cancel:()=>{}} as any;
 let release!:()=>void;const app=s.plugin.app as any,create=app.vault.createFolder;app.vault.createFolder=async(path:string)=>{await create(path);if(!release)await new Promise<void>(resolve=>release=resolve);};
 const result=s.plugin.copy().catch(e=>e);await vi.waitFor(()=>expect(release).toBeDefined());s.plugin.host().cancel();release();expect(await result).toMatchObject({code:'cancelled'});await new Promise(resolve=>setTimeout(resolve,10));expect(s.saved.size).toBe(0);expect(s.source()).toContain('https://');
});
it('noteSwitchDuringFinalSourceReadCannotCombineOldTextWithTheNewPath',async()=>{
 const s=setup();s.plugin.article={} as any;s.plugin.bridge={getAccount:()=>({id:'a',name:'公众号'})} as any;const run=vi.fn();s.plugin.controller={run,cancel:()=>{}} as any;
 let reads=0,release!:(source:string)=>void;const read=s.plugin.readSource.bind(s.plugin);s.plugin.readSource=async()=>++reads===2?new Promise(resolve=>release=resolve):read();
 const result=s.plugin.copy().catch(e=>e);await vi.waitFor(()=>expect(release).toBeDefined());const old=s.source();s.plugin.activeNote={path:'另一篇.md',extension:'md'} as any;s.plugin.invalidate();release(old);expect(await result).toMatchObject({code:'stale-snapshot'});expect(run).not.toHaveBeenCalled();
});

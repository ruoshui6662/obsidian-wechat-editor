// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import {TFile} from 'obsidian';
import WechatLayoutPlugin from '../src/main';
import {nativeWorkspace} from '../../../tests/helpers/native-workspace';
const {writes}=vi.hoisted(()=>({writes:[] as string[]}));
vi.mock('../src/clipboard',()=>({writeRichClipboard:async(value:{html:string})=>{writes.push(value.html);},writeTextClipboard:async()=>{}}));
const cleanups:Array<()=>void>=[];
afterEach(()=>{cleanups.splice(0).forEach(clean=>clean());writes.length=0;vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
const file=(path:string)=>Object.assign(new TFile(),{path,extension:path.split('.').at(-1)});
async function setup(headerMarkdown='',footerMarkdown=''){
 let source='正文\n\n![[图.png]] ^pic',account={id:'a',name:'公众号'},sequence=0;
 const files=[file('文章/稿.md'),file('文章/图.png'),file('其他/图.png'),file('开头.png'),file('结尾.png'),file('其他/别篇.md')];
 const bytes=await readFile('fixtures/vault/表情.png'),events=new Map<string,Function>(),container=document.createElement('div');document.body.append(container);
 vi.stubGlobal('URL',class extends URL{static createObjectURL(){return 'blob:event-'+sequence++;}static revokeObjectURL(){}});
 const ws=nativeWorkspace(container,files[0]);Object.assign(ws.workspace,{on:(name:string,callback:Function)=>{events.set(name,callback);return{};}});
 const vault={on:(name:string,callback:Function)=>{events.set(name,callback);return{};},getFiles:()=>files};
 const plugin=new WechatLayoutPlugin({workspace:ws.workspace,vault} as any,{version:'test'} as any);ws.register(plugin);
 vi.spyOn(plugin as any,'startBridge').mockResolvedValue(undefined);plugin.loadData=async()=>({notes:{'文章/稿.md':{content:{headerMarkdown,footerMarkdown},overrides:{}}}});
 plugin.getEditor=()=>undefined;plugin.readSource=async()=>source;plugin.vaultPort=async()=>({listFiles:()=>files.map(f=>f.path),readBinary:async()=>bytes});
 await plugin.onload();await plugin.refresh();
 let uploadStarted=false,release!:()=>void;
 plugin.bridge={getAccount:()=>account,getInfo:()=>({}),isConnected:()=>true,verifyAccount:async()=>{},upload:async()=>{uploadStarted=true;await new Promise<void>(resolve=>{release=resolve;});return 'https://mmbiz.qpic.cn/copied';},stop:async()=>{}} as any;
 cleanups.push(()=>plugin.unload());
 return {plugin,files,events,setSource:(value:string)=>{source=value;},setAccount:()=>{account={id:'b',name:'另一个公众号'};},async startCopy(){const pending=plugin.copy().then(()=>({code:'copied'}),error=>error);await vi.waitFor(()=>expect(uploadStarted).toBe(true));return{pending,release:()=>release()};}};
}
it.each(['identical-save','unrelated-image','unrelated-same-basename','unrelated-note-rename','unrelated-image-create','unrelated-image-delete'])('%s preserves an active copy',async event=>{
 const s=await setup(),copy=await s.startCopy(),revision=s.plugin.version;
 if(event==='identical-save')s.events.get('modify')!(s.files[0]);
 if(event==='unrelated-image')s.events.get('modify')!(file('无关.png'));
 if(event==='unrelated-same-basename')s.events.get('modify')!(s.files[2]);
 if(event==='unrelated-note-rename'){const other=s.files[5];other.path='其他/别篇改名.md';s.events.get('rename')!(other,'其他/别篇.md');}
 if(event==='unrelated-image-create'){const created=file('新图.png');s.files.push(created);s.events.get('create')!(created);}
 if(event==='unrelated-image-delete'){const removed=s.files.splice(2,1)[0];s.events.get('delete')!(removed);}
 await new Promise(resolve=>setTimeout(resolve,0));copy.release();
 expect(await copy.pending).toMatchObject({code:'copied'});expect(s.plugin.version).toBe(revision);expect(writes).toHaveLength(1);expect(writes[0]).toContain('https://mmbiz.qpic.cn/copied');
});
it.each(['body','header','footer'])('%s image changes cancel an active copy and rebuild its preview',async part=>{
 const s=await setup(part==='header'?'![[开头.png]]':'',part==='footer'?'![[结尾.png]]':''),copy=await s.startCopy();
 const id=part==='header'?'template-header-img-0':part==='footer'?'template-footer-img-0':'img-0',before=s.plugin.state().sources.get(id);
 s.events.get('modify')!(s.files[part==='header'?3:part==='footer'?4:1]);
 expect(await copy.pending).toMatchObject({code:'cancelled'});await vi.waitFor(()=>{expect(s.plugin.state().sources.get(id)).not.toBe(before);expect(s.plugin.state().sources.get(id)).toMatch(/^blob:event-/);});expect(writes).toHaveLength(0);copy.release();
});
it.each(['source-edit','source-rename','image-rename','image-delete','account-change'])('%s prevents copying the old snapshot',async event=>{
 const s=await setup(),copy=await s.startCopy();
 if(event==='source-edit'){s.setSource('新的正文\n\n![[图.png]]');s.events.get('modify')!(s.files[0]);await vi.waitFor(()=>expect(s.plugin.article?.source).toContain('新的正文'));}
 if(event==='source-rename'){s.files[0].path='文章/新稿.md';s.events.get('rename')!(s.files[0],'文章/稿.md');}
 if(event==='image-rename'){s.files[1].path='文章/新图.png';s.events.get('rename')!(s.files[1],'文章/图.png');}
 if(event==='image-delete'){s.events.get('delete')!(s.files.splice(1,1)[0]);}
 if(event==='account-change')s.setAccount();
 copy.release();expect(await copy.pending).toMatchObject({code:event==='account-change'?'stale-snapshot':'cancelled'});expect(writes).toHaveLength(0);
});
it('creating a competing basename cancels a copy that resolved a unique basename',async()=>{
 const s=await setup();s.files[3].path='配图/开头.png';s.setSource('![[开头.png]]');await s.plugin.refresh();const copy=await s.startCopy(),created=file('其他/开头.png');s.files.push(created);s.events.get('create')!(created);
 expect(await copy.pending).toMatchObject({code:'cancelled'});copy.release();expect(writes).toHaveLength(0);
});
it.each(['saved-source','old-preview-image','copy-image'])('%s uses the active copy snapshot when preview text is older',async event=>{
 const s=await setup();s.setSource('当前复制的正文\n\n![[开头.png]]');const copy=await s.startCopy();
 s.events.get('modify')!(s.files[event==='saved-source'?0:event==='old-preview-image'?1:3]);await new Promise(resolve=>setTimeout(resolve,0));copy.release();
 expect(await copy.pending).toMatchObject({code:event==='copy-image'?'cancelled':'copied'});expect(writes).toHaveLength(event==='copy-image'?0:1);
});
it('a source read failure after a modify event prevents copying an unverifiable snapshot',async()=>{
 const s=await setup(),copy=await s.startCopy();s.plugin.readSource=async()=>{throw Error('暂时无法读取笔记');};s.events.get('modify')!(s.files[0]);await new Promise(resolve=>setTimeout(resolve,0));copy.release();
 expect(await copy.pending).toMatchObject({code:'cancelled'});expect(writes).toHaveLength(0);
});
it.each(['same','changed'])('waits for a slow %s-source save check before writing the clipboard',async content=>{
 const s=await setup(),copy=await s.startCopy();let releaseRead!:(source:string)=>void;
 s.plugin.readSource=()=>new Promise(resolve=>{releaseRead=resolve;});s.events.get('modify')!(s.files[0]);copy.release();
 try{await new Promise(resolve=>setTimeout(resolve,0));expect(writes).toHaveLength(0);releaseRead(content==='same'?'正文\n\n![[图.png]] ^pic':'真正改变的正文');expect(await copy.pending).toMatchObject({code:content==='same'?'copied':'cancelled'});expect(writes).toHaveLength(content==='same'?1:0);}
 finally{releaseRead('正文\n\n![[图.png]] ^pic');}
});

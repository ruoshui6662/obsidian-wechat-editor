import {Plugin,ItemView,MarkdownView,TFile,FileSystemAdapter,Notice,requestUrl,type WorkspaceLeaf,type ViewStateResult} from 'obsidian';
import {realpath} from 'node:fs/promises';
import {join,posix,relative,isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseArticle} from '../../core/src/parse';
import {imageReadingWidth} from '../../core/src/image-geometry';
import {renderArticle} from '../../core/src/render';
import {normalizeLayout,mergeImageStyles,mergeImageStyleOverrides} from '../../core/src/styles';
import {CopyJobController,abortable,type Snapshot,type JobEvent} from '../../core/src/job';
import {LayoutError,type Article,type ImageStyle,type BlockOverrides,type ImageGeometry} from '../../core/src/types';
import {BridgeServer} from './bridge';
import {ConfirmBrowserPairing} from './confirm-browser-pairing';
import {prepareAssets,resolveVaultAsset,inspectImage,type VaultPort,type EffectRenderer} from './vault-assets';
import {writeRichClipboard,writeTextClipboard} from './clipboard';
import {loadSettings,type PluginSettings,type NoteSettings} from './settings';
import {LayoutPanel,type PanelState,type PanelHost} from './view';
import {ensureSelectionBlockId,resolveOverrides,migrateNotePath} from './local-styles';
import {applyTemplate} from './templates';
import {TemplateModal} from './template-modal';
import {ConfirmTemplateDelete} from './confirm-delete';
import {ConfirmImageUnify} from './confirm-image-unify';
import {articleTheme} from '../../core/src/themes';
import {renderImageEffect} from './image-effects';
import {PreviewAssets} from './preview-assets';
import {localizeRemoteImages} from './remote-images';
import {watchNativeImages,type NativeImageSelection} from './native-images';
const VIEW='wechat-layout-workspace',LEGACY=['wechat-layout-controls','wechat-layout-preview'] as const;
export default class WechatLayoutPlugin extends Plugin{
 declare settings:PluginSettings;bridge!:BridgeServer;controller!:CopyJobController;activeNote:TFile|null=null;article:Article|null=null;version=0;
 private appearanceUndo=new Map<string,{before:NoteSettings;after:string}>();
 private views=new Set<WechatLayoutView>();private opening:Promise<WorkspaceLeaf|undefined>|null=null;private pendingSaves=0;private saveError='';private saveQueue:Promise<void>=Promise.resolve();private previewAssets=new PreviewAssets();private refreshId=0;private disposed=false;private lastAccount:string|null=null;private previewSources=new Map<string,string>();private previewGeometry=new Map<string,ImageGeometry>();private previewDiagnostics:string[]=[];
 private bridgeStarting:Promise<void>|null=null;private bridgeError='';
 private downloadingImages=false;private copyAbort:AbortController|null=null;
 private attachmentCreates=new Set<string>();
 effectRenderer:EffectRenderer=renderImageEffect;
 async onload(){
  this.settings=loadSettings(await this.loadData());this.activeNote=this.app.workspace.getActiveFile();
  this.controller=new CopyJobController({verifyAccount:(account,signal)=>this.bridge.verifyAccount(account,signal),prepare:(s,signal)=>this.prepare(s,signal),upload:(a,account,signal)=>this.bridge.upload(a,account,signal),render:(s,map,geometry)=>renderArticle(s.article,s.layout,map,s.overrides,geometry),writeClipboard:writeRichClipboard,isCurrent:s=>!this.disposed&&s.revision===String(this.version)&&this.activeNote?.path===s.article.sourcePath&&this.bridge.getAccount()?.id===s.account.id,onEvent:e=>this.copyEvent(e)});
  this.registerView(VIEW,leaf=>new WechatLayoutView(leaf,this));for(const type of LEGACY)this.registerView(type,leaf=>new LegacyLayoutView(leaf,this,type));
  this.addCommand({id:'open-wechat-layout',name:'公众号图文排版',callback:()=>void this.openView()});
  this.addCommand({id:'reset-wechat-layout-pairing',name:'重新配对公众号图片助手',callback:()=>void this.resetPairing()});
  this.addCommand({id:'download-network-images',name:'下载网络图片到本地',callback:()=>{void this.downloadNetworkImages().then(count=>new Notice(count?`已下载 ${count} 张图片，保存在文章附件目录。`:'当前文章没有需要下载的网络图片。')).catch(error=>new Notice(error instanceof Error?error.message:'网络图片下载失败。'));}});
  this.addRibbonIcon('image','公众号图文排版',()=>void this.openView());
  const watched=new WeakSet<Document>();const watch=(doc:Document)=>{if(watched.has(doc))return;watched.add(doc);this.register(watchNativeImages(doc,selection=>this.openNativeImage(selection),error=>new Notice(error instanceof Error?error.message:'无法打开图片样式，请重试。')));};
  watch(this.app.workspace.containerEl.ownerDocument);this.app.workspace.iterateAllLeaves(leaf=>watch(leaf.view.containerEl.ownerDocument));this.registerEvent(this.app.workspace.on('window-open',(_win,window)=>watch(window.document)));
  this.registerEvent(this.app.workspace.on('file-open',file=>{if(file?.extension==='md'&&file.path!==this.activeNote?.path){this.activeNote=file;this.invalidate();void this.refresh();}}));
  this.registerEvent(this.app.workspace.on('editor-change',(_editor,view)=>{if(view.file?.path===this.activeNote?.path){this.invalidate();void this.refresh();}}));
  this.registerEvent(this.app.vault.on('modify',file=>{if(file.path===this.activeNote?.path||file instanceof TFile&&file.extension!=='md'){if(!(file instanceof TFile)||file.extension!=='md')this.previewAssets.clear();this.invalidate();void this.refresh();}}));
  this.registerEvent(this.app.vault.on('rename',(file,oldPath)=>{this.previewAssets.clear();migrateNotePath(this.settings.notes,oldPath,file.path);void this.persist();this.invalidate();void this.refresh();}));
  this.registerEvent(this.app.vault.on('delete',file=>{if(file.path===this.activeNote?.path){this.activeNote=null;this.article=null;this.refreshId++;this.previewAssets.clear();this.invalidate();this.pushState();}else if(!(file instanceof TFile)||file.extension!=='md'){this.previewAssets.clear();this.invalidate();void this.refresh();}}));
  this.registerEvent(this.app.vault.on('create',file=>{if(this.attachmentCreates.delete(file.path))return;if(!(file instanceof TFile)||file.extension!=='md'){this.previewAssets.clear();this.invalidate();void this.refresh();}}));
  await this.startBridge();
  this.app.workspace.onLayoutReady(()=>{void this.restoreWorkspaceLayout().catch(e=>new Notice(e instanceof Error?e.message:'无法恢复排版窗格。'));});
 }
 private async startBridge(){
  if(this.bridgeStarting)return this.bridgeStarting;
  this.bridgeStarting=this.launchBridge();
  try{await this.bridgeStarting;}finally{this.bridgeStarting=null;}
 }
 private async launchBridge(){
  this.bridgeError='';
  this.settings.bridgeId??=randomUUID();
  this.bridge=new BridgeServer({
   bridgeId:this.settings.bridgeId,name:this.app.vault.getName?.()||'Obsidian',clientId:this.settings.bridgeClientId,
   requestPairing:request=>new Promise(resolve=>new ConfirmBrowserPairing(this.app,request,resolve).open()),
   savePairing:async credentials=>{this.settings.bridgeToken=credentials.token;this.settings.bridgeOrigin=credentials.origin;this.settings.bridgeClientId=credentials.clientId;await this.persist();},
   pairingToken:this.settings.bridgeToken,origin:this.settings.bridgeOrigin,
   onChange:()=>{
    const id=this.bridge.getAccount()?.id??null;if(id!==this.lastAccount){this.lastAccount=id;this.invalidate();}
    const info=this.bridge.getInfo();if(info.origin&&info.origin!==this.settings.bridgeOrigin){this.settings.bridgeOrigin=info.origin;void this.persist();}this.pushState();
   },
  });
  try{const info=await this.bridge.start();this.settings.bridgeToken=info.pairingToken;await this.persist();}catch(e){this.bridgeError=e instanceof Error?e.message:'图片连接服务启动失败。';new Notice(this.bridgeError);}finally{this.pushState();}
 }
 async getPairingInfo():Promise<string>{
  if(this.bridgeStarting)await this.bridgeStarting;else if(!this.bridge?.getInfo().endpoint)await this.startBridge();
  const info=this.bridge.getInfo();if(!info.endpoint)throw Error(this.bridgeError||'连接服务尚未启动，请重试配对。');
  return JSON.stringify({endpoint:info.endpoint,token:info.pairingToken});
 }
 async resetPairing(){this.cancelCopy();if(this.bridgeStarting)await this.bridgeStarting;await this.bridge.stop();delete this.settings.bridgeToken;delete this.settings.bridgeOrigin;delete this.settings.bridgeClientId;await this.startBridge();if(this.bridge.getInfo().endpoint)new Notice('已解除旧连接，请在浏览器图片助手中点击连接，并在这里允许。');}
 invalidate(){this.version++;this.controller?.cancel();}
 async persist(){await this.saveData(this.settings);}
 noteSettings():NoteSettings{
  if(!this.activeNote)return{overrides:{}};return this.settings.notes[this.activeNote.path]??(this.settings.notes[this.activeNote.path]={overrides:{}});
 }
 getEditor(){return this.app.workspace.getLeavesOfType('markdown').map(l=>l.view).find((v):v is MarkdownView=>v instanceof MarkdownView&&v.file?.path===this.activeNote?.path)?.editor;}
 async readSource(){if(!this.activeNote)return '';return this.getEditor()?.getValue()??await this.app.vault.cachedRead(this.activeNote);}
 async vaultPort():Promise<VaultPort>{
  const adapter=this.app.vault.adapter;const root=adapter instanceof FileSystemAdapter?await realpath(adapter.getBasePath()):undefined;
  return {listFiles:()=>this.app.vault.getFiles().map(f=>f.path),rootRealPath:root,realPath:root?path=>realpath(join((adapter as FileSystemAdapter).getBasePath(),path)):undefined,readBinary:async path=>{const file=this.app.vault.getAbstractFileByPath(path);if(!(file instanceof TFile))throw new LayoutError('missing-image',`找不到图片：${path}`);if(file.stat.size>10*1024*1024)throw new LayoutError('image-too-large',`图片超过 10 MiB：${path}`);return new Uint8Array(await this.app.vault.readBinary(file));}};
 }
 async refresh(options:{forceAssets?:boolean}={}){
  const id=++this.refreshId;if(options.forceAssets)this.previewAssets.clear();
  const note=this.activeNote,current=()=>!this.disposed&&id===this.refreshId&&note?.path===this.activeNote?.path;
  if(!note||note.extension!=='md'){this.article=null;this.previewSources=new Map();this.previewAssets.clear();this.pushState();return;}
  const source=await this.readSource();if(!current())return;
  const article=this.expandArticle(parseArticle(source,note.path)),sources=new Map<string,string>(),diagnostics=[...article.diagnostics.map(d=>d.message)];
  const overrides=this.effectiveOverrides(article),layout=this.effectiveLayout(),geometry=new Map<string,ImageGeometry>();
  const plans=article.images.map(ref=>{
   const block=article.blocks.find(b=>b.key===ref.blockKey),style=mergeImageStyles(overrides['*']?.image,block?.blockId?overrides[block.blockId]?.image:undefined);
   const bake=style.bakeEffects&&ref.mode==='block';
   const readingWidth=imageReadingWidth(article,ref,layout,style,overrides);
   const key=JSON.stringify([note.path,!!ref.literalPath,ref.source,bake?{readingWidth,alignment:style.alignment,widthPercent:style.widthPercent,width:ref.width,radius:style.radius,shadow:style.shadow,borderWidth:style.borderWidth,borderColor:style.borderColor,background:style.background,backgroundMode:style.backgroundMode,shadowOpacity:style.shadowOpacity,shadowBlur:style.shadowBlur,shadowOffsetY:style.shadowOffsetY}:null]);
   const url=this.previewAssets.ready(key);if(url){sources.set(ref.occurrenceId,url);const g=this.previewAssets.geometry(key);if(g)geometry.set(ref.occurrenceId,g);}
   return{ref,style,bake,key};
  });
  const local=plans.filter(({ref})=>!/^https?:\/\//i.test(ref.source));
  if(local.length!==plans.length)diagnostics.push('网络图片将在复制时读取。');
  const publish=()=>{if(!current())return;this.article=article;this.previewSources=new Map(sources);this.previewGeometry=new Map(geometry);this.previewDiagnostics=[...new Set(diagnostics)];this.pushState();};
  // Text and already prepared images reach the visible preview before any file/canvas work.
  publish();this.previewAssets.retain(new Set(local.map(plan=>plan.key)));
  const missing=local.filter(plan=>!sources.has(plan.ref.occurrenceId));if(!missing.length)return;
  try{
   const vault=await this.vaultPort();if(!current())return;
   for(const {ref,style,bake,key}of missing){
    if(!current())return;
    try{
     const url=await this.previewAssets.get(key,async()=>{const asset=await resolveVaultAsset(ref,note.path,vault),info=inspectImage(asset.bytes);return bake&&info.mime!=='image/gif'?this.effectRenderer(asset.bytes,info.mime,style,imageReadingWidth(article,ref,layout,style,overrides,info.width)):{bytes:asset.bytes,mime:info.mime};});
     if(!current())return;sources.set(ref.occurrenceId,url);const g=this.previewAssets.geometry(key);if(g)geometry.set(ref.occurrenceId,g);publish();
    }catch(error){if(!current())return;diagnostics.push(error instanceof Error?error.message:'图片无法预览。');publish();}
   }
  }catch(error){if(current()){diagnostics.push(error instanceof Error?error.message:'图片无法预览。');publish();}}
 }
 expandArticle(article:Article):Article{const template=this.settings.templates.find(t=>t.id===this.noteSettings().templateId);return template?applyTemplate(article,template):article;}
 private effectiveLayout(){const template=this.settings.templates.find(t=>t.id===this.noteSettings().templateId);return normalizeLayout({...this.settings.layout,...template?.layout,...this.noteSettings().layout});}
 private effectiveOverrides(article=this.article):BlockOverrides{const note=this.noteSettings(),template=this.settings.templates.find(t=>t.id===note.templateId),base=articleTheme(this.effectiveLayout().themeId)?.image;const raw={...note.overrides,'*':{...note.overrides['*'],image:mergeImageStyles(base,template?.imageDefault,note.overrides['*']?.image)}};return article?resolveOverrides(article,raw).active:raw;}
 imageStyles(snapshot:Snapshot):Map<string,ImageStyle>{
  const map=new Map<string,ImageStyle>();for(const ref of snapshot.article.images){const block=snapshot.article.blocks.find(b=>b.key===ref.blockKey);const style=mergeImageStyles(snapshot.overrides['*']?.image,block?.blockId?snapshot.overrides[block.blockId]?.image:undefined);map.set(ref.occurrenceId,style);}return map;
 }
 private async saveDownloadedImage(path:string,bytes:Uint8Array,signal?:AbortSignal){
  const check=()=>{if(signal?.aborted)throw new LayoutError('cancelled','已取消本次复制。');};check();
  const adapter=this.app.vault.adapter,base=adapter instanceof FileSystemAdapter?await realpath(adapter.getBasePath()):undefined;
  const contained=async(path:string)=>{if(!base)return;const rel=relative(base,await realpath(join(base,path)));if(rel==='..'||rel.startsWith('../')||isAbsolute(rel))throw new LayoutError('outside-vault','附件目录指向笔记库外部，未保存图片。');};
  const create=async(path:string,action:()=>Promise<unknown>)=>{check();this.attachmentCreates.add(path);try{await action();}catch(error){this.attachmentCreates.delete(path);throw error;}};
  let folder='';for(const part of posix.dirname(path).split('/')){await contained(folder);folder=posix.join(folder,part);const existing=this.app.vault.getAbstractFileByPath(folder);if(existing instanceof TFile)throw new LayoutError('image-folder','图片附件目录与已有文件重名。');if(!existing)await create(folder,()=>this.app.vault.createFolder(folder));await contained(folder);}
  await create(path,()=>this.app.vault.createBinary(path,new Uint8Array(bytes).buffer));
 }
 async downloadNetworkImages(signal?:AbortSignal):Promise<number>{
  const check=()=>{if(signal?.aborted)throw new LayoutError('cancelled','已取消本次复制。');};check();
  if(this.downloadingImages)throw new LayoutError('image-download-busy','正在下载网络图片，请稍候。');
  const note=this.activeNote;if(!note)throw new LayoutError('no-note','请先打开一篇 Markdown 笔记。');
  const sourcePath=note.path,source=await this.readSource();check();if(!parseArticle(source,sourcePath).images.some(ref=>/^https?:\/\//i.test(ref.source)))return 0;
  if(this.downloadingImages)throw new LayoutError('image-download-busy','正在下载网络图片，请稍候。');this.downloadingImages=true;
  try{
   const editor=this.getEditor(),current=()=>!this.disposed&&this.activeNote?.path===sourcePath&&(!editor||editor.getValue()===source);
   const directory=posix.join(posix.dirname(sourcePath),'附件',posix.basename(sourcePath,'.md'),'网络图片-'+randomUUID().slice(0,8));
   const template=this.settings.templates.find(t=>t.id===this.noteSettings().templateId),numberOffset=template?parseArticle(template.headerMarkdown,sourcePath).images.length:0;
   const result=await localizeRemoteImages(source,sourcePath,{directory,numberOffset,signal,progress:signal?(done,total)=>this.copyEvent({type:'downloading',done,total}):undefined,isCurrent:current,download:async url=>{
    const response=await requestUrl({url,throw:false});if(response.status<200||response.status>=300)throw new LayoutError('image-download','网络图片读取失败，请保存到本地后替换。');return new Uint8Array(response.arrayBuffer);
   },save:async(path,bytes)=>{
    if(!current())throw new LayoutError('stale-snapshot','文章已变化，请重新下载网络图片。');
    await this.saveDownloadedImage(path,bytes,signal);
   }});
   check();if(!current())throw new LayoutError('stale-snapshot','文章已变化，下载文件已保留，原文未替换。');
   if(editor){editor.replaceRange(result.source,editor.offsetToPos(0),editor.offsetToPos(source.length),'wechat-layout');}
   else await this.app.vault.process(note,value=>{check();if(!current()||value!==source)throw new LayoutError('stale-snapshot','文章已变化，原文未替换。');return result.source;});
   this.invalidate();await this.refresh();return result.count;
  }finally{this.downloadingImages=false;}
 }
 private async prepare(snapshot:Snapshot,signal:AbortSignal=new AbortController().signal){
  const check=()=>{if(signal.aborted)throw new LayoutError('cancelled','已取消本次复制。');};check();
  const vault=await this.vaultPort(),remote=new Map<string,{bytes:Uint8Array;filename:string}>(),downloads=new Map<string,Uint8Array>();
  const directory=posix.join(posix.dirname(snapshot.article.sourcePath),'附件',posix.basename(snapshot.article.sourcePath,'.md'),'网络图片-'+randomUUID().slice(0,8));
  // Reusable header/footer templates keep their original links. Their images
  // still become numbered local attachments before upload, without editing a
  // shared template used by other notes.
  for(const [index,ref]of snapshot.article.images.entries())if(/^https?:\/\//i.test(ref.source)){
   check();
   let bytes=downloads.get(ref.source);if(!bytes){const response=await abortable(requestUrl({url:ref.source,throw:false}),signal);check();if(response.status<200||response.status>=300)throw new LayoutError('image-download',`图${index+1}下载失败，请检查图片地址。`,[ref.occurrenceId]);bytes=new Uint8Array(response.arrayBuffer);downloads.set(ref.source,bytes);}
   const info=inspectImage(bytes),extension=({'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp'} as Record<string,string>)[info.mime],filename=`图${index+1}.${extension}`;
   check();await abortable(this.saveDownloadedImage(posix.join(directory,filename),bytes,signal),signal);check();remote.set(ref.occurrenceId,{bytes,filename});
  }
  const styles=this.imageStyles(snapshot);
  return prepareAssets(snapshot.article,ref=>remote.has(ref.occurrenceId)?Promise.resolve(remote.get(ref.occurrenceId)!):resolveVaultAsset(ref,snapshot.article.sourcePath,vault),styles,this.effectRenderer,(ref,naturalWidth)=>imageReadingWidth(snapshot.article,ref,snapshot.layout,styles.get(ref.occurrenceId)!,snapshot.overrides,naturalWidth),signal);
 }
 async copy(){
  if(this.pendingSaves||this.saveError)throw new LayoutError('save-pending',this.saveError?`排版保存失败：${this.saveError}，请重试保存。`:'排版正在保存，请稍后复制。');
  if(!this.article||!this.activeNote)throw new LayoutError('no-note','请先打开一篇 Markdown 笔记。');const account=this.bridge.getAccount();if(!account)throw new LayoutError('no-account','请先连接浏览器图片助手并登录公众号。');
  this.cancelCopy();const controller=new AbortController();this.copyAbort=controller;const {signal}=controller;
  const check=()=>{if(signal.aborted)throw new LayoutError('cancelled','已取消本次复制。');};
  try{
   this.copyEvent({type:'downloading',message:'检查网络图片…'});
   const sourcePath=this.activeNote.path;await abortable(this.downloadNetworkImages(signal),signal);check();
   if(this.disposed||this.activeNote?.path!==sourcePath||this.bridge.getAccount()?.id!==account.id)throw new LayoutError('stale-snapshot','文章或公众号已变化，请重新复制。');
   if(this.pendingSaves||this.saveError)throw new LayoutError('save-pending','排版正在保存或保存失败，请稍后重试。');
   const revision=this.version,source=await abortable(this.readSource(),signal);check();
   if(this.activeNote?.path!==sourcePath||this.version!==revision||this.bridge.getAccount()?.id!==account.id)throw new LayoutError('stale-snapshot','文章或公众号已变化，请重新复制。');
   const article=this.expandArticle(parseArticle(source,sourcePath));
   const snapshot:Snapshot={id:randomUUID(),article,layout:this.effectiveLayout(),overrides:structuredClone(this.effectiveOverrides(article)),account,revision:String(this.version)};
   await this.controller.run(snapshot,signal);
  }catch(error){
   if(this.copyAbort===controller)this.copyEvent({type:error instanceof LayoutError&&error.code==='cancelled'?'cancelled':'failed',message:error instanceof Error?error.message:'复制失败，请重试。'});
   throw error;
  }finally{if(this.copyAbort===controller)this.copyAbort=null;}
 }
 private copyEvent(event:JobEvent){for(const view of this.views)view.panel?.setJobEvent(event);}
 private cancelCopy(){this.copyAbort?.abort();this.controller?.cancel();}

 async changeBlock(key:string,patch:{text?:Partial<import('../../core/src/types').LayoutSettings>;image?:Partial<ImageStyle>}){
  const article=this.article,noteFile=this.activeNote;const block=article?.blocks.find(b=>b.key===key);if(!block||!noteFile||article?.sourcePath!==noteFile.path||key.startsWith('template-'))throw new LayoutError('block-range','请在当前笔记中选择段落或独立图片。');
  const source=await this.readSource();if(this.activeNote?.path!==noteFile.path||this.article?.source!==article!.source)throw new LayoutError('block-range','笔记或内容已变化，请重新选择。');const result=ensureSelectionBlockId(source,article!,key,()=> 'wx-'+randomUUID());
  if(result.edit){const editor=this.getEditor();if(!editor)throw new LayoutError('editor-required','请先打开当前笔记的编辑器，再调整局部样式。');editor.replaceRange(result.edit.text,editor.offsetToPos(result.edit.from),editor.offsetToPos(result.edit.to),'wechat-layout');}
  const note=this.noteSettings();const current=note.overrides[result.blockId]||{};note.overrides[result.blockId]={text:{...current.text,...patch.text},image:mergeImageStyleOverrides(current.image,patch.image)};this.invalidate();try{await this.saveLayout();}finally{await this.refresh();}return result.blockId;
 }
 private async appearanceChange(change:(note:NoteSettings)=>void){
  if(!this.activeNote||this.article?.sourcePath!==this.activeNote.path)throw Error('请先打开当前笔记。');
  const path=this.activeNote.path,note=this.noteSettings(),before=structuredClone(note);change(note);
  this.appearanceUndo.set(path,{before,after:JSON.stringify(note)});this.invalidate();await this.saveLayout();await this.refresh();
 }
 async undoAppearance(){
  const path=this.activeNote?.path;if(!path)return;const entry=this.appearanceUndo.get(path);
  if(!entry||entry.after!==JSON.stringify(this.noteSettings()))return;
  this.settings.notes[path]=structuredClone(entry.before);this.appearanceUndo.delete(path);this.invalidate();await this.saveLayout();await this.refresh();
 }
 async applyArticleTheme(id:string){
  const theme=articleTheme(id);if(!theme)return;
  const includeTitle=this.effectiveLayout().includeTitle;
  await this.appearanceChange(note=>{note.layout={...theme.layout,includeTitle};});
 }
 async changeAllImages(patch:Partial<ImageStyle>,mode:'default'|'all'='all'){
  await this.appearanceChange(note=>{
   const overrides=note.overrides;
   if(mode==='all')for(const [id,value]of Object.entries(overrides))if(id!=='*'&&value.image){delete value.image;if(!value.text||!Object.keys(value.text).length)delete overrides[id];}
   overrides['*']={...overrides['*'],image:mode==='all'?{...patch}:mergeImageStyleOverrides(overrides['*']?.image,patch)};
  });
 }
 async requestImageStyle(patch:Partial<ImageStyle>,mode:'default'|'all'='default'){
  const path=this.activeNote?.path,note=this.noteSettings(),before=JSON.stringify(note),revision=this.version;
  if(mode==='all'){
   const accepted=await new Promise<boolean>(resolve=>{const modal=new ConfirmImageUnify(this.app,resolve);this.register(()=>modal.close());modal.open();});
   if(!accepted)return false;
   if(this.disposed||path!==this.activeNote?.path||revision!==this.version||before!==JSON.stringify(this.noteSettings()))throw Error('文章或样式已变化，请重新应用。');
  }
  await this.changeAllImages(patch,mode);return true;
 }
 async resetImageStyle(key:string){
  const block=this.article?.blocks.find(b=>b.key===key);if(!block?.blockId)return;const id=block.blockId;
  await this.appearanceChange(note=>{if(note.overrides[id]){delete note.overrides[id].image;if(!Object.keys(note.overrides[id].text??{}).length)delete note.overrides[id];}});
 }
 editTemplate(createNew=false){
  const current=this.settings.templates.find(t=>t.id===this.noteSettings().templateId);
  const template={id:createNew||!current?randomUUID():current.id,name:createNew?'我的排版方案':current?.name||'我的排版方案',layout:this.effectiveLayout(),imageDefault:{...this.effectiveOverrides()['*']?.image},headerMarkdown:current?.headerMarkdown||'',footerMarkdown:current?.footerMarkdown||''};
  const target=this.noteSettings();const modal=new TemplateModal(this.app,template,async value=>{if(this.disposed)throw Error('插件已关闭。');const index=this.settings.templates.findIndex(t=>t.id===value.id);if(index>=0)this.settings.templates[index]=value;else this.settings.templates.push(value);target.templateId=value.id;target.layout={};if(target.overrides['*'])delete target.overrides['*'].image;this.invalidate();await this.saveLayout();await this.refresh();});this.register(()=>modal.close());modal.open();
 }
 confirmDeleteTemplate(id:string){
  const template=this.settings.templates.find(t=>t.id===id);if(!template||this.disposed)return;
  const count=Object.values(this.settings.notes).filter(note=>note.templateId===id).length;
  const modal=new ConfirmTemplateDelete(this.app,template.name,count,()=>{
   if(this.disposed||!this.settings.templates.some(t=>t.id===id))return;
   this.settings.templates=this.settings.templates.filter(t=>t.id!==id);for(const note of Object.values(this.settings.notes))if(note.templateId===id)delete note.templateId;
   this.invalidate();void this.saveLayout().catch(()=>{});void this.refresh();
  });this.register(()=>modal.close());modal.open();
 }
 private changeTextLayout(patch:Partial<import('../../core/src/types').LayoutSettings>){
  const note=this.noteSettings();note.layout={...note.layout,...patch};
  for(const [id,override]of Object.entries(note.overrides)){
   if(override.text){for(const key of Object.keys(patch) as Array<keyof import('../../core/src/types').LayoutSettings>)delete override.text[key];if(!Object.keys(override.text).length)delete override.text;}
   if(!override.text&&!override.image)delete note.overrides[id];
  }
  this.invalidate();void this.saveLayout().catch(()=>{});
 }
 host():PanelHost{return{retrySave:()=>{void this.saveLayout().then(()=>this.refresh()).catch(()=>{});},copy:()=>this.copy(),cancel:()=>this.cancelCopy(),getPairingInfo:()=>this.getPairingInfo(),copyPairing:text=>writeTextClipboard(text),changeLayout:patch=>this.changeTextLayout(patch),refresh:()=>void this.refresh({forceAssets:true}),resetPairing:()=>this.resetPairing(),changeBlock:(key,patch)=>this.changeBlock(key,patch),changeAllImages:(patch,mode)=>this.requestImageStyle(patch,mode),resetImageStyle:key=>this.resetImageStyle(key),applyArticleTheme:id=>this.applyArticleTheme(id),undoAppearance:()=>this.undoAppearance(),saveTemplate:()=>this.editTemplate(true),editTemplate:()=>this.editTemplate(),applyTemplate:id=>{this.noteSettings().templateId=id||undefined;this.noteSettings().layout={};if(this.noteSettings().overrides['*'])delete this.noteSettings().overrides['*'].image;this.invalidate();void this.saveLayout().catch(()=>{});void this.refresh();},deleteTemplate:id=>this.confirmDeleteTemplate(id)};}
 state():PanelState{return{themeOverride:!!this.noteSettings().layout?.themeId,canUndoAppearance:!!this.activeNote&&this.appearanceUndo.get(this.activeNote.path)?.after===JSON.stringify(this.noteSettings()),saving:this.pendingSaves>0,saveError:this.saveError,pluginVersion:this.manifest.version,article:this.article,layout:this.effectiveLayout(),overrides:this.effectiveOverrides(),sources:this.previewSources,geometry:this.previewGeometry,account:this.bridge?.getAccount()??null,bridgeConnected:this.bridge?.isConnected()??false,pairingReady:!!this.bridge?.getInfo().endpoint,templates:this.settings.templates,templateId:this.noteSettings().templateId,diagnostics:[...this.previewDiagnostics,...(this.article?resolveOverrides(this.article,this.noteSettings().overrides).diagnostics.map(d=>d.message):[])]};}
 pushState(){if(this.disposed)return;const state=this.state();for(const view of this.views)view.panel?.setState(state);}
 attach(view:WechatLayoutView){if(this.disposed){view.panel?.destroy();return;}this.views.add(view);view.panel?.setState(this.state());void this.refresh();}
 detach(view:WechatLayoutView){this.views.delete(view);if(!this.views.size){this.refreshId++;this.releaseUrls();}}
 private releaseUrls(){this.previewAssets.clear();}
 async restoreViewSource(state:unknown){
  if(this.disposed||this.activeNote||!state||typeof state!=='object'||!('sourcePath' in state)||typeof state.sourcePath!=='string')return;
  const file=this.app.vault.getAbstractFileByPath(state.sourcePath);if(file instanceof TFile&&file.extension==='md'){this.activeNote=file;await this.refresh();}
 }
 private saveLayout(){
  this.pendingSaves++;this.saveError='';this.pushState();
  const save=this.saveQueue.catch(()=>{}).then(()=>this.persist());this.saveQueue=save;
  return save.then(()=>{this.saveError='';},error=>{this.saveError=error instanceof Error?error.message:'无法保存排版，请重试。';throw error;}).finally(()=>{this.pendingSaves--;this.pushState();});
 }
 private async restoreWorkspaceLayout(){
  const workspace=this.app.workspace,leaves=[...workspace.getLeavesOfType(VIEW),...LEGACY.flatMap(type=>workspace.getLeavesOfType(type))];if(this.disposed||!leaves.length)return;
  // Saved source wins over the fallback, even when both custom views are deferred.
  if(!this.activeNote)for(const leaf of leaves)await this.restoreViewSource(leaf.getViewState().state);
  if(!this.activeNote){const source=workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).find((view):view is MarkdownView=>view instanceof MarkdownView&&view.file?.extension==='md');this.activeNote=source?.file??null;}
  await this.openView(this.activeNote??undefined);
 }
 async openView(note?:TFile,reveal=true){
  if(this.disposed)return;const current=note??this.app.workspace.getActiveFile();if(current?.extension==='md')this.activeNote=current;
  const existed=this.app.workspace.getLeavesOfType(VIEW).length>0;
  if(!this.opening)this.opening=this.openWorkspaceViews();const pending=this.opening;
  try{const leaf=await pending;if(leaf&&!this.disposed&&(reveal||!existed))await this.app.workspace.revealLeaf(leaf);}finally{if(this.opening===pending)this.opening=null;}
 }
 private async openWorkspaceViews():Promise<WorkspaceLeaf|undefined>{
  if(this.disposed)return;const workspace=this.app.workspace,legacy=LEGACY.flatMap(type=>workspace.getLeavesOfType(type));let leaf=workspace.getLeavesOfType(VIEW)[0];let created=false;
  if(!this.activeNote)for(const old of legacy)await this.restoreViewSource(old.getViewState().state);
  if(this.disposed)return;
  if(!leaf){
   leaf=legacy[0]??workspace.getRightLeaf(false)??workspace.getLeaf('tab');created=!legacy.includes(leaf);
   const old=leaf.getViewState(),page=old.type==='wechat-layout-preview'?'preview':'editor';
   await leaf.setViewState({type:VIEW,state:{sourcePath:this.activeNote?.path,page},active:true});
   if(this.disposed){if(created)leaf.detach();return;}
  }
  await leaf.loadIfDeferred();if(this.disposed){if(created)leaf.detach();return;}
  // Only remove our obsolete views after the replacement has opened successfully.
  for(const old of legacy)if(old!==leaf)old.detach();
  for(const duplicate of workspace.getLeavesOfType(VIEW))if(duplicate!==leaf)duplicate.detach();
  return leaf;
 }
 async openNativeImage(selection:NativeImageSelection){
  if(this.disposed)return;const path=selection.file.path;if(this.activeNote?.path!==path){this.activeNote=selection.file;this.invalidate();}
  await this.openView(selection.file,false);await this.refresh();
  if(this.disposed)return;if(this.activeNote?.path!==path||this.article?.sourcePath!==path||this.article.source!==selection.source)throw Error('笔记或图片位置已变化，请重新单击图片。');
  let selected=false;for(const view of this.views)if(view.panel?.selectImage(selection.occurrenceId))selected=true;
  if(!selected)throw Error('暂时无法选择图片，请等待样式保存完成后重试。');
 }
 onunload(){this.disposed=true;this.attachmentCreates.clear();this.cancelCopy();this.releaseUrls();void this.bridge?.stop();for(const view of this.views)view.panel?.destroy();this.views.clear();}
}
abstract class SourceBoundView extends ItemView{
 constructor(leaf:WorkspaceLeaf,protected plugin:WechatLayoutPlugin){super(leaf);}
 getState(){return{sourcePath:this.plugin.activeNote?.path};}
 async setState(state:unknown,result:ViewStateResult){await this.plugin.restoreViewSource(state);await super.setState(state,result);}
}
export class WechatLayoutView extends SourceBoundView{
 panel?:LayoutPanel;
 getState(){return{...super.getState(),page:this.panel?.currentPage??'editor'};}
 async setState(state:unknown,result:ViewStateResult){await super.setState(state,result);if(state&&typeof state==='object'&&'page' in state&&(state.page==='editor'||state.page==='preview'))this.panel?.showPage(state.page);}
 getViewType(){return VIEW;}getDisplayText(){return '公众号图文排版';}getIcon(){return 'image';}
 async onOpen(){this.contentEl.replaceChildren();this.panel=new LayoutPanel(this.contentEl,this.plugin.host());this.plugin.attach(this);}
 async onClose(){this.plugin.detach(this);this.panel?.destroy();this.panel=undefined;}
}

/** Old workspace types remain registered only so saved layouts can migrate. */
class LegacyLayoutView extends SourceBoundView{
 constructor(leaf:WorkspaceLeaf,plugin:WechatLayoutPlugin,private type:string){super(leaf,plugin);}
 getViewType(){return this.type;}getDisplayText(){return '公众号图文排版';}getIcon(){return 'image';}
 async onOpen(){this.contentEl.textContent='正在恢复排版工作区…';}
 async onClose(){this.contentEl.replaceChildren();}
}

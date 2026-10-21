import {Menu,setIcon,setTooltip} from 'obsidian';
import {iconButton} from './chrome';
import type {Account,Article,BlockOverrides,LayoutSettings,ImageStyle} from '../../core/src/types';
import type {JobEvent} from '../../core/src/job';
import {DEFAULT_LAYOUT,LAYOUT_RANGES,normalizeImage,mergeImageStyles,imageContainerInset} from '../../core/src/styles';
import {numberControl,selectControl,PresetNumberControl} from './controls';
import type {Template} from './settings';
import {ImageInspector} from './image-inspector';
import {displayVersion} from './version';
import {ArticlePreview} from './article-preview';
import {WorkspacePages} from './workspace-pages';
import {StatusBarInset} from './status-bar-inset';
import {SidebarWidth} from './sidebar-width';
import {ARTICLE_THEMES,articleTheme,themeIsAdjusted} from '../../core/src/themes';
export interface ContentSelection {path:string;key:string|null;imageId:string|null}
export interface PanelState {themeOverride?:boolean;canUndoAppearance?:boolean;pluginVersion?:string;article:Article|null;layout:LayoutSettings;overrides:BlockOverrides;geometry?:ReadonlyMap<string,import('../../core/src/types').ImageGeometry>;sources:ReadonlyMap<string,string>;account:Account|null;pairingReady:boolean;bridgeConnected?:boolean;templates?:Template[];templateId?:string;diagnostics?:string[];saving?:boolean;saveError?:string}
export interface PanelHost {selectionChanged?(selection:ContentSelection):void;retrySave?():void;copy():Promise<void>;cancel():void;getPairingInfo():Promise<string>;copyPairing(text:string):Promise<void>;changeLayout(patch:Partial<LayoutSettings>):void;refresh():void;changeBlock?(blockKey:string,patch:{text?:Partial<LayoutSettings>;image?:Partial<ImageStyle>}):Promise<string|void>;changeAllImages?(patch:Partial<ImageStyle>,mode?:'default'|'all'):Promise<boolean|void>|void;resetImageStyle?(key:string):Promise<void>;applyArticleTheme?(id:string):Promise<void>|void;undoAppearance?():Promise<void>;saveTemplate?():void;applyTemplate?(id:string):void;editTemplate?():void;deleteTemplate?(id:string):void;resetPairing?():Promise<void>}
export class LayoutPanel {
 private sidebarWidth:SidebarWidth;private viewport:StatusBarInset;private menu?:Menu;private renderedArticle:Article|null=null;
 private layoutNumbers=new Map<keyof LayoutSettings,PresetNumberControl>();
 private preview:ArticlePreview;private pages:WorkspacePages;private editorTop=0;private locateSelection=false;
 private imageEffectsOpen=false;private selectedImage:string|null=null;private imageEditor?:ImageInspector;private imageTarget?:{path:string;key:string;id?:string;source:string};private imageWrites=0;
 private jobMessage='';private pairingBusy=false;private pairRequest=0;private destroyed=false;
 private state:PanelState={article:null,layout:DEFAULT_LAYOUT,overrides:{},sources:new Map(),account:null,pairingReady:false};private busy=false;private selected:string|null=null;
 constructor(private root:HTMLElement,private host:PanelHost){
  root.classList.add('wx-layout','wx-workspace-view');root.innerHTML=`
<header class="wx-header"><strong class="wx-article-title">打开一篇笔记</strong><div class="wx-connection"><span class="wx-dot"></span><span data-account>图片助手未连接</span><button data-action="pair">连接</button></div></header>
<nav class="wx-navigation" aria-label="排版功能"></nav>
<div class="wx-workspace">
 <section class="wx-operations wx-page" data-page="editor" aria-label="排版操作区">
  <div class="wx-operations-scroll" data-operations-scroll>
   <div class="wx-editor-content">
    <section class="wx-template-section" aria-label="排版方案"><div class="wx-template-row"><span class="wx-theme-choice"><span data-theme-swatches aria-hidden="true"></span><select aria-label="文章主题与个人方案" data-template><option value="">当前排版</option></select></span><button data-action="save-template" title="将当前排版另存为个人方案">另存为</button><button data-action="more" aria-label="方案更多操作">更多</button></div></section>
    <details class="wx-settings wx-card" open><summary>全文排版</summary><div data-controls><div class="wx-grid wx-common-controls" data-common-controls></div><p class="wx-font-hint" data-font-hint hidden>思源宋体可免费商用，预览需本机安装。未安装或微信端字体不可用时，会回退为系统宋体。</p><details class="wx-disclosure" data-heading-options><summary>三级标题 <span data-heading-summary>18 px · 蓝色分段</span></summary><div class="wx-grid" data-heading-controls></div></details><details class="wx-disclosure" data-spacing-options><summary>段落节奏 <span>标题与相邻留白</span></summary><div class="wx-grid" data-spacing-controls></div><p class="wx-font-hint">自动协调取相邻间距的较大值，避免重复留白。原有参数均保留，可随时切回原有间距。</p></details><details class="wx-disclosure" data-text-more><summary>更多文字选项 <span>字距、缩进、颜色</span></summary><div class="wx-grid" data-advanced-controls></div></details></div></details>
    <details class="wx-selected wx-card" open><summary><span data-selection-title>图片排版</span></summary><div class="wx-image-context"><span data-image-scope>文章默认</span><button data-action="image-defaults" class="wx-text-action" hidden>返回文章默认</button><button data-action="reset-image" class="wx-text-action" hidden>使用文章默认</button></div><p class="wx-selection-hint" data-selection-label>点击笔记中的图片，可单独调整。</p><div data-selected-controls></div></details>
    <section class="wx-template-end wx-card"><button class="wx-tail-entry" data-action="edit-template"><strong>头尾内容</strong><span data-tail-summary>未设置</span><span data-tail-chevron aria-hidden="true"></span></button></section>
   </div>
  </div>
 </section>
 <section class="wx-page" data-page="preview"></section>
</div>
<footer class="wx-footer"><div class="wx-feedback"><span data-status-icon aria-hidden="true"></span><p role="status">先打开一篇 Markdown 笔记。</p></div><details class="wx-status-details" data-status-details hidden><summary>查看详情</summary><div data-status-message tabindex="0" role="region" aria-label="完整状态信息"></div></details><div class="wx-actions"><button data-action="undo-appearance" class="wx-secondary" hidden>撤销</button><button data-action="refresh" class="wx-secondary" title="重新读取当前文章">刷新</button><button data-action="retry-save" class="wx-secondary" hidden>重试保存</button><button data-action="cancel" class="wx-secondary" hidden>取消</button><button data-action="copy" class="wx-primary">复制图文</button></div><span class="wx-version" hidden>本地验证版</span></footer>`;
  setIcon(root.querySelector('[data-tail-chevron]')!,'chevron-right');this.makeControls();iconButton(this.button('refresh'),'refresh-cw','重新读取当前文章');iconButton(this.button('more'),'ellipsis','方案更多操作');
  this.preview=new ArticlePreview(root.querySelector('[data-page=preview]')!);
  const editor=root.querySelector<HTMLElement>('[data-page=editor]')!,scroll=root.querySelector<HTMLElement>('[data-operations-scroll]')!;
  this.pages=new WorkspacePages(root.querySelector('.wx-navigation')!,[
   {id:'editor',label:'编辑',el:editor,beforeHide:()=>{this.menu?.hide();this.imageEditor?.closeMenu();const active=root.ownerDocument.activeElement;if(active instanceof HTMLInputElement&&editor.contains(active)){active.dispatchEvent(new Event('change',{bubbles:true}));active.blur();}},onHide:()=>{this.editorTop=scroll.scrollTop;},onShow:()=>{scroll.scrollTop=this.editorTop;if(this.locateSelection){this.locateSelection=false;this.revealSelection();}}},
   {id:'preview',label:'预览',el:root.querySelector('[data-page=preview]')!,onHide:()=>this.preview.setActive(false),onShow:()=>this.preview.setActive(true)},
  ]);
  this.button('image-defaults').addEventListener('click',()=>{if(this.imageEditor?.hasPending)return;this.clearImageEditor();this.selected=null;this.selectedImage=null;this.showSelection();this.markSelection();});
  this.button('reset-image').addEventListener('click',()=>{if(this.imageEditor?.hasPending||!this.selected)return;void host.resetImageStyle?.(this.selected).catch(e=>this.status(e.message));});
  this.button('undo-appearance').addEventListener('click',()=>{void host.undoAppearance?.().catch(e=>this.status(e.message));});
  this.button('retry-save').addEventListener('click',()=>{if(this.imageEditor?.hasFailed)this.imageEditor.retrySave();else host.retrySave?.();});
  this.button('copy').addEventListener('click',()=>{this.busy=true;this.updateButtons();void host.copy().catch(e=>this.setJobEvent({type:e?.code==='cancelled'?'cancelled':'failed',message:e instanceof Error?e.message:'复制失败'}));});
  this.button('cancel').addEventListener('click',()=>host.cancel());this.button('refresh').addEventListener('click',()=>host.refresh());
  const pairing=document.createElement('section');pairing.className='wx-pairing';pairing.dataset.pairing='';pairing.hidden=true;
  pairing.innerHTML='<strong>连接浏览器图片助手</strong><p>在浏览器工具栏打开图片助手，点击「连接 Obsidian」，然后在这里允许连接。首次允许后会自动恢复，无需选择公众号。</p><p data-pair-status aria-live="polite"></p><details><summary data-action="legacy-pair">旧版助手连接方式</summary><textarea data-pair-text aria-label="配对信息" rows="3" readonly spellcheck="false"></textarea><div class="wx-pair-actions"><button data-action="copy-pair">复制配对信息</button><button data-action="select-pair">选中信息</button></div></details><div class="wx-pair-actions"><button data-action="close-pair">关闭</button></div>';
  root.querySelector('.wx-editor-content')!.prepend(pairing);
  this.button('pair').addEventListener('click',()=>{this.showPage('editor');pairing.hidden=false;this.pairStatus('等待从浏览器助手发起连接');});
  this.root.querySelector('[data-action=legacy-pair]')!.addEventListener('click',()=>{if(!this.pairText().value)void this.openPairing();});
  this.button('copy-pair').addEventListener('click',()=>void this.copyPairing());
  this.button('select-pair').addEventListener('click',()=>{const text=this.pairText();text.focus();text.select();this.pairStatus('已选中，请按 ⌘C（Windows：Ctrl+C）复制，再粘贴到浏览器图片助手。');});
  this.button('close-pair').addEventListener('click',()=>{this.pairRequest++;this.pairingBusy=false;this.pairText().value='';pairing.hidden=true;this.updateButtons();});
  this.button('more').addEventListener('click',()=>this.openMenu());this.button('save-template').addEventListener('click',()=>host.saveTemplate?.());this.button('edit-template').addEventListener('click',()=>host.editTemplate?.());
  root.querySelector<HTMLSelectElement>('[data-template]')!.addEventListener('change',e=>{const id=(e.target as HTMLSelectElement).value;if(id.startsWith('theme:'))void Promise.resolve(host.applyArticleTheme?.(id.slice(6))).catch(e=>this.status(e.message));else host.applyTemplate?.(id);});
  this.viewport=new StatusBarInset(root);this.sidebarWidth=new SidebarWidth(root);

 }
 private openMenu(){
  this.menu?.hide();const path=this.state.article?.sourcePath,id=this.state.templateId;
  const current=()=>!this.destroyed&&!this.imageEditor?.hasPending&&!this.state.saving&&!this.busy&&path===this.state.article?.sourcePath&&id===this.state.templateId;
  const menu=this.menu=new Menu();menu.addItem(item=>item.setTitle('编辑头尾内容').setIcon('panel-top-bottom-dashed').setDisabled(!path).onClick(()=>{if(current())this.host.editTemplate?.();}));
  menu.addItem(item=>item.setTitle('恢复主题').setIcon('rotate-ccw').setDisabled(!path||!this.state.layout.themeId).onClick(()=>{if(current()&&this.state.layout.themeId)void Promise.resolve(this.host.applyArticleTheme?.(this.state.layout.themeId)).catch(e=>this.status(e.message));}));
  menu.addItem(item=>item.setTitle('删除方案…').setIcon('trash-2').setWarning(true).setDisabled(!id).onClick(()=>{if(current()&&id)this.host.deleteTemplate?.(id);}));
  const rect=this.button('more').getBoundingClientRect();menu.showAtPosition({x:rect.left,y:rect.bottom+4},this.root.ownerDocument);
 }
 selectImage(occurrenceId:string):boolean{
  const image=this.state.article?.images.find(ref=>ref.occurrenceId===occurrenceId);if(!image)return false;
  if(!this.selectBlock(image.blockKey,occurrenceId))return false;
  return true;
 }
 selectBlock(key:string,imageId:string|null):boolean{
  if((this.imageWrites>0||this.imageEditor?.hasPending)&&key!==this.selected){this.status('图片样式正在保存，请稍候再选择另一张。');return false;}
  if(key!==this.selected||imageId!==this.selectedImage)this.clearImageEditor();this.selected=key;this.selectedImage=imageId;
  this.root.querySelector<HTMLDetailsElement>('.wx-selected')!.open=true;this.showSelection();this.markSelection();this.revealSelection();return true;
 }
 get currentPage(){return this.pages.current;}
 showPage(id:'editor'|'preview'){this.pages.show(id);}
 private revealSelection(){if(this.currentPage==='editor')this.root.querySelector<HTMLElement>('.wx-selected')!.scrollIntoView?.({block:'nearest'});else this.locateSelection=true;}
 private button(action:string){return this.root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;}
 private status(message:string){
  this.root.querySelector('[role=status]')!.textContent=message.length>90?message.slice(0,90)+'…':message;
  const details=this.root.querySelector<HTMLDetailsElement>('[data-status-details]')!;details.hidden=message.length<=90;this.root.querySelector('[data-status-message]')!.textContent=message;if(details.hidden)details.open=false;
  const error=!!this.state.saveError||!!this.imageEditor?.hasFailed||message.startsWith('复制失败');this.root.querySelector('.wx-feedback')!.classList.toggle('is-error',error);setIcon(this.root.querySelector('[data-status-icon]')!,error?'circle-alert':message==='已保存'?'circle-check':this.busy||this.state.saving||this.imageEditor?.hasPending?'loader-circle':'info');
 }
 private pairText(){return this.root.querySelector<HTMLTextAreaElement>('[data-pair-text]')!;}
 private pairStatus(message:string){this.root.querySelector('[data-pair-status]')!.textContent=message;}
 private async openPairing(){
  const request=++this.pairRequest;this.root.querySelector<HTMLElement>('[data-pairing]')!.hidden=false;this.pairText().value='';this.pairingBusy=true;this.pairStatus('正在准备配对信息…');this.updateButtons();
  try{
   const text=await this.host.getPairingInfo();if(this.destroyed||request!==this.pairRequest)return;
   this.pairText().value=text;await this.copyPairing(request);
  }catch(e){if(!this.destroyed&&request===this.pairRequest)this.pairStatus(e instanceof Error?e.message:'无法生成配对信息，请重试。');}
  finally{if(!this.destroyed&&request===this.pairRequest){this.pairingBusy=false;this.updateButtons();}}
 }
 private async copyPairing(request=this.pairRequest){
  const text=this.pairText().value;if(!text)return;this.pairingBusy=true;this.pairStatus('正在复制配对信息…');this.updateButtons();
  try{await this.host.copyPairing(text);if(!this.destroyed&&request===this.pairRequest)this.pairStatus('配对信息已复制，请粘贴到浏览器图片助手，再点击“连接 Obsidian”。');}
  catch(e){if(!this.destroyed&&request===this.pairRequest)this.pairStatus(e instanceof Error?e.message:'自动复制失败，请选中下方配对信息后手动复制。');}
  finally{if(!this.destroyed&&request===this.pairRequest){this.pairingBusy=false;this.updateButtons();}}
 }
 private makeControls(){
  const p=this.root.querySelector<HTMLElement>('[data-common-controls]')!,advanced=this.root.querySelector<HTMLElement>('[data-advanced-controls]')!;
  selectControl(p,'字体','fontFamily','sans',[['system','系统默认'],['sans','系统黑体'],['serif','系统宋体'],['source-han-serif','思源宋体']],v=>this.host.changeLayout({fontFamily:v as LayoutSettings['fontFamily']}));
  for(const [key,label,presets,step,unit]of [
   ['fontSize','字号',[10,11,12,13,14,15,16,17,18,19,20,24,28,32,36],1,'px'],
   ['lineHeight','行距',[1,1.5,1.75,2,2.5,3],.05,'倍'],
   ['letterSpacing','字距',[0,.5,1,2],.1,'px'],
   ['paragraphBefore','段前距',[0,8,16,24,32,40,48],1,'px'],
   ['paragraphAfter','段后距',[0,8,16,24,32,40,48],1,'px'],
   ['sidePadding','两侧留白',[0,8,16,32,48],1,'px'],
   ['firstLineIndent','首行缩进',[0,2],.5,'字'],
  ]as const){const [min,max]=LAYOUT_RANGES[key];this.layoutNumbers.set(key,new PresetNumberControl(['letterSpacing','firstLineIndent'].includes(key)?advanced:p,label,key,Number(DEFAULT_LAYOUT[key]),presets,min,max,value=>this.host.changeLayout({[key]:value}),{step,unit,presentation:'select'}));}
  const headings=this.root.querySelector<HTMLElement>('[data-heading-controls]')!;
  this.layoutNumbers.set('h3FontSize',new PresetNumberControl(headings,'标题字号','h3FontSize',18,[16,18,20,22,24],10,50,value=>this.host.changeLayout({h3FontSize:value}),{unit:'px',presentation:'select'}));
  selectControl(headings,'标题装饰','h3AccentBar','true',[['true','蓝色分段'],['false','无装饰']],value=>this.host.changeLayout({h3AccentBar:value==='true'}));
  const rhythm=this.root.querySelector<HTMLElement>('[data-spacing-controls]')!;
  selectControl(rhythm,'间距规则','spacingMode','smart',[['smart','自动协调'],['manual','原有间距']],value=>this.host.changeLayout({spacingMode:value as LayoutSettings['spacingMode']})).closest('.wx-field')!.classList.add('wx-full-row');
  for(const [key,label]of [['headingBefore','标题前距'],['headingAfter','标题后距']] as const)this.layoutNumbers.set(key,new PresetNumberControl(rhythm,label,key,DEFAULT_LAYOUT[key],[0,8,12,16,24,28,32],0,64,value=>this.host.changeLayout({[key]:value}),{unit:'px',presentation:'select'}));
  selectControl(advanced,'对齐','textAlign','left',[['left','左对齐'],['justify','两端对齐']],v=>this.host.changeLayout({textAlign:v as 'left'|'justify'}));
  selectControl(advanced,'复制标题','includeTitle','false',[['false','只复制正文'],['true','包含标题']],v=>this.host.changeLayout({includeTitle:v==='true'}));
  const color=document.createElement('input');color.type='color';color.value='#333333';color.dataset.setting='textColor';color.setAttribute('aria-label','正文颜色');color.addEventListener('change',()=>this.host.changeLayout({textColor:color.value}));const colorRow=document.createElement('label');colorRow.className='wx-field';const colorLabel=document.createElement('span');colorLabel.textContent='正文颜色';colorRow.append(colorLabel,color);advanced.append(colorRow);p.querySelector('[data-setting=fontFamily]')!.closest('.wx-field')!.classList.add('wx-full-row');p.querySelector('[data-number-control=sidePadding]')!.classList.add('wx-full-row');
 }
 setState(state:PanelState):void{
  if(this.destroyed)return;
  if(this.state.templateId!==state.templateId||this.state.article?.sourcePath!==state.article?.sourcePath)this.menu?.hide();
  const noteChanged=this.renderedArticle?.sourcePath!==state.article?.sourcePath;
  if(noteChanged){this.editorTop=0;this.root.querySelector<HTMLElement>('[data-operations-scroll]')!.scrollTop=0;this.selectedImage=null;this.locateSelection=false;}
  if(this.imageTarget&&this.imageTarget.path!==state.article?.sourcePath)this.clearImageEditor();
  if(this.selected&&(this.renderedArticle?.source!==state.article?.source||this.renderedArticle?.sourcePath!==state.article?.sourcePath)){
   const previous=this.renderedArticle?.blocks.find(b=>b.key===this.selected),oldImage=this.renderedArticle?.images.find(i=>i.occurrenceId===this.selectedImage);
   const matches=previous?.blockId&&this.renderedArticle?.sourcePath===state.article?.sourcePath?state.article?.blocks.filter(b=>b.blockId===previous.blockId):[];
   this.selected=matches?.length===1?matches[0].key:null;
   if(oldImage&&this.selected){const images=state.article!.images.filter(i=>i.blockKey===this.selected&&i.source===oldImage.source&&i.mode===oldImage.mode);this.selectedImage=images.length===1?images[0].occurrenceId:null;}else this.selectedImage=null;
  }
  this.renderedArticle=state.article;
  this.root.querySelector('.wx-version')!.textContent=displayVersion(state.pluginVersion);setTooltip(this.button('more'),`方案更多操作 · ${displayVersion(state.pluginVersion)}`);
  this.root.querySelector<HTMLElement>('[data-font-hint]')!.hidden=state.layout.fontFamily!=='source-han-serif';
  this.state=state;this.root.querySelector('.wx-article-title')!.textContent=state.article?.title||'打开一篇笔记';this.root.querySelector('[data-account]')!.textContent=state.account?`已连接 · ${state.account.name}`:state.bridgeConnected?'助手已连接 · 等待微信登录':'图片助手未连接';this.root.querySelector('.wx-dot')!.classList.toggle('is-connected',!!state.account||!!state.bridgeConnected);
  for(const input of this.root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-controls] [data-setting]'))if(input!==input.ownerDocument.activeElement&&input.dataset.setting&&input.dataset.setting in state.layout)input.value=String(state.layout[input.dataset.setting as keyof LayoutSettings]);
  for(const [key,control]of this.layoutNumbers)control.sync(Number(state.layout[key]),noteChanged);
  this.root.querySelector('[data-heading-summary]')!.textContent=`${state.layout.h3FontSize} px · ${state.layout.h3AccentBar?'蓝色分段':'无装饰'}`;
  const select=this.root.querySelector<HTMLSelectElement>('[data-template]')!,theme=articleTheme(state.layout.themeId);select.replaceChildren();
  if(!theme&&!state.templateId)select.add(new Option('当前排版',''));
  const builtin=document.createElement('optgroup');builtin.label='文章主题';for(const item of ARTICLE_THEMES)builtin.append(new Option(item.name+(theme?.id===item.id&&(!state.templateId||state.themeOverride)&&themeIsAdjusted(state.layout)?' · 已调整':''),'theme:'+item.id));select.append(builtin);
  if(state.templates?.length){const own=document.createElement('optgroup');own.label='我的方案';for(const t of state.templates)own.append(new Option(t.name,t.id));select.append(own);}
  select.value=state.templateId&&!state.themeOverride?state.templateId:theme?'theme:'+theme.id:'';
  const swatches=this.root.querySelector<HTMLElement>('[data-theme-swatches]')!;swatches.replaceChildren();swatches.hidden=!theme;if(theme)for(const color of ['#ffffff',theme.accent,theme.soft]){const dot=document.createElement('i');dot.style.backgroundColor=color;swatches.append(dot);}
  select.title=theme?theme.description+(themeIsAdjusted(state.layout)?' · 已调整':''):'';
  const template=state.templates?.find(t=>t.id===state.templateId);this.root.querySelector('[data-tail-summary]')!.textContent=template?.headerMarkdown||template?.footerMarkdown?'已设置':'未设置';if(!this.busy)this.jobMessage='';
  this.preview.setState(state);this.showSelection();this.markSelection();this.updateButtons();
 }
 setJobEvent(event:JobEvent):void{
  if(this.destroyed)return;
  this.busy=!['copied','failed','cancelled'].includes(event.type);const labels={downloading:`下载网络图片 ${event.done??0}/${event.total??0}…`,checking:'检查文章…',preparing:'准备图片…',uploading:`上传图片 ${event.done??0}/${event.total??0}`,writing:'正在写入剪贴板…',copied:'图文已复制，到公众号粘贴。',cancelled:'已取消。',failed:'复制失败，请重试。'};
  this.jobMessage=event.message||labels[event.type];this.status(this.jobMessage);this.updateButtons();
 }
 private updateButtons(){this.updateStatus();const pending=!!this.state.saving||this.busy||!!this.imageEditor?.hasPending||this.imageWrites>0;this.button('undo-appearance').hidden=!this.state.canUndoAppearance;this.button('undo-appearance').disabled=pending;this.root.querySelector<HTMLSelectElement>('[data-template]')!.disabled=pending||!this.state.article;this.button('image-defaults').disabled=pending;this.button('reset-image').disabled=pending;this.button('save-template').disabled=pending||!this.state.article;this.button('edit-template').disabled=pending||!this.state.article;this.button('more').disabled=pending;this.button('retry-save').hidden=!this.state.saveError&&!this.imageEditor?.hasFailed;this.button('copy').disabled=!!this.state.saving||!!this.state.saveError||this.busy||this.imageWrites>0||!!this.imageEditor?.hasPending||!this.state.article||!this.state.account;this.button('cancel').hidden=!this.busy;this.button('pair').disabled=this.pairingBusy;this.button('copy-pair').disabled=this.pairingBusy||!this.pairText().value;this.button('select-pair').disabled=!this.pairText().value;}
 private updateStatus(){
  if(this.busy)return;
  const state=this.state;this.status(state.saveError?`保存失败：${state.saveError}`:this.imageEditor?.hasFailed?'图片样式保存失败，请重试保存。':state.saving||this.imageEditor?.hasPending?'正在保存排版…':this.jobMessage|| (state.diagnostics?.length?state.diagnostics.join(' · '):state.article?(state.account?'已保存':'连接图片助手后即可复制。'):'先打开一篇 Markdown 笔记。'));
 }
 private clearImageEditor(){if(this.imageEditor)this.imageEffectsOpen=this.imageEditor.effectsExpanded;this.imageEditor?.dispose();this.imageEditor=undefined;this.imageTarget=undefined;}
 private markSelection(){const ref=this.state.article?.images.find(i=>i.blockKey===this.selected&&i.occurrenceId===this.selectedImage)??this.state.article?.images.find(i=>i.blockKey===this.selected&&(!this.imageTarget||i.source===this.imageTarget.source));this.selectedImage=ref?.occurrenceId??null;const scope=this.root.querySelector<HTMLElement>('[data-image-scope]')!;if(this.selectedImage)scope.dataset.selectedImage=this.selectedImage;else delete scope.dataset.selectedImage;if(this.state.article)this.host.selectionChanged?.({path:this.state.article.sourcePath,key:this.selected,imageId:this.selectedImage});}

 private showSelection(){
  const block=this.state.article?.blocks.find(b=>b.key===this.selected);const label=this.root.querySelector('[data-selection-label]')!;const title=this.root.querySelector('[data-selection-title]')!;const p=this.root.querySelector<HTMLElement>('[data-selected-controls]')!;
  const scope=this.root.querySelector<HTMLElement>('[data-image-scope]')!;scope.textContent=block?'仅这张':'文章默认';
  this.button('image-defaults').hidden=!block;this.button('reset-image').hidden=!block||!block.blockId||!this.state.overrides[block.blockId]?.image;
  if(!block){
   title.textContent='图片排版';label.textContent=this.state.article?'点击笔记中的图片，可单独调整。':'打开笔记后即可设置图片样式。';
   if(this.imageEditor&&this.imageTarget?.key==='*'&&this.imageTarget.path===this.state.article?.sourcePath){this.imageEditor.sync(normalizeImage(this.state.overrides['*']?.image),'',this.state.layout.sidePadding);return;}
   if(this.imageEditor?.hasPending)return;this.clearImageEditor();p.replaceChildren();if(!this.state.article)return;
   const path=this.state.article.sourcePath;this.imageTarget={path,key:'*',source:''};
   this.imageEditor=new ImageInspector(p,false,{scope:'default',stateChanged:()=>{if(!this.destroyed)this.updateButtons();},change:async patch=>{if(this.destroyed||path!==this.state.article?.sourcePath)throw Error('笔记已切换，请重新设置。');await this.host.changeAllImages?.(patch,'default');}});
   this.imageEditor.effectsExpanded=this.imageEffectsOpen;this.imageEditor.sync(normalizeImage(this.state.overrides['*']?.image),'',this.state.layout.sidePadding);return;
  }
  if(this.imageEditor&&this.imageTarget&&this.imageTarget.path===this.state.article?.sourcePath&&((block&&(block.key===this.imageTarget.key||!!block.blockId&&block.blockId===this.imageTarget.id)&&this.state.article.images.some(i=>i.blockKey===block.key&&i.source===this.imageTarget!.source))||this.imageEditor.hasPending)){
   if(block){this.imageTarget.key=block.key;this.imageEditor.sync(mergeImageStyles(this.state.overrides['*']?.image,block.blockId?this.state.overrides[block.blockId]?.image:undefined),this.imageTarget.source,imageContainerInset(block,this.state.layout,block.blockId?this.state.overrides[block.blockId]?.text:undefined));}return;
  }
  this.clearImageEditor();p.replaceChildren();title.textContent='图片排版';
  if(block.key.startsWith('template-')){label.textContent='方案头尾内容';p.textContent='这张图片来自方案头尾，请在“头尾内容”中修改。';return;}
  label.textContent='只调整当前选中内容';
  const images=this.state.article!.images.filter(i=>i.blockKey===block.key);const clicked=images.find(i=>i.occurrenceId===this.selectedImage);const image=images.find(i=>i.mode==='block');
  const change=(patch:{text?:Partial<LayoutSettings>;image?:Partial<ImageStyle>})=>void this.host.changeBlock?.(block.key,patch).catch(e=>this.status(e.message));
  if(clicked?.mode==='inline'){title.textContent='行内图片';p.textContent='行内图片随文字排版；将图片放在单独一段后，可设置独立缩进和阴影。';return;}
  if(image){
   title.textContent='图片排版';label.textContent='';if(images.length!==1){p.textContent='这段包含多张图片；请将每张图片放在单独一段，再分别设置样式。';return;}
   const target={path:this.state.article!.sourcePath,key:block.key,id:block.blockId,source:image.source};this.imageTarget=target;
   this.imageEditor=new ImageInspector(p,/\.gif(?:[?#].*)?$/i.test(image.source),{
    stateChanged:()=>{if(!this.destroyed)this.updateButtons();},
    change:async patch=>{
     if(this.destroyed||this.state.article?.sourcePath!==target.path)throw Error('笔记已切换，请重新选择图片。');
     const current=target.id?this.state.article.blocks.find(b=>b.blockId===target.id):this.state.article.blocks.find(b=>b.key===target.key);
     if(!current||!this.state.article.images.some(i=>i.blockKey===current.key&&i.source===target.source))throw Error('图片位置已变化，请重新选择。');if(current.blockId)target.id=current.blockId;
     this.imageWrites++;this.updateButtons();
     try{const id=await this.host.changeBlock?.(current.key,{image:patch});if(typeof id==='string')target.id=id;
      if(!this.destroyed&&this.imageTarget===target&&this.state.article?.sourcePath===target.path){const updated=target.id?this.state.article.blocks.find(b=>b.blockId===target.id):this.state.article.blocks.find(b=>b.key===target.key);if(updated){target.key=updated.key;this.selected=updated.key;this.markSelection();}}
     }finally{this.imageWrites--;if(!this.destroyed)this.updateButtons();}
    },
    apply:this.host.changeAllImages?(style,mode)=>this.host.changeAllImages!(style,mode):undefined,
   });
   this.imageEditor.effectsExpanded=this.imageEffectsOpen;this.imageEditor.sync(mergeImageStyles(this.state.overrides['*']?.image,block.blockId?this.state.overrides[block.blockId]?.image:undefined),image.source,imageContainerInset(block,this.state.layout,block.blockId?this.state.overrides[block.blockId]?.text:undefined));
  }else{const local=block.blockId?this.state.overrides[block.blockId]?.text:{};const grid=document.createElement('div');grid.className='wx-grid';p.append(grid);numberControl(grid,'此段字号','localFontSize',local?.fontSize??this.state.layout.fontSize,...LAYOUT_RANGES.fontSize,1,v=>change({text:{fontSize:v}}));numberControl(grid,'此段段后','localParagraphAfter',local?.paragraphAfter??this.state.layout.paragraphAfter,0,48,1,v=>change({text:{paragraphAfter:v}}));const indent=local?.firstLineIndent??this.state.layout.firstLineIndent,choices:Array<[string,string]>=[['0','不缩进'],['2','两个字']];if(indent!==0&&indent!==2)choices.push([String(indent),`${indent}字（当前）`]);selectControl(grid,'此段缩进','localIndent',String(indent),choices,v=>change({text:{firstLineIndent:Number(v)}}));}
 }
 destroy():void{this.sidebarWidth.destroy();this.viewport.destroy();this.menu?.hide();this.pages.destroy();this.preview.destroy();this.clearImageEditor();this.destroyed=true;this.pairRequest++;this.root.replaceChildren();}
}

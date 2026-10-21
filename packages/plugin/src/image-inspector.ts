import {IMAGE_APPEARANCES,describeShadow,softShadow,matchesAppearance} from '../../core/src/image-appearance';
import {Menu} from 'obsidian';
import type {ImageStyle} from '../../core/src/types';
import {DEFAULT_IMAGE,normalizeImage,imageInsets,type HorizontalInsets} from '../../core/src/styles';
import {numberControl,selectControl,PresetNumberControl} from './controls';
const JUSTIFY_STYLE:Partial<ImageStyle>={alignment:'justify',leftInset:null,rightInset:null,marginLeft:0,marginRight:0};
const COMMON_LAYOUTS=[
 {id:'follow-text-plain',label:'无阴影',shadow:0},
 {id:'follow-text-shadow',label:'轻阴影',shadow:6},
] as const;
interface InspectorOptions {
 change(patch:Partial<ImageStyle>):Promise<void>;
 apply?(style:ImageStyle,mode:'default'|'all'):Promise<boolean|void>|void;
 scope?:'default'|'single';
 stateChanged():void;
}
/** Mounted for one selection: async saves never replace a focused control. */
export class ImageInspector {
 readonly el:HTMLElement;
 private menu?:Menu;private containerInset:number|HorizontalInsets=0;
 private style:ImageStyle=DEFAULT_IMAGE;
 private pending:Partial<ImageStyle>|null=null;
 private sideControls=new Map<'marginLeft'|'marginRight',PresetNumberControl>();
 private running=false;private failed=false;private disposed=false;private applying=false;
 constructor(parent:HTMLElement,private gif:boolean,private options:InspectorOptions){
  this.el=document.createElement('div');this.el.className='wx-image-inspector';parent.append(this.el);
  const name=document.createElement('strong');name.dataset.imageName='';name.hidden=true;this.el.append(name);
  const commonRow=document.createElement('div');commonRow.className='wx-image-preset-row';const commonLabel=document.createElement('span');commonLabel.textContent='阴影';commonRow.append(commonLabel);this.el.append(commonRow);
  const common=document.createElement('div');common.className='wx-image-presets wx-image-layout-presets';common.setAttribute('role','group');common.setAttribute('aria-label','图片阴影');commonRow.append(common);
  for(const preset of COMMON_LAYOUTS){const button=document.createElement('button');button.type='button';button.dataset.imageLayout=preset.id;button.textContent=preset.label;button.title=preset.label;button.addEventListener('click',()=>this.commit({shadow:preset.shadow},true));common.append(button);}
  const presetRow=document.createElement('div');presetRow.className='wx-image-preset-row';const presetLabel=document.createElement('span');presetLabel.textContent='预设';presetRow.append(presetLabel);this.el.append(presetRow);const presets=document.createElement('div');presets.className='wx-image-presets';presets.setAttribute('role','group');presets.setAttribute('aria-label','图片外观');presetRow.append(presets);
  for(const preset of IMAGE_APPEARANCES){
   const button=document.createElement('button');button.type='button';button.dataset.imagePreset=preset.id;button.textContent=preset.label;
   button.title='替换圆角、边框、底色和投影；保留图片尺寸与位置';
   button.addEventListener('click',()=>this.commit({...preset.style},true));presets.append(button);
  }
  const layout=this.group('尺寸与位置',false);
  selectControl(layout,'对齐','imageAlign','left',[['left','左对齐'],['center','居中对齐'],['right','右对齐'],['justify','两端对齐']],v=>this.commit(v==='justify'?{...JUSTIFY_STYLE}:{alignment:v as ImageStyle['alignment']}));
  selectControl(layout,'宽度','imageWidth','auto',[['auto','原始尺寸'],['40','40%'],['65','65%'],['100','100%'],['custom','自定义']],v=>{if(v!=='custom')this.commit({widthPercent:v==='auto'?null:Number(v)});else{const input=this.el.querySelector<HTMLInputElement>('[data-setting=widthPercent]')!;input.closest<HTMLElement>('.wx-field')!.hidden=false;input.focus();input.select();}});
  this.numeric(layout,'自定义宽度 %','widthPercent',100,5,100);
  for(const [key,label]of [['marginLeft','左侧留白'],['marginRight','右侧留白']]as const)this.sideControls.set(key,new PresetNumberControl(layout,label,key,DEFAULT_IMAGE[key],[0,8,16,24,32],0,192,value=>{const edges=imageInsets(this.style,this.containerInset);this.commit({leftInset:edges.left,rightInset:edges.right,[key==='marginLeft'?'leftInset':'rightInset']:value});},{unit:'px',presentation:'select'}));
  const help=document.createElement('p');help.className='wx-image-hint';help.dataset.imageLayoutHint='';this.el.append(help);
  const effect=this.group('更多样式',true);effect.parentElement!.insertBefore(presetRow,effect);
  this.numeric(effect,'圆角 px','radius',0,0,64,true);this.numeric(effect,'阴影强度','shadow',0,0,30,true);this.numeric(effect,'边框 px','borderWidth',0,0,12);effect.querySelector('[data-setting=borderWidth]')!.closest('.wx-field')!.classList.add('wx-single-field');
  this.numeric(effect,'明暗 %','shadowOpacity',18,0,50);this.numeric(effect,'柔和度 px','shadowBlur',12,0,80);this.numeric(effect,'下移 px','shadowOffsetY',3,0,24,false,.5);
  selectControl(effect,'图片背景','backgroundMode','solid',[['preserve','保留透明'],['solid','纯色底板']],value=>this.commit({backgroundMode:value as ImageStyle['backgroundMode']},true));
  for(const [key,label]of [['borderColor','边框颜色'],['background','背景颜色']]as const){const row=document.createElement('label');row.className='wx-field';const text=document.createElement('span');text.textContent=label;const input=document.createElement('input');input.type='color';input.dataset.setting=key;input.setAttribute('aria-label',label);input.addEventListener('input',()=>this.commit({[key]:input.value,...(key==='background'?{backgroundMode:'solid' as const}:{})},true));row.append(text,input);effect.append(row);}
  for(const [key,label]of [['marginBefore','上方留白 px'],['marginAfter','下方留白 px']]as const)this.numeric(layout,label,key,DEFAULT_IMAGE[key],0,64);

  const row=document.createElement('label');row.className='wx-image-toggle';const bake=document.createElement('input');bake.type='checkbox';bake.dataset.setting='bakeEffects';bake.disabled=gif;bake.addEventListener('change',()=>this.commit({bakeEffects:bake.checked}));row.append(document.createTextNode('复制时保留静态图片效果'),bake);effect.parentElement!.append(row);
  const hint=document.createElement('p');hint.dataset.imageHint='';hint.className='wx-image-hint';hint.textContent=gif?'GIF 保留动画，不合成静态图；圆角和阴影在微信中的效果需检查。':'将圆角、边框、底色与阴影合成到上传副本，原文件保留。';effect.parentElement!.append(hint);
  const status=document.createElement('p');status.dataset.imageStatus='';status.className='wx-image-status';status.setAttribute('aria-live','polite');this.el.append(status);
  const retry=document.createElement('button');retry.type='button';retry.dataset.action='retry-image';retry.textContent='重试保存';retry.hidden=true;retry.addEventListener('click',()=>this.retrySave());this.el.append(retry);
  if(options.apply){const apply=document.createElement('button');apply.type='button';apply.dataset.action='apply-images';apply.className='wx-wide-secondary';apply.textContent='应用到全文…';apply.addEventListener('click',()=>this.openApplyMenu(apply));this.el.append(apply);}
 }
 private group(title:string,disclosure=false){
  const section=document.createElement(disclosure?'details':'section');section.className=disclosure?'wx-image-group wx-disclosure':'wx-image-group';
  if(disclosure){section.dataset.imageEffects='';const heading=document.createElement('summary');heading.textContent=title;const summary=document.createElement('span');summary.dataset.imageEffectSummary='';heading.append(summary);section.append(heading);}else section.setAttribute('aria-label',title);
  const grid=document.createElement('div');grid.className='wx-grid';section.append(grid);this.el.append(section);return grid;
 }
 private numeric(parent:HTMLElement,label:string,key:keyof ImageStyle,value:number,min:number,max:number,slider=false,step=1){
  const input=numberControl(parent,label,key,value,min,max,step,v=>this.commit({[key]:v},['radius','shadow','borderWidth','shadowOpacity','shadowBlur','shadowOffsetY'].includes(key)),true);
  if(slider){const range=document.createElement('input');range.type='range';range.min=String(min);range.max=String(max);range.step='1';range.dataset.imageRange=key;range.setAttribute('aria-label',label);range.addEventListener('input',()=>this.commit({[key]:Number(range.value)},true));const row=input.parentElement!,wrap=document.createElement('div');wrap.className='wx-image-slider';row.replaceWith(wrap);wrap.append(row,range);}
 }
 sync(style:ImageStyle,name:string,containerInset:number|HorizontalInsets=0){this.containerInset=containerInset;if(!this.hasPending)this.style=normalizeImage(style);this.el.querySelector('[data-image-name]')!.textContent=name;this.syncControls();}
 get effectsExpanded(){return this.el.querySelector<HTMLDetailsElement>('[data-image-effects]')!.open;}
 set effectsExpanded(value:boolean){this.el.querySelector<HTMLDetailsElement>('[data-image-effects]')!.open=value;}
 get hasFailed(){return this.failed;}
 retrySave(){if(!this.failed||this.disposed)return;this.failed=false;void this.flush();}
 get hasPending(){return this.running||this.applying||!!this.pending;}
 private syncControls(){
  const fill=this.style.alignment==='justify';this.el.querySelector('[data-image-effect-summary]')!.textContent=`圆角 ${this.style.radius} px · 阴影 ${this.style.shadow}`;this.el.querySelector('[data-image-layout-hint]')!.textContent='两端对齐默认与正文同宽，左右留白可单独调整。';
  this.el.querySelector('[data-setting=imageWidth]')!.closest<HTMLElement>('.wx-field')!.hidden=fill;
  const custom=this.el.querySelector<HTMLInputElement>('[data-setting=widthPercent]')!;custom.closest<HTMLElement>('.wx-field')!.hidden=fill||(custom!==custom.ownerDocument.activeElement&&(!this.style.widthPercent||[40,65,100].includes(this.style.widthPercent)));
  const shadow=describeShadow(this.style);
  const background=this.el.querySelector<HTMLInputElement>('[data-setting=background]')!;background.closest<HTMLElement>('.wx-field')!.hidden=this.style.backgroundMode==='preserve';
  for(const input of this.el.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-setting]')){
   const key=input.dataset.setting!,widthControl=key==='imageWidth'||key==='widthPercent';if(widthControl)input.disabled=fill;if(input===input.ownerDocument.activeElement&&!(fill&&widthControl))continue;
   if(key==='imageWidth')input.value=fill?'100':this.style.widthPercent?([40,65,100].includes(this.style.widthPercent)?String(this.style.widthPercent):'custom'):'auto';
   else if(key==='widthPercent'&&fill)input.value='100';
   else if(key==='backgroundMode')input.value=this.style.backgroundMode??'solid';
   else if(key==='shadowOpacity')input.value=String(shadow.opacity);
   else if(key==='shadowBlur')input.value=String(shadow.blur);
   else if(key==='shadowOffsetY')input.value=String(shadow.offsetY);
   else if(key==='imageAlign')input.value=this.style.alignment;
   else if(input instanceof HTMLInputElement&&input.type==='checkbox')input.checked=this.style.bakeEffects;
   else input.value=String(this.style[key as keyof ImageStyle]??(key==='widthPercent'?100:''));
  }
  const edges=imageInsets(this.style,this.containerInset);for(const [key,control]of this.sideControls)control.sync(key==='marginLeft'?edges.left:edges.right);
  for(const preset of COMMON_LAYOUTS)this.el.querySelector(`[data-image-layout=${preset.id}]`)!.setAttribute('aria-pressed',String(this.style.shadow===preset.shadow));
  for(const range of this.el.querySelectorAll<HTMLInputElement>('[data-image-range]'))if(range!==range.ownerDocument.activeElement)range.value=String(this.style[range.dataset.imageRange as keyof ImageStyle]);
  for(const preset of IMAGE_APPEARANCES)this.el.querySelector(`[data-image-preset=${preset.id}]`)!.setAttribute('aria-pressed',String(matchesAppearance(this.style,preset)));
  const apply=this.el.querySelector<HTMLButtonElement>('[data-action=apply-images]');if(apply)apply.disabled=this.hasPending;
 }
 private commit(patch:Partial<ImageStyle>,decoration=false){
  if(this.disposed)return;if(Object.hasOwn(patch,'shadow')&&!Object.hasOwn(patch,'shadowBlur'))patch={...patch,...softShadow(patch.shadow!)};const next=normalizeImage({...this.style,...patch});
  if(decoration)patch.bakeEffects=!this.gif&&(next.radius>0||next.shadow>0||next.borderWidth>0||next.backgroundMode==='solid');
  if(this.gif)patch.bakeEffects=false;
  this.style=normalizeImage({...this.style,...patch});this.pending={...this.pending,...patch};this.failed=false;this.syncControls();void this.flush();
 }
 private status(text:string,error=false){this.el.querySelector('[data-image-status]')!.textContent=text;this.el.querySelector<HTMLButtonElement>('[data-action=retry-image]')!.hidden=!error;this.options.stateChanged();this.syncControls();}
 private async flush(){
  if(this.running||this.disposed||this.failed)return;this.running=true;this.status('正在保存图片样式…');
  try{while(this.pending&&!this.disposed){const patch=this.pending;this.pending=null;try{await this.options.change(patch);}catch(e){this.pending={...patch,...(this.pending as Partial<ImageStyle>|null??{})};this.failed=true;this.status(e instanceof Error?`保存失败：${e.message}`:'保存失败，请重试。',true);break;}}}
  finally{this.running=false;if(!this.disposed){if(!this.failed)this.status('图片样式已保存');else this.options.stateChanged();this.syncControls();}}
 }
 closeMenu(){this.menu?.hide();}
 private openApplyMenu(button:HTMLButtonElement){
  if(this.hasPending||this.disposed)return;this.menu?.hide();const snapshot=JSON.stringify(this.style);const menu=this.menu=new Menu();
  for(const [mode,label]of [['default','设为文章默认'],['all','统一所有图片…']] as const)menu.addItem(item=>item.setTitle(label).setIcon(mode==='all'?'images':'image').onClick(()=>{if(!this.disposed&&!this.hasPending&&snapshot===JSON.stringify(this.style))void this.apply(mode);}));
  const rect=button.getBoundingClientRect();menu.showAtPosition({x:rect.left,y:rect.bottom+4},this.el.ownerDocument);
 }
 private async apply(mode:'default'|'all'){
  if(this.hasPending||this.disposed)return;this.applying=true;this.status(mode==='all'?'等待确认…':'正在设置文章默认…');
  try{const applied=await this.options.apply?.({...this.style,widthPercent:this.style.widthPercent??null},mode);if(!this.disposed)this.status(applied===false?'已取消':mode==='all'?'全文图片已统一，可在底栏撤销':'已设为文章默认，单独调整的图片保留');}
  catch(e){if(!this.disposed)this.status(e instanceof Error?e.message:'应用失败，请重试。');}
  finally{this.applying=false;if(!this.disposed){this.options.stateChanged();this.syncControls();}}
 }
 dispose(){this.menu?.hide();this.disposed=true;this.pending=null;}
}

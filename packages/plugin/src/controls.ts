import {iconButton} from './chrome';
export function numberControl(parent:HTMLElement,label:string,key:string,value:number,min:number,max:number,step:number,change:(value:number)=>void,live=false):HTMLInputElement{
 const row=document.createElement('label');row.className='wx-field';const name=document.createElement('span');name.textContent=label;const input=document.createElement('input');input.type='number';input.dataset.setting=key;input.value=String(value);input.min=String(min);input.max=String(max);input.step=String(step);
 let committed=value;
 input.addEventListener('focus',()=>{if(input.value!==''&&Number.isFinite(input.valueAsNumber))committed=input.valueAsNumber;});
 const commit=(finish:boolean)=>{
  const next=input.valueAsNumber;
  if(input.value===''||!Number.isFinite(next)){if(finish)input.value=String(committed);return;}
  if(!finish&&(next<min||next>max))return;
  const bounded=Math.min(max,Math.max(min,next));if(finish)input.value=String(bounded);
  if(bounded!==committed){committed=bounded;change(bounded);}
 };
 if(live)input.addEventListener('input',()=>commit(false));input.addEventListener('change',()=>commit(true));input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commit(true);input.blur();}});row.append(name,input);parent.append(row);return input;
}
export function selectControl(parent:HTMLElement,label:string,key:string,value:string,values:readonly(readonly[string,string])[],change:(value:string)=>void):HTMLSelectElement{
 const row=document.createElement('label');row.className='wx-field';const name=document.createElement('span');name.textContent=label;const input=document.createElement('select');input.dataset.setting=key;input.setAttribute('aria-label',label);for(const [v,text]of values){const o=document.createElement('option');o.value=v;o.textContent=text;input.append(o);}input.value=value;input.addEventListener('change',()=>change(input.value));row.append(name,input);parent.append(row);return input;
}

let nextPresetNumberId=0;
interface PresetNumberOptions {step?:number;unit?:string;presentation?:'buttons'|'select'}
/** Presets are immediate; manual mode preserves the same numeric control. */
export class PresetNumberControl {
 readonly input:HTMLInputElement;
 private value:number;private manual=false;
 private row:HTMLElement;private manualButton?:HTMLButtonElement;private select?:HTMLSelectElement;
 private buttons=new Map<number,HTMLButtonElement>();private valueCell?:HTMLElement;private renderedManual?:boolean;
 constructor(parent:HTMLElement,private label:string,key:string,value:number,private presets:readonly number[],min:number,max:number,change:(value:number)=>void,options:PresetNumberOptions={}){
  this.value=value;this.manual=!presets.includes(value);const doc=parent.ownerDocument,root=doc.createElement('div');root.className='wx-preset-number';root.dataset.numberControl=key;root.setAttribute('role','group');root.setAttribute('aria-label',label);
  const title=doc.createElement('span');title.className='wx-preset-number-label';title.textContent=label;parent.append(root);
  const manual=()=>{this.manual=true;this.render();this.input.focus();this.input.select();};
  const choose=(preset:number)=>{this.manual=false;this.value=preset;this.render();change(preset);};
  if(options.presentation==='select'){
   root.classList.add('wx-preset-select');const row=doc.createElement('div');row.className='wx-field';this.valueCell=doc.createElement('div');this.valueCell.className='wx-number-value';this.select=doc.createElement('select');this.select.dataset.numberSelect=key;this.select.setAttribute('aria-label',label);
   for(const preset of presets){const option=doc.createElement('option');option.value=String(preset);option.textContent=String(preset)+(options.unit?` ${options.unit}`:'');this.select.append(option);}
   const option=doc.createElement('option');option.value='manual';option.textContent='手动设置';this.select.append(option);this.select.addEventListener('change',()=>{const value=this.select!.value;if(value==='manual')manual();else if(value!==''&&presets.includes(Number(value)))choose(Number(value));});this.valueCell.append(this.select);this.manualButton=doc.createElement('button');this.manualButton.dataset.numberManual=key;iconButton(this.manualButton,'pencil',`${label}：手动设置`);this.manualButton.addEventListener('click',()=>{if(this.manual){this.input.dispatchEvent(new Event('change'));this.manual=false;this.render();this.select!.focus();}else manual();});this.valueCell.append(this.manualButton);row.append(title,this.valueCell);root.append(row);
  }else{
   const choices=doc.createElement('div');choices.className='wx-number-choices';root.append(title,choices);
   for(const preset of presets){const button=doc.createElement('button');button.type='button';button.dataset.numberPreset=key;button.dataset.value=String(preset);button.textContent=String(preset);button.setAttribute('aria-label',`${label} ${preset}`);button.addEventListener('click',()=>{button.focus();choose(preset);});choices.append(button);this.buttons.set(preset,button);}
   this.manualButton=doc.createElement('button');this.manualButton.type='button';this.manualButton.dataset.numberManual=key;this.manualButton.textContent='手动设置';this.manualButton.addEventListener('click',manual);choices.append(this.manualButton);
  }
  const unit=options.unit??'px';this.input=numberControl(root,`手动数值${unit?' '+unit:''}`,key,value,min,max,options.step??1,next=>{this.value=next;this.render();change(next);},true);this.input.setAttribute('aria-label',`${label} 手动数值${unit?' '+unit:''}`);this.row=this.input.parentElement!;this.row.classList.add('wx-preset-manual');this.row.dataset.numberInput=key;this.row.id=`wx-number-${++nextPresetNumberId}`;this.manualButton?.setAttribute('aria-controls',this.row.id);this.select?.setAttribute('aria-controls',this.row.id);if(this.valueCell)this.valueCell.insertBefore(this.row,this.manualButton!);this.sync(value);
 }
 sync(value:number,resetMode=false){const changed=this.value!==value;this.value=value;if(resetMode){this.input.value=String(value);if(this.input===this.input.ownerDocument.activeElement)this.input.blur();this.manual=!this.presets.includes(value);}else if(changed&&!this.presets.includes(value))this.manual=true;this.render();}
 private render(){
  this.row.hidden=!this.manual;this.row.closest('.wx-preset-number')?.classList.toggle('is-manual',this.manual);this.manualButton?.setAttribute('aria-expanded',String(this.manual));this.manualButton?.setAttribute('aria-pressed',String(this.manual));
  if(this.select){this.select.hidden=this.manual;const option=this.select.querySelector<HTMLOptionElement>('[data-custom]');option?.remove();if(!this.manual&&!this.presets.includes(this.value)){const custom=new Option(`${this.value}（自定义）`,String(this.value));custom.dataset.custom='';this.select.prepend(custom);}this.select.value=this.manual?'manual':String(this.value);if(this.manualButton&&this.renderedManual!==this.manual){iconButton(this.manualButton,this.manual?'list-filter':'pencil',`${this.label}：${this.manual?'返回常用值':'手动设置'}`);this.renderedManual=this.manual;}}
  for(const [value,button]of this.buttons)button.setAttribute('aria-pressed',String(!this.manual&&value===this.value));
  if(this.input!==this.input.ownerDocument.activeElement)this.input.value=String(this.value);
 }
}

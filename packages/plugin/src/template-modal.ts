import {Modal,type App} from 'obsidian';
import type {Template} from './settings';
export class TemplateModal extends Modal{
 constructor(app:App,private template:Template,private save:(value:Template)=>Promise<void>){super(app);}
 onOpen(){
  this.contentEl.classList.add('wx-template-modal');this.setTitle('保存个人排版方案');
  const field=(label:string,value:string,multiline=false)=>{const l=document.createElement('label');l.textContent=label;this.contentEl.append(l);const input=multiline?document.createElement('textarea'):document.createElement('input');input.value=value;this.contentEl.append(input);return input;};
  const name=field('方案名称',this.template.name);const help=document.createElement('p');help.textContent='保存正文与整篇图片样式。文章开头、结尾和单张图片的调整保留在各自文章中。';this.contentEl.append(help);
  const error=document.createElement('p');this.contentEl.append(error);const button=document.createElement('button');button.textContent='保存方案';button.className='mod-cta';this.contentEl.append(button);
  button.addEventListener('click',()=>{if(!name.value.trim()){error.textContent='请填写方案名称。';return;}button.disabled=true;void this.save({...this.template,name:name.value.trim().slice(0,80)}).then(()=>this.close(),e=>{button.disabled=false;error.textContent=e instanceof Error?e.message:'保存失败，请重试。';});});
 }
 onClose(){this.contentEl.replaceChildren();}
}

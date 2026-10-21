import {Modal,type App} from 'obsidian';
import type {Template} from './settings';
export class TemplateModal extends Modal{
 constructor(app:App,private template:Template,private save:(value:Template)=>Promise<void>){super(app);}
 onOpen(){
  this.contentEl.classList.add('wx-template-modal');this.setTitle('保存个人排版方案');
  const field=(label:string,value:string,multiline=false)=>{const l=document.createElement('label');l.textContent=label;this.contentEl.append(l);const input=multiline?document.createElement('textarea'):document.createElement('input');input.value=value;this.contentEl.append(input);return input;};
  const name=field('方案名称',this.template.name);const header=field('固定头部（Markdown，可插入本地图片）',this.template.headerMarkdown,true);const footer=field('固定尾部（Markdown，可包含来源与往期推荐）',this.template.footerMarkdown,true);
  const error=document.createElement('p');this.contentEl.append(error);const button=document.createElement('button');button.textContent='保存方案';button.className='mod-cta';this.contentEl.append(button);
  button.addEventListener('click',()=>{if(!name.value.trim()){error.textContent='请填写方案名称。';return;}button.disabled=true;void this.save({...this.template,name:name.value.trim().slice(0,80),headerMarkdown:header.value,footerMarkdown:footer.value}).then(()=>this.close(),()=>{button.disabled=false;error.textContent='保存失败，请重试。';});});
 }
 onClose(){this.contentEl.replaceChildren();}
}

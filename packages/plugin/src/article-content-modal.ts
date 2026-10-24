import {Modal,type App} from 'obsidian';
export class ArticleContentModal extends Modal {
 constructor(app:App,private part:'header'|'footer',private value:string,private save:(value:string)=>Promise<void>){super(app);}
 onOpen(){
  this.contentEl.classList.add('wx-template-modal');this.setTitle(this.part==='header'?'本篇文章开头':'本篇文章结尾');
  const help=document.createElement('p');help.textContent='仅应用于本篇文章，支持 Markdown 和本地图片。';
  const input=document.createElement('textarea');input.value=this.value;input.rows=8;input.setAttribute('aria-label',this.part==='header'?'文章开头':'文章结尾');
  const error=document.createElement('p');error.setAttribute('role','alert');
  const actions=document.createElement('div');actions.className='wx-confirm-actions';
  const cancel=document.createElement('button');cancel.textContent='取消';cancel.addEventListener('click',()=>this.close());
  const save=document.createElement('button');save.textContent='保存';save.className='mod-cta';save.dataset.action='save-content';save.addEventListener('click',()=>{save.disabled=true;cancel.disabled=true;void this.save(input.value).then(()=>this.close(),e=>{error.textContent=e instanceof Error?e.message:'保存失败，请重试。';save.disabled=false;cancel.disabled=false;});});
  actions.append(cancel,save);this.contentEl.append(help,input,error,actions);input.focus();
 }
 onClose(){this.contentEl.replaceChildren();}
}

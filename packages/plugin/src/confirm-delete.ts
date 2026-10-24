import {Modal,type App} from 'obsidian';
/** The callback closes over the template id, never the currently active note. */
export class ConfirmTemplateDelete extends Modal {
 constructor(app:App,private name:string,private count:number,private confirm:()=>void){super(app);}
 onOpen(){
  this.setTitle('删除排版方案？');
  const explanation=document.createElement('p');explanation.textContent=`将删除“${this.name}”，并解除 ${this.count} 篇笔记与此方案的关联。关联文章将不再使用该方案排版；本篇开头、结尾、笔记正文和图片文件会保留。此操作不可撤销。`;
  const actions=document.createElement('div');actions.className='wx-confirm-actions';const cancel=document.createElement('button');cancel.textContent='取消';cancel.dataset.action='cancel-delete';cancel.addEventListener('click',()=>this.close());const remove=document.createElement('button');remove.textContent='删除方案';remove.className='mod-warning';remove.dataset.action='confirm-delete';remove.addEventListener('click',()=>{remove.disabled=true;this.close();this.confirm();});actions.append(cancel,remove);this.contentEl.append(explanation,actions);cancel.focus();
 }
 onClose(){this.contentEl.replaceChildren();}
}

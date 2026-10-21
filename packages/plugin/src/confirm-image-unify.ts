import {Modal,type App} from 'obsidian';
export class ConfirmImageUnify extends Modal {
 private settled=false;
 constructor(app:App,private resolve:(confirmed:boolean)=>void){super(app);}
 onOpen(){
  this.setTitle('统一所有图片？');
  const message=document.createElement('p');message.textContent='这篇文章中单独调整过的图片也会使用当前样式。行内表情保留原样，完成后可以撤销。';
  const actions=document.createElement('div');actions.className='wx-confirm-actions';
  const cancel=document.createElement('button');cancel.textContent='取消';cancel.dataset.action='cancel-unify';cancel.addEventListener('click',()=>this.close());
  const confirm=document.createElement('button');confirm.textContent='统一所有图片';confirm.className='mod-cta';confirm.dataset.action='confirm-unify';confirm.addEventListener('click',()=>{this.settled=true;this.resolve(true);this.close();});
  actions.append(cancel,confirm);this.contentEl.append(message,actions);cancel.focus();
 }
 onClose(){if(!this.settled){this.settled=true;this.resolve(false);}this.contentEl.replaceChildren();}
}

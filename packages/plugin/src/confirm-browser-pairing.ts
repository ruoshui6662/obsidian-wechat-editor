import {Modal,type App} from 'obsidian';
import type {PairingRequest} from './bridge';
export class ConfirmBrowserPairing extends Modal {
 private settled=false;private abort=()=>this.close();
 constructor(app:App,private request:PairingRequest,private resolve:(allowed:boolean)=>void){super(app)}
 onOpen(){
  if(this.request.signal.aborted){this.close();return;}this.request.signal.addEventListener('abort',this.abort,{once:true});
  this.setTitle('允许图片助手连接？');
  const message=document.createElement('p');message.textContent='允许后，这个浏览器可接收本库排版文章的图片，并上传到浏览器中已登录的公众号。以后重启会自动恢复连接。';
  const detail=document.createElement('details'),summary=document.createElement('summary'),origin=document.createElement('code');summary.textContent='连接来源';origin.textContent=this.request.origin;detail.append(summary,origin);
  const actions=document.createElement('div');actions.className='wx-confirm-actions';const cancel=document.createElement('button');cancel.textContent='取消';cancel.addEventListener('click',()=>this.close());
  const allow=document.createElement('button');allow.textContent='允许连接';allow.className='mod-cta';allow.dataset.allowBrowser='';allow.addEventListener('click',()=>{if(this.request.signal.aborted)return;this.settled=true;this.resolve(true);this.close();});
  actions.append(cancel,allow);this.contentEl.append(message,detail,actions);cancel.focus();
 }
 onClose(){this.request.signal.removeEventListener('abort',this.abort);if(!this.settled){this.settled=true;this.resolve(false);}this.contentEl.replaceChildren();}
}

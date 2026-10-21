// Runtime stand-ins for host integration tests; production still imports Obsidian.
import {StateField} from '@codemirror/state';
export const editorInfoField=StateField.define<any>({create:()=>null,update:value=>value});
export class Plugin {
 private cleanups:Array<()=>void>=[];
 constructor(public app:unknown,public manifest:unknown){}
 async loadData(){return{};}
 async saveData(_data:unknown){}
 register(cleanup:()=>void){this.cleanups.push(cleanup);}
 registerEvent(_event:unknown){}
 registerDomEvent(el:EventTarget,type:string,callback:EventListener,options?:AddEventListenerOptions){el.addEventListener(type,callback,options);this.register(()=>el.removeEventListener(type,callback,options));}
 addCommand(_command:unknown){}
 addRibbonIcon(){}
 unload(){for(const cleanup of this.cleanups)cleanup();(this as any).onunload?.();}
}
export class ItemView {contentEl=document.createElement('div');constructor(public leaf:unknown){}getState(){return{};}async setState(_state:unknown,_result:unknown){}}
export class MarkdownView {}
export class TFile {}
export class FileSystemAdapter {}
export class Notice {constructor(_message:string){}}
export class Modal {
 static latest:Modal|undefined;contentEl=document.createElement('div');containerEl=this.contentEl;title='';
 constructor(public app:unknown){}
 setTitle(title:string){this.title=title;return this;}
 open(){Modal.latest=this;document.body.append(this.contentEl);(this as any).onOpen?.();}
 close(){(this as any).onClose?.();this.contentEl.remove();}
}
export class MenuItem {
 title='';disabled=false;callback:()=>void=()=>{};
 setTitle(title:string){this.title=title;return this;}
 setIcon(_icon:string){return this;}
 setDisabled(disabled:boolean){this.disabled=disabled;return this;}
 setWarning(_warning:boolean){return this;}
 onClick(callback:()=>void){this.callback=callback;return this;}
 click(){if(!this.disabled)this.callback();}
}
export class Menu {
 static latest:Menu|undefined;items:MenuItem[]=[];hidden=false;
 addItem(build:(item:MenuItem)=>void){const item=new MenuItem();build(item);this.items.push(item);return this;}
 showAtPosition(_position:unknown,_doc?:Document){Menu.latest=this;return this;}
 hide(){this.hidden=true;}
}
export async function requestUrl(){throw Error('Unexpected network request in host test');}
export function setIcon(el:HTMLElement,icon:string){el.dataset.icon=icon;el.replaceChildren();}
export function setTooltip(el:HTMLElement,text:string){el.setAttribute('aria-label',text);el.title=text;}

/** Functional navigation: one visible page, independent mounted state. */
export interface WorkspacePage {
 id:string;label:string;el:HTMLElement;beforeHide?():void;onShow?():void;onHide?():void;
}
let nextId=0;
export class WorkspacePages {
 private selected:string;private tabs=new Map<string,HTMLButtonElement>();
 private prefix=`wx-pages-${++nextId}`;
 constructor(private navigation:HTMLElement,private pages:readonly WorkspacePage[],initial=pages[0].id){
  this.selected=initial;navigation.setAttribute('role','tablist');navigation.setAttribute('aria-label','排版功能');
  for(const page of pages){
   const button=navigation.ownerDocument.createElement('button');button.type='button';button.textContent=page.label;button.dataset.pageTab=page.id;button.id=`${this.prefix}-tab-${page.id}`;button.setAttribute('role','tab');button.setAttribute('aria-controls',`${this.prefix}-page-${page.id}`);
   page.el.id=`${this.prefix}-page-${page.id}`;page.el.dataset.page=page.id;page.el.setAttribute('role','tabpanel');page.el.setAttribute('aria-labelledby',button.id);
   button.addEventListener('click',()=>this.show(page.id));button.addEventListener('keydown',event=>{const index=pages.findIndex(p=>p.id===page.id);let next=index;if(event.key==='ArrowRight')next=(index+1)%pages.length;else if(event.key==='ArrowLeft')next=(index+pages.length-1)%pages.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=pages.length-1;else return;event.preventDefault();this.show(pages[next].id);this.tabs.get(pages[next].id)!.focus();});
   this.tabs.set(page.id,button);navigation.append(button);
  }
  this.apply();for(const page of pages)if(page.id!==initial)page.onHide?.();this.pages.find(p=>p.id===initial)?.onShow?.();
 }
 get current(){return this.selected;}
 show(id:string){
  const next=this.pages.find(page=>page.id===id);if(!next||id===this.selected)return;
  const previous=this.pages.find(page=>page.id===this.selected)!;previous.beforeHide?.();
  // Remove focus from the outgoing page before making it inert.
  const active=previous.el.ownerDocument.activeElement;if(active instanceof HTMLElement&&previous.el.contains(active))this.tabs.get(id)!.focus();
  previous.onHide?.();this.selected=id;this.apply();next.onShow?.();
 }
 private apply(){for(const page of this.pages){const active=page.id===this.selected;page.el.hidden=!active;page.el.toggleAttribute('inert',!active);page.el.setAttribute('aria-hidden',String(!active));const tab=this.tabs.get(page.id)!;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}}
 destroy(){this.navigation.replaceChildren();this.tabs.clear();}
}

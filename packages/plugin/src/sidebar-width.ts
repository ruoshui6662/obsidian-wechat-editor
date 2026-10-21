const DOCK='.workspace-split.mod-sidedock,.workspace-split.mod-right-split,.workspace-split.mod-left-split';
interface Lease {el:HTMLElement;hadClass:boolean;min:string;max:string;width:string;writtenWidth?:string;writtenMin?:string;writtenMax?:string}
/** Constrain the native dock, not its clipped leaf. Release ownership when our tab is hidden. */
export class SidebarWidth {
 private doc!:Document;private win!:(Window & typeof globalThis)|null;private resize?:ResizeObserver;private tree?:MutationObserver;private attributes?:MutationObserver;
 private observed=new Set<Element>();private lease?:Lease;private initialized=new WeakSet<HTMLElement>();private migrate?:()=>void;private frame:number|null=null;private disposed=false;
 constructor(private root:HTMLElement){this.bind();if(typeof root.onWindowMigrated==='function')this.migrate=root.onWindowMigrated(this.schedule);this.update();}
 private bind(){
  this.doc=this.root.ownerDocument;this.win=this.doc.defaultView as (Window & typeof globalThis)|null;
  const Resize=this.win?.ResizeObserver??globalThis.ResizeObserver,Mutation=this.win?.MutationObserver??globalThis.MutationObserver;
  if(Resize)this.resize=new Resize(this.schedule);
  if(Mutation){this.attributes=new Mutation(this.schedule);this.tree=new Mutation(this.schedule);this.tree.observe(this.doc.body??this.doc.documentElement,{childList:true,subtree:true});}
  this.win?.addEventListener('resize',this.schedule);
 }
 private schedule=()=>{
  if(this.disposed)return;
  if(this.doc!==this.root.ownerDocument){this.unbind();this.bind();this.update();return;}
  if(this.frame!==null)return;
  if(this.win?.requestAnimationFrame)this.frame=this.win.requestAnimationFrame(()=>{this.frame=null;this.update();});else this.update();
 };
 private watch(elements:Set<Element>){
  if(elements.size===this.observed.size&&[...elements].every(el=>this.observed.has(el)))return;
  this.resize?.disconnect();this.attributes?.disconnect();this.observed=elements;
  for(const el of elements){this.resize?.observe(el);this.attributes?.observe(el,{attributes:true,attributeFilter:['style','class','hidden']});}
 }
 private update(){
  if(this.disposed)return;if(this.doc!==this.root.ownerDocument){this.unbind();this.bind();}
  const dock=this.root.closest<HTMLElement>(DOCK),workspace=dock?.closest<HTMLElement>('.workspace');
  const observed=new Set<Element>([this.root]);for(let el=this.root.parentElement;el;el=el.parentElement){observed.add(el);if(el===workspace)break;}
  const others=[...workspace?.querySelectorAll<HTMLElement>(DOCK)??[]].filter(el=>el!==dock);
  for(const el of others)observed.add(el);this.watch(observed);
  const box=this.root.getBoundingClientRect();
  if(!dock||!workspace||!this.root.isConnected||box.width<=0||box.height<=0||dock.classList.contains('is-sidedock-collapsed')){this.release();return;}
  const otherWidth=others.reduce((sum,el)=>sum+(el.classList.contains('is-sidedock-collapsed')?0:el.getBoundingClientRect().width),0);
  const available=Math.max(0,workspace.getBoundingClientRect().width-otherWidth);
  // Keep room for writing; on unusually small windows allow a compact 280px panel if possible.
  const maximum=Math.floor(Math.min(available,Math.max(280,available-240))),minimum=Math.min(400,maximum),preferred=Math.min(460,maximum);
  if(maximum<=0){this.release();return;}
  if(this.lease?.el!==dock){this.release();this.lease={el:dock,hadClass:dock.classList.contains('wx-layout-dock'),min:dock.style.getPropertyValue('--wx-dock-min-width'),max:dock.style.getPropertyValue('--wx-dock-max-width'),width:dock.style.width};}
  const lease=this.lease!;
  if(!this.initialized.has(dock)){this.initialized.add(dock);if(dock.getBoundingClientRect().width<minimum){lease.writtenWidth=`${preferred}px`;dock.style.width=lease.writtenWidth;}}
  if(!dock.classList.contains('wx-layout-dock'))dock.classList.add('wx-layout-dock');
  lease.writtenMin=`${minimum}px`;lease.writtenMax=`${maximum}px`;
  if(dock.style.getPropertyValue('--wx-dock-min-width')!==lease.writtenMin)dock.style.setProperty('--wx-dock-min-width',lease.writtenMin);
  if(dock.style.getPropertyValue('--wx-dock-max-width')!==lease.writtenMax)dock.style.setProperty('--wx-dock-max-width',lease.writtenMax);
 }
 private release(){
  const lease=this.lease;if(!lease)return;this.lease=undefined;const {el}=lease;
  if(!lease.hadClass)el.classList.remove('wx-layout-dock');
  for(const [key,old,written]of [['--wx-dock-min-width',lease.min,lease.writtenMin],['--wx-dock-max-width',lease.max,lease.writtenMax]])if(el.style.getPropertyValue(key!)===written){if(old)el.style.setProperty(key!,old);else el.style.removeProperty(key!);}
  if(lease.writtenWidth&&el.style.width===lease.writtenWidth)el.style.width=lease.width;
 }
 private unbind(){
  if(this.frame!==null)this.win?.cancelAnimationFrame(this.frame);this.frame=null;this.win?.removeEventListener('resize',this.schedule);
  this.resize?.disconnect();this.tree?.disconnect();this.attributes?.disconnect();this.observed.clear();this.release();this.resize=undefined;this.tree=undefined;this.attributes=undefined;
 }
 destroy(){if(this.disposed)return;this.disposed=true;this.unbind();this.migrate?.();}
}

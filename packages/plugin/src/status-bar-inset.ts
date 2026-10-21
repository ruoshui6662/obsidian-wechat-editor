/** Reserve only the bottom area actually covered by this window's host status bar. */
export class StatusBarInset {
 private doc!:Document;private win!:(Window & typeof globalThis)|null;
 private resize?:ResizeObserver;private tree?:MutationObserver;private attributes?:MutationObserver;
 private unwatchMigration?:()=>void;private bars=new Set<HTMLElement>();private frame:number|null=null;private disposed=false;
 constructor(private root:HTMLElement){
  this.bind();if(typeof root.onWindowMigrated==='function')this.unwatchMigration=root.onWindowMigrated(this.schedule);this.update();
 }
 private bind(){
  this.doc=this.root.ownerDocument;this.win=this.doc.defaultView as (Window & typeof globalThis)|null;
  const Resize=this.win?.ResizeObserver??globalThis.ResizeObserver,Mutation=this.win?.MutationObserver??globalThis.MutationObserver;
  if(Resize){this.resize=new Resize(this.schedule);this.resize.observe(this.root);}
  if(Mutation){
   this.attributes=new Mutation(this.schedule);
   this.tree=new Mutation(this.schedule);
   this.tree.observe(this.doc.body??this.doc.documentElement,{childList:true,subtree:true});
  }
  this.watchBars(true);this.win?.addEventListener('resize',this.schedule);
 }
 private watchBars(force=false){
  if(this.disposed)return;
  const bars=new Set(this.doc.querySelectorAll<HTMLElement>('.status-bar'));
  if(!force&&bars.size===this.bars.size&&[...bars].every(bar=>this.bars.has(bar)))return;
  for(const bar of this.bars)if(!bars.has(bar))this.resize?.unobserve(bar);
  for(const bar of bars)if(!this.bars.has(bar))this.resize?.observe(bar);
  this.bars=bars;this.attributes?.disconnect();
  for(const el of [this.doc.documentElement,this.doc.body,...bars])if(el)this.attributes?.observe(el,{attributes:true,attributeFilter:['style','class','hidden']});
 }
 private schedule=()=>{
  if(this.disposed)return;
  if(this.doc!==this.root.ownerDocument){this.unbind();this.bind();this.update();return;}
  if(this.frame!==null)return;
  if(this.win?.requestAnimationFrame)this.frame=this.win.requestAnimationFrame(()=>{this.frame=null;this.update();});
  else this.update();
 };
 private update(){
  if(this.disposed)return;
  if(this.doc!==this.root.ownerDocument){this.unbind();this.bind();}
  this.watchBars();const panel=this.root.getBoundingClientRect();let inset=0;
  if(panel.width>0&&panel.height>0)for(const bar of this.bars){
   const box=bar.getBoundingClientRect(),style=this.win?.getComputedStyle(bar);
   if(box.width<=0||box.height<=0||style?.display==='none'||style?.visibility==='hidden')continue;
   // A status bar beside this pane, below it, or above its bottom edge needs no reservation.
   if(box.right<=panel.left||box.left>=panel.right||box.top>=panel.bottom||box.bottom<panel.bottom-1)continue;
   inset=Math.max(inset,Math.min(panel.height,panel.bottom-box.top));
  }
  const value=`${Math.ceil(inset)}px`;if(this.root.style.getPropertyValue('--wx-bottom-inset')!==value)this.root.style.setProperty('--wx-bottom-inset',value);
 }
 private unbind(){
  if(this.frame!==null)this.win?.cancelAnimationFrame(this.frame);this.frame=null;
  this.win?.removeEventListener('resize',this.schedule);this.resize?.disconnect();this.tree?.disconnect();this.attributes?.disconnect();this.bars.clear();
  this.resize=undefined;this.tree=undefined;this.attributes=undefined;
 }
 destroy(){
  if(this.disposed)return;this.disposed=true;this.unbind();this.unwatchMigration?.();this.root.style.removeProperty('--wx-bottom-inset');
 }
}

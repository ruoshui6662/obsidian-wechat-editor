type RGB=[number,number,number];
interface Palette {surface:string;secondary:string;foreground:string;border:string}
const rgb=(value:string):RGB|null=>{
 const hex=value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
 if(hex){const s=hex[1].length===3?[...hex[1]].map(c=>c+c).join(''):hex[1];return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16)) as RGB;}
 const decimal=value.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*1(?:\.0*)?)?\s*\)$/i);
 return decimal?decimal.slice(1,4).map(Number) as RGB:null;
};
const luminance=(color:RGB)=>color.map(v=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a:RGB,b:RGB)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
/** Lift dark ink without inverting hue or touching the picture pixels. */
function readable(source:string,palette:Palette,minimum=4.5){
 const color=rgb(source),surfaces=[rgb(palette.surface)!,rgb(palette.secondary)!];if(!color)return source;
 for(let step=0;step<=20;step++){const lifted=color.map(v=>Math.round(v+(255-v)*step/20)) as RGB;if(surfaces.every(bg=>contrast(lifted,bg)>=minimum))return `rgb(${lifted.join(', ')})`;}
 return palette.foreground;
}
/** Preview-only adapter: export HTML and image styles never receive these colors. */
export class PreviewTheme {
 private observer?:MutationObserver;private destroyed=false;
 private originals:Array<{node:HTMLElement;style:string}>=[];
 constructor(private host:HTMLElement,private paper:ShadowRoot){
  const document=host.ownerDocument;
  this.observer=new (document.defaultView?.MutationObserver??MutationObserver)(()=>this.sync());
  this.observer.observe(document.body,{attributes:true,attributeFilter:['class','style']});
  this.sync();
 }
 capture(){
  this.originals=[...this.paper.querySelectorAll<HTMLElement>('[style]')].filter(node=>node.tagName!=='IMG'&&!node.closest('[data-wx-heading-bar],[data-wx-photo]')).map(node=>({node,style:node.getAttribute('style')!}));
  this.sync();
 }
 private palette():Palette{
  const view=this.host.ownerDocument.defaultView!,host=view.getComputedStyle(this.host),body=view.getComputedStyle(this.host.ownerDocument.body);
  const value=(key:string,fallback:string)=>{const color=host.getPropertyValue(key).trim()||body.getPropertyValue(key).trim();return rgb(color)?color:fallback;};
  return {surface:value('--background-primary','#1e1e1e'),secondary:value('--background-secondary','#262626'),foreground:value('--text-normal','#dadada'),border:value('--background-modifier-border','#454545')};
 }
 private sync(){
  if(this.destroyed)return;
  const dark=this.host.ownerDocument.body.classList.contains('theme-dark');this.host.dataset.previewTheme=dark?'dark':'light';
  const palette=dark?this.palette():null;
  if(palette){this.host.style.setProperty('--wx-preview-paper',palette.surface);this.host.style.setProperty('--wx-preview-ink',palette.foreground);}else{this.host.style.removeProperty('--wx-preview-paper');this.host.style.removeProperty('--wx-preview-ink');}
  this.host.style.colorScheme=dark?'dark':'light';
  for(const {node,style} of this.originals){
   node.setAttribute('style',style);if(!palette)continue;
   if(node.style.color)node.style.color=readable(node.style.color,palette);
   if(node.style.backgroundColor&&rgb(node.style.backgroundColor))node.style.backgroundColor=node.parentNode===this.paper?palette.surface:palette.secondary;
   for(const side of ['Top','Right','Bottom','Left'] as const){const key=`border${side}Color` as const;if(node.style[key]&&rgb(node.style[key]))node.style[key]=palette.border;}
  }
 }
 destroy(){this.destroyed=true;this.observer?.disconnect();this.originals=[];}
}

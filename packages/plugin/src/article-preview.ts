import type {Article} from '../../core/src/types';
import {READING_WIDTH} from '../../core/src/image-geometry';
import {renderArticle} from '../../core/src/render';
import type {PanelState,ContentSelection} from './view';
import {PreviewTheme} from './preview-theme';
/** Article-only page. Hidden updates are deferred to preserve reading position. */
export class ArticlePreview {
 private paper:ShadowRoot;private article:Article|null=null;private selection:ContentSelection|null=null;private generation=0;private destroyed=false;
 private resizeObserver?:ResizeObserver;private theme:PreviewTheme;private active=true;private savedTop=0;private pending:PanelState|null=null;
 constructor(private root:HTMLElement,onSelect?:(article:Article,key:string,imageId:string|null)=>void){
  root.classList.add('wx-layout','wx-preview-view');
  root.innerHTML=`<section class="wx-preview-pane" aria-label="文章预览区"><div class="wx-preview-caption">手机阅读参考 · ${READING_WIDTH} px</div><div class="wx-preview-scroll" tabindex="0" aria-label="文章预览滚动区"><div class="wx-reading-frame" data-reading-width="${READING_WIDTH}"><article class="wx-paper" style="width:${READING_WIDTH}px"></article></div></div></section>`;
  this.paper=root.querySelector('.wx-paper')!.attachShadow({mode:'open'});
  this.theme=new PreviewTheme(root.querySelector<HTMLElement>('.wx-paper')!,this.paper);
  const scroll=root.querySelector<HTMLElement>('.wx-preview-scroll')!;
  const fit=()=>{
   if(this.destroyed)return;
   const frame=root.querySelector<HTMLElement>('.wx-reading-frame')!,paper=root.querySelector<HTMLElement>('.wx-paper')!;
   const css=scroll.ownerDocument.defaultView?.getComputedStyle(scroll)??getComputedStyle(scroll);
   const width=scroll.clientWidth-(parseFloat(css.paddingLeft)||0)-(parseFloat(css.paddingRight)||0);
   const scale=width>0?Math.min(1,width/READING_WIDTH):1;
   frame.style.width=READING_WIDTH*scale+'px';paper.style.zoom=String(scale);
  };
  if(typeof ResizeObserver!=='undefined'){this.resizeObserver=new ResizeObserver(fit);this.resizeObserver.observe(scroll);}fit();
  for(const type of ['wheel','touchstart','pointerdown','keydown'])scroll.addEventListener(type,()=>{this.generation++;},{passive:true});
  this.paper.addEventListener('click',event=>{const el=event.target as HTMLElement;if(el.closest('a'))event.preventDefault();if(!onSelect)return;const imageId=el.closest<HTMLImageElement>('[data-wx-image]')?.dataset.wxImage??null;const key=imageId?this.article?.images.find(i=>i.occurrenceId===imageId)?.blockKey:el.closest<HTMLElement>('[data-wx-block]')?.dataset.wxBlock;if(this.article&&key)onSelect(this.article,key,imageId);});
 }
 setActive(active:boolean){
  if(active===this.active)return;
  const scroll=this.root.querySelector<HTMLElement>('.wx-preview-scroll')!;
  if(!active){this.savedTop=scroll.scrollTop;this.generation++;this.active=false;return;}
  this.active=true;scroll.scrollTop=this.savedTop;if(this.pending){const state=this.pending;this.pending=null;this.render(state,this.savedTop);}else this.restoreOnLoad(this.savedTop);
 }
 setState(state:PanelState){
  const same=this.article?.sourcePath===state.article?.sourcePath;
  if(!this.active){if(!same)this.savedTop=0;this.article=state.article;this.pending=state;return;}
  const top=same?this.root.querySelector<HTMLElement>('.wx-preview-scroll')!.scrollTop:0;this.render(state,top);
 }
 private render(state:PanelState,top:number){
  this.article=state.article;
  this.paper.innerHTML='<style>:host{display:block}section{max-width:100%}img[data-selected="true"]{outline:2px solid var(--wx-accent,#007aff);outline-offset:4px}</style>'+(state.article?renderArticle(state.article,state.layout,state.sources,state.overrides,state.geometry).html:'<p style="padding:24px;color:#999;font:14px sans-serif">打开笔记后，在这里预览公众号排版。</p>');
  this.theme.capture();
  this.restoreOnLoad(top);this.markSelection(this.selection);
 }
 private restoreOnLoad(top:number){
  const generation=++this.generation,scroll=this.root.querySelector<HTMLElement>('.wx-preview-scroll')!;
  const restore=()=>{if(!this.destroyed&&this.active&&generation===this.generation)scroll.scrollTop=top;};restore();for(const image of this.paper.querySelectorAll('img'))image.addEventListener('load',restore,{once:true});
 }
 markSelection(selection:ContentSelection|null){
  this.selection=selection;for(const image of this.paper.querySelectorAll('img[data-selected]'))image.removeAttribute('data-selected');
  if(selection?.path===this.article?.sourcePath&&selection?.imageId)this.paper.querySelector(`[data-wx-image="${selection.imageId}"]`)?.setAttribute('data-selected','true');
 }
 destroy(){this.destroyed=true;this.resizeObserver?.disconnect();this.theme.destroy();this.pending=null;this.generation++;this.root.replaceChildren();}
}

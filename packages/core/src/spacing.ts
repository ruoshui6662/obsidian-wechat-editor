import type Token from 'markdown-it/lib/token.mjs';
import type {Article,BlockOverrides,LayoutSettings} from './types';
import {mergeImageStyles,normalizeLayout} from './styles';
export interface BlockSpacing {before:number;after:number}
export interface SpacingPlan {roots:Map<Token,BlockSpacing>;images:Map<string,BlockSpacing>;imageBlocks:Set<string>;title?:BlockSpacing}
/** One outer owner per top-level gap; nested containers keep their own layout. */
export function planSpacing(article:Article,layout:LayoutSettings,overrides:BlockOverrides):SpacingPlan{
 const plan:SpacingPlan={roots:new Map(),images:new Map(),imageBlocks:new Set()};
 if(layout.spacingMode!=='smart')return plan;
 const roots:Array<{token:Token;space:BlockSpacing;heading:boolean}>=[];
 for(const token of article.tokens){
  if(token.level!==0||token.nesting<0||!['paragraph_open','heading_open','blockquote_open','bullet_list_open','ordered_list_open','table_open','fence','code_block','hr'].includes(token.type))continue;
  const block=article.blocks.find(b=>b.key===token.meta?.blockKey),local=block?.blockId?overrides[block.blockId]?.text:undefined,s=normalizeLayout({...layout,...local});
  const images=article.images.filter(i=>i.blockKey===block?.key&&i.mode==='block');
  let before=0,after=s.paragraphAfter,heading=token.type==='heading_open';
  if(images.length&&['paragraph_open','heading_open'].includes(token.type)){
   const styles=images.map(()=>mergeImageStyles(overrides['*']?.image,block?.blockId?overrides[block.blockId]?.image:undefined));
   before=styles[0].marginBefore;after=styles.at(-1)!.marginAfter;heading=false;plan.imageBlocks.add(block!.key);
   images.forEach((image,index)=>plan.images.set(image.occurrenceId,{before:index?Math.max(styles[index-1].marginAfter,styles[index].marginBefore):0,after:0}));
  }else if(heading){before=local?.paragraphBefore??s.headingBefore;after=local?.paragraphAfter??s.headingAfter;}
  else if(token.type==='paragraph_open'){before=s.paragraphBefore;}
  else if(token.type==='blockquote_open'||token.type==='hr'){before=16;after=16;}
  else if(token.type==='bullet_list_open'||token.type==='ordered_list_open')after=20;
  roots.push({token,space:{before,after},heading});
 }
 if(layout.includeTitle&&article.extractedTitle)plan.title={before:0,after:roots.length?0:layout.headingAfter};
 roots.forEach((root,index)=>plan.roots.set(root.token,{before:index?Math.max(roots[index-1].space.after,root.space.before):plan.title?Math.max(layout.headingAfter,root.space.before):root.heading?0:root.space.before,after:index===roots.length-1?root.space.after:0}));
 return plan;
}

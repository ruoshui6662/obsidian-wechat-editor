import type {Article,BlockOverrides,ImageRef,ImageStyle,LayoutSettings} from './types';
import {imageContainerInset,imageInsets} from './styles';
export const READING_WIDTH=375;
/** The same content box used by renderArticle, before bitmap decoration. */
export function imageReadingWidth(article:Article,ref:ImageRef,layout:LayoutSettings,style:ImageStyle,overrides:BlockOverrides={},naturalWidth=Infinity):number{
 const block=article.blocks.find(b=>b.key===ref.blockKey),stack:number[]=[];let available=READING_WIDTH;
 for(const token of article.tokens){
  if(token===block?.tokens[0])break;
  if(token.nesting===-1)available+=stack.pop()??0;
  else if(token.nesting===1){const cost=token.type==='blockquote_open'?31:token.type==='bullet_list_open'||token.type==='ordered_list_open'?24:0;const inset=cost&&token.level===0?layout.sidePadding*2:0;stack.push(cost+inset);available-=cost+inset;}
 }
 const edges=imageInsets(style,imageContainerInset(block,layout,block?.blockId?overrides[block.blockId]?.text:undefined));
 available=Math.max(1,available-edges.left-edges.right);
 if(style.alignment==='justify')return available;
 if(style.widthPercent)return available*style.widthPercent/100;
 return Math.max(1,Math.min(available,ref.width??naturalWidth));
}

import {parseArticle} from '../../core/src/parse';
import type {Article} from '../../core/src/types';
import type {Template} from './settings';
export type {Template} from './settings';
export function applyTemplate(article:Article,template:Template):Article{
 const main=parseArticle(article.source,article.sourcePath);
 function part(source:string,prefix:string):Article{
  const a=parseArticle(source,article.sourcePath);
  for(const b of a.blocks){b.key=prefix+b.key;if(b.blockId)b.blockId=prefix+b.blockId;}
  for(const t of a.tokens)if(t.meta?.blockKey){t.meta.blockKey=prefix+t.meta.blockKey;if(t.meta.blockId)t.meta.blockId=prefix+t.meta.blockId;}
  for(const i of a.images){i.occurrenceId=prefix+i.occurrenceId;i.blockKey=prefix+i.blockKey;}
  return a;
 }
 const head=part(template.headerMarkdown,'template-header-'),foot=part(template.footerMarkdown,'template-footer-');
 return{...main,tokens:[...head.tokens,...main.tokens,...foot.tokens],blocks:[...head.blocks,...main.blocks,...foot.blocks],images:[...head.images,...main.images,...foot.images],diagnostics:[...head.diagnostics,...main.diagnostics,...foot.diagnostics],revision:article.revision+'\0'+template.headerMarkdown+'\0'+template.footerMarkdown};
}

import MarkdownIt from 'markdown-it';
import { parseDocument } from 'yaml';
import type Token from 'markdown-it/lib/token.mjs';
import type { Article, ArticleBlock, Diagnostic, ImageRef } from './types';
import { wikiImages } from './wikilinks';
import imageRule from 'markdown-it/lib/rules_inline/image.mjs';

export function parseArticle(source:string,sourcePath:string):Article {
  const md=new MarkdownIt({html:false,breaks:true,linkify:false}).use(wikiImages);
  md.inline.ruler.at('image',(state,silent)=>{const from=state.pos,ok=imageRule(state,silent);if(ok&&!silent){const token=state.tokens.at(-1);if(token?.type==='image')token.meta={...token.meta,markupFrom:from,markupTo:state.pos};}return ok;});
  // Preserve the note's path spelling; the Vault resolver decodes exactly once.
  md.normalizeLink=(url:string)=>url;
  const diagnostics:Diagnostic[]=[]; let body=source.replace(/\r\n/g,'\n'),offset=0;
  let title=sourcePath.split('/').at(-1)!.replace(/\.md$/i,'');
  const fm=body.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if(fm){
    const doc=parseDocument(fm[1]);
    if(doc.errors.length)diagnostics.push({code:'invalid-frontmatter',message:'文档属性格式有误，请修正后再复制。',severity:'error'});
    else {const data=doc.toJSON();if(typeof data?.title==='string'&&data.title.trim())title=data.title.trim();}
    offset=(fm[0].match(/\n/g)||[]).length;body=body.slice(fm[0].length);
  }
  const env={};const tokens=md.parse(body,env);
  let extractedTitle:string|undefined;
  const firstH1=tokens.findIndex(t=>t.type==='heading_open'&&t.tag==='h1');
  if(firstH1>=0&&tokens[firstH1+1]?.content===title){extractedTitle=title;tokens.splice(firstH1,3);}
  const blocks:ArticleBlock[]=[];const images:ImageRef[]=[];
  for(let n=0;n<tokens.length;n++){
    const t=tokens[n];if(!t.map)continue;
    if(!['paragraph_open','heading_open','fence','code_block','table_open','hr'].includes(t.type))continue;
    const range={startLine:t.map[0]+offset,endLine:t.map[1]+offset};
    const inline=tokens[n+1]?.type==='inline'?tokens[n+1]:null;
    let blockId:string|undefined;
    const id=inline?.content.match(/(?:^|\s)\^([A-Za-z0-9-]+)\s*$/);
    if(inline&&id){
      blockId=id[1];inline.content=inline.content.slice(0,id.index).trimEnd();
      inline.children=md.parseInline(inline.content,env)[0]?.children??[];
    }
    const key=`block-${range.startLine}`;
    t.meta={...t.meta,blockKey:key,blockId};
    let end=n+1;
    if(t.nesting===1){while(end<tokens.length&&!(tokens[end].nesting===-1&&tokens[end].level===t.level))end++;end++;}
    const block:ArticleBlock={key,blockId,range,kind:t.type.replace('_open',''),tokens:tokens.slice(n,end)};
    blocks.push(block);
  }
  // Table cell inline tokens have no source map and no paragraph_open token.
  // Traverse each selectable block's complete token span, including those cells.
  const visited=new Set<Token>(),lineStarts=[0];for(let i=0;i<source.length;i++)if(source[i]==='\n')lineStarts.push(i+1);
  const searchAt=new Map<string,number>();
  for(const block of blocks)for(const inline of block.tokens){
    if(inline.type!=='inline'||visited.has(inline))continue;visited.add(inline);
    const {range,key}=block;const children=inline.children??[];
    // Map inline offsets back to the note, including quote/list prefixes. If
    // mapping isn't exact, omit the edit range instead of risking a wrong edit.
    const positions:number[]=[];let cursor=searchAt.get(key)??lineStarts[range.startLine],valid=true;
    const limit=lineStarts[range.endLine]??source.length;
    for(const [n,line]of inline.content.split('\n').entries()){
      if(n){const newline=source.indexOf('\n',cursor);if(newline<0||newline>=limit){valid=false;break;}positions.push(newline);cursor=newline+1;}
      let at=source.indexOf(line,cursor),tableEscapes=false;
      if(block.kind==='table'&&line.includes('|')){
        const pattern=[...line].map(c=>c==='|'?'\\\\?\\|':c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('');
        const match=new RegExp(pattern).exec(source.slice(cursor,limit));
        if(match&&(at<0||cursor+match.index<=at)){at=cursor+match.index;tableEscapes=true;}
      }
      if(at<0||at+line.length>limit){valid=false;break;}
      cursor=at;for(let j=0;j<line.length;j++){const c=line[j];if(tableEscapes&&c==='|'&&source[cursor]==='\\'&&source[cursor+1]==='|')cursor++;positions.push(cursor++);}
    }
    if(valid)searchAt.set(key,cursor);
    const blockOnly=children.every(c=>c.type==='image'||c.type==='softbreak'||(c.type==='text'&&!c.content.trim()));
    for(const child of children){
      if(child.meta?.unsupportedEmbed)diagnostics.push({code:'unsupported-note-embed',message:'笔记嵌入暂不展开，请将内容放入当前文章。',severity:'error',source:range});
      if(child.type!=='image')continue;
      const occurrenceId=`img-${images.length}`;
      let width=child.meta?.width,height=child.meta?.height;
      const alt=child.content.replace(/\|(\d+)(?:x(\d+))?$/,(match,w,h)=>{width=Number(w);height=h?Number(h):undefined;return '';});
      const from=positions[child.meta?.markupFrom],to=positions[child.meta?.markupTo-1];
      const markupRange=valid&&from!==undefined&&to!==undefined?{from,to:to+1}:undefined;
      const ref:ImageRef={occurrenceId,source:child.attrGet('src')??'',literalPath:child.meta?.wiki===true,alt,blockKey:key,mode:blockOnly?'block':'inline',width,height,range,...(markupRange?{markupRange}:{})};
      images.push(ref);child.meta={...child.meta,ref};
    }
  }
  return {title,sourcePath,source,revision:source,tokens,blocks,images,diagnostics,extractedTitle};
}

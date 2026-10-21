import type {Article,BlockOverrides,Diagnostic,SourceRange} from '../../core/src/types';
import {LayoutError} from '../../core/src/types';
import type {NoteSettings} from './settings';
export function ensureBlockId(source:string,range:SourceRange,generateId:()=>string):{source:string;blockId:string;edit:{from:number;to:number;text:string}|null}{
 const lines=source.split('\n');const segment=lines.slice(range.startLine,range.endLine).join('\n');const existing=segment.match(/(?:^|\s)\^([A-Za-z0-9-]+)\s*$/)||lines[range.endLine]?.match(/^\^([A-Za-z0-9-]+)\s*$/);
 if(existing)return{source,blockId:existing[1],edit:null};
 if(range.startLine<0||range.endLine<=range.startLine||range.endLine>lines.length)throw new LayoutError('block-range','段落位置已变化，请刷新后再调整。');
 const blockId=generateId();if(!/^[A-Za-z0-9-]+$/.test(blockId))throw Error('Invalid block identifier');
 const heading=/^\s{0,3}#{1,6}\s/.test(lines[range.startLine])||(range.endLine===range.startLine+2&&/^\s{0,3}(?:=+|-+)\s*$/.test(lines[range.startLine+1]));
 const line=heading?range.startLine:range.endLine-1;
 let from=0;for(let i=0;i<line;i++)from+=lines[i].length+1;from+=lines[line].length;
 if(heading){const closing=lines[line].match(/\s+#+\s*$/);if(closing)from-=closing[0].length;}
 const text=(heading?' ':'\n')+'^'+blockId;return{source:source.slice(0,from)+text+source.slice(from),blockId,edit:{from,to:from,text}};
}
export function resolveOverrides(article:Article,saved:BlockOverrides):{active:BlockOverrides;diagnostics:Diagnostic[]}{
 const active:BlockOverrides=Object.create(null),diagnostics:Diagnostic[]=[];const counts=new Map<string,number>();for(const b of article.blocks)if(b.blockId)counts.set(b.blockId,(counts.get(b.blockId)||0)+1);
 for(const [id,value]of Object.entries(saved))if(id==='*'||counts.get(id)===1)active[id]=value;else diagnostics.push({code:counts.has(id)?'ambiguous-block-id':'missing-block-id',severity:'warning',message:`局部样式 ${id} 未应用：${counts.has(id)?'块标识重复':'原段落已删除或标识已变化'}。`});
 return{active,diagnostics};
}
export function migrateNotePath(notes:Record<string,NoteSettings>,from:string,to:string):void{
 if(!from||from===to)return;
 const moves=Object.entries(notes).filter(([path])=>path===from||path.startsWith(from+'/')).map(([path,value])=>({previous:path,next:to+path.slice(from.length),value}));
 for(const move of moves)delete notes[move.previous];
 for(const move of moves)notes[move.next]=move.value;
}
export function ensureSelectionBlockId(source:string,article:Article,key:string,generateId:()=>string){
 if(source!==article.source)throw new LayoutError('block-range','文章已变化，请刷新预览后再调整局部样式。');
 const block=article.blocks.find(b=>b.key===key);if(!block||key.startsWith('template-'))throw new LayoutError('block-range','请选择当前笔记中的段落或独立图片。');
 return ensureBlockId(source,block.range,generateId);
}

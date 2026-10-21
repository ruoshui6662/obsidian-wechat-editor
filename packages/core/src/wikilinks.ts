import type MarkdownIt from 'markdown-it';
export function parseWikiImage(value: string): {source: string; width?: number; height?: number} | null {
  const [source,...parts]=value.split('|');
  if(!source?.trim()) return null;
  const dimensions=parts.at(-1)?.match(/^(\d+)(?:x(\d+))?$/);
  return {source:source.trim(),...(dimensions?{width:Number(dimensions[1]),...(dimensions[2]?{height:Number(dimensions[2])}:{})}:{})};
}
export function wikiImages(md: MarkdownIt): void {
  md.inline.ruler.before('image','wiki_image',(state,silent)=>{
    if(!state.src.startsWith('![[',state.pos))return false;
    const end=state.src.indexOf(']]',state.pos+3); if(end<0)return false;
    const raw=state.src.slice(state.pos+3,end); const parsed=parseWikiImage(raw); if(!parsed)return false;
    if(!silent){
      if(!/^https?:\/\//i.test(parsed.source)&&!/\.(png|jpe?g|gif|webp|svg|avif|heic|heif)(?:[?#].*)?$/i.test(parsed.source)) {
        const token=state.push('text','',0); token.content=state.src.slice(state.pos,end+2); token.meta={unsupportedEmbed:true};
      } else {
        const token=state.push('image','img',0); token.attrSet('src',parsed.source);token.content='';token.children=[];token.meta={...parsed,wiki:true,markupFrom:state.pos,markupTo:end+2};
      }
    }
    state.pos=end+2; return true;
  });
}

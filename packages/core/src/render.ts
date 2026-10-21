import {describeShadow} from './image-appearance';
import {planSpacing} from './spacing';
import type Token from 'markdown-it/lib/token.mjs';
import MarkdownIt from 'markdown-it';
import type { Article, BlockOverrides, ImageRef, LayoutSettings, RenderedArticle, ImageGeometry } from './types';
import { mergeImageStyles, imageInsets, imageContainerInset, normalizeLayout, textCSS } from './styles';
import {articleTheme,headingDecoration,headingHasText} from './themes';
const escape=(v:string)=>v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function safeImageURL(value:string):boolean{return /^(https?:\/\/|blob:|app:\/\/|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(value)&&!/[\x00-\x1f]/.test(value);}
export function renderArticle(article:Article,layout:LayoutSettings,sources:ReadonlyMap<string,string>,overrides:BlockOverrides={},geometry:ReadonlyMap<string,ImageGeometry>=new Map()):RenderedArticle{
 const md=new MarkdownIt({html:false,breaks:true});const settings=normalizeLayout(layout),diagnostics=[...article.diagnostics];
 const theme=articleTheme(settings.themeId),spacing=planSpacing(article,settings,overrides);
 const gap=(token:Token,before:number,after:number)=>{const value=spacing.roots.get(token)??{before,after};return `margin-top:${value.before}px;margin-bottom:${value.after}px;`;};
 const refs=new Map(article.images.map(i=>[i.occurrenceId,i]));
 const blockByKey=new Map(article.blocks.map(b=>[b.key,b]));
 const inset=(level:number)=>`margin-left:${level===0?settings.sidePadding:0}px;margin-right:${level===0?settings.sidePadding:0}px;`;
 const imageRule=(ref:ImageRef)=>{
  const raw=sources.get(ref.occurrenceId)||'';
  const src=safeImageURL(raw)?raw:'';
  const b=blockByKey.get(ref.blockKey);const s=mergeImageStyles(overrides['*']?.image,b?.blockId?overrides[b.blockId]?.image:undefined);const parentInset=imageContainerInset(b,settings,b?.blockId?overrides[b.blockId]?.text:undefined),edges=imageInsets(s,parentInset);
  if(ref.mode==='inline'){
   const size=ref.width?`width:${ref.width}px;height:${ref.height?ref.height+'px':'auto'};`:'height:1.5em;width:auto;';
   return `<img src="${escape(src)}" alt="${escape(ref.alt)}" data-wx-image="${ref.occurrenceId}" style="display:inline-block;vertical-align:middle;max-width:100%;${size}" />`;
  }
  const fill=s.alignment==='justify';
  const width=fill?'100%':s.widthPercent?`${s.widthPercent}%`:ref.width?`${ref.width}px`:'auto';
  const sh=describeShadow(s),shadow=s.shadow?(s.backgroundMode==='preserve'?`filter:drop-shadow(0 ${sh.offsetY}px ${sh.blur/2}px rgba(0,0,0,${sh.opacity/100}));`:`box-shadow:0 ${sh.offsetY}px ${sh.blur}px rgba(0,0,0,${sh.opacity/100});`):'';
  const visual=s.bakeEffects&&!/\.gif(?:[?#].*)?$/i.test(ref.source)?'':`border-radius:${s.radius}px;border:${s.borderWidth}px solid ${s.borderColor};${s.backgroundMode?`background-color:${s.backgroundMode==='solid'?s.background:'transparent'};`:''}${shadow}`;
  const baked=geometry.get(ref.occurrenceId);
  const image=baked?`<span data-wx-photo="" style="display:inline-block;vertical-align:middle;max-width:100%;width:${width==='auto'?baked.naturalWidth+'px':width};"><img src="${escape(src)}" alt="${escape(ref.alt)}" data-wx-image="${ref.occurrenceId}" style="display:block;max-width:none;width:${(1+2*baked.paddingRatio)*100}%;height:auto;margin:${-baked.paddingRatio*100}%;" /></span>`:`<img src="${escape(src)}" alt="${escape(ref.alt)}" data-wx-image="${ref.occurrenceId}" style="display:${fill?'block':'inline-block'};vertical-align:middle;max-width:100%;width:${width};height:auto;box-sizing:border-box;${visual}" />`;
  return `<span style="display:block;text-align:${fill?'left':s.alignment};margin-top:${spacing.images.get(ref.occurrenceId)?.before??s.marginBefore}px;margin-bottom:${spacing.images.get(ref.occurrenceId)?.after??s.marginAfter}px;margin-left:${edges.left-parentInset.left}px;margin-right:${edges.right-parentInset.right}px;text-indent:0;">${image}</span>`;
 };
 md.renderer.rules.image=(tokens,i)=>{const ref=refs.get(tokens[i].meta?.ref?.occurrenceId);if(ref)return imageRule(ref);diagnostics.push({code:'untracked-image',severity:'error',message:'存在未识别的图片，请刷新预览后再复制。'});return '<span style="color:#a33232;">[未识别的图片]</span>';};
 md.renderer.rules.link_open=(tokens,i)=>{
  const href=tokens[i].attrGet('href')??'';const allowed=/^https:\/\/mp\.weixin\.qq\.com\//i.test(href);
  if(!allowed)diagnostics.push({code:'external-link',severity:'warning',message:'普通外链将以文字显示，请在公众号后台检查。'});
  tokens[i].meta={allowed};
  // The matching closing rule tracks links with an explicit stack.
  linkStack.push(allowed);return allowed?`<a href="${escape(href)}" style="color:${theme?.accent??'#1677b3'};text-decoration:none;">`:'<span>';
 };
 const linkStack:boolean[]=[];
 md.renderer.rules.link_close=()=>linkStack.pop()?'</a>':'</span>';
 for(const kind of ['paragraph_open','heading_open'])md.renderer.rules[kind]=(tokens,i)=>{
  const t=tokens[i],b=blockByKey.get(t.meta?.blockKey);const s=normalizeLayout({...settings,...(b?.blockId?overrides[b.blockId]?.text:{})});
  const local=b?.blockId?overrides[b.blockId]?.text:undefined;
  const accent=local?.textColor?s.textColor:theme?.accent??s.textColor;
  const decoration=t.type==='heading_open'?`${theme?`color:${accent};`:''}${headingDecoration(theme,t.tag,s,headingHasText(b)).css}`:'';
  const heading=t.type==='heading_open'?(t.tag==='h3'?`font-size:${s.h3FontSize}px;font-weight:600;line-height:1.5;text-align:left;text-indent:0;`:`font-size:${Math.max(s.fontSize,Math.min(30,s.fontSize+(t.tag==='h1'?8:t.tag==='h2'?5:2)))}px;font-weight:700;text-indent:0;`):'';
  const tag=t.hidden?'span':t.tag;
  const space=spacing.roots.get(t);const styled=space?{...s,paragraphBefore:space.before,paragraphAfter:space.after}:s;
  const css=t.hidden?textCSS({...s,paragraphBefore:0,paragraphAfter:0})+'display:block;':textCSS(styled,t.level===0?s.sidePadding:0)+heading+decoration+(spacing.imageBlocks.has(b?.key??'')?'line-height:0;':'');
  const marker=t.type==='heading_open'&&t.tag==='h3'&&s.h3AccentBar&&headingHasText(b)?`<span data-wx-heading-bar="" aria-hidden="true" style="display:inline-block;width:4px;height:16px;line-height:0;font-size:0;margin-left:-12px;margin-right:8px;vertical-align:-2px;">${[[6,'#3478f6'],[4,'#6b9df9'],[2,'#9bbdfb']].map(([height,color],index)=>`<span style="display:block;width:4px;height:${height}px;margin-top:${index?2:0}px;border-radius:1px;background-color:${color};"></span>`).join('')}</span>`:'';
  return `<${tag} data-wx-block="${escape(b?.key??'')}" style="${escape(css)}">${marker}`;
 };
 md.renderer.rules.paragraph_close=(tokens,i)=>tokens[i].hidden?'</span>':'</p>\n';
 md.renderer.rules.table_open=(tokens,i)=>`<section style="${inset(tokens[i].level)}${gap(tokens[i],0,settings.paragraphAfter)}"><table style="border-collapse:collapse;width:100%;font-size:14px;table-layout:auto;">`;
 md.renderer.rules.table_close=()=>'</table></section>\n';
 for(const tag of ['th','td'])md.renderer.rules[tag+'_open']=(tokens,i)=>{
  const alignment=tokens[i].attrGet('style')?.match(/text-align\s*:\s*(left|center|right)/)?.[1]??'left';
  return `<${tag} style="border:1px solid ${theme?.border??'#ddd'};${theme&&tag==='th'?`background:${theme.soft};color:${theme.accent};`:''}padding:6px;text-align:${alignment};overflow-wrap:anywhere;">`;
 };
 md.renderer.rules.bullet_list_open=(tokens,i)=>`<ul style="${gap(tokens[i],0,20)}${inset(tokens[i].level)}padding-left:24px;list-style-type:disc;">`;
 md.renderer.rules.ordered_list_open=(tokens,i)=>{const start=tokens[i].attrGet('start');return `<ol${start!==null?` start="${escape(String(start))}"`:''} style="${gap(tokens[i],0,20)}${inset(tokens[i].level)}padding-left:24px;list-style-type:decimal;">`;};
 md.renderer.rules.list_item_open=()=>'<li style="margin-bottom:6px;">';
 md.renderer.rules.blockquote_open=(tokens,i)=>`<blockquote style="${gap(tokens[i],16,16)}${inset(tokens[i].level)}padding:8px 14px;border-left:3px solid ${theme?.accent??'#d9dee5'};background:${theme?.soft??'#f7f8fa'};">`;
 const defaultFence=md.renderer.rules.fence!;
 const codeStyle=(token:Token)=>`white-space:pre-wrap;overflow-wrap:anywhere;${gap(token,0,settings.paragraphAfter)}${inset(token.level)}padding:12px;background:${theme?.soft??'#f5f7fa'};border-radius:6px;font-size:13px;line-height:1.6;`;
 md.renderer.rules.fence=(tokens,i,options,env,renderer)=>defaultFence(tokens,i,options,env,renderer).replace('<pre>',`<pre style="${codeStyle(tokens[i])}">`);
 const defaultCode=md.renderer.rules.code_block!;
 md.renderer.rules.code_block=(tokens,i,options,env,renderer)=>defaultCode(tokens,i,options,env,renderer).replace('<pre>',`<pre style="${codeStyle(tokens[i])}">`);
 md.renderer.rules.hr=(tokens,i)=>`<hr style="${gap(tokens[i],16,16)}${inset(tokens[i].level)}border:0;border-top:1px solid #ddd;" />`;
 if(theme){md.renderer.rules.strong_open=()=>`<strong style="color:${theme.accent};font-weight:700;">`;md.renderer.rules.code_inline=(tokens,i)=>`<code style="color:${theme.accent};background:${theme.soft};padding:2px 4px;border-radius:3px;">${escape(tokens[i].content)}</code>`;}
 const html=md.renderer.render(article.tokens,md.options,{});
 const title=settings.includeTitle&&article.extractedTitle?`<h1 style="${escape(textCSS({...settings,fontSize:Math.max(24,settings.fontSize),...(spacing.title?{paragraphBefore:spacing.title.before,paragraphAfter:spacing.title.after}:{})},settings.sidePadding))}font-weight:700;${theme?`color:${theme.accent};`:''}">${escape(article.title)}</h1>`:'';
 const text=article.tokens.filter(t=>['inline','fence','code_block'].includes(t.type)).map(t=>t.type==='inline'?(t.children??[]).map(c=>c.type==='image'?`[图片${c.content?': '+c.content:''}]`:['softbreak','hardbreak'].includes(c.type)?'\n':c.content).join(''):t.content).join('\n\n');
 return {html:`<section style="box-sizing:border-box;background:#ffffff;padding:0;${escape(textCSS({...settings,paragraphBefore:0,paragraphAfter:0}))}">${title}${html}</section>`,text:(title?article.title+'\n\n':'')+text,diagnostics};
}

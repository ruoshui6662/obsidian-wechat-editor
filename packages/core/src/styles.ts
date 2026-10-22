import {DEFAULT_LAYOUT} from './defaults';
import {articleTheme,headingDecoration,headingHasText} from './themes';
import { ARTICLE_THEME_IDS, type ImageStyle, type LayoutSettings, type ArticleBlock } from './types';
const FONT_FAMILIES:Record<LayoutSettings['fontFamily'],string>={
 system:"system-ui,-apple-system,BlinkMacSystemFont,sans-serif",
 sans:"-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif",
 serif:"'Songti SC',SimSun,serif",
 'source-han-serif':"'Source Han Serif SC','Source Han Serif CN','思源宋体','思源宋体 CN','Songti SC',SimSun,serif",
};
export {DEFAULT_LAYOUT} from './defaults';
export const LAYOUT_RANGES={headingBefore:[0,64],headingAfter:[0,64],h3FontSize:[10,50],fontSize:[10,50],lineHeight:[1,3],letterSpacing:[0,3],paragraphBefore:[0,48],paragraphAfter:[0,48],firstLineIndent:[0,4],sidePadding:[0,96]} as const;
export const DEFAULT_IMAGE:ImageStyle={alignment:'left',marginBefore:28,marginAfter:28,marginLeft:0,marginRight:0,radius:0,borderWidth:0,borderColor:'#dddddd',shadow:0,background:'#ffffff',bakeEffects:false};
export const clamp=(v:unknown,min:number,max:number,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(min,v)):fallback;
export const color=(v:unknown,fallback:string)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:fallback;
export function normalizeLayout(input:Partial<LayoutSettings>={}):LayoutSettings{
 return {spacingMode:input.spacingMode==='manual'?'manual':'smart',headingBefore:clamp(input.headingBefore,0,64,28),headingAfter:clamp(input.headingAfter,0,64,12),h3FontSize:clamp(input.h3FontSize,...LAYOUT_RANGES.h3FontSize,18),h3AccentBar:input.h3AccentBar!==false,...(ARTICLE_THEME_IDS.includes(input.themeId!)?{themeId:input.themeId}:{}),fontFamily:typeof input.fontFamily==='string'&&Object.hasOwn(FONT_FAMILIES,input.fontFamily)?input.fontFamily:DEFAULT_LAYOUT.fontFamily,fontSize:clamp(input.fontSize,...LAYOUT_RANGES.fontSize,DEFAULT_LAYOUT.fontSize),lineHeight:clamp(input.lineHeight,...LAYOUT_RANGES.lineHeight,DEFAULT_LAYOUT.lineHeight),letterSpacing:clamp(input.letterSpacing,...LAYOUT_RANGES.letterSpacing,DEFAULT_LAYOUT.letterSpacing),paragraphBefore:clamp(input.paragraphBefore,...LAYOUT_RANGES.paragraphBefore,DEFAULT_LAYOUT.paragraphBefore),paragraphAfter:clamp(input.paragraphAfter,...LAYOUT_RANGES.paragraphAfter,DEFAULT_LAYOUT.paragraphAfter),firstLineIndent:clamp(input.firstLineIndent,...LAYOUT_RANGES.firstLineIndent,0),sidePadding:clamp(input.sidePadding,...LAYOUT_RANGES.sidePadding,DEFAULT_LAYOUT.sidePadding),textColor:color(input.textColor,'#333333'),textAlign:input.textAlign==='justify'?'justify':'left',includeTitle:input.includeTitle===true};
}
/** Retired follow-body mode maps to justify with inherited body insets. */
function canonicalImageLayer(input:Partial<ImageStyle>):Partial<ImageStyle>{
 return (input.alignment as string)==='text'?{...input,alignment:'justify',leftInset:null,rightInset:null,marginLeft:0,marginRight:0}:input;
}
export function normalizeImage(input:Partial<ImageStyle>={}):ImageStyle{
 input=canonicalImageLayer(input);
 return {...(['preserve','solid'].includes(input.backgroundMode??'')?{backgroundMode:input.backgroundMode}:{}),...Object.fromEntries((['shadowOpacity','shadowBlur','shadowOffsetY'] as const).filter(key=>typeof input[key]==='number').map(key=>[key,clamp(input[key],0,key==='shadowOpacity'?50:key==='shadowBlur'?80:24,key==='shadowOpacity'?18:0)])),...(input.leftInset===null?{leftInset:null}:typeof input.leftInset==='number'&&Number.isFinite(input.leftInset)?{leftInset:clamp(input.leftInset,0,192,0)}:{}),...(input.rightInset===null?{rightInset:null}:typeof input.rightInset==='number'&&Number.isFinite(input.rightInset)?{rightInset:clamp(input.rightInset,0,192,0)}:{}),widthPercent:input.widthPercent==null?undefined:clamp(input.widthPercent,5,100,100),alignment:['left','center','right','justify'].includes(input.alignment??'')?input.alignment!:'left',marginBefore:clamp(input.marginBefore,0,64,DEFAULT_IMAGE.marginBefore),marginAfter:clamp(input.marginAfter,0,64,DEFAULT_IMAGE.marginAfter),marginLeft:clamp(input.marginLeft,0,96,0),marginRight:clamp(input.marginRight,0,96,0),radius:clamp(input.radius,0,64,0),borderWidth:clamp(input.borderWidth,0,12,0),borderColor:color(input.borderColor,'#dddddd'),shadow:clamp(input.shadow,0,30,0),background:color(input.background,'#ffffff'),bakeEffects:input.bakeEffects===true};
}
export function textCSS(s:LayoutSettings,horizontalInset=0):string{
 const fonts=FONT_FAMILIES[s.fontFamily]??FONT_FAMILIES.sans;
 return `font-family:${fonts};font-size:${s.fontSize}px;line-height:${s.lineHeight};letter-spacing:${s.letterSpacing}px;color:${s.textColor};text-align:${s.textAlign};margin-top:${s.paragraphBefore}px;margin-bottom:${s.paragraphAfter}px;margin-left:${horizontalInset}px;margin-right:${horizontalInset}px;text-indent:${s.firstLineIndent}em;word-break:break-word;`;
}

/** Legacy offsets remain additive; explicit targets use the container edge as zero. */
export type HorizontalInsets={left:number;right:number};
export function imageInsets(style:ImageStyle,containerInset:number|HorizontalInsets){
 const base=typeof containerInset==='number'?{left:containerInset,right:containerInset}:containerInset;
 return {left:style.leftInset??base.left+style.marginLeft,right:style.rightInset??base.right+style.marginRight};
}
/** A legacy per-image side override must also override a newer global target. */
export function mergeImageStyleOverrides(...layers:Array<Partial<ImageStyle>|undefined>):Partial<ImageStyle>{
 let merged:Partial<ImageStyle>={};
 for(const rawLayer of layers){if(!rawLayer)continue;const layer=canonicalImageLayer(rawLayer);
  if(Object.hasOwn(layer,'marginLeft')&&!Object.hasOwn(layer,'leftInset'))delete merged.leftInset;
  if(Object.hasOwn(layer,'marginRight')&&!Object.hasOwn(layer,'rightInset'))delete merged.rightInset;
  // A local strength from older settings owns its legacy shadow description.
  if(Object.hasOwn(layer,'shadow'))for(const key of ['shadowOpacity','shadowBlur','shadowOffsetY'] as const)delete merged[key];
  merged={...merged,...layer};
 }
 return merged;
}
export function mergeImageStyles(...layers:Array<Partial<ImageStyle>|undefined>):ImageStyle{
 const merged=mergeImageStyleOverrides(...layers);return {...normalizeImage(merged),...(merged.widthPercent===null?{widthPercent:null}:{})};
}
export function imageContainerInset(block:ArticleBlock|undefined,layout:LayoutSettings,local?:Partial<LayoutSettings>):HorizontalInsets{
 const token=block?.tokens[0],side=!!token&&['paragraph_open','heading_open'].includes(token.type)&&token.level===0&&!token.hidden?normalizeLayout({...layout,...local}).sidePadding:0;
 const decoration=token?.type==='heading_open'?headingDecoration(articleTheme(layout.themeId),token.tag,normalizeLayout({...layout,...local}),headingHasText(block)).leftInset:0;
 return {left:side+decoration,right:side};
}

import type {ImageStyle} from './types';
import {normalizeImage} from './styles';
export interface ShadowDescription {opacity:number;blur:number;offsetY:number}
/** Opacity is a percentage; a missing value uses the same light edge preset. */
export function describeShadow(style:ImageStyle):ShadowDescription{
 if(!style.shadow)return{opacity:0,blur:0,offsetY:0};
 const base=softShadow(style.shadow);return {opacity:style.shadowOpacity??base.shadowOpacity!,blur:style.shadowBlur??base.shadowBlur!,offsetY:style.shadowOffsetY??base.shadowOffsetY!};
}
export function softShadow(strength:number):Partial<ImageStyle>{
 const value=Math.max(0,Math.min(30,strength));
 return value?{shadowOpacity:Math.round(Math.max(8,Math.min(16,10+(value-6)/3))*10)/10,shadowBlur:value+2,shadowOffsetY:value/6}:{shadowOpacity:0,shadowBlur:0,shadowOffsetY:0};
}
export interface ImageAppearance {id:'original'|'rounded'|'shadow'|'floating';label:string;style:Partial<ImageStyle>}
const clear:Partial<ImageStyle>={radius:0,borderWidth:0,borderColor:'#dddddd',background:'#ffffff',backgroundMode:'preserve',shadow:0,shadowOpacity:0,shadowBlur:0,shadowOffsetY:0,bakeEffects:false};
export const IMAGE_APPEARANCES:readonly ImageAppearance[]=[
 {id:'original',label:'原图',style:{...clear}},
 {id:'rounded',label:'圆角',style:{...clear,radius:8,bakeEffects:true}},
 {id:'shadow',label:'阴影',style:{...clear,radius:4,shadow:6,...softShadow(6),bakeEffects:true}},
 {id:'floating',label:'卡片',style:{...clear,radius:8,shadow:12,...softShadow(12),backgroundMode:'solid',bakeEffects:true}},
];
export function matchesAppearance(style:ImageStyle,preset:ImageAppearance):boolean{
 const current=normalizeImage(style),target=normalizeImage(preset.style);
 return Object.keys(preset.style).every(key=>key==='bakeEffects'||current[key as keyof ImageStyle]===target[key as keyof ImageStyle]);
}

/** Shadows stay in HTML; only these pixel decorations need a static copy. */
export function needsImageBake(style:ImageStyle):boolean{return style.bakeEffects&&(style.radius>0||style.borderWidth>0||style.backgroundMode==='solid');}

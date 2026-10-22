import type {ArticleThemeId,ImageStyle,LayoutSettings,ArticleBlock} from './types';
import {DEFAULT_LAYOUT} from './defaults';

/** Curated article styles. The plugin chrome always follows the Obsidian theme. */
export interface ArticleTheme {
 id:ArticleThemeId;name:string;description:string;
 accent:string;soft:string;muted:string;border:string;heading:'plain'|'line'|'bar';
 layout:LayoutSettings;image:Partial<ImageStyle>;
}
const make=(id:ArticleThemeId,name:string,description:string,palette:Pick<ArticleTheme,'accent'|'soft'|'muted'|'border'|'heading'>,layout:Partial<LayoutSettings>,image:Partial<ImageStyle>={}):ArticleTheme=>({id,name,description,...palette,layout:{...DEFAULT_LAYOUT,themeId:id,...layout},image});
export const ARTICLE_THEMES:readonly ArticleTheme[]=[
 make('daily','日常简洁','白底深灰，清爽耐读',{accent:'#333333',soft:'#f7f8fa',muted:'#575d65',border:'#dddddd',heading:'plain'},{fontFamily:'system',fontSize:16,lineHeight:1.8,paragraphAfter:28,sidePadding:16},{alignment:'justify',radius:0,shadow:0}),
 make('minimal','极简留白','系统字体，细线与克制蓝色',{accent:'#245f9e',soft:'#f5f6f8',muted:'#515154',border:'#d9dde3',heading:'line'},{fontFamily:'system',textColor:'#29292c',fontSize:16,lineHeight:1.85,paragraphAfter:28,sidePadding:16},{alignment:'justify',radius:6,shadow:0,bakeEffects:true}),
 make('technology','科技蓝','墨蓝标题，浅蓝引用',{accent:'#234a77',soft:'#f1f6fc',muted:'#4c6075',border:'#d5e0ec',heading:'bar'},{fontFamily:'sans',fontSize:16,lineHeight:1.8,paragraphAfter:28,sidePadding:16},{alignment:'justify',radius:8,shadow:0,bakeEffects:true}),
 make('serif-reading','宋韵阅读','宋体正文，舒展的长文节奏',{accent:'#555045',soft:'#f7f6f2',muted:'#656159',border:'#dedbd3',heading:'line'},{fontFamily:'serif',fontSize:17,lineHeight:1.95,letterSpacing:.5,paragraphAfter:28,sidePadding:16},{alignment:'justify',radius:0,shadow:0}),
 make('warm','温暖手记','暖灰文字，陶土色强调',{accent:'#95503c',soft:'#faf4ef',muted:'#6b5a51',border:'#e6d8ce',heading:'plain'},{fontFamily:'sans',textColor:'#413b37',fontSize:16,lineHeight:1.9,paragraphAfter:28,sidePadding:16},{alignment:'justify',radius:8,shadow:0,bakeEffects:true}),
];
export const articleTheme=(id:unknown)=>ARTICLE_THEMES.find(theme=>theme.id===id);
export function themeIsAdjusted(layout:LayoutSettings):boolean{
 const theme=articleTheme(layout.themeId);if(!theme)return true;
 return Object.keys(theme.layout).some(key=>key!=='includeTitle'&&layout[key as keyof LayoutSettings]!==theme.layout[key as keyof LayoutSettings]);
}

export function headingHasText(block:ArticleBlock|undefined):boolean{return block?.tokens.find(token=>token.type==='inline')?.children?.some(token=>token.type!=='image'&&!!token.content.trim())??false;}

/** Shared by text rendering and image alignment inside an image-only heading. */
export function headingDecoration(theme:ArticleTheme|undefined,tag:string,layout?:LayoutSettings,hasText=true):{css:string;leftInset:number}{
 if(tag==='h3'&&layout?.h3AccentBar&&hasText)return {css:'padding-left:12px;',leftInset:12};
 if(!theme||tag!=='h2')return {css:'',leftInset:0};
 if(theme.heading==='bar')return {css:`border-left:3px solid ${theme.accent};padding-left:12px;`,leftInset:15};
 if(theme.heading==='line')return {css:`border-bottom:1px solid ${theme.border};padding-bottom:10px;`,leftInset:0};
 return {css:'',leftInset:0};
}

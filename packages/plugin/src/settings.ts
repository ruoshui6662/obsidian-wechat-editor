import type {BlockOverrides,LayoutSettings,ImageStyle} from '../../core/src/types';
import {DEFAULT_LAYOUT,normalizeLayout,normalizeImage} from '../../core/src/styles';
import {articleTheme} from '../../core/src/themes';
export interface Template {id:string;name:string;layout:LayoutSettings;imageDefault?:Partial<ImageStyle>;headerMarkdown:string;footerMarkdown:string}
export interface ArticleContent {headerMarkdown:string;footerMarkdown:string}
export interface NoteSettings {layout?:Partial<LayoutSettings>;overrides:BlockOverrides;templateId?:string;content?:ArticleContent}
export interface PluginSettings {schemaVersion:1;spacingDefaultsVersion:1;layout:LayoutSettings;notes:Record<string,NoteSettings>;templates:Template[];bridgeToken?:string;bridgeOrigin?:string;bridgeId?:string;bridgeClientId?:string}
const record=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function cleanOverrides(input:unknown):BlockOverrides{
 const out:BlockOverrides=Object.create(null);if(!record(input))return out;
 for(const [key,value]of Object.entries(input)){
  if(!record(value)||['__proto__','constructor','prototype'].includes(key))continue;
  const text=record(value.text)?Object.fromEntries(Object.entries(normalizeLayout(value.text)).filter(([k])=>Object.hasOwn(value.text,k))):undefined;
  const image=record(value.image)?Object.fromEntries(Object.entries(normalizeImage(value.image)).filter(([k])=>Object.hasOwn(value.image,k)||(value.image.alignment==='text'&&['leftInset','rightInset','marginLeft','marginRight'].includes(k)))):undefined;
  if(image&&value.image.widthPercent===null)image.widthPercent=null;
  out[key]={...(text?{text}:{}),...(image?{image}:{})};
 }return out;
}
export function loadSettings(raw:unknown):PluginSettings{
 const data=record(raw)?raw:{};const notes:Record<string,NoteSettings>=Object.create(null);
 if(record(data.notes))for(const [path,note]of Object.entries(data.notes))if(record(note))notes[path]={layout:record(note.layout)?Object.fromEntries(Object.entries(normalizeLayout(note.layout)).filter(([k])=>Object.hasOwn(note.layout,k))):undefined,overrides:cleanOverrides(note.overrides),templateId:typeof note.templateId==='string'?note.templateId:undefined,...(record(note.content)?{content:{headerMarkdown:typeof note.content.headerMarkdown==='string'?note.content.headerMarkdown:'',footerMarkdown:typeof note.content.footerMarkdown==='string'?note.content.footerMarkdown:''}}:{})};
 const templates:Template[]=Array.isArray(data.templates)?data.templates.filter((t:any)=>record(t)&&typeof t.id==='string'&&typeof t.name==='string').map((t:any)=>({id:t.id,name:t.name.slice(0,80),layout:normalizeLayout(t.layout),...(record(t.imageDefault)?{imageDefault:cleanOverrides({'*':{image:t.imageDefault}})['*']?.image}:{}),headerMarkdown:typeof t.headerMarkdown==='string'?t.headerMarkdown:'',footerMarkdown:typeof t.footerMarkdown==='string'?t.footerMarkdown:''})):[];
 // Snapshot legacy shared content once; future edits belong to each article.
 for(const note of Object.values(notes)){const template=templates.find(t=>t.id===note.templateId);if(!note.content&&template)note.content={headerMarkdown:template.headerMarkdown,footerMarkdown:template.footerMarkdown};}
 const settings:PluginSettings={spacingDefaultsVersion:1,bridgeId:typeof data.bridgeId==='string'&&/^[a-zA-Z0-9-]{1,128}$/.test(data.bridgeId)?data.bridgeId:undefined,bridgeClientId:typeof data.bridgeClientId==='string'&&/^[a-zA-Z0-9-]{1,128}$/.test(data.bridgeClientId)?data.bridgeClientId:undefined,schemaVersion:1,layout:normalizeLayout(data.layout??(Object.keys(data).length?DEFAULT_LAYOUT:articleTheme('daily')!.layout)),notes,templates,bridgeToken:typeof data.bridgeToken==='string'&&/^[a-f0-9]{64}$/.test(data.bridgeToken)?data.bridgeToken:undefined,bridgeOrigin:typeof data.bridgeOrigin==='string'&&/^chrome-extension:\/\/[a-p]{32}$/.test(data.bridgeOrigin)?data.bridgeOrigin:undefined};
 if(data.spacingDefaultsVersion!==1){
  // Upgrade the previous 24px defaults once, leaving deliberate custom values alone.
  const text=(style:Partial<LayoutSettings>|undefined)=>{if(style?.paragraphAfter===24)style.paragraphAfter=28;};
  const image=(style:Partial<ImageStyle>|undefined)=>{if(style?.marginBefore===24)style.marginBefore=28;if(style?.marginAfter===24)style.marginAfter=28;};
  text(settings.layout);
  for(const note of Object.values(settings.notes)){text(note.layout);for(const override of Object.values(note.overrides)){text(override.text);image(override.image);}}
  for(const template of settings.templates){text(template.layout);image(template.imageDefault);}
 }
 return settings;
}

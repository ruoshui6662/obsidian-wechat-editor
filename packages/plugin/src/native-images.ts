import {EditorView} from '@codemirror/view';
import {editorInfoField,type TFile} from 'obsidian';
import {parseArticle} from '../../core/src/parse';
export interface NativeImageSelection {file:TFile;source:string;occurrenceId:string}
/** Capture before editor widgets consume click; use source positions, never DOM order. */
export function watchNativeImages(doc:Document,select:(selection:NativeImageSelection)=>Promise<void>,error:(error:unknown)=>void):()=>void{
 const click=(event:MouseEvent)=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const image=event.composedPath().find((node):node is HTMLImageElement=>(node as Node).nodeType===1&&(node as Element).tagName==='IMG');
  if(!image||image.classList.contains('cm-widgetBuffer')||image.closest('.wx-layout'))return;
  const editorDOM=image.closest<HTMLElement>('.cm-editor');const view=editorDOM&&EditorView.findFromDOM(editorDOM);if(!view)return;
  const info=view.state.field(editorInfoField,false);if(!info?.file||!info.file.path.endsWith('.md'))return;
  let offset:number;try{offset=view.posAtDOM(image);}catch{return;}
  const source=view.state.doc.toString(),line=view.state.doc.lineAt(offset).number-1;
  const article=parseArticle(source,info.file.path);
  const candidates=article.images.filter(ref=>ref.range.startLine<=line&&line<ref.range.endLine);
  if(candidates.length!==1){if(candidates.length>1)error(Error('这一段包含多张图片，请先将每张图片放在单独一段，再调整图片样式。'));return;}
  event.preventDefault();event.stopPropagation();
  const selection={file:info.file,source,occurrenceId:candidates[0].occurrenceId};
  void Promise.resolve().then(()=>select(selection)).catch(error);
 };
 doc.addEventListener('click',click,true);return()=>doc.removeEventListener('click',click,true);
}

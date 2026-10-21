// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {EditorState} from '@codemirror/state';
import {EditorView,Decoration,WidgetType} from '@codemirror/view';
import {editorInfoField,TFile} from 'obsidian';
import WechatLayoutPlugin from '../src/main';
import {nativeWorkspace} from '../../../tests/helpers/native-workspace';
const cleanups:Array<()=>void>=[];
afterEach(()=>{for(const clean of cleanups.splice(0))clean();document.body.replaceChildren();vi.restoreAllMocks();});
class ImageWidget extends WidgetType {
 toDOM(){const embed=document.createElement('span');embed.className='internal-embed image-embed';embed.setAttribute('src','同图.png');const img=document.createElement('img');img.src='app://local/同图.png';embed.append(img);return embed;}
}
async function setup(onlySecond=false,popout=false){
 const source='![[同图.png]]\n\n![[同图.png]]';const file=Object.assign(new TFile(),{path:'稿.md',extension:'md'});
 let editorDoc=document;if(popout){const iframe=document.createElement('iframe');document.body.append(iframe);editorDoc=iframe.contentDocument!;}
 const parent=editorDoc.createElement('div');editorDoc.body.append(parent);const firstEnd=source.indexOf('\n'),secondStart=firstEnd+2;
 const decoration=Decoration.replace({widget:new ImageWidget()});const ranges=onlySecond?[decoration.range(secondStart,source.length)]:[decoration.range(0,firstEnd),decoration.range(secondStart,source.length)];
 let cm!:EditorView;const editor={getValue:()=>cm.state.doc.toString()};
 cm=new EditorView({parent,state:EditorState.create({doc:source,extensions:[editorInfoField.init(()=>({file,editor}) as any),EditorView.decorations.of(Decoration.set(ranges))]})});cleanups.push(()=>cm.destroy());
 const ws=nativeWorkspace(popout?document.createElement('div'):parent,file);ws.editor.view.containerEl=parent;
 const app={workspace:ws.workspace,vault:{on:()=>({})}};
 const plugin=new WechatLayoutPlugin(app as any,{version:'test'} as any);ws.register(plugin);plugin.getEditor=()=>editor as any;
 plugin.vaultPort=async()=>({listFiles:()=>[],readBinary:async()=>{throw Error('Preview fixture intentionally has no bytes')}});vi.spyOn(plugin as any,'startBridge').mockResolvedValue(undefined);
 await plugin.onload();cleanups.push(()=>plugin.unload());
 const click=(index=0,extra:MouseEventInit={})=>{const event=new MouseEvent('click',{bubbles:true,cancelable:true,composed:true,...extra});parent.querySelectorAll('.image-embed img')[index].dispatchEvent(event);return event;};
 return{plugin,parent,cm,click,right:()=>ws.workspace.getLeavesOfType('wechat-layout-workspace')[0]?.view};
}
it('nativeEditorImageClickOpensTheInspectorForThatOccurrence',async()=>{
 const s=await setup();s.click(1);await vi.waitFor(()=>expect(s.right()?.panel).toBeDefined());
 const root=s.right()!.contentEl;await vi.waitFor(()=>expect(root.querySelector('[data-setting=shadow]')).not.toBeNull());expect((root.querySelector('.wx-selected') as HTMLDetailsElement).open).toBe(true);
 expect((root.querySelector('[data-image-scope]') as HTMLElement).dataset.selectedImage).toBe('img-1');
});
it('nativeSelectionUsesSourcePositionWhenOnlyTheSecondImageIsRendered',async()=>{
 const s=await setup(true);s.click();await vi.waitFor(()=>expect(s.right()?.panel).toBeDefined());
 await vi.waitFor(()=>expect((s.right()!.contentEl.querySelector('[data-image-scope]') as HTMLElement).dataset.selectedImage).toBe('img-1'));
});
it('nativeImageClickWorksInAPopoutThatExistedBeforePluginLoad',async()=>{
 const s=await setup(false,true);s.click(1);await vi.waitFor(()=>expect(s.right()?.panel).toBeDefined());
 await vi.waitFor(()=>expect(s.right()!.contentEl.querySelector('[data-setting=shadow]')).not.toBeNull());
});
it('modifierClickRetainsNativeOpenBehaviour',async()=>{
 const s=await setup();const event=s.click(0,{metaKey:true});await Promise.resolve();expect(s.right()).toBeUndefined();expect(event.defaultPrevented).toBe(false);
});
it('unrelatedImagesOutsideTheNativeEditorAreIgnored',async()=>{
 const s=await setup();const img=document.createElement('img');document.body.append(img);const event=new MouseEvent('click',{bubbles:true,cancelable:true});img.dispatchEvent(event);await Promise.resolve();expect(s.right()).toBeUndefined();expect(event.defaultPrevented).toBe(false);
});
it('unloadingStopsNativeImageClickHandling',async()=>{
 const s=await setup();s.plugin.unload();s.click();await Promise.resolve();expect(s.right()).toBeUndefined();
});

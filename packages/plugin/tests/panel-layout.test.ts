// @vitest-environment jsdom
import {afterEach,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {ArticlePreview} from '../src/article-preview';
import {LayoutPanel,type PanelState} from '../src/view';
import {parseArticle} from '../../core/src/parse';
import {DEFAULT_LAYOUT} from '../../core/src/styles';
const cleanups:Array<()=>void>=[];
afterEach(()=>{cleanups.splice(0).forEach(clean=>clean());document.body.replaceChildren();document.head.querySelectorAll('[data-test-css]').forEach(el=>el.remove());});
function setup(){
 const controlsRoot=document.createElement('div'),root=document.createElement('div');document.body.append(controlsRoot,root);const controls=new LayoutPanel(controlsRoot,{copy:async()=>{},cancel:()=>{},getPairingInfo:async()=>'{}',copyPairing:async()=>{},changeLayout:()=>{},refresh:()=>{}}),preview=new ArticlePreview(root,()=>{});cleanups.push(()=>{controls.destroy();preview.destroy();});
 const state:PanelState={article:parseArticle('第一段\n\n![[图.png]] ^pic\n\n最后一段','稿.md'),layout:DEFAULT_LAYOUT,overrides:{},sources:new Map([['img-0','blob:fixture']]),account:{id:'a',name:'测试号'},pairingReady:true};controls.setState(state);preview.setState(state);return{root,controlsRoot,controls,preview,state};
}
it('bothControllersUseFullHeightIndependentScrollAreas',()=>{
 const {root,controlsRoot,controls}=setup();controls.selectImage('img-0');const style=document.createElement('style');style.dataset.testCss='';style.textContent=readFileSync('packages/plugin/styles.css','utf8');document.head.append(style);
 expect(getComputedStyle(controlsRoot.querySelector('.wx-operations')!).flexGrow).toBe('1');expect(getComputedStyle(root.querySelector('.wx-preview-pane')!).flexGrow).toBe('1');expect(getComputedStyle(controlsRoot.querySelector('[data-operations-scroll]')!).overflowY).toBe('auto');expect(getComputedStyle(root.querySelector('.wx-preview-scroll')!).overflowY).toBe('auto');expect(getComputedStyle(controlsRoot.querySelector('[data-selected-controls]')!).overflow).toBe('visible');
});
it('previewRefreshAndImageLoadPreserveReadingPosition',()=>{
 const {root,preview,state}=setup();const scroll=root.querySelector<HTMLElement>('.wx-preview-scroll')!;scroll.scrollTop=240;preview.setState({...state,layout:{...DEFAULT_LAYOUT,fontSize:20}});scroll.scrollTop=0;root.querySelector('.wx-paper')!.shadowRoot!.querySelector('img')!.dispatchEvent(new Event('load'));expect(scroll.scrollTop).toBe(240);
});
it('lateImageLoadsDoNotOverrideTheUsersNewScrollPosition',()=>{
 const {root,preview,state}=setup();const scroll=root.querySelector<HTMLElement>('.wx-preview-scroll')!;scroll.scrollTop=240;preview.setState(state);scroll.dispatchEvent(new WheelEvent('wheel'));scroll.scrollTop=400;root.querySelector('.wx-paper')!.shadowRoot!.querySelector('img')!.dispatchEvent(new Event('load'));expect(scroll.scrollTop).toBe(400);
});
it('switchingNotesStartsTheNewArticleAtTheTopAndIgnoresOldLoads',()=>{
 const {root,preview,state}=setup();const scroll=root.querySelector<HTMLElement>('.wx-preview-scroll')!,oldImage=root.querySelector('.wx-paper')!.shadowRoot!.querySelector('img')!;scroll.scrollTop=240;preview.setState({...state,article:parseArticle('另一篇\n\n![[图.png]]','另一篇.md')});expect(scroll.scrollTop).toBe(0);oldImage.dispatchEvent(new Event('load'));expect(scroll.scrollTop).toBe(0);
});

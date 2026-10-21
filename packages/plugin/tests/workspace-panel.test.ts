// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {LayoutPanel,type PanelHost,type PanelState} from '../src/view';
import {parseArticle} from '../../core/src/parse';
import {DEFAULT_LAYOUT} from '../../core/src/styles';
const panels:LayoutPanel[]=[];
afterEach(()=>{panels.splice(0).forEach(p=>p.destroy());document.body.replaceChildren();});
function setup(host:Partial<PanelHost>={}){
 const root=document.createElement('div');document.body.append(root);const p=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},getPairingInfo:async()=>'{}',copyPairing:async()=>{},changeLayout:()=>{},refresh:()=>{},...host});panels.push(p);
 const state:PanelState={article:parseArticle('正文\n\n![[图.png]] ^a\n\n![[图.png]] ^b','稿.md'),layout:DEFAULT_LAYOUT,overrides:{},sources:new Map([['img-0','blob:test'],['img-1','blob:test']]),account:{id:'a',name:'测试号'},pairingReady:true};p.setState(state);
 return{root,p,state,tab:(id:string)=>root.querySelector<HTMLButtonElement>(`[data-page-tab=${id}]`)!,page:(id:string)=>root.querySelector<HTMLElement>(`[data-page=${id}]`)!};
}
it('navigationShowsOnlyOneFullPageAndKeepsCommonCopyOutsideBothPages',()=>{
 const s=setup();expect(s.tab('editor').getAttribute('aria-selected')).toBe('true');expect(s.page('editor').hidden).toBe(false);expect(s.page('preview').hidden).toBe(true);expect(s.page('preview').hasAttribute('inert')).toBe(true);
 s.tab('preview').click();expect(s.page('editor').hidden).toBe(true);expect(s.page('editor').hasAttribute('inert')).toBe(true);expect(s.page('preview').hidden).toBe(false);expect(s.page('editor').querySelector('.wx-paper')).toBeNull();expect(s.page('preview').querySelector('input,select,[data-controls]')).toBeNull();expect(s.root.querySelector('[data-action=copy]')!.closest('[data-page]')).toBeNull();
});
it('clickingPreviewContentNeverSelectsAnImageOrChangesPage',()=>{
 const selected=vi.fn(),s=setup({selectionChanged:selected});s.tab('preview').click();const before=selected.mock.calls.length;(s.page('preview').querySelector('.wx-paper')!.shadowRoot!.querySelector('img') as HTMLElement).click();expect(s.p.currentPage).toBe('preview');expect(selected).toHaveBeenCalledTimes(before);expect(s.root.querySelector('[data-image-scope]')!.textContent).toBe('文章默认');
});
it('switchingPagesKeepsImageControlsAndTheirPendingSaveAlive',async()=>{
 let finish!:()=>void;const save=new Promise<void>(resolve=>{finish=resolve}),s=setup({changeBlock:async()=>{await save;}});s.p.selectImage('img-0');const input=s.root.querySelector<HTMLInputElement>('[data-setting=radius]')!;input.value='8';input.dispatchEvent(new Event('input'));s.tab('preview').click();expect(s.root.querySelector<HTMLButtonElement>('[data-action=copy]')!.disabled).toBe(true);s.tab('editor').click();expect(s.root.querySelector('[data-setting=radius]')).toBe(input);expect(input.value).toBe('8');finish();await vi.waitFor(()=>expect(s.root.querySelector<HTMLButtonElement>('[data-action=copy]')!.disabled).toBe(false));
});
it('nativeImageSelectionDuringPreviewStaysInPreviewAndIsReadyInEditor',()=>{
 const s=setup();s.tab('preview').click();expect(s.p.selectImage('img-1')).toBe(true);expect(s.p.currentPage).toBe('preview');s.tab('editor').click();expect(s.root.querySelector('[data-setting=shadow]')).not.toBeNull();expect(s.root.querySelector<HTMLElement>('[data-image-scope]')!.dataset.selectedImage).toBe('img-1');
});
it('nativeSelectionDistinguishesRepeatedImagesWithoutExposingOccurrenceNumbers',()=>{
 const s=setup();expect(s.root.querySelector('[data-image-picker]')).toBeNull();s.p.selectImage('img-1');expect(s.root.querySelector<HTMLElement>('[data-image-scope]')!.dataset.selectedImage).toBe('img-1');expect(s.p.currentPage).toBe('editor');expect(s.root.querySelector('.wx-selected')!.textContent).not.toContain('第2处');
});
it('switchingCommitsAnUnfinishedNumericInputAndKeepsTheSameControl',()=>{
 const changed=vi.fn(),s=setup({changeLayout:changed}),choice=s.root.querySelector<HTMLSelectElement>('[data-number-select=fontSize]')!;choice.value='manual';choice.dispatchEvent(new Event('change'));const input=s.root.querySelector<HTMLInputElement>('[data-setting=fontSize]')!;input.focus();input.value='21';s.tab('preview').click();expect(changed).toHaveBeenCalledWith({fontSize:21});s.tab('editor').click();expect(s.root.querySelector('[data-setting=fontSize]')).toBe(input);
});
it('hiddenPreviewRefreshRestoresReadingPositionAndNoteSwitchResetsIt',()=>{
 const s=setup();s.tab('preview').click();const scroll=s.root.querySelector<HTMLElement>('.wx-preview-scroll')!;scroll.scrollTop=270;s.tab('editor').click();scroll.scrollTop=0;s.p.setState({...s.state,layout:{...DEFAULT_LAYOUT,fontSize:20}});s.tab('preview').click();expect(scroll.scrollTop).toBe(270);s.tab('editor').click();s.p.setState({...s.state,article:parseArticle('另一篇','其他.md')});s.tab('preview').click();expect(scroll.scrollTop).toBe(0);
});
it('navigationSupportsArrowKeysAndDoesNotRebuildAnAlreadySelectedPage',()=>{
 const s=setup();s.tab('editor').focus();s.tab('editor').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));expect(s.p.currentPage).toBe('preview');expect(document.activeElement).toBe(s.tab('preview'));const paper=s.root.querySelector('.wx-paper');s.tab('preview').click();expect(s.root.querySelector('.wx-paper')).toBe(paper);s.tab('preview').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));expect(s.p.currentPage).toBe('editor');
});
it('saveStateDisablesCopyOnBothPagesAndExposesRetryAfterFailure',()=>{
 const retry=vi.fn(),s=setup({retrySave:retry});s.p.setState({...s.state,saving:true});expect(s.root.querySelector<HTMLButtonElement>('[data-action=copy]')!.disabled).toBe(true);s.tab('preview').click();s.p.setState({...s.state,saving:false,saveError:'磁盘不可用'});expect(s.root.querySelector<HTMLButtonElement>('[data-action=copy]')!.disabled).toBe(true);expect(s.root.querySelector('[role=status]')!.textContent).toContain('磁盘不可用');s.root.querySelector<HTMLButtonElement>('[data-action=retry-save]')!.click();expect(retry).toHaveBeenCalledOnce();
});
it('destroyedWorkspaceIgnoresLateStateFromPendingPersistence',()=>{
 const s=setup();s.p.destroy();expect(()=>s.p.setState({...s.state,saving:false})).not.toThrow();expect(s.root.children).toHaveLength(0);
});
it('failedImageSaveRemainsVisibleAndRetryableFromPreview',async()=>{
 let fail=true;const s=setup({changeBlock:async()=>{if(fail)throw Error('图片写入失败');}});s.p.selectImage('img-0');const radius=s.root.querySelector<HTMLInputElement>('[data-setting=radius]')!;radius.value='8';radius.dispatchEvent(new Event('input'));s.tab('preview').click();await vi.waitFor(()=>expect(s.root.querySelector('[role=status]')!.textContent).toContain('保存失败'));expect(s.root.querySelector<HTMLButtonElement>('[data-action=copy]')!.disabled).toBe(true);fail=false;s.root.querySelector<HTMLButtonElement>('[data-action=retry-save]')!.click();await vi.waitFor(()=>expect(s.root.querySelector<HTMLButtonElement>('[data-action=copy]')!.disabled).toBe(false));expect(s.p.currentPage).toBe('preview');
});
it('imagePickerFollowsSelectedBlockWhenANewImageChangesOccurrenceNumbers',()=>{
 const changes:Array<string>=[],s=setup({changeBlock:async key=>{changes.push(key);}});const initial=parseArticle('![[A.png]] ^a\n\n![[B.png]] ^b','稿.md');s.p.setState({...s.state,article:initial});s.p.selectImage('img-1');const radius=s.root.querySelector<HTMLInputElement>('[data-setting=radius]')!;s.p.setState({...s.state,article:parseArticle('![[new.png]] ^new\n\n![[A.png]] ^a\n\n![[B.png]] ^b','稿.md')});expect(s.root.querySelector<HTMLElement>('[data-image-scope]')!.dataset.selectedImage).toBe('img-2');expect(s.root.querySelector('[data-image-name]')!.textContent).toBe('B.png');radius.value='8';radius.dispatchEvent(new Event('input'));expect(changes).toEqual(['block-4']);
});

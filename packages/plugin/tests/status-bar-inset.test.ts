// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {LayoutPanel} from '../src/view';
const panels:LayoutPanel[]=[];
afterEach(()=>{panels.splice(0).forEach(panel=>panel.destroy());document.body.replaceChildren();vi.unstubAllGlobals();});
const rect=(left:number,top:number,width:number,height:number)=>new DOMRect(left,top,width,height);
function bar(bounds:()=>DOMRect,doc=document){const el=doc.createElement('div');el.className='status-bar';el.getBoundingClientRect=()=>el.style.display==='none'?rect(0,0,0,0):bounds();doc.body.append(el);return el;}
function setup(bounds=()=>rect(300,60,500,640),doc=document,configure?:(root:HTMLElement)=>void){const root=doc.createElement('div');root.className='view-content';root.getBoundingClientRect=bounds;doc.body.append(root);configure?.(root);const panel=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},refresh:()=>{},getPairingInfo:async()=>'{}',copyPairing:async()=>{},changeLayout:()=>{}});panels.push(panel);return{root,panel,inset:()=>root.style.getPropertyValue('--wx-bottom-inset')};}
it('reservesTheActualStatusBarOverlapForBothFunctionalPages',()=>{
 bar(()=>rect(500,676,300,24));const s=setup();expect(s.inset()).toBe('24px');s.panel.showPage('preview');expect(s.inset()).toBe('24px');expect(s.root.querySelector('[data-page=preview]')!.classList.contains('wx-workspace-view')).toBe(false);s.panel.showPage('editor');expect(s.inset()).toBe('24px');
});
for(const [label,bounds]of [
 ['a bar beside another horizontal pane',rect(0,676,200,24)],
 ['a bar already below the pane',rect(500,700,300,24)],
 ['a bar above the footer area',rect(500,100,300,24)],
]as const)it(`doesNotWasteSpaceFor ${label}`,()=>{bar(()=>bounds);expect(setup().inset()).toBe('0px');});
it('tracksStatusBarInsertionHidingAndRemovalWithoutChangingTheHost',async()=>{
 const s=setup();expect(s.inset()).toBe('0px');const el=bar(()=>rect(500,676,300,24));await vi.waitFor(()=>expect(s.inset()).toBe('24px'));el.style.display='none';await vi.waitFor(()=>expect(s.inset()).toBe('0px'));el.style.display='';await vi.waitFor(()=>expect(s.inset()).toBe('24px'));el.remove();await vi.waitFor(()=>expect(s.inset()).toBe('0px'));expect(el.style.position).toBe('');
});
it('usesOnlyThePanelsOwnDocumentStatusBar',()=>{
 bar(()=>rect(500,660,300,40));const doc=document.implementation.createHTMLDocument('Popout');bar(()=>rect(500,680,300,20),doc);expect(setup(undefined,doc).inset()).toBe('20px');
});
it('respondsToStatusBarResizeAndReleasesObserversOnDestroy',async()=>{
 const instances:FakeResizeObserver[]=[];
 class FakeResizeObserver {observed=new Set<Element>();constructor(readonly callback:()=>void){instances.push(this);}observe(el:Element){this.observed.add(el);}unobserve(el:Element){this.observed.delete(el);}disconnect(){this.observed.clear();}}
 vi.stubGlobal('ResizeObserver',FakeResizeObserver);let bounds=rect(500,676,300,24);const el=bar(()=>bounds),s=setup();expect(instances.some(observer=>observer.observed.has(el))).toBe(true);bounds=rect(500,664,300,36);instances.forEach(observer=>observer.callback());await vi.waitFor(()=>expect(s.inset()).toBe('36px'));s.panel.destroy();expect(instances.every(observer=>observer.observed.size===0)).toBe(true);expect(s.inset()).toBe('');instances.forEach(observer=>observer.callback());await new Promise(resolve=>setTimeout(resolve,25));expect(s.inset()).toBe('');
});
it('rebindsAnExistingPanelWhenItsLeafMovesToAnotherWindow',async()=>{
 bar(()=>rect(500,676,300,24));const s=setup(),doc=document.implementation.createHTMLDocument('Popout');const other=bar(()=>rect(500,664,300,36),doc);expect(s.inset()).toBe('24px');doc.body.append(s.root);await vi.waitFor(()=>expect(s.inset()).toBe('36px'));other.style.display='none';await vi.waitFor(()=>expect(s.inset()).toBe('0px'));document.body.append(s.root);await vi.waitFor(()=>expect(s.inset()).toBe('24px'));
});
it('usesTheHostMigrationNotificationImmediatelyAndUnsubscribesOnClose',()=>{
 bar(()=>rect(500,676,300,24));const callbacks=new Set<()=>void>(),unsubscribe=vi.fn();const s=setup(undefined,document,root=>{root.onWindowMigrated=callback=>{const notify=()=>callback(window);callbacks.add(notify);return()=>{callbacks.delete(notify);unsubscribe();};};}),doc=document.implementation.createHTMLDocument('Popout');bar(()=>rect(500,664,300,36),doc);const subscriptions=callbacks.size;expect(subscriptions).toBeGreaterThan(0);doc.body.append(s.root);for(const notify of callbacks)notify();expect(s.inset()).toBe('36px');s.panel.destroy();expect(callbacks.size).toBe(0);expect(unsubscribe).toHaveBeenCalledTimes(subscriptions);
});

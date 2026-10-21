// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {LayoutPanel} from '../src/view';
const panels:LayoutPanel[]=[];
afterEach(()=>{panels.splice(0).forEach(p=>p.destroy());document.body.replaceChildren();});
const rect=(width:number)=>new DOMRect(0,0,width,700);
function setup(initial=300){
 let spaceWidth=1280;const space=document.createElement('div');space.className='workspace';space.getBoundingClientRect=()=>rect(spaceWidth);document.body.append(space);
 const other=document.createElement('div');other.className='workspace-split mod-sidedock mod-left-split';other.getBoundingClientRect=()=>rect(240);space.append(other);
 const dock=document.createElement('div');dock.className='workspace-split mod-sidedock mod-right-split';dock.style.width=`${initial}px`;dock.getBoundingClientRect=()=>rect(Number.parseFloat(dock.style.width));space.append(dock);
 const leaf=document.createElement('div');leaf.className='workspace-leaf';dock.append(leaf);const root=document.createElement('div');root.getBoundingClientRect=()=>leaf.style.display==='none'||dock.classList.contains('is-sidedock-collapsed')?rect(0):rect(Number.parseFloat(dock.style.width));leaf.append(root);
 const panel=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},refresh:()=>{},getPairingInfo:async()=>'{}',copyPairing:async()=>{},changeLayout:()=>{}});panels.push(panel);
 return{root,panel,space,dock,leaf,min:()=>dock.style.getPropertyValue('--wx-dock-min-width'),resize:(width:number)=>{spaceWidth=width;window.dispatchEvent(new Event('resize'));}};
}
it('givesTheVisibleSidebarA400pxFloorAnd460pxInitialWidth',()=>{const s=setup();expect(s.min()).toBe('400px');expect(s.dock.style.width).toBe('460px');expect(s.dock.classList.contains('wx-layout-dock')).toBe(true);expect(s.root.style.minWidth).toBe('');s.panel.showPage('preview');expect(s.min()).toBe('400px');});
it('preservesAnAlreadyGenerousWidth',()=>{const s=setup(600);expect(s.min()).toBe('400px');expect(s.dock.style.width).toBe('600px');});
it('keepsTheFloorDuringNativeDragWithoutReplacingTheUsersInlineWidth',async()=>{const s=setup();s.dock.style.width='220px';await new Promise(resolve=>setTimeout(resolve,30));expect(s.min()).toBe('400px');expect(s.dock.style.width).toBe('220px');s.panel.destroy();expect(s.dock.style.width).toBe('220px');expect(s.min()).toBe('');});
it('releasesConstraintsForOtherSidebarTabsAndAllowsCollapse',async()=>{const s=setup();s.leaf.style.display='none';await vi.waitFor(()=>expect(s.min()).toBe(''));expect(s.dock.style.width).toBe('300px');s.leaf.style.display='';await vi.waitFor(()=>expect(s.min()).toBe('400px'));s.dock.classList.add('is-sidedock-collapsed');await vi.waitFor(()=>expect(s.min()).toBe(''));expect(s.dock.classList.contains('is-sidedock-collapsed')).toBe(true);});
it('adaptsTheFloorWhenTheWindowCannotFitBothPanes',async()=>{const s=setup();s.resize(800);await vi.waitFor(()=>{expect(Number.parseFloat(s.min())).toBeLessThan(400);expect(Number.parseFloat(s.min())).toBeGreaterThanOrEqual(280);});s.resize(1280);await vi.waitFor(()=>expect(s.min()).toBe('400px'));});
it('releasesTheOldSidebarWhenTheLeafMovesToAMainPane',async()=>{const s=setup();s.space.append(s.leaf);await vi.waitFor(()=>expect(s.min()).toBe(''));expect(s.dock.style.width).toBe('300px');s.panel.destroy();expect(s.root.children).toHaveLength(0);});
it('restoresTheOriginalSidebarStylesOnClose',()=>{const s=setup();s.panel.destroy();expect(s.min()).toBe('');expect(s.dock.classList.contains('wx-layout-dock')).toBe(false);expect(s.dock.style.width).toBe('300px');});
it('stopsSchedulingMeasurementsOnceTheSidebarIsIdle',async()=>{
 const frames=vi.spyOn(window,'requestAnimationFrame');const s=setup();try{await new Promise(resolve=>setTimeout(resolve,80));const settled=frames.mock.calls.length;await new Promise(resolve=>setTimeout(resolve,80));expect(frames.mock.calls.length).toBe(settled);}finally{s.panel.destroy();frames.mockRestore();}
});

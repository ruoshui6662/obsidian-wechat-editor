// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {LayoutPanel} from '../src/view';
import {DEFAULT_LAYOUT} from '../../core/src/styles';
import {parseArticle} from '../../core/src/parse';
const pluginCSS=readFileSync('packages/plugin/styles.css','utf8');
// Reproduce Tahoe's separate base arrow geometry and higher-specificity dark image.
// Simple local URLs avoid JSDOM's data-SVG parsing limits; no resource fetch occurs.
const themeCSS=`select{background-image:url("arrow-light.svg");background-repeat:no-repeat;background-position:right center;background-size:8px 5px;padding-right:22px;appearance:none}.theme-dark select{background-image:url("arrow-dark.svg")}`;
const panels:LayoutPanel[]=[];
afterEach(()=>{panels.splice(0).forEach(p=>p.destroy());document.body.replaceChildren();document.body.className='';document.head.querySelectorAll('[data-select-test]').forEach(n=>n.remove());});
for(const mode of ['theme-light','theme-dark'])for(const order of ['theme-first','plugin-first'])it(`${mode}KeepsASingleArrowAndTextClearanceWhen${order}`,()=>{
 document.body.className=mode;
 for(const source of order==='theme-first'?[themeCSS,pluginCSS]:[pluginCSS,themeCSS]){const style=document.createElement('style');style.dataset.selectTest='';style.textContent=source;document.head.append(style);}
 const root=document.createElement('div');document.body.append(root);const p=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},getPairingInfo:async()=>'{}',copyPairing:async()=>{},changeLayout:()=>{},refresh:()=>{}});panels.push(p);p.setState({article:parseArticle('正文\n\n![[图.png]]','稿.md'),layout:DEFAULT_LAYOUT,overrides:{},sources:new Map(),account:null,pairingReady:false});
 const selects=root.querySelectorAll('select');expect(selects.length).toBeGreaterThan(10);
 for(const select of selects){const css=getComputedStyle(select);expect(css.backgroundImage).toContain(mode==='theme-dark'?'arrow-dark.svg':'arrow-light.svg');expect(css.backgroundRepeat).toBe('no-repeat');expect(css.backgroundSize).toBe('8px 5px');expect(parseFloat(css.paddingRight)).toBeGreaterThanOrEqual(22);}
 const outside=document.createElement('select');document.body.append(outside);expect(getComputedStyle(outside).paddingRight).toBe('22px');
});
it('switchingDarkModeDoesNotResetTheArrowGeometry',()=>{
 const style=document.createElement('style');style.dataset.selectTest='';style.textContent=themeCSS+'\n'+pluginCSS;document.head.append(style);const root=document.createElement('div');root.className='wx-layout';root.innerHTML='<label class="wx-field"><select><option>16 px</option></select></label>';document.body.append(root);const select=root.querySelector('select')!;
 document.body.className='theme-light';expect(getComputedStyle(select).backgroundImage).toContain('arrow-light.svg');document.body.className='theme-dark';expect(getComputedStyle(select).backgroundImage).toContain('arrow-dark.svg');expect(getComputedStyle(select).backgroundRepeat).toBe('no-repeat');expect(getComputedStyle(select).backgroundSize).toBe('8px 5px');
});
it('compactHostThemeCannotClampTextInsideParameterControls',()=>{
 const style=document.createElement('style');style.dataset.selectTest='';
 style.textContent='body{--input-height:24px} select,input{height:24px;min-height:24px;line-height:24px;padding:3px 8px}\n'+pluginCSS;document.head.append(style);
 const root=document.createElement('div');document.body.append(root);const p=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},getPairingInfo:async()=>'{}',copyPairing:async()=>{},changeLayout:()=>{},refresh:()=>{}});panels.push(p);p.setState({article:parseArticle('正文\n\n![[图.png]]','稿.md'),layout:DEFAULT_LAYOUT,overrides:{},sources:new Map(),account:null,pairingReady:false});
 // Removing the height cap lets the control grow for larger UI fonts instead of clipping ink.
 for(const select of root.querySelectorAll('select')){const css=getComputedStyle(select);expect(css.height).toBe('auto');expect(css.lineHeight).toBe('1.5');expect(parseFloat(css.minHeight)).toBeGreaterThanOrEqual(30);}
 const select=root.querySelector<HTMLSelectElement>('[data-number-select=fontSize]')!;select.value='manual';select.dispatchEvent(new Event('change'));const input=root.querySelector<HTMLInputElement>('[data-setting=fontSize]')!,css=getComputedStyle(input);expect(document.activeElement).toBe(input);expect(css.height).toBe('auto');expect(css.lineHeight).toBe('1.5');expect(parseFloat(css.minHeight)).toBeGreaterThanOrEqual(30);
 expect(getComputedStyle(root.querySelector('.wx-number-value')!).minHeight).toBe('32px');
 // A range hit target is not a text box and keeps its own track geometry.
 const range=root.querySelector<HTMLInputElement>('input[type=range]')!;expect(getComputedStyle(range).height).toBe('22px');expect(getComputedStyle(range).paddingTop).toBe('0px');
});

// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {LayoutPanel} from '../src/view';
import {DEFAULT_LAYOUT} from '../../core/src/styles';
import {parseArticle} from '../../core/src/parse';
const panels:LayoutPanel[]=[];
afterEach(()=>{panels.splice(0).forEach(p=>p.destroy());document.body.replaceChildren();document.body.className='';document.head.querySelectorAll('[data-settings-test]').forEach(n=>n.remove());});
function setup(){
 const style=document.createElement('style');style.dataset.settingsTest='';style.textContent='.theme-light input[type=number]{box-shadow:0 0 0 1px #ddd}\n'+readFileSync('packages/plugin/styles.css','utf8');document.head.append(style);document.body.className='theme-light';
 const root=document.createElement('div');document.body.append(root);const panel=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},getPairingInfo:async()=>'{}',copyPairing:async()=>{},changeLayout:()=>{},refresh:()=>{}});panels.push(panel);panel.setState({article:parseArticle('正文\n\n![[图.png]]','稿.md'),layout:DEFAULT_LAYOUT,overrides:{},sources:new Map(),account:null,pairingReady:false});return{root,panel};
}
it('textAndImageRowsShareOneAlignedValueColumnWithoutHalfWidthExceptions',()=>{
 const {root}=setup(),font=root.querySelector('[data-setting=fontFamily]')!.closest<HTMLElement>('.wx-field')!,fieldCSS=getComputedStyle(font);
 for(const row of root.querySelectorAll('.wx-field,.wx-image-preset-row,.wx-image-slider'))expect(getComputedStyle(row).gridTemplateColumns).toBe(fieldCSS.gridTemplateColumns);
 expect(getComputedStyle(root.querySelector('[data-common-controls]')!).gridTemplateColumns).toBe('minmax(0,1fr)');expect(getComputedStyle(root.querySelector('[data-number-control=sidePadding] .wx-field')!).maxWidth).toBe('none');expect(getComputedStyle(root.querySelector('.wx-single-field')!).width).toBe('100%');
});
it('rowSeparatorsHaveOneOwnerInsteadOfDoubleBottomAndSectionBorders',()=>{
 const {root}=setup(),rows=[...root.querySelector('[data-common-controls]')!.children];expect(getComputedStyle(rows[0]).borderTopWidth).toBe('0px');
 for(const row of rows.slice(1)){expect(getComputedStyle(row).borderTopWidth).toBe('1px');expect(parseFloat(getComputedStyle(row).borderBottomWidth)||0).toBe(0);}
 expect(getComputedStyle(root.querySelector('[data-heading-options]')!).borderTopWidth).toBe('1px');expect(getComputedStyle(root.querySelector('.wx-card')!).borderTopWidth).toBe('0px');
});
it('manualNumberInputDoesNotDrawASecondBorderInsideItsSharedFrame',()=>{
 const {root}=setup(),select=root.querySelector<HTMLSelectElement>('[data-number-select=lineHeight]')!;select.value='manual';select.dispatchEvent(new Event('change'));const input=root.querySelector<HTMLInputElement>('[data-setting=lineHeight]')!,css=getComputedStyle(input);expect(getComputedStyle(select.parentElement!).gridTemplateColumns).toBe('minmax(0,1fr) 28px');expect(css.boxShadow).toBe('none');expect(css.borderTopWidth).toBe('0px');expect(css.borderRadius).toBe('0');expect(document.activeElement).toBe(input);select.value='2';select.dispatchEvent(new Event('change'));expect(getComputedStyle(select.parentElement!).gridTemplateColumns).toBe('minmax(0,1fr)');expect(getComputedStyle(root.querySelector('[data-number-manual=lineHeight]')!).display).toBe('none');
});

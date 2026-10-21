// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {numberControl} from '../src/controls';
import {LayoutPanelHarness as LayoutPanel} from '../../../tests/helpers/layout-panel';
import WechatLayoutPlugin from '../src/main';
import {loadSettings} from '../src/settings';
import {CopyJobController} from '../../core/src/job';
import {parseArticle} from '../../core/src/parse';
import {renderArticle} from '../../core/src/render';
it('typingGlobalSpacingReachesPreviewSavedSettingsAndCopyWithoutBlur',async()=>{
 const source='第一段\n\n第二段';const account={id:'test',name:'测试号'};let saved:any,clipboard='';
 const plugin=new WechatLayoutPlugin({workspace:{getLeavesOfType:()=>[]},vault:{cachedRead:async()=>source}} as any,{} as any);
 plugin.settings=loadSettings({notes:{'稿.md':{layout:{paragraphAfter:0},overrides:{}}}});plugin.saveData=async data=>{saved=structuredClone(data)};
 plugin.activeNote={path:'稿.md'} as any;plugin.article=parseArticle(source,'稿.md');plugin.bridge={isConnected:()=>true,getAccount:()=>account,getInfo:()=>({endpoint:'test'})} as any;
 plugin.controller=new CopyJobController({verifyAccount:async()=>{},prepare:async()=>[],upload:async()=>{throw Error('No images expected')},render:(s,map)=>renderArticle(s.article,s.layout,map,s.overrides),writeClipboard:async result=>{clipboard=result.html},isCurrent:()=>true,onEvent:()=>{}});
 const root=document.createElement('div');document.body.append(root);const panel=new LayoutPanel(root,plugin.host());(plugin as any).views.add({panel});panel.setState(plugin.state());
 for(const [key,value]of [['sidePadding','16'],['paragraphAfter','28']]){const choice=root.querySelector<HTMLSelectElement>(`[data-number-select=${key}]`)!;choice.value='manual';choice.dispatchEvent(new Event('change'));const input=root.querySelector<HTMLInputElement>(`[data-setting=${key}]`)!;input.focus();input.value=value;input.dispatchEvent(new Event('input'));}
 await vi.waitFor(()=>expect(plugin.state().saving).toBe(false));panel.showPage('preview');
 expect(saved.notes['稿.md'].layout).toMatchObject({sidePadding:16,paragraphAfter:28});
 const preview=root.querySelector('.wx-paper')!.shadowRoot!.querySelector('p')!;expect(preview.style.marginBottom).toBe('0px');expect((preview.nextElementSibling as HTMLElement).style.marginTop).toBe('28px');
 await plugin.copy();const article=document.createElement('div');article.innerHTML=clipboard;expect(article.querySelector('p')!.style.marginBottom).toBe('0px');expect(article.querySelectorAll('p')[1].style.marginTop).toBe('28px');
 // The copied blocks must carry their inset even when the paste target unwraps the article.
 expect(article.querySelector('p')!.style.marginLeft).toBe('16px');panel.destroy();root.remove();
});
it('focusedMultiDigitInputSurvivesStateRefreshUntilItBecomesValid',()=>{
 const root=document.createElement('div');document.body.append(root);const plugin=new WechatLayoutPlugin({} as any,{} as any);plugin.settings=loadSettings({});plugin.activeNote={path:'稿.md'} as any;
 const panel=new LayoutPanel(root,plugin.host());(plugin as any).views.add({panel});panel.setState(plugin.state());
 const choice=root.querySelector<HTMLSelectElement>('[data-number-select=fontSize]')!;choice.value='manual';choice.dispatchEvent(new Event('change'));const input=root.querySelector<HTMLInputElement>('[data-setting=fontSize]')!;input.focus();input.value='1';input.dispatchEvent(new Event('input'));panel.setState(plugin.state());expect(input.value).toBe('1');
 input.value='19';input.dispatchEvent(new Event('input'));expect(plugin.state().layout.fontSize).toBe(19);expect(input.value).toBe('19');panel.destroy();root.remove();
});
it('emptyInputDoesNotAccidentallySetSpacingToZero',()=>{
 const values:number[]=[];const input=numberControl(document.createElement('div'),'段后','paragraphAfter',28,0,48,1,value=>values.push(value),true);
 input.value='';input.dispatchEvent(new Event('input'));input.dispatchEvent(new Event('change'));expect(values).toEqual([]);expect(input.value).toBe('28');
 input.value='0';input.dispatchEvent(new Event('input'));expect(values).toEqual([0]);
});

// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {LayoutPanelHarness as LayoutPanel} from '../../../tests/helpers/layout-panel';
import {DEFAULT_LAYOUT} from '../../core/src/styles';
import {parseArticle} from '../../core/src/parse';
import {loadSettings} from '../src/settings';
function panel(){const root=document.createElement('div');document.body.append(root);const p=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},getPairingInfo:async()=>'{}',copyPairing:async()=>{},changeLayout:()=>{},refresh:()=>{}});return{root,p};}
it('sourceInsertionCannotRetargetSelectedParagraph',()=>{let target='';const root=document.createElement('div');const p=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},getPairingInfo:async()=>'{}',copyPairing:async()=>{},changeLayout:()=>{},refresh:()=>{},changeBlock:async key=>{target=key}});const state={article:parseArticle('第一段 ^a\n\n第二段 ^b','稿.md'),layout:DEFAULT_LAYOUT,overrides:{},sources:new Map(),account:null,pairingReady:true};p.setState(state);p.selectBlock('block-2',null);state.article=parseArticle('新段\n\n第一段 ^a\n\n第二段 ^b','稿.md');p.setState(state);const input=root.querySelector<HTMLInputElement>('[data-setting=localFontSize]');if(input){input.value='20';input.dispatchEvent(new Event('change'));expect(target).toBe('block-4');}else expect(root.querySelector('[data-selection-label]')?.textContent).toContain('点击');});
it('viewOpensCurrentMarkdownAndKeepsSourceEditor',()=>{const editor=document.createElement('textarea');editor.value='保留的正文';document.body.append(editor);const {root,p}=panel();p.setState({article:parseArticle('正文 **重点**','测试.md'),layout:DEFAULT_LAYOUT,sources:new Map(),overrides:{},account:{id:'a',name:'测试号'},pairingReady:true});p.showPage('preview');expect(root.querySelector('.wx-article-title')?.textContent).toBe('测试');expect(root.querySelector('.wx-paper')?.shadowRoot?.textContent).toContain('重点');expect(editor.value).toBe('保留的正文');p.destroy();});
it('copyDisabledWithoutRecognizedAccount',()=>{const{root,p}=panel();p.setState({article:parseArticle('正文','稿.md'),layout:DEFAULT_LAYOUT,sources:new Map(),overrides:{},account:null,pairingReady:true});expect(root.querySelector<HTMLButtonElement>('[data-action="copy"]')!.disabled).toBe(true);p.destroy();});
it('showsUploadErrorsAndAllowsRetry',()=>{const{root,p}=panel();p.setState({article:parseArticle('正文','稿.md'),layout:DEFAULT_LAYOUT,sources:new Map(),overrides:{},account:{id:'a',name:'测试号'},pairingReady:true});p.setJobEvent({type:'failed',message:'图片上传失败，请重试。'});expect(root.querySelector('[role=status]')?.textContent).toContain('失败');expect(root.querySelector<HTMLButtonElement>('[data-action=copy]')!.disabled).toBe(false);p.destroy();});
it('destroyClearsPanelElements',()=>{const{root,p}=panel();p.destroy();expect(root.children).toHaveLength(0);});
it('loadSettingsRejectsInvalidValuesAndPreservesNoteOverrides',()=>{const s=loadSettings({layout:{fontSize:999},notes:{'稿.md':{overrides:{pic:{image:{radius:8}}}}},bridgeToken:'bad'});expect(s.layout.fontSize).toBe(50);expect(s.notes['稿.md'].overrides.pic.image?.radius).toBe(8);expect(s.bridgeToken).toBeUndefined();});
it('autoImageWidthSurvivesSettingsRoundTrip',()=>{const s=loadSettings(JSON.parse(JSON.stringify({notes:{'稿.md':{overrides:{'*':{image:{widthPercent:65}},pic:{image:{widthPercent:null}}}}}})));expect(s.notes['稿.md'].overrides.pic.image?.widthPercent).toBeNull();});
it('pictureShadowSwitchOnlyWritesShadowFieldsToTheSelectedImage',()=>{let patch:any;const root=document.createElement('div');const p=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},getPairingInfo:async()=>'{}',copyPairing:async()=>{},changeLayout:()=>{},refresh:()=>{},changeBlock:async(_key,value)=>{patch=value}});p.setState({article:parseArticle('![[图.png]]','稿.md'),layout:DEFAULT_LAYOUT,overrides:{},sources:new Map(),account:null,pairingReady:true});p.selectImage('img-0');const toggle=root.querySelector<HTMLInputElement>('[data-image-shadow-toggle]')!;toggle.checked=true;toggle.dispatchEvent(new Event('change'));expect(patch.image.shadow).toBe(6);expect(patch.image.radius).toBeUndefined();expect(patch.image.backgroundMode).toBeUndefined();p.destroy();});
it('legacyPairingOpensImmediatelyWhileServiceStartsAndShowsCopiedInformation',async()=>{
 const root=document.createElement('div');let ready!:(value:string)=>void;const info=new Promise<string>(resolve=>{ready=resolve});const copy=vi.fn().mockResolvedValue(undefined);
 const p=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},getPairingInfo:()=>info,copyPairing:copy,changeLayout:()=>{},refresh:()=>{}});
 p.setState({article:null,layout:DEFAULT_LAYOUT,overrides:{},sources:new Map(),account:null,pairingReady:false});
 const button=root.querySelector<HTMLButtonElement>('[data-action=pair]')!;expect(button.disabled).toBe(false);button.click();root.querySelector<HTMLElement>('[data-action=legacy-pair]')!.click();
 expect(root.querySelector<HTMLElement>('[data-pairing]')?.hidden).toBe(false);expect(root.querySelector('[data-pair-status]')?.textContent).toContain('准备');
 ready('{"endpoint":"ws://127.0.0.1:17836","token":"test"}');await vi.waitFor(()=>expect(copy).toHaveBeenCalledWith('{"endpoint":"ws://127.0.0.1:17836","token":"test"}'));
 expect(root.querySelector('[data-pair-status]')?.textContent).toContain('已复制');expect(root.querySelector<HTMLTextAreaElement>('[data-pair-text]')?.value).toContain('endpoint');p.destroy();
});
it('legacyPairingCopyFailureRemainsVisibleAcrossAccountUpdatesAndAllowsManualCopy',async()=>{
 const root=document.createElement('div');const p=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},getPairingInfo:async()=>'{"token":"test"}',copyPairing:async()=>{throw Error('自动复制失败，请手动复制。')},changeLayout:()=>{},refresh:()=>{}});
 root.querySelector<HTMLButtonElement>('[data-action=pair]')!.click();root.querySelector<HTMLElement>('[data-action=legacy-pair]')!.click();await vi.waitFor(()=>expect(root.querySelector('[data-pair-status]')?.textContent).toContain('手动复制'));
 p.setState({article:null,layout:DEFAULT_LAYOUT,overrides:{},sources:new Map(),account:null,pairingReady:true});
 expect(root.querySelector('[data-pair-status]')?.textContent).toContain('手动复制');const text=root.querySelector<HTMLTextAreaElement>('[data-pair-text]')!;expect(text.value).toBe('{"token":"test"}');
 root.querySelector<HTMLButtonElement>('[data-action=select-pair]')!.click();expect(text.selectionStart).toBe(0);expect(text.selectionEnd).toBe(text.value.length);
 root.querySelector<HTMLButtonElement>('[data-action=close-pair]')!.click();expect(text.value).toBe('');expect(root.querySelector<HTMLElement>('[data-pairing]')!.hidden).toBe(true);p.destroy();
});
it('legacyPairingShowsActualStartupFailureAndAllowsRetry',async()=>{
 const root=document.createElement('div');const getPairingInfo=vi.fn().mockRejectedValueOnce(Error('本地连接服务无法启动：端口不可用')).mockResolvedValueOnce('{"token":"retry"}');
 const p=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},getPairingInfo,copyPairing:async()=>{},changeLayout:()=>{},refresh:()=>{}});
 root.querySelector<HTMLButtonElement>('[data-action=pair]')!.click();root.querySelector<HTMLElement>('[data-action=legacy-pair]')!.click();await vi.waitFor(()=>expect(root.querySelector('[data-pair-status]')?.textContent).toContain('端口不可用'));
 const button=root.querySelector<HTMLButtonElement>('[data-action=pair]')!;expect(button.disabled).toBe(false);button.click();root.querySelector<HTMLElement>('[data-action=legacy-pair]')!.click();await vi.waitFor(()=>expect(root.querySelector('[data-pair-status]')?.textContent).toContain('已复制'));p.destroy();
});

it('connectionHelpDoesNotCopySecretsAndDistinguishesLoginFromLocalConnection',()=>{
 const root=document.createElement('div'),getPairingInfo=vi.fn(async()=>'{}'),copyPairing=vi.fn(async()=>{});const p=new LayoutPanel(root,{copy:async()=>{},cancel:()=>{},getPairingInfo,copyPairing,changeLayout:()=>{},refresh:()=>{}});
 root.querySelector<HTMLButtonElement>('[data-action=pair]')!.click();expect(getPairingInfo).not.toHaveBeenCalled();expect(copyPairing).not.toHaveBeenCalled();expect(root.querySelector('[data-pairing]')?.textContent).toContain('允许连接');
 p.setState({article:null,layout:DEFAULT_LAYOUT,overrides:{},sources:new Map(),account:null,pairingReady:true,bridgeConnected:true});expect(root.querySelector('[data-account]')?.textContent).toContain('等待微信登录');p.destroy();
});

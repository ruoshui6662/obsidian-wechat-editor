// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {ConfirmBrowserPairing} from '../src/confirm-browser-pairing';
it('native approval defaults to cancel and closing never grants access',()=>{
 let result:boolean|undefined;const signal=new AbortController();const modal=new ConfirmBrowserPairing({} as any,{name:'助手',origin:'chrome-extension://'+'a'.repeat(32),signal:signal.signal},v=>result=v);modal.open();expect(document.activeElement?.textContent).toBe('取消');modal.close();expect(result).toBe(false);
});
it('explicit approval grants once and expiration closes the dialog',()=>{
 const answers:boolean[]=[];const signal=new AbortController();const modal=new ConfirmBrowserPairing({} as any,{name:'助手',origin:'chrome-extension://'+'a'.repeat(32),signal:signal.signal},v=>answers.push(v));modal.open();modal.contentEl.querySelector<HTMLButtonElement>('[data-allow-browser]')!.click();expect(answers).toEqual([true]);
 const expired=new ConfirmBrowserPairing({} as any,{name:'助手',origin:'chrome-extension://'+'a'.repeat(32),signal:signal.signal},v=>answers.push(v));expired.open();signal.abort();expect(answers).toEqual([true,false]);expect(expired.contentEl.isConnected).toBe(false);
});

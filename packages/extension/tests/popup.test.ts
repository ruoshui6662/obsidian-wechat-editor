// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {it,expect,vi} from 'vitest';
import {mountPopup} from '../src/popup-view';
const html=readFileSync('packages/extension/popup.html','utf8');
it('uses one connection action without token text or an account selector',async()=>{
 document.documentElement.innerHTML=html;const send=vi.fn(async()=>({phase:'idle',message:'连接 Obsidian',account:null,wechatMessage:'等待登录'}));const ui=mountPopup(document,{send,diagnostics:async()=>{}});await ui.ready;document.querySelector<HTMLButtonElement>('#primary')!.click();await Promise.resolve();expect(send).toHaveBeenCalledWith({type:'connect'});expect(document.querySelector('textarea')).toBeNull();expect(document.querySelector('#tabs')).toBeNull();ui.destroy();
});
it('shows local connection independently of missing WeChat login',async()=>{
 document.documentElement.innerHTML=html;const ui=mountPopup(document,{send:async()=>({phase:'connected',message:'Obsidian 已连接',name:'主库',account:null,wechatMessage:'请在公众号后台登录'}),diagnostics:async()=>{}});await ui.ready;expect(document.querySelector('#obsidian-status')?.textContent).toContain('已连接');expect(document.querySelector('#vault-name')?.textContent).toBe('主库');expect(document.querySelector('#wechat-status')?.textContent).toContain('登录');expect(document.querySelector('#primary')?.textContent).toContain('公众号后台');ui.destroy();
});

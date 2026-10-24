import type {Account} from '../../core/src/types';
import {LayoutError} from '../../core/src/types';
import type {WechatSession} from './connection';
interface Tab {id?:number;url?:string;active?:boolean;windowId?:number;discarded?:boolean;frozen?:boolean}
interface TargetPort {tabs():Promise<Tab[]>;focused():Promise<Tab[]>;read(tabId:number):Promise<Account>}
const timeout=<T>(task:Promise<T>):Promise<T>=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('后台响应超时')),7000);task.then(v=>{clearTimeout(timer);resolve(v)},e=>{clearTimeout(timer);reject(e)});});
export async function resolveWechatSession(port:TargetPort):Promise<WechatSession>{
 const [all,focused]=await Promise.all([port.tabs(),port.focused()]);
 const tabs=all.filter(t=>Number.isInteger(t.id)&&t.url?.startsWith('https://mp.weixin.qq.com/')&&!t.discarded&&!t.frozen);
 if(!tabs.length)throw new LayoutError('wechat-tab','请打开已登录的公众号后台');
 const preferred=tabs.find(t=>focused.some(f=>f.id===t.id));
 const read=async(t:Tab)=>({tabId:t.id!,account:await timeout(port.read(t.id!))});
 if(preferred){try{return await read(preferred);}catch{throw new LayoutError('wechat-login','请在当前公众号后台完成登录，或重新打开后台');}}
 const results=await Promise.allSettled(tabs.slice(0,8).map(read));const sessions=results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
 if(new Set(sessions.map(s=>s.account.id)).size>1)throw new LayoutError('wechat-ambiguous','请先打开要使用的公众号后台，再回到 Obsidian 复制');
 if(!sessions.length)throw new LayoutError('wechat-login','请在公众号后台完成登录；如已登录，请重新打开后台');
 return sessions[0];
}

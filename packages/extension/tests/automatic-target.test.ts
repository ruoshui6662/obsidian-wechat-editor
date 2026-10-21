import {it,expect} from 'vitest';
import {resolveWechatSession} from '../src/wechat-target';
const tab=(id:number,active=false)=>({id,url:'https://mp.weixin.qq.com/cgi-bin/home',active,windowId:1});
it('rediscovers a replacement tab instead of depending on stored tab ids',async()=>{
 const session=await resolveWechatSession({tabs:async()=>[tab(99)],focused:async()=>[],read:async id=>({id:'account-'+id,name:'当前号'})});expect(session.tabId).toBe(99);
});
it('prefers the focused backend and follows its current account',async()=>{
 const session=await resolveWechatSession({tabs:async()=>[tab(1),tab(2,true)],focused:async()=>[tab(2,true)],read:async id=>({id:'account-'+id,name:'当前号'})});expect(session.account.id).toBe('account-2');
});
it('skips logged-out tabs and reports missing login clearly',async()=>{
 const port={tabs:async()=>[tab(1),tab(2)],focused:async()=>[],read:async(id:number)=>{if(id===1)throw Error('登录页');return{id:'account',name:'当前号'}}};expect((await resolveWechatSession(port)).tabId).toBe(2);await expect(resolveWechatSession({...port,read:async()=>{throw Error('登录页')}})).rejects.toThrow(/登录/);
});
it('does not arbitrarily pick between different logged-in accounts',async()=>{
 await expect(resolveWechatSession({tabs:async()=>[tab(1),tab(2)],focused:async()=>[],read:async id=>({id:'account-'+id,name:'当前号'})})).rejects.toThrow(/打开要使用的公众号后台/);
});

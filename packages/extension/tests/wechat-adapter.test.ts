// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {webcrypto,createHash} from 'node:crypto';
import {wechatPageOperation} from '../src/wechat-page';
import {uploadWechatImage} from '../src/wechat-adapter';
const bytes=new Uint8Array([1,2,3]);
const home=()=>({ok:true,text:async()=>`var data={t:'12345',user_name:'gh_test',nick_name:'测试号',ticket:'private-ticket',time:12345678};`});
const payload={key:'x',base64:'AQID',size:3,sha256:createHash('sha256').update(bytes).digest('hex'),mime:'image/png',filename:'测试.png'};
beforeEach(()=>{vi.stubGlobal('crypto',webcrypto);(globalThis as any).wx={data:{t:'12345',user_name:'gh_test',nick_name:'测试号',ticket:'private-ticket',time:12345678}};});
afterEach(()=>{vi.unstubAllGlobals();delete (globalThis as any).wx;});
it('businessErrorOnHttp200RejectsUpload',async()=>{vi.stubGlobal('fetch',async(_url:string,init?:RequestInit)=>init?.method==='POST'?{ok:true,json:async()=>({base_resp:{ret:200013,err_msg:'fail'}})}:home());const r=await wechatPageOperation('upload','gh_test',payload);expect(r.ok).toBe(false);expect(r.message).toContain('200013');expect(JSON.stringify(r)).not.toContain('private-ticket');});
it('missingCdnUrlRejectsUpload',async()=>{vi.stubGlobal('fetch',async(_url:string,init?:RequestInit)=>init?.method==='POST'?{ok:true,json:async()=>({base_resp:{ret:0,err_msg:'ok'}})}:home());expect((await wechatPageOperation('upload','gh_test',payload)).ok).toBe(false);});
it('differentAccountAbortsUpload',async()=>{let requests=0;vi.stubGlobal('fetch',async(_url:string,init?:RequestInit)=>{if(init?.method==='POST')requests++;return home()});const r=await wechatPageOperation('upload','another-account',payload);expect(r.ok).toBe(false);expect(requests).toBe(0);});
it('returnsOnlyAccountAndValidImageAddress',async()=>{vi.stubGlobal('fetch',async(_url:string,init?:RequestInit)=>init?.method==='POST'?{ok:true,json:async()=>({base_resp:{ret:0,err_msg:'ok'},cdn_url:'https://mmbiz.qpic.cn/test'})}:home());expect(await wechatPageOperation('upload','gh_test',payload)).toEqual({ok:true,account:{id:'gh_test',name:'测试号'},url:'https://mmbiz.qpic.cn/test'});});
it('rejectsMismatchedImageDigestBeforeUploading',async()=>{vi.stubGlobal('fetch',async()=>{throw Error('not expected')});const r=await wechatPageOperation('upload','gh_test',{...payload,sha256:'0'.repeat(64)});expect(r.ok).toBe(false);expect(r.message).toContain('校验');});
it('timeoutAllowsExplicitRetry',async()=>{const signal=new AbortController().signal;await expect(uploadWechatImage(1,{key:'x',bytes,mime:'image/png',filename:'a.png',occurrenceIds:[]},'gh_test',signal,async()=>new Promise(()=>{}),5)).rejects.toThrow(/超时/);});
it('reads the current cookie session instead of a stale page global',async()=>{
 vi.stubGlobal('fetch',async()=>({ok:true,text:async()=>`var wx={data:{user_name:'gh_new',nick_name:'当前号',t:'new-token',ticket:'new-ticket',time:'1700000000'}};`}));
 expect(await wechatPageOperation('read')).toEqual({ok:true,account:{id:'gh_new',name:'当前号'}});
});
it('does not parse suffixes of unrelated keys as upload credentials',async()=>{
 delete (globalThis as any).wx;vi.stubGlobal('fetch',async()=>({ok:true,text:async()=>`var data={widget:'wrong',upload_ticket:'wrong',runtime:'wrong',t:12345,user_name:'gh_test',nick_name:'测试号',ticket:'private-ticket',time:1700000000};`}));
 const result=await wechatPageOperation('read');expect(result).toEqual({ok:true,account:{id:'gh_test',name:'测试号'}});
});
it('does not upload from an old tab after the browser cookie account changed',async()=>{
 const methods:string[]=[];vi.stubGlobal('fetch',async(_url:string,init?:RequestInit)=>{methods.push(init?.method||'GET');return{ok:true,text:async()=>`var data={user_name:'gh_new',nick_name:'新号',t:'new-token',ticket:'new-ticket',time:1700000000};`}});
 const result=await wechatPageOperation('upload','gh_test',payload);expect(result).toMatchObject({ok:false,code:'account-changed'});expect(methods).toEqual(['GET']);
});

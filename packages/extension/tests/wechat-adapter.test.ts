// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {webcrypto,createHash} from 'node:crypto';
import {wechatPageOperation} from '../src/wechat-page';
import {uploadWechatImage} from '../src/wechat-adapter';
const bytes=new Uint8Array([1,2,3]);
const home=()=>({ok:true,text:async()=>`var data={t:'12345',user_name:'gh_test',nick_name:'测试号',ticket:'private-ticket',time:12345678};`});
const payload={key:'x',base64:'AQID',size:3,sha256:createHash('sha256').update(bytes).digest('hex'),mime:'image/png',filename:'测试.png'};
beforeEach(()=>{vi.stubGlobal('crypto',webcrypto);(globalThis as any).wx={data:{t:'12345',user_name:'gh_test',nick_name:'测试号',ticket:'private-ticket',time:12345678}};});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();delete (globalThis as any).wx;});
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
const preparedAsset={key:'x',bytes,mime:'image/png',filename:'a.png',occurrenceIds:[]};
const page=wechatPageOperation;
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r});return{promise,resolve};}
it('cancels only the targeted page fetch and releases its operation',async()=>{
 vi.useFakeTimers();const firstStarted=deferred<void>();const secondStarted=deferred<void>();let uploads=0;const signals:AbortSignal[]=[];
 vi.stubGlobal('fetch',async(_url:string,init?:RequestInit)=>{
  if(init?.method!=='POST')return home();
  uploads++;signals.push(init.signal as AbortSignal);if(uploads===1)firstStarted.resolve();else secondStarted.resolve();
  return new Promise((_resolve,reject)=>init.signal!.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));
 });
 const first=page('upload','gh_test',payload,'cancel-first');await firstStarted.promise;
 const second=page('upload','gh_test',payload,'keep-second');await secondStarted.promise;await page('cancel','',null,'cancel-first');
 expect(await first).toMatchObject({ok:false,code:'cancelled'});
 expect(signals.map(s=>s.aborted)).toEqual([true,false]);
 await page('cancel','',null,'keep-second');expect(await second).toMatchObject({ok:false,code:'cancelled'});
 expect(uploads).toBe(2);expect(vi.getTimerCount()).toBe(0);
});
it('remembers cancellation delivered before an injected upload starts',async()=>{
 const fetch=vi.fn(async()=>home());vi.stubGlobal('fetch',fetch);const digest=vi.fn(webcrypto.subtle.digest.bind(webcrypto.subtle));vi.stubGlobal('crypto',{subtle:{digest}});
 await page('cancel','',null,'cancel-before-start',Date.now()+1000);
 expect(await page('upload','gh_test',payload,'cancel-before-start',Date.now()+1000)).toMatchObject({ok:false,code:'cancelled'});
 expect(fetch).not.toHaveBeenCalled();expect(digest).not.toHaveBeenCalled();
});
it('rejects an expired injected upload after its cancellation tombstone expires',async()=>{
 vi.useFakeTimers();const fetch=vi.fn(async()=>home());vi.stubGlobal('fetch',fetch);
 const deadline=Date.now()+50;await page('cancel','',null,'expired-upload',deadline);await vi.advanceTimersByTimeAsync(100);
 expect(await page('upload','gh_test',payload,'expired-upload',deadline)).toMatchObject({ok:false,code:'upload-timeout'});
 expect(fetch).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
it('does not hash or dispatch an already cancelled upload',async()=>{
 const digest=vi.fn(webcrypto.subtle.digest.bind(webcrypto.subtle));vi.stubGlobal('crypto',{subtle:{digest}});
 const controller=new AbortController();controller.abort();const runner=vi.fn();
 await expect(uploadWechatImage(1,preparedAsset,'gh_test',controller.signal,runner)).rejects.toMatchObject({code:'cancelled'});
 expect(digest).not.toHaveBeenCalled();expect(runner).not.toHaveBeenCalled();
});
it('stops before dispatch if cancelled while hashing',async()=>{
 const hashed=deferred<ArrayBuffer>();vi.stubGlobal('crypto',{subtle:{digest:()=>hashed.promise}});
 const controller=new AbortController();const runner=vi.fn();
 const result=uploadWechatImage(1,preparedAsset,'gh_test',controller.signal,runner);const rejected=expect(result).rejects.toMatchObject({code:'cancelled'});
 controller.abort();await rejected;hashed.resolve(new ArrayBuffer(32));await Promise.resolve();expect(runner).not.toHaveBeenCalled();
});
it.each(['abort','timeout'] as const)('forwards %s to the page using the upload request id',async(reason)=>{
 const invoked=deferred<void>();const calls:any[][]=[];
 const runner=async(...args:any[])=>{calls.push(args);if(args[1]==='upload'){invoked.resolve();return new Promise<any>(()=>{});}return{ok:true};};
 const controller=new AbortController();const result=uploadWechatImage(1,preparedAsset,'gh_test',controller.signal,runner,20);
 const rejected=expect(result).rejects.toMatchObject({code:reason==='abort'?'cancelled':'upload-timeout'});
 await invoked.promise;if(reason==='abort')controller.abort();await rejected;
 expect(calls.map(c=>c[1])).toEqual(['upload','cancel']);expect(calls[0][4]).toEqual(expect.any(String));expect(calls[0][4].length).toBeGreaterThan(0);expect(calls[1][4]).toBe(calls[0][4]);
 expect(calls[1][3]).toBeUndefined();
});
it('prevents a delayed upload injection from posting after adapter cancellation',async()=>{
 const pending=deferred<void>();const resume=deferred<void>();const finished=deferred<void>();const fetch=vi.fn(async()=>home());vi.stubGlobal('fetch',fetch);
 const runner=async(...args:any[])=>{if(args[1]==='upload'){pending.resolve();await resume.promise;}const result=await page(args[1],args[2],args[3],args[4],args[5]);if(args[1]==='upload')finished.resolve();return result;};
 const controller=new AbortController();const result=uploadWechatImage(1,preparedAsset,'gh_test',controller.signal,runner);
 const rejected=expect(result).rejects.toMatchObject({code:'cancelled'});await pending.promise;controller.abort();await rejected;resume.resolve();await finished.promise;expect(fetch).not.toHaveBeenCalled();
});
it('cancels page hashing before any account request or upload starts',async()=>{
 const hashed=deferred<ArrayBuffer>();const fetch=vi.fn();vi.stubGlobal('fetch',fetch);vi.stubGlobal('crypto',{subtle:{digest:()=>hashed.promise}});
 const pending=page('upload','gh_test',payload,'cancel-page-digest');await page('cancel','',null,'cancel-page-digest');
 hashed.resolve(new ArrayBuffer(32));expect(await pending).toMatchObject({ok:false,code:'cancelled'});expect(fetch).not.toHaveBeenCalled();
});
it('aborts the page fetch at its deadline and removes its timers',async()=>{
 vi.useFakeTimers();const started=deferred<void>();let signal:AbortSignal|undefined;
 vi.stubGlobal('fetch',async(_url:string,init?:RequestInit)=>{
  if(init?.method!=='POST')return home();signal=init.signal as AbortSignal;started.resolve();
  return new Promise((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));
 });
 const pending=page('upload','gh_test',payload,'page-timeout',Date.now()+1000);await started.promise;
 await vi.advanceTimersByTimeAsync(1000);expect(await pending).toMatchObject({ok:false,code:'upload-timeout'});expect(signal?.aborted).toBe(true);expect(vi.getTimerCount()).toBe(0);
});
it('bounds hashing by the adapter timeout without dispatching a page operation',async()=>{
 vi.stubGlobal('crypto',{subtle:{digest:()=>new Promise(()=>{})}});const runner=vi.fn();
 await expect(uploadWechatImage(1,preparedAsset,'gh_test',new AbortController().signal,runner,5)).rejects.toMatchObject({code:'upload-timeout'});expect(runner).not.toHaveBeenCalled();
});
it('keeps cancellation settled when the upload later reports success',async()=>{
 const started=deferred<void>();const uploaded=deferred<any>();const calls:string[]=[];
 const runner=async(_tab:number,operation:'read'|'upload'|'cancel')=>{calls.push(operation);if(operation==='upload'){started.resolve();return uploaded.promise;}return{ok:true};};
 const controller=new AbortController();const pending=uploadWechatImage(1,preparedAsset,'gh_test',controller.signal,runner);
 const rejected=expect(pending).rejects.toMatchObject({code:'cancelled'});await started.promise;controller.abort();await rejected;
 uploaded.resolve({ok:true,account:{id:'gh_test',name:'测试号'},url:'https://mmbiz.qpic.cn/test'});await Promise.resolve();
 await expect(pending).rejects.toMatchObject({code:'cancelled'});expect(calls).toEqual(['upload','cancel']);
});
it('serializes page cancellation without closures across out-of-order Chrome injections',async()=>{
 const waiting=deferred<void>();const resume=deferred<void>();const injected=deferred<void>();let tabCalls=0;
 const serializedPage=new Function(`return (${wechatPageOperation.toString()})`)();
 const fetch=vi.fn(async()=>home());vi.stubGlobal('fetch',fetch);
 vi.stubGlobal('chrome',{
  tabs:{get:async()=>{if(++tabCalls===1){waiting.resolve();await resume.promise;}return{url:'https://mp.weixin.qq.com/'};}},
  scripting:{executeScript:async({args}:{args:any[]})=>{const result=await serializedPage(...args);if(args[0]==='upload')injected.resolve();return[{result}];}}
 });
 const controller=new AbortController();const pending=uploadWechatImage(1,preparedAsset,'gh_test',controller.signal);
 const rejected=expect(pending).rejects.toMatchObject({code:'cancelled'});await waiting.promise;controller.abort();await rejected;resume.resolve();await injected.promise;expect(fetch).not.toHaveBeenCalled();
});
it('rejects account changes detected after the single upload POST',async()=>{
 let reads=0,posts=0;vi.stubGlobal('fetch',async(_url:string,init?:RequestInit)=>{
  if(init?.method==='POST'){posts++;return{ok:true,json:async()=>({base_resp:{ret:0,err_msg:'ok'},cdn_url:'https://mmbiz.qpic.cn/test'})};}
  if(++reads===1)return home();return{ok:true,text:async()=>`var data={t:'12345',user_name:'gh_new'};`};
 });
 expect(await wechatPageOperation('upload','gh_test',payload)).toMatchObject({ok:false,code:'account-changed'});expect(posts).toBe(1);expect(reads).toBe(2);
});
it.each(['network','http','body'] as const)('retries one postflight %s failure without repeating the accepted upload',async(failure)=>{
 let reads=0,posts=0;vi.stubGlobal('fetch',async(_url:string,init?:RequestInit)=>{
  if(init?.method==='POST'){posts++;return{ok:true,json:async()=>({base_resp:{ret:0,err_msg:'ok'},cdn_url:'https://mmbiz.qpic.cn/accepted'})};}
  if(++reads===2){if(failure==='network')throw new TypeError('Failed to fetch');if(failure==='http')return{ok:false,status:503};return{ok:true,text:async()=>{throw new TypeError('body interrupted')}};}
  return home();
 });
 expect(await page('upload','gh_test',payload)).toEqual({ok:true,account:{id:'gh_test',name:'测试号'},url:'https://mmbiz.qpic.cn/accepted'});expect(posts).toBe(1);expect(reads).toBe(3);
});
it('stops safely after two failed postflight reads without repeating the POST',async()=>{
 let reads=0,posts=0;vi.stubGlobal('fetch',async(_url:string,init?:RequestInit)=>{
  if(init?.method==='POST'){posts++;return{ok:true,json:async()=>({base_resp:{ret:0,err_msg:'ok'},cdn_url:'https://mmbiz.qpic.cn/accepted'})};}
  if(++reads>1)throw new TypeError('Failed to fetch');return home();
 });
 expect(await page('upload','gh_test',payload)).toMatchObject({ok:false});expect(posts).toBe(1);expect(reads).toBe(3);
});
it('retries a transient preflight request before uploading once',async()=>{
 let reads=0,posts=0;vi.stubGlobal('fetch',async(_url:string,init?:RequestInit)=>{
  if(init?.method==='POST'){posts++;return{ok:true,json:async()=>({base_resp:{ret:0,err_msg:'ok'},cdn_url:'https://mmbiz.qpic.cn/test'})};}
  if(++reads===1)throw new TypeError('Failed to fetch');return home();
 });
 expect(await page('upload','gh_test',payload)).toMatchObject({ok:true,url:'https://mmbiz.qpic.cn/test'});expect(posts).toBe(1);expect(reads).toBe(3);
});
it('does not retry a failed read when its upload was cancelled',async()=>{
 let reads=0;vi.stubGlobal('fetch',async()=>{reads++;await page('cancel','',null,'cancel-failed-read');throw new TypeError('Failed to fetch');});
 expect(await page('upload','gh_test',payload,'cancel-failed-read')).toMatchObject({ok:false,code:'cancelled'});expect(reads).toBe(1);
});
it('does not retry credential parsing failures',async()=>{
 let reads=0;vi.stubGlobal('fetch',async()=>{reads++;return{ok:true,text:async()=>'<html>signed out</html>'};});
 expect(await page('upload','gh_test',payload)).toMatchObject({ok:false});expect(reads).toBe(1);
});
it('does not retry a failed read after its deadline expires',async()=>{
 vi.useFakeTimers();const deadline=Date.now()+1000;let reads=0;
 vi.stubGlobal('fetch',async()=>{reads++;vi.setSystemTime(deadline);throw new TypeError('Failed to fetch');});
 expect(await page('upload','gh_test',payload,'expired-failed-read',deadline)).toMatchObject({ok:false,code:'upload-timeout'});expect(reads).toBe(1);
});

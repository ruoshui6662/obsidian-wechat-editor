import {it,expect,vi,afterEach} from 'vitest';
import {createHash} from 'node:crypto';
import {ExtensionConnection} from '../src/connection';
class Socket {
 readyState=1;onopen:(()=>void)|null=null;onclose:((e?:{code:number})=>void)|null=null;onmessage:((e:{data:string})=>Promise<void>)|null=null;onerror:(()=>void)|null=null;sent:any[]=[];
 send(s:string){this.sent.push(JSON.parse(s));}close(){this.readyState=3;this.onclose?.({code:1006});}
 async receive(type:string,requestId:string,payload:any={},rest:any={}){await this.onmessage?.({data:JSON.stringify({version:1,type,requestId,payload,...rest})});}
}
const account={id:'gh_test',name:'测试号'},bytes=new Uint8Array([1,2,3]);
const payload={key:'pic',filename:'pic.png',mime:'image/png',size:3,sha256:createHash('sha256').update(bytes).digest('hex'),base64:'AQID'};
const connections:ExtensionConnection[]=[];
afterEach(()=>{connections.forEach(c=>c.stop());connections.length=0;vi.useRealTimers();});
async function setup(read=async()=>account,upload=async(_tab:number,_asset:any,_id:string,_signal:AbortSignal)=>'https://mmbiz.qpic.cn/pic'){
 const sockets:Socket[]=[];const c=new ExtensionConnection({load:async()=>({endpoint:'ws://127.0.0.1:17836',token:'a'.repeat(64),tabId:1}),socket:()=>{const s=new Socket();sockets.push(s);return s as any;},readAccount:read,upload,status:()=>{}});connections.push(c);await c.restore();sockets[0].onopen?.();await sockets[0].receive('hello-ok','hello');return{c,sockets};
}
it('temporary account read failures are reported as unavailable instead of a changed account',async()=>{
 let failed=false;const {c,sockets}=await setup(async()=>{if(failed)throw Error('network');return account;});failed=true;await c.refreshAccount();
 expect(sockets[0].sent.at(-1)).toMatchObject({type:'account',payload:{account:null,unavailable:true}});
 failed=false;await sockets[0].receive('account-check','verify');expect(sockets[0].sent.at(-1)).toMatchObject({requestId:'verify',payload:{account}});
});
it('an upload survives a brief socket loss without issuing another upload',async()=>{
 vi.useFakeTimers();let complete!:(url:string)=>void,signal:AbortSignal|undefined,calls=0;
 const {c,sockets}=await setup(async()=>account,async(_tab,_asset,_id,s)=>{calls++;signal=s;return new Promise<string>(r=>{complete=r;});});
 const task=sockets[0].receive('upload','request',payload,{jobId:'job',accountId:account.id});await vi.waitFor(()=>expect(calls).toBe(1));const sessionId=sockets[0].sent.find(m=>m.type==='hello').payload.sessionId;
 sockets[0].close();expect(signal!.aborted).toBe(false);complete('https://mmbiz.qpic.cn/done');await task;await vi.advanceTimersByTimeAsync(1000);
 const resumed=sockets[1];resumed.onopen?.();expect(resumed.sent[0].payload.sessionId).toBe(sessionId);await resumed.receive('hello-ok','hello',{pendingUploadIds:['request']});
 expect(resumed.sent.filter(m=>m.type==='upload-result')).toEqual([expect.objectContaining({requestId:'request',jobId:'job',payload:{key:'pic',url:'https://mmbiz.qpic.cn/done'}})]);expect(calls).toBe(1);c.stop();
});
it('reconnect aborts a task the host cancelled while disconnected',async()=>{
 vi.useFakeTimers();let uploadSignal:AbortSignal|undefined;const {sockets}=await setup(async()=>account,async(_t,_a,_id,signal)=>{uploadSignal=signal;return new Promise<string>((_r,j)=>signal.addEventListener('abort',()=>j(Error('cancelled'))));});
 const task=sockets[0].receive('upload','request',payload,{jobId:'job',accountId:account.id});await vi.waitFor(()=>expect(uploadSignal).toBeDefined());sockets[0].close();await vi.advanceTimersByTimeAsync(1000);sockets[1].onopen?.();await sockets[1].receive('hello-ok','hello',{pendingUploadIds:[]});await task;expect(uploadSignal!.aborted).toBe(true);expect(sockets[1].sent.some(m=>m.type==='upload-result')).toBe(false);
});
it('uses verified tab selection for uploads while page adapter still enforces account identity',async()=>{
 let reads=0;const {sockets}=await setup(async()=>{reads++;return account;});await sockets[0].receive('upload','request',payload,{jobId:'job',accountId:account.id});expect(reads).toBe(1);expect(sockets[0].sent.at(-1).type).toBe('upload-result');
});
it('replays a completed result whose acknowledgement was lost, without uploading twice',async()=>{
 vi.useFakeTimers();let calls=0;const {sockets}=await setup(async()=>account,async()=>{calls++;return 'https://mmbiz.qpic.cn/done';});await sockets[0].receive('upload','unacked',payload,{jobId:'job',accountId:account.id});sockets[0].close();await vi.advanceTimersByTimeAsync(1000);sockets[1].onopen?.();await sockets[1].receive('hello-ok','hello',{pendingUploadIds:['unacked']});expect(sockets[1].sent.filter(m=>m.type==='upload-result')).toHaveLength(1);expect(calls).toBe(1);
});

import {it,expect,vi,afterEach} from 'vitest';
import {ExtensionConnection} from '../src/connection';
afterEach(()=>vi.useRealTimers());
class Socket {
 readyState=1;onopen:(()=>void)|null=null;onclose:(()=>void)|null=null;onmessage:((e:{data:string})=>void)|null=null;onerror:(()=>void)|null=null;sent:string[]=[];
 send(s:string){this.sent.push(s)}close(){this.readyState=3;this.onclose?.()}
}
async function authenticate(s:Socket){s.onopen?.();await s.onmessage?.({data:JSON.stringify({version:1,type:'hello-ok',requestId:'hello',payload:{}})});}
it('accountCheckReadsPageEvenWhenNoImagesUpload',async()=>{
 const s=new Socket();let id='first';const c=new ExtensionConnection({load:async()=>({endpoint:'ws://127.0.0.1:17836',token:'a'.repeat(64),tabId:1}),socket:()=>s as any,readAccount:async()=>({id,name:id}),upload:async()=>'',status:()=>{}});
 await c.restore();await authenticate(s);id='second';await s.onmessage?.({data:JSON.stringify({version:1,type:'account-check',requestId:'fresh',payload:{}})});expect(JSON.parse(s.sent.at(-1)!)).toMatchObject({type:'account',requestId:'fresh',payload:{account:{id:'second'}}});c.stop();
});
it('workerRestartRestoresPairing',async()=>{
 const sockets:Socket[]=[];const options={load:async()=>({endpoint:'ws://127.0.0.1:17836',token:'a'.repeat(64),tabId:1}),socket:()=>{const s=new Socket();sockets.push(s);return s as any},readAccount:async()=>({id:'gh_test',name:'测试号'}),upload:async()=>'',status:()=>{}};
 const first=new ExtensionConnection(options);await first.restore();await authenticate(sockets[0]);expect(JSON.parse(sockets[0].sent[0])).toMatchObject({type:'hello',payload:{account:null}});first.stop();
 const second=new ExtensionConnection(options);await second.restore();await authenticate(sockets[1]);expect(JSON.parse(sockets[1].sent.at(-1)!)).toMatchObject({type:'account',payload:{account:{id:'gh_test'}}});second.stop();
});
it('heartbeatEvery20Seconds',async()=>{
 vi.useFakeTimers();const s=new Socket();const c=new ExtensionConnection({load:async()=>({endpoint:'ws://127.0.0.1:17836',token:'a'.repeat(64),tabId:1}),socket:()=>s as any,readAccount:async()=>({id:'gh_test',name:'测试号'}),upload:async()=>'',status:()=>{}});
 await c.restore();await authenticate(s);await vi.advanceTimersByTimeAsync(20000);expect(s.sent.map(x=>JSON.parse(x).type)).toContain('ping');c.stop();const count=s.sent.length;await vi.advanceTimersByTimeAsync(40000);expect(s.sent).toHaveLength(count);
});
it('restoringActiveWorkerKeepsConnectionAndTask',async()=>{const sockets:Socket[]=[];const c=new ExtensionConnection({load:async()=>({endpoint:'ws://127.0.0.1:17836',token:'a'.repeat(64),tabId:1}),socket:()=>{const s=new Socket();sockets.push(s);return s as any},readAccount:async()=>({id:'gh_test',name:'测试号'}),upload:async()=>'',status:()=>{}});await c.restore();await c.restore();expect(sockets).toHaveLength(1);expect(sockets[0].readyState).toBe(1);c.stop();});

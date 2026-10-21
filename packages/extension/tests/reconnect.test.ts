import {it,expect,vi,afterEach} from 'vitest';
import {ExtensionConnection} from '../src/connection';
class Socket {
 readyState=1;sent:any[]=[];onopen:any;onclose:any;onmessage:any;onerror:any;
 send(raw:string){this.sent.push(JSON.parse(raw));}close(code=1000){this.readyState=3;this.onclose?.({code});}
}
const pairing={endpoint:'ws://127.0.0.1:17836',token:'a'.repeat(64),tabId:4};
afterEach(()=>vi.useRealTimers());
it('authenticates before a slow WeChat page returns',async()=>{
 const s=new Socket();const c=new ExtensionConnection({load:async()=>pairing,socket:()=>s as any,readAccount:()=>new Promise(()=>{}),upload:async()=>'',status:()=>{}});
 await c.restore();void s.onopen();expect(s.sent[0]).toMatchObject({type:'hello',payload:{account:null}});c.stop();
});
it('reconnects an open socket when pong stops arriving',async()=>{
 vi.useFakeTimers();const sockets:Socket[]=[];const c=new ExtensionConnection({load:async()=>pairing,socket:()=>{const s=new Socket();sockets.push(s);return s as any},readAccount:async()=>({id:'a',name:'a'}),upload:async()=>'',status:()=>{}});
 await c.restore();sockets[0].onopen();await sockets[0].onmessage({data:JSON.stringify({version:1,type:'hello-ok',requestId:'hello',payload:{}})});
 await vi.advanceTimersByTimeAsync(65000);expect(sockets.length).toBeGreaterThan(1);c.stop();
});
it('times out a socket stuck in CONNECTING',async()=>{
 vi.useFakeTimers();const sockets:Socket[]=[];const c=new ExtensionConnection({load:async()=>pairing,socket:()=>{const s=new Socket();s.readyState=0;sockets.push(s);return s as any},readAccount:async()=>({id:'a',name:'a'}),upload:async()=>'',status:()=>{}});
 await c.restore();await vi.advanceTimersByTimeAsync(16000);expect(sockets.length).toBeGreaterThan(1);c.stop();
});
it('superseded and revoked clients do not fight the active browser',async()=>{
 vi.useFakeTimers();const s=new Socket();let sockets=0;const c=new ExtensionConnection({load:async()=>pairing,socket:()=>{sockets++;return s as any},readAccount:async()=>({id:'a',name:'a'}),upload:async()=>'',status:()=>{}});
 await c.restore();s.close(4003);await vi.advanceTimersByTimeAsync(60000);await c.restore();expect(sockets).toBe(1);c.stop();
});
it('does not publish account state from an earlier connection',async()=>{
 const releases:Array<(v:any)=>void>=[],sockets:Socket[]=[];const c=new ExtensionConnection({load:async()=>pairing,socket:()=>{const s=new Socket();sockets.push(s);return s as any},readAccount:()=>new Promise(r=>releases.push(r)),upload:async()=>'',status:()=>{}});
 const hello={data:JSON.stringify({version:1,type:'hello-ok',requestId:'hello',payload:{}})};
 await c.restore();sockets[0].onopen();const first=sockets[0].onmessage(hello);await c.restore(true);sockets[1].onopen();const second=sockets[1].onmessage(hello);
 releases[0]({id:'stale',name:'stale'});await first;expect(sockets[1].sent.filter(m=>m.type==='account')).toHaveLength(0);
 releases[1]({id:'fresh',name:'fresh'});await second;expect(sockets[1].sent.at(-1)).toMatchObject({type:'account',payload:{account:{id:'fresh'}}});c.stop();
});

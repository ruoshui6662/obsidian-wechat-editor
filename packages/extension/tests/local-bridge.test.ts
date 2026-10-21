import {it,expect} from 'vitest';
import {discoverBridges,locatePairing,requestPairing} from '../src/local-bridge';
class Socket {
 readyState=0;onopen:any;onmessage:any;onclose:any;onerror:any;sent:any[]=[];
 constructor(private id:string){queueMicrotask(()=>{this.readyState=1;this.onopen?.()})}
 send(raw:string){const m=JSON.parse(raw);this.sent.push(m);queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({version:1,requestId:m.requestId,type:m.type==='discover'?'discovery':'pair-granted',payload:m.type==='discover'?{product:'wechat-layout',bridgeId:this.id,name:this.id}:{bridgeId:this.id,name:this.id,token:'a'.repeat(64)}})}))}
 close(){this.readyState=3;this.onclose?.({code:1000})}
}
it('finds the same vault after its port changes without choosing another vault',async()=>{
 const factory=(url:string)=>new Socket(url.endsWith('17836')?'test-vault':'main-vault') as any;
 const found=await discoverBridges(factory,['ws://127.0.0.1:17836','ws://127.0.0.1:17837']);expect(found).toHaveLength(2);
 const pairing=await locatePairing({endpoint:'ws://127.0.0.1:17836',bridgeId:'main-vault',token:'b'.repeat(64)},factory,['ws://127.0.0.1:17836','ws://127.0.0.1:17837']);expect(pairing.endpoint).toBe('ws://127.0.0.1:17837');expect(pairing.token).toBe('b'.repeat(64));
});
it('does not send an existing token during discovery',async()=>{
 const sockets:Socket[]=[];await discoverBridges(()=>{const s=new Socket('main');sockets.push(s);return s as any},['ws://127.0.0.1:17836']);expect(sockets.flatMap(s=>s.sent)).toEqual([expect.objectContaining({type:'discover',payload:{}})]);
});
it('transfers the granted credential without copied text',async()=>{
 const result=await requestPairing({endpoint:'ws://127.0.0.1:17836',bridgeId:'main',name:'main'},'client',()=>new Socket('main') as any,()=>{},new AbortController().signal);expect(result).toMatchObject({bridgeId:'main',clientId:'client',token:'a'.repeat(64)});
});

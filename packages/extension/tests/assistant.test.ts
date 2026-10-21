import {it,expect,vi} from 'vitest';
import {AssistantController} from '../src/assistant';
function setup(initial:Record<string,any>={}){
 const data={...initial},restore=vi.fn(async()=>{}),stop=vi.fn(),publish=vi.fn();
 const controller=new AssistantController({store:{get:async()=>({...data}),set:async value=>{Object.assign(data,value)},remove:async key=>{delete data[key]}},connection:{restore,stop,refreshAccount:async()=>{}},discover:async()=>[{endpoint:'ws://127.0.0.1:17836',bridgeId:'main',name:'主库'}],pair:async(b,id)=>({...b,clientId:id,token:'a'.repeat(64)}),publish});return{controller,data,restore,stop,publish};
}
it('paused automatic connections stay paused after worker restart',async()=>{const s=setup({paused:true,pairing:{token:'secret'}});await s.controller.initialize();expect(s.restore).not.toHaveBeenCalled();expect(s.controller.snapshot.phase).toBe('paused');});
it('stores granted credentials while keeping them out of popup status',async()=>{const s=setup();await s.controller.initialize();await s.controller.connect();expect(s.data.pairing.token).toBe('a'.repeat(64));expect(JSON.stringify(s.controller.snapshot)).not.toContain('a'.repeat(64));expect(s.restore).toHaveBeenCalledWith(true);});
it('unlinking clears remembered authorization and stops restoration',async()=>{const s=setup({pairing:{token:'secret'}});await s.controller.initialize();await s.controller.unlink();expect(s.data.pairing).toBeUndefined();expect(s.stop).toHaveBeenCalled();expect(s.controller.snapshot.phase).toBe('idle');});
it('pause wins over a granted-credential write already in progress',async()=>{
 let finish!:()=>void,started!:()=>void;const writing=new Promise<void>(r=>started=r),data:Record<string,any>={};let block=true;
 const c=new AssistantController({store:{get:async()=>({...data}),set:async v=>{if(v.pairing&&block){started();await new Promise<void>(r=>finish=r);block=false;}Object.assign(data,v)},remove:async k=>{delete data[k]}},connection:{restore:async()=>{},stop:()=>{},refreshAccount:async()=>{}},discover:async()=>[{endpoint:'ws://127.0.0.1:17836',bridgeId:'main',name:'主库'}],pair:async(b,id)=>({...b,clientId:id,token:'a'.repeat(64)}),publish:()=>{}});
 const connecting=c.connect();await writing;const pausing=c.pause();finish();await Promise.all([connecting,pausing]);expect(data.paused).toBe(true);expect(c.snapshot.phase).toBe('paused');
});
it('late authenticated metadata cannot restore an unlinked credential',async()=>{
 const s=setup({pairing:{endpoint:'ws://127.0.0.1:17836',token:'a'.repeat(64)}});await s.controller.initialize();await s.controller.unlink();await s.controller.remember({endpoint:'ws://127.0.0.1:17837',token:'a'.repeat(64),bridgeId:'main'});expect(s.data.pairing).toBeUndefined();
});
it('retry does not reopen a connection after a concurrent pause',async()=>{
 let release!:()=>void,writing!:()=>void;const started=new Promise<void>(r=>writing=r),data:Record<string,any>={pairing:{token:'saved'},paused:true},restore=vi.fn(async()=>{});
 const c=new AssistantController({store:{get:async()=>({...data}),set:async v=>{if(v.paused===false){writing();await new Promise<void>(r=>release=r);}Object.assign(data,v)},remove:async k=>{delete data[k]}},connection:{restore,stop:()=>{},refreshAccount:async()=>{}},discover:async()=>[],pair:async()=>{throw Error('unused')},publish:()=>{}});
 await c.initialize();const retry=c.retry();await started;const pause=c.pause();release();await Promise.all([retry,pause]);expect(restore).not.toHaveBeenCalled();expect(data.paused).toBe(true);
});
it('background refresh cannot resume after a concurrent pause',async()=>{
 let read!:()=>void,started!:()=>void,save!:()=>void;const pending=new Promise<void>(r=>started=r);let delayed=false;
 const data:Record<string,any>={pairing:{token:'saved'},paused:true},restore=vi.fn(async()=>{});
 const c=new AssistantController({store:{get:async()=>{const snapshot={...data};if(delayed){started();await new Promise<void>(r=>read=r);}return snapshot;},set:async v=>{await new Promise<void>(r=>save=r);Object.assign(data,v)},remove:async()=>{}},connection:{restore,stop:()=>{},refreshAccount:async()=>{}},discover:async()=>[],pair:async()=>{throw Error('unused')},publish:()=>{}});
 await c.initialize();data.paused=false;delayed=true;const refreshing=c.refresh();await pending;const pausing=c.pause();await Promise.resolve();read();await refreshing;save();await pausing;expect(restore).not.toHaveBeenCalled();
});
it('preserves recent connection diagnostics across worker restart without trusting stale login state',async()=>{
 const s=setup({paused:true,pairing:{name:'主库'},assistantState:{connectedAt:100,lastDisconnect:'心跳超时',disconnectedAt:200,phase:'connected',account:{id:'stale',name:'旧号'}}});await s.controller.initialize();expect(s.controller.snapshot).toMatchObject({phase:'paused',account:null,connectedAt:100,lastDisconnect:'心跳超时',disconnectedAt:200});
});

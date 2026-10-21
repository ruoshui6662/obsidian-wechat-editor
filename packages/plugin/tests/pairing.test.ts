import {it,expect,afterEach} from 'vitest';
import {WebSocket} from 'ws';
import {BridgeServer} from '../src/bridge';
const origin='chrome-extension://'+'a'.repeat(32),servers:BridgeServer[]=[],clients:WebSocket[]=[];
afterEach(async()=>{clients.forEach(s=>s.terminate());for(const s of servers)await s.stop();servers.length=0;clients.length=0;});
async function start(options:any={}){const server=new BridgeServer({portStart:0,portEnd:0,bridgeId:'vault-one',name:'主库',...options});servers.push(server);return{server,...await server.start()};}
async function open(endpoint:string,clientOrigin=origin){const s=new WebSocket(endpoint,{origin:clientOrigin});clients.push(s);await new Promise<void>((r,j)=>{s.once('open',r);s.once('error',j)});return s;}
function next(s:WebSocket){return new Promise<any>(r=>s.once('message',raw=>r(JSON.parse(String(raw)))));}
const send=(s:WebSocket,type:string,payload:any)=>s.send(JSON.stringify({version:1,type,requestId:'request-1',payload}));
it('discovers a vault without disclosing a token or accessing WeChat',async()=>{
 const info=await start();const s=await open(info.endpoint);const result=next(s);send(s,'discover',{});expect(await result).toMatchObject({type:'discovery',payload:{bridgeId:'vault-one',name:'主库'}});expect(JSON.stringify(await Promise.resolve(info.server.getPublicInfo()))).not.toContain(info.pairingToken);
});
it('grants a credential only after desktop approval and authenticates it',async()=>{
 let approve!:(v:boolean)=>void;const info=await start({requestPairing:()=>new Promise<boolean>(r=>approve=r)});const s=await open(info.endpoint);
 const waiting=next(s);send(s,'pair-request',{bridgeId:'vault-one',clientId:'browser-one',name:'浏览器助手'});expect((await waiting).type).toBe('pair-waiting');expect(info.server.getInfo().pairingToken).toBe(info.pairingToken);
 const granted=next(s);approve(true);const m=await granted;expect(m.type).toBe('pair-granted');expect(m.payload.token).toMatch(/^[a-f0-9]{64}$/);
 const client=await open(info.endpoint);const hello=next(client);send(client,'hello',{token:m.payload.token,account:null,clientId:'browser-one'});expect((await hello).type).toBe('hello-ok');expect(info.server.isConnected()).toBe(true);
});
it('denial does not rotate or reveal the existing secret',async()=>{
 const info=await start({requestPairing:async()=>false});const s=await open(info.endpoint);const messages:any[]=[];s.on('message',raw=>messages.push(JSON.parse(String(raw))));const closed=new Promise<void>(r=>s.once('close',()=>r()));send(s,'pair-request',{bridgeId:'vault-one',clientId:'browser-one',name:'助手'});await closed;expect(messages.map(m=>m.type)).not.toContain('pair-granted');expect(info.server.getInfo().pairingToken).toBe(info.pairingToken);
});
it('a closed approval request cannot grant credentials later',async()=>{
 let approve!:(v:boolean)=>void;const info=await start({requestPairing:()=>new Promise<boolean>(r=>approve=r)});const s=await open(info.endpoint);const waiting=next(s);send(s,'pair-request',{bridgeId:'vault-one',clientId:'browser-one',name:'助手'});await waiting;s.close();await new Promise<void>(r=>s.once('close',()=>r()));approve(true);await new Promise(r=>setTimeout(r,20));expect(info.server.getInfo().pairingToken).toBe(info.pairingToken);
});
it('website origins cannot trigger native approval',async()=>{
 let prompts=0;const info=await start({requestPairing:async()=>{prompts++;return true}});const s=await open(info.endpoint,'https://example.com');const closed=new Promise<void>(r=>s.once('close',()=>r()));send(s,'pair-request',{bridgeId:'vault-one',clientId:'browser-one',name:'助手'});await closed;expect(prompts).toBe(0);
});
it('cancellation during persistence restores the previously working credential',async()=>{
 let finish!:()=>void,writing!:()=>void;const started=new Promise<void>(r=>writing=r);let disk='';let writes=0;
 const info=await start({pairingToken:'b'.repeat(64),requestPairing:async()=>true,savePairing:async({token}:{token:string})=>{writes++;if(writes===1){writing();await new Promise<void>(r=>finish=r);}disk=token;}});
 const s=await open(info.endpoint);send(s,'pair-request',{bridgeId:'vault-one',clientId:'browser-one',name:'助手'});await started;s.close();await new Promise<void>(r=>s.once('close',()=>r()));finish();await new Promise(r=>setTimeout(r,20));expect(disk).toBe(info.pairingToken);expect(info.server.getInfo().pairingToken).toBe(info.pairingToken);
});
it('legacy token holders can still connect after native pairing when no client id is supplied',async()=>{
 const info=await start({pairingToken:'b'.repeat(64),clientId:'new-assistant'});const s=await open(info.endpoint);const hello=next(s);send(s,'hello',{token:info.pairingToken,account:null});expect((await hello).type).toBe('hello-ok');
});
it('stopping stops accepting connections before a pending save finishes',async()=>{
 let finish!:()=>void,writing!:()=>void;const started=new Promise<void>(r=>writing=r);let writes=0;
 const info=await start({requestPairing:async()=>true,savePairing:async()=>{if(++writes===1){writing();await new Promise<void>(r=>finish=r);}}});
 const s=await open(info.endpoint);send(s,'pair-request',{bridgeId:'vault-one',clientId:'browser-one',name:'助手'});await started;const stopping=info.server.stop();let accepted=false;
 try{const late=await open(info.endpoint);accepted=true;late.terminate();}catch{}finally{finish();await stopping;}expect(accepted).toBe(false);
});
it('concurrent stop callers both wait for pending authorization cleanup',async()=>{
 let finish!:()=>void,writing!:()=>void;const started=new Promise<void>(r=>writing=r);let writes=0;
 const info=await start({requestPairing:async()=>true,savePairing:async()=>{if(++writes===1){writing();await new Promise<void>(r=>finish=r);}}});const s=await open(info.endpoint);send(s,'pair-request',{bridgeId:'vault-one',clientId:'browser-one',name:'助手'});await started;
 const first=info.server.stop();let secondDone=false;const second=info.server.stop().then(()=>secondDone=true);await Promise.resolve();const wasDone=secondDone;finish();await Promise.all([first,second]);expect(wasDone).toBe(false);
});

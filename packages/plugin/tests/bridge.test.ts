import {afterEach,describe,it,expect} from 'vitest';
import {WebSocket} from 'ws';
import {createServer} from 'node:net';
import {BridgeServer} from '../src/bridge';
import {testAccount,tinyAsset} from '../../../tests/helpers/fakes';
const origin='chrome-extension://'+'a'.repeat(32);const servers:BridgeServer[]=[];const clients:WebSocket[]=[];
afterEach(async()=>{for(const c of clients)c.terminate();for(const s of servers)await s.stop();clients.length=0;servers.length=0;});
async function start(){const server=new BridgeServer({portStart:0,portEnd:0});servers.push(server);const info=await server.start();return {server,...info};}
async function connect(endpoint:string,token:string,clientOrigin=origin){const socket=new WebSocket(endpoint,{origin:clientOrigin});clients.push(socket);await new Promise<void>((r,j)=>{socket.once('open',r);socket.once('error',j)});socket.send(JSON.stringify({version:1,type:'hello',requestId:'hello',payload:{token,account:testAccount}}));return socket;}
async function message(s:WebSocket){return new Promise<any>((r,j)=>{s.once('message',b=>r(JSON.parse(b.toString())));s.once('error',j);});}
describe('local bridge',()=>{
 it('accountCheckWaitsForCorrelatedFreshBrowserResponse',async()=>{const info=await start();const s=await connect(info.endpoint,info.pairingToken);await message(s);const incoming=message(s);const task=info.server.verifyAccount(testAccount,new AbortController().signal);const assertion=expect(task).rejects.toMatchObject({code:'account-changed'});const m=await incoming;expect(m.type).toBe('account-check');s.send(JSON.stringify({version:1,type:'account',requestId:m.requestId,payload:{account:{id:'other',name:'其他公众号'}}}));await assertion;});
 it('fallsBackWhen17836IsBusy',async()=>{
  const busy=createServer();await new Promise<void>(r=>busy.listen(0,'127.0.0.1',r));const port=(busy.address() as any).port;
  const server=new BridgeServer({portStart:port,portEnd:port+1});servers.push(server);try{const info=await server.start();expect(info.endpoint).toBe(`ws://127.0.0.1:${port+1}`);}finally{await new Promise<void>(r=>busy.close(()=>r()));}
 });
 it('rejectsWrongTokenOrOrigin',async()=>{
  const info=await start();const s=await connect(info.endpoint,'wrong');await new Promise<void>(r=>s.once('close',()=>r()));expect(info.server.getAccount()).toBeNull();
  const other=await connect(info.endpoint,info.pairingToken,'https://example.com');await new Promise<void>(r=>other.once('close',()=>r()));expect(info.server.getAccount()).toBeNull();
 });
 it('lateResponseCannotResolveAnotherJob',async()=>{
  const info=await start();const s=await connect(info.endpoint,info.pairingToken);await message(s);
  const request=message(s);const task=info.server.upload(tinyAsset(),testAccount,new AbortController().signal,'job');const m=await request;
  s.send(JSON.stringify({version:1,type:'upload-result',requestId:'unknown',jobId:m.jobId,accountId:testAccount.id,payload:{key:m.payload.key,url:'https://mmbiz.qpic.cn/wrong'}}));
  s.send(JSON.stringify({version:1,type:'upload-result',requestId:m.requestId,jobId:m.jobId,accountId:testAccount.id,payload:{key:m.payload.key,url:'https://mmbiz.qpic.cn/right'}}));
  await expect(task).resolves.toBe('https://mmbiz.qpic.cn/right');
 });
 it('disconnectRejectsPendingUploads',async()=>{
  const info=await start();const s=await connect(info.endpoint,info.pairingToken);await message(s);const request=message(s);const task=info.server.upload(tinyAsset(),testAccount,new AbortController().signal);const assertion=expect(task).rejects.toMatchObject({code:'bridge-disconnected'});await request;s.close();await assertion;
 });
 it('stopReleasesPortAndTimers',async()=>{const info=await start();const port=Number(new URL(info.endpoint).port);await info.server.stop();const s=createServer();await new Promise<void>((r,j)=>s.once('error',j).listen(port,'127.0.0.1',r));await new Promise<void>(r=>s.close(()=>r()));});
 it('rejectsOversizedAndInvalidPayload',async()=>{const info=await start();const s=await connect(info.endpoint,info.pairingToken);await message(s);s.send(JSON.stringify({version:1,type:'account',requestId:'bad',payload:{id:42}}));await new Promise<void>(r=>s.once('close',()=>r()));expect(info.server.getAccount()).toBeNull();});
});

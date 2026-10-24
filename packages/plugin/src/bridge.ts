import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import type { Account, PreparedAsset } from '../../core/src/types';
import { LayoutError } from '../../core/src/types';
import { MAX_MESSAGE_BYTES, parseMessage, type BridgeMessage } from '../../core/src/protocol';
import { digest } from './vault-assets';
export interface PairingRequest {name:string;origin:string;signal:AbortSignal}
interface BridgeOptions {portStart?:number;portEnd?:number;pairingToken?:string;origin?:string;bridgeId?:string;name?:string;clientId?:string;requestPairing?:(request:PairingRequest)=>Promise<boolean>;savePairing?:(credentials:{token:string;origin?:string;clientId?:string})=>Promise<void>;onChange?:()=>void}
interface Pending {accountId:string;jobId:string;key:string;finish:(error:Error|null,url?:string)=>void}
export class BridgeServer {
 private server:WebSocketServer|null=null;private peer:WebSocket|null=null;private account:Account|null=null;private pending=new Map<string,Pending>();
 private token:string;private origin?:string;private endpoint='';private clientId?:string;private bridgeId:string;private pairing:AbortController|null=null;private lastPairing=0;private tasks=new Set<Promise<void>>();private stopping=false;private stopTask:Promise<void>|null=null;
 private sessionId?:string;private recoveryTimer:ReturnType<typeof setTimeout>|null=null;private waiting=new Set<(error?:Error)=>void>();
 private accountChecks=new Map<string,{finish:(error:Error|null)=>void;send:()=>void}>();
 constructor(private options:BridgeOptions={}){this.token=options.pairingToken||randomBytes(32).toString('hex');this.origin=options.origin;this.clientId=options.clientId;this.bridgeId=options.bridgeId||randomUUID();}
 async start():Promise<{endpoint:string;pairingToken:string}>{
  if(this.stopping)throw new LayoutError('bridge-stopping','连接服务正在停止，请稍后重试。');
  if(this.server)return{endpoint:this.endpoint,pairingToken:this.token};
  let last:unknown;
  for(let port=this.options.portStart??17836;port<=(this.options.portEnd??17845);port++){
   const s=new WebSocketServer({port,host:'127.0.0.1',maxPayload:MAX_MESSAGE_BYTES});
   try{await new Promise<void>((r,j)=>{s.once('listening',r);s.once('error',j)});this.server=s;this.endpoint=`ws://127.0.0.1:${(s.address() as AddressInfo).port}`;s.on('error',()=>this.disconnect());s.on('connection',(socket,req)=>this.accept(socket,req.headers.origin));return{endpoint:this.endpoint,pairingToken:this.token};}
   catch(e){last=e;s.close();if((e as NodeJS.ErrnoException).code!=='EADDRINUSE')break;}
  }
  throw new LayoutError('bridge-start',`本地连接服务无法启动：${(last as Error)?.message??'端口不可用'}`);
 }
 getPublicInfo(){return{product:'wechat-layout',bridgeId:this.bridgeId,name:(this.options.name||'Obsidian').slice(0,80)};}
 isConnected(){return this.peer?.readyState===WebSocket.OPEN;}
 getAccount():Account|null{return this.account?{...this.account}:null;}
 getOrigin():string|undefined{return this.origin;}
 getInfo(){return{endpoint:this.endpoint,pairingToken:this.token,origin:this.origin};}
 private accept(socket:WebSocket,origin?:string):void{
  if(this.stopping){socket.terminate();return;}
  let authenticated=false,pairingStarted=false;const approval=new AbortController();
  let timer:ReturnType<typeof setTimeout>;const deadline=(ms:number)=>{clearTimeout(timer);timer=setTimeout(()=>{approval.abort();socket.close(1008,'连接超时');},ms);timer.unref?.();};deadline(5000);
  const validOrigin=!!origin&&/^chrome-extension:\/\/[a-p]{32}$/.test(origin);
  socket.on('error',()=>{});
  socket.on('message',data=>{
   const task=(async()=>{
    try{
     if(!validOrigin||(!authenticated&&Buffer.byteLength(data.toString())>8192)){socket.close(1008,'来源无效');return;}
     const m=parseMessage(data.toString());
     if(!authenticated){
      if(pairingStarted)return;
      if(m.type==='discover'){this.send(socket,{version:1,type:'discovery',requestId:m.requestId,payload:this.getPublicInfo()});socket.close(1000);return;}
      if(m.type==='pair-request'){
       if(m.payload.bridgeId!==this.bridgeId||!this.options.requestPairing||this.pairing||Date.now()-this.lastPairing<5000){socket.close(4004,'请稍后重试连接');return;}
       pairingStarted=true;this.pairing=approval;this.lastPairing=Date.now();deadline(90000);
       this.send(socket,{version:1,type:'pair-waiting',requestId:m.requestId,payload:{}});
       try{
        const allowed=await this.options.requestPairing({name:m.payload.name,origin:origin!,signal:approval.signal});
        if(approval.signal.aborted||socket.readyState!==WebSocket.OPEN)return;
        if(!allowed){this.send(socket,{version:1,type:'pair-denied',requestId:m.requestId,payload:{}});socket.close(4004,'已取消连接');return;}
        const token=randomBytes(32).toString('hex'),previous={token:this.token,origin:this.origin,clientId:this.clientId};
        try{await this.options.savePairing?.({token,origin:origin!,clientId:m.payload.clientId});}
        catch(error){await this.options.savePairing?.(previous);throw error;}
        if(approval.signal.aborted||socket.readyState!==WebSocket.OPEN){await this.options.savePairing?.(previous);return;}
        this.token=token;this.origin=origin;this.clientId=m.payload.clientId;
        const old=this.peer;if(old){this.disconnect();old.close(4003,'连接已由其他助手接管');}
        this.send(socket,{version:1,type:'pair-granted',requestId:m.requestId,payload:{...this.getPublicInfo(),token}});this.options.onChange?.();socket.close(1000);
       }finally{if(this.pairing===approval)this.pairing=null;}
       return;
      }
      const candidate=typeof m.payload.token==='string'?Buffer.from(m.payload.token):Buffer.alloc(0),actual=Buffer.from(this.token);
      if(m.type!=='hello'||(this.origin&&origin!==this.origin)||(this.clientId&&m.payload.clientId!==undefined&&m.payload.clientId!==this.clientId)||candidate.length!==actual.length||!timingSafeEqual(candidate,actual)){socket.close(4003,'需要重新允许连接');return;}
      clearTimeout(timer);authenticated=true;
      const resuming=!!(this.recoveryTimer||this.peer)&&!!m.payload.sessionId&&m.payload.sessionId===this.sessionId;
      if(this.recoveryTimer){clearTimeout(this.recoveryTimer);this.recoveryTimer=null;if(!resuming){this.rejectPending(new LayoutError('bridge-restarted','图片助手已重启，本次上传结果待确认，请重新复制。'));this.account=null;}}
      if(this.peer){const old=this.peer;if(resuming){this.peer=null;old.close(4000,'同一助手恢复连接');}else{this.disconnect();old.close(4003,'旧连接已替换');}}
      this.origin=origin;this.peer=socket;this.sessionId=m.payload.sessionId;if(!resuming)this.account=m.payload.account;this.send(socket,{version:1,type:'hello-ok',requestId:m.requestId,payload:{...this.getPublicInfo(),pendingUploadIds:[...this.pending.keys()]}});for(const check of this.accountChecks.values())check.send();for(const ready of [...this.waiting])ready();this.options.onChange?.();return;
     }
     if(socket!==this.peer)return;
     if(m.type==='ping'){this.send(socket,{version:1,type:'pong',requestId:m.requestId,payload:{}});return;}
     if(m.type==='account'){
      if(m.payload.unavailable===true){this.accountChecks.get(m.requestId)?.finish(new LayoutError('account-unavailable','暂时无法核对微信登录，请检查后台后重试。'));return;}
      if(m.payload.account?.id!==this.account?.id)this.rejectPending(new LayoutError('account-changed','浏览器中的公众号已变化，请重新复制。'));
      this.account=m.payload.account;this.accountChecks.get(m.requestId)?.finish(null);this.options.onChange?.();return;
     }
     const p=this.pending.get(m.requestId);if(!p)return;
     if(m.jobId!==p.jobId||m.accountId!==p.accountId)throw Error('任务或账号不匹配');
     if(m.type==='error'){p.finish(new LayoutError(m.payload.code,m.payload.message));if(this.sessionId)this.send(socket,{version:1,type:'upload-ack',requestId:m.requestId,payload:{}});}
     else if(m.type==='upload-result'){if(m.payload.key!==p.key)throw Error('图片不匹配');p.finish(null,m.payload.url);if(this.sessionId)this.send(socket,{version:1,type:'upload-ack',requestId:m.requestId,payload:{}});}
    }catch{socket.close(1008,'消息无效');}
   })();this.tasks.add(task);void task.finally(()=>this.tasks.delete(task));
  });
  socket.on('close',code=>{clearTimeout(timer);approval.abort();if(this.peer===socket){if(this.sessionId&&!this.stopping&&![1008,4001,4003].includes(code))this.suspend();else this.disconnect();}});
 }
 private send(socket:WebSocket,m:BridgeMessage){socket.send(JSON.stringify(m));}
 private rejectPending(error:Error){for(const p of [...this.pending.values()])p.finish(error);for(const p of [...this.accountChecks.values()])p.finish(error);}
 private suspend(){this.peer=null;this.recoveryTimer=setTimeout(()=>{this.recoveryTimer=null;this.disconnect();},15000);this.recoveryTimer.unref?.();this.options.onChange?.();}
 private ready(signal:AbortSignal):Promise<void>{
  if(signal.aborted)return Promise.reject(new LayoutError('cancelled','已取消本次复制。'));if(this.isConnected())return Promise.resolve();
  if(!this.recoveryTimer)return Promise.reject(new LayoutError('bridge-disconnected','请先连接浏览器图片助手。'));
  return new Promise((resolve,reject)=>{const finish=(error?:Error)=>{this.waiting.delete(finish);signal.removeEventListener('abort',abort);error?reject(error):resolve();};const abort=()=>finish(new LayoutError('cancelled','已取消本次复制。'));this.waiting.add(finish);signal.addEventListener('abort',abort,{once:true});});
 }
 private disconnect(){if(this.recoveryTimer)clearTimeout(this.recoveryTimer);this.recoveryTimer=null;this.peer=null;this.account=null;this.sessionId=undefined;for(const ready of [...this.waiting])ready(new LayoutError('bridge-disconnected','本机连接未能恢复，请重新复制。'));this.rejectPending(new LayoutError('bridge-disconnected','浏览器扩展连接已断开，请连接后重试。'));this.options.onChange?.();}
 async verifyAccount(expected:Account,signal:AbortSignal):Promise<void>{
  await this.ready(signal);
  const socket=this.peer;if(!socket||socket.readyState!==WebSocket.OPEN)return Promise.reject(new LayoutError('bridge-disconnected','请先连接浏览器图片助手。'));
  if(signal.aborted)return Promise.reject(new LayoutError('cancelled','已取消本次复制。'));
  const requestId=randomUUID();return new Promise((resolve,reject)=>{
   const abort=()=>finish(new LayoutError('cancelled','已取消本次复制。'));
   const timer=setTimeout(()=>finish(new LayoutError('account-timeout','账号核对超时，请检查后台标签页后重试。')),20000);
   const finish=(error:Error|null)=>{if(!this.accountChecks.has(requestId))return;this.accountChecks.delete(requestId);clearTimeout(timer);signal.removeEventListener('abort',abort);if(error)reject(error);else if(this.account?.id!==expected.id)reject(new LayoutError('account-changed','公众号已变化，请重新复制。'));else resolve();};
   const send=()=>{try{if(this.peer?.readyState===WebSocket.OPEN)this.send(this.peer,{version:1,type:'account-check',requestId,payload:{}});}catch(e){finish(e as Error);}};
   this.accountChecks.set(requestId,{finish,send});signal.addEventListener('abort',abort,{once:true});send();
  });
 }
 async upload(asset:PreparedAsset,account:Account,signal:AbortSignal,jobId:string=randomUUID()):Promise<string>{
  await this.ready(signal);
  if(!this.peer||this.peer.readyState!==WebSocket.OPEN||account.id!==this.account?.id)return Promise.reject(new LayoutError('bridge-disconnected','请先连接扩展并确认目标公众号。'));
  if(signal.aborted)return Promise.reject(new LayoutError('cancelled','已取消本次上传。'));
  const socket=this.peer,requestId=randomUUID();
  return new Promise((resolve,reject)=>{
   const cancel=()=>{try{if(this.peer?.readyState===WebSocket.OPEN)this.send(this.peer,{version:1,type:'cancel',requestId,jobId,accountId:account.id,payload:{}});}catch{}};
   const abort=()=>{cancel();finish(new LayoutError('cancelled','已取消本次上传。'));};
   const timer=setTimeout(()=>{cancel();finish(new LayoutError('upload-timeout','图片上传超时，请检查微信后台后重试。'));},120000);
   const finish=(error:Error|null,url?:string)=>{if(!this.pending.has(requestId))return;clearTimeout(timer);signal.removeEventListener('abort',abort);this.pending.delete(requestId);if(error)reject(error);else resolve(url!);};
   this.pending.set(requestId,{accountId:account.id,jobId,key:asset.key,finish});signal.addEventListener('abort',abort,{once:true});
   try{this.send(socket,{version:1,type:'upload',requestId,jobId,accountId:account.id,payload:{key:asset.key,filename:asset.filename,mime:asset.mime,size:asset.bytes.byteLength,sha256:digest(asset.bytes),base64:Buffer.from(asset.bytes).toString('base64')}});}catch(e){finish(e as Error);}
  });
 }
 stop():Promise<void>{
  return this.stopTask??(this.stopTask=this.stopServer().finally(()=>{this.stopping=false;this.stopTask=null;}));
 }
 private async stopServer():Promise<void>{
  this.stopping=true;this.pairing?.abort();this.pairing=null;const server=this.server;this.server=null;this.endpoint='';this.disconnect();
  if(!server)return;
  const closed=new Promise<void>(resolve=>server.close(()=>resolve()));
  for(const client of server.clients)client.terminate();
  await Promise.allSettled([...this.tasks]);await closed;
 }
}

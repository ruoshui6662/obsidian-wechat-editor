import type {Account,PreparedAsset} from '../../core/src/types';
import {LayoutError} from '../../core/src/types';
import {parseMessage,type BridgeMessage} from '../../core/src/protocol';
export interface Pairing {endpoint:string;token:string;tabId?:number;bridgeId?:string;name?:string;clientId?:string}
export interface WechatSession {tabId:number;account:Account}
export interface LinkState {phase:'idle'|'connecting'|'connected'|'reconnecting'|'approval'|'paused';message:string;account:Account|null;wechatMessage:string;name?:string;connectedAt?:number;lastReplyAt?:number;lastDisconnect?:string;disconnectedAt?:number}
interface ConnectionOptions {
 load():Promise<Pairing|null>;socket(url:string):WebSocket;
 readAccount(tabId:number):Promise<Account>;
 resolveSession?():Promise<WechatSession>;
 locate?(pairing:Pairing):Promise<Pairing>;
 save?(pairing:Pairing):Promise<void>;
 upload(tabId:number,asset:PreparedAsset,accountId:string,signal:AbortSignal):Promise<string>;
 status(message:string):void;state?(state:LinkState):void;
}
const bounded=<T>(task:Promise<T>,ms:number,message:string):Promise<T>=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(message)),ms);task.then(v=>{clearTimeout(timer);resolve(v)},e=>{clearTimeout(timer);reject(e)});});
export class ExtensionConnection {
 private socket:WebSocket|null=null;private heartbeat:ReturnType<typeof setInterval>|null=null;private deadline:ReturnType<typeof setTimeout>|null=null;private reconnect:ReturnType<typeof setTimeout>|null=null;
 private generation=0;private uploads=new Map<string,AbortController>();private blocked=false;private attempts=0;private authenticated=false;private startedAt=0;private replyAt=0;private refreshTask:Promise<WechatSession|null>|null=null;
 private state:LinkState={phase:'idle',message:'尚未连接 Obsidian',account:null,wechatMessage:'等待检查公众号后台'};
 constructor(private options:ConnectionOptions){}
 private publish(patch:Partial<LinkState>){this.state={...this.state,...patch};this.options.status(this.state.message);this.options.state?.({...this.state});}
 stop():void {
  this.generation++;if(this.heartbeat)clearInterval(this.heartbeat);if(this.reconnect)clearTimeout(this.reconnect);if(this.deadline)clearTimeout(this.deadline);
  this.heartbeat=null;this.reconnect=null;this.deadline=null;this.authenticated=false;this.refreshTask=null;
  const socket=this.socket;this.socket=null;for(const c of this.uploads.values())c.abort();this.uploads.clear();socket?.close();
 }
 async restore(force=false):Promise<void>{
  if(force){this.blocked=false;this.attempts=0;}
  if(this.blocked)return;
  if(!force&&this.socket&&[0,1].includes(this.socket.readyState)){
   if(Date.now()-(this.authenticated?this.replyAt:this.startedAt)<(this.authenticated?45000:10000))return;
  }else if(!force&&this.reconnect)return;
  this.stop();const generation=this.generation,current=()=>generation===this.generation;
  this.startedAt=Date.now();this.publish({phase:this.attempts?'reconnecting':'connecting',message:'正在连接 Obsidian…',account:null});
  let pairing:Pairing|null;
  try{pairing=await this.options.load();if(!current())return;if(!pairing){this.publish({phase:'idle',message:'点击连接 Obsidian'});return;}if(this.options.locate)pairing=await this.options.locate(pairing);if(!current())return;}
  catch{if(current())this.retry('未找到 Obsidian，请保持笔记库打开');return;}
  let endpoint:URL;try{endpoint=new URL(pairing.endpoint);}catch{this.publish({phase:'approval',message:'连接信息失效，请重新连接'});return;}
  if(endpoint.protocol!=='ws:'||endpoint.hostname!=='127.0.0.1'||!/^\d+$/.test(endpoint.port)||!/^[a-f0-9]{64}$/.test(pairing.token)){this.publish({phase:'approval',message:'连接信息失效，请重新连接'});return;}
  let socket:WebSocket;try{socket=this.options.socket(endpoint.href);}catch{this.retry('无法建立本机连接');return;}
  this.socket=socket;const alive=()=>current()&&this.socket===socket;
  const send=(m:BridgeMessage)=>{if(alive()&&socket.readyState===1)socket.send(JSON.stringify(m));};
  this.deadline=setTimeout(()=>{if(alive())socket.close(4000,'连接超时')},10000);
  const read=async():Promise<WechatSession>=>this.options.resolveSession?this.options.resolveSession():{tabId:pairing!.tabId!,account:await this.options.readAccount(pairing!.tabId!)};
  const refresh=():Promise<WechatSession|null>=>{
   if(this.refreshTask)return this.refreshTask;
   const task=bounded(read(),7000,'后台读取超时，请打开公众号后台').then(session=>{
    if(!alive())return null;
    this.publish({account:session.account,wechatMessage:'后台已就绪'});send({version:1,type:'account',requestId:crypto.randomUUID(),payload:{account:session.account}});return session;
   },error=>{if(alive()){this.publish({account:null,wechatMessage:error instanceof Error?error.message:'请打开已登录的公众号后台'});send({version:1,type:'account',requestId:crypto.randomUUID(),payload:{account:null}});}return null;}).finally(()=>{if(this.refreshTask===task)this.refreshTask=null;});
   this.refreshTask=task;return task;
  };
  this.refresh=()=>this.authenticated&&alive()?refresh():Promise.resolve(null);
  socket.onopen=()=>{
   if(!alive())return;this.replyAt=Date.now();
   send({version:1,type:'hello',requestId:crypto.randomUUID(),payload:{token:pairing!.token,clientId:pairing!.clientId,account:null}});
   this.heartbeat=setInterval(()=>{
    if(!alive())return;if(Date.now()-this.replyAt>45000){socket.close(4000,'心跳超时');return;}
    send({version:1,type:'ping',requestId:crypto.randomUUID(),payload:{}});if(this.authenticated)void refresh();
   },20000);
  };
  socket.onmessage=async event=>{
   if(!alive())return;
   try{
    const m=parseMessage(String(event.data));
    if(m.type==='hello-ok'){
     if(this.authenticated)return;this.authenticated=true;if(this.deadline)clearTimeout(this.deadline);this.attempts=0;this.replyAt=Date.now();
     this.publish({phase:'connected',message:'Obsidian 已连接',name:m.payload.name||pairing!.name,connectedAt:Date.now(),lastReplyAt:this.replyAt,wechatMessage:'正在识别公众号…'});
     if(m.payload.bridgeId){pairing={...pairing!,bridgeId:m.payload.bridgeId,name:m.payload.name};void this.options.save?.(pairing).catch(()=>{});}await refresh();return;
    }
    if(!this.authenticated)return;
    if(m.type==='pong'){this.replyAt=Date.now();this.publish({lastReplyAt:this.replyAt});return;}
    if(m.type==='account-check'){const session=await refresh();send({version:1,type:'account',requestId:m.requestId,payload:{account:session?.account??null}});return;}
    if(m.type==='cancel'){this.uploads.get(m.requestId)?.abort();return;}
    if(m.type!=='upload')return;
    const controller=new AbortController();this.uploads.set(m.requestId,controller);
    try{
     const session=await refresh();if(!alive()||controller.signal.aborted)return;
     if(!session||session.account.id!==m.accountId)throw new LayoutError('account-changed','公众号已变化，请重新复制。');
     const raw=atob(m.payload.base64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
     const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
     if(bytes.length!==m.payload.size||hash!==m.payload.sha256)throw new LayoutError('asset-integrity','图片数据校验失败，请重试。');
     if(!alive()||controller.signal.aborted)return;
     const url=await this.options.upload(session.tabId,{key:m.payload.key,bytes,mime:m.payload.mime,filename:m.payload.filename,occurrenceIds:[]},m.accountId!,controller.signal);
     if(!controller.signal.aborted)send({...m,type:'upload-result',payload:{key:m.payload.key,url}});
    }catch(e){if(!controller.signal.aborted)send({...m,type:'error',payload:{code:e instanceof LayoutError?e.code:'upload-failed',message:e instanceof Error?e.message.slice(0,1000):'上传失败，请重试。'}});}finally{if(this.uploads.get(m.requestId)===controller)this.uploads.delete(m.requestId);}
   }catch{if(alive())socket.close(4003,'消息不兼容，请更新两端插件');}
  };
  socket.onclose=event=>{
   if(!alive())return;this.stop();const revoked=event?.code===4003;
   if(revoked){this.blocked=true;this.publish({phase:'approval',account:null,message:'连接已失效，请点击重新连接',lastDisconnect:'授权失效或连接被替换',disconnectedAt:Date.now()});}
   else this.retry('本机连接中断，正在自动恢复');
  };
  socket.onerror=()=>{if(alive())this.publish({message:'正在等待 Obsidian…'});};
 }
 private retry(reason:string){this.publish({phase:'reconnecting',message:reason,account:null,lastDisconnect:reason,disconnectedAt:Date.now()});const delay=Math.min(15000,1000*2**Math.min(this.attempts++,4));this.reconnect=setTimeout(()=>{this.reconnect=null;void this.restore()},delay);}
 private refresh:()=>Promise<WechatSession|null>=()=>Promise.resolve(null);
 async refreshAccount(){await this.refresh();}
}

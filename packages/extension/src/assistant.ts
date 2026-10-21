import type {LinkState,Pairing} from './connection';
import type {LocalBridge} from './local-bridge';
interface Options {
 store:{get():Promise<Record<string,any>>;set(value:Record<string,any>):Promise<void>;remove(key:string):Promise<void>};
 connection:{restore(force?:boolean):Promise<void>;stop():void;refreshAccount():Promise<void>};
 discover():Promise<LocalBridge[]>;pair(bridge:LocalBridge,clientId:string,waiting:()=>void,signal:AbortSignal):Promise<Pairing>;publish(state:AssistantState):void;
}
export interface AssistantState extends LinkState {candidates?:LocalBridge[];busy?:boolean}
export class AssistantController {
 snapshot:AssistantState={phase:'idle',message:'连接后即可从 Obsidian 复制图文',account:null,wechatMessage:'自动识别已登录的公众号'};
 private pending:AbortController|null=null;private generation=0;private writes:Promise<void>=Promise.resolve();private initialized:Promise<void>|null=null;
 constructor(private options:Options){}
 private write(task:()=>Promise<void>){const next=this.writes.then(task);this.writes=next.catch(()=>{});return next;}
 async remember(pairing:Pairing){await this.write(async()=>{const saved=await this.options.store.get();if(!saved.paused&&saved.pairing?.token===pairing.token)await this.options.store.set({pairing});});}
 private publish(patch:Partial<AssistantState>){this.snapshot={...this.snapshot,...patch};this.options.publish({...this.snapshot});}
 update(state:LinkState){if(!this.pending)this.publish({...state,busy:false,candidates:undefined});}
 initialize(){return this.initialized??(this.initialized=this.load());}
 private async load(){const generation=this.generation,saved=await this.options.store.get();if(generation!==this.generation)return;
  const previous=saved.assistantState;if(previous&&typeof previous==='object'){
   for(const key of ['connectedAt','disconnectedAt'] as const)if(typeof previous[key]==='number'&&Number.isFinite(previous[key]))this.snapshot[key]=previous[key];
   if(typeof previous.lastDisconnect==='string')this.snapshot.lastDisconnect=previous.lastDisconnect.slice(0,200);
  }
  if(saved.paused&&saved.pairing)this.publish({phase:'paused',message:'自动连接已暂停',name:saved.pairing?.name});else if(saved.pairing)await this.options.connection.restore();else this.publish({phase:'idle'});}
 async refresh(){
  const generation=this.generation;await this.initialize();if(generation!==this.generation)return this.snapshot;
  const saved=await this.options.store.get();if(generation!==this.generation)return this.snapshot;
  if(!saved.paused&&!this.pending){await this.options.connection.restore();if(generation===this.generation)await this.options.connection.refreshAccount();}return this.snapshot;
 }
 async connect(bridgeId?:string){
  if(this.pending)return;const generation=++this.generation,controller=new AbortController();this.pending=controller;await this.initialize();if(generation!==this.generation)return;this.options.connection.stop();
  this.publish({phase:'connecting',busy:true,candidates:undefined,message:'正在寻找 Obsidian…',account:null});
  try{
   const found=await this.options.discover();if(generation!==this.generation)return;
   if(!found.length)throw Error('未找到 Obsidian，请打开笔记库并启用排版插件');
   const target=bridgeId?found.find(b=>b.bridgeId===bridgeId):found.length===1?found[0]:undefined;
   if(!target){this.publish({phase:'idle',message:'选择要连接的笔记库',candidates:found});return;}
   let saved=await this.options.store.get();let clientId=saved.clientId;
   if(typeof clientId!=='string'){clientId=crypto.randomUUID();await this.write(()=>this.options.store.set({clientId}));}
   const pairing=await this.options.pair(target,clientId,()=>{if(generation===this.generation)this.publish({phase:'approval',message:'请在 Obsidian 中允许连接',name:target.name})},controller.signal);
   if(generation!==this.generation)return;
   await this.write(async()=>{if(generation===this.generation)await this.options.store.set({pairing,paused:false});});if(generation!==this.generation)return;
   this.pending=null;this.publish({name:target.name,busy:false});await this.options.connection.restore(true);
  }catch(error){if(generation===this.generation)this.publish({phase:'idle',message:error instanceof Error?error.message:'连接失败，请重试'});}
  finally{if(generation===this.generation){this.pending=null;this.publish({busy:false});}}
 }
 async retry(){if(this.pending)return;const generation=++this.generation;await this.initialize();if(generation!==this.generation)return;await this.write(async()=>{if(generation===this.generation)await this.options.store.set({paused:false});});if(generation!==this.generation)return;await this.options.connection.restore(true);if(generation===this.generation)await this.options.connection.refreshAccount();}
 async pause(){this.generation++;this.pending?.abort();this.pending=null;this.options.connection.stop();await this.write(()=>this.options.store.set({paused:true}));this.publish({phase:'paused',message:'自动连接已暂停',account:null,busy:false,candidates:undefined});}
 async unlink(){this.generation++;this.pending?.abort();this.pending=null;this.options.connection.stop();await this.write(()=>this.options.store.set({paused:true}));await this.write(()=>this.options.store.remove('pairing'));this.publish({phase:'idle',message:'已移除此浏览器的连接记录',account:null,name:undefined,busy:false,candidates:undefined});}
}

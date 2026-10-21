import {parseMessage} from '../../core/src/protocol';
import type {Pairing} from './connection';
export interface LocalBridge {endpoint:string;bridgeId:string;name:string}
type SocketFactory=(url:string)=>WebSocket;
const ENDPOINTS=Array.from({length:10},(_,i)=>`ws://127.0.0.1:${17836+i}`);
function checkEndpoint(endpoint:string){const u=new URL(endpoint);if(u.protocol!=='ws:'||u.hostname!=='127.0.0.1'||!u.port||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('无效的本机地址');}
export async function discoverBridges(factory:SocketFactory,endpoints=ENDPOINTS):Promise<LocalBridge[]>{
 const results=await Promise.all(endpoints.map(endpoint=>new Promise<LocalBridge|null>(resolve=>{
  let socket:WebSocket;try{checkEndpoint(endpoint);socket=factory(endpoint);}catch{resolve(null);return;}
  let done=false;const requestId=crypto.randomUUID();const timer=setTimeout(()=>finish(null),1200);
  const finish=(value:LocalBridge|null)=>{if(done)return;done=true;clearTimeout(timer);socket.close();resolve(value);};
  socket.onopen=()=>socket.send(JSON.stringify({version:1,type:'discover',requestId,payload:{}}));
  socket.onmessage=event=>{try{const m=parseMessage(String(event.data));if(m.type!=='discovery'||m.requestId!==requestId)return;finish({endpoint,bridgeId:m.payload.bridgeId,name:m.payload.name});}catch{finish(null)}};
  socket.onerror=()=>finish(null);socket.onclose=()=>finish(null);
 })));
 return results.filter((r):r is LocalBridge=>!!r);
}
export async function locatePairing(pairing:Pairing,factory:SocketFactory,endpoints=ENDPOINTS):Promise<Pairing>{
 checkEndpoint(pairing.endpoint);if(!pairing.bridgeId)return pairing;
 const preferred=await discoverBridges(factory,[pairing.endpoint]);let target=preferred.find(b=>b.bridgeId===pairing.bridgeId);
 if(!target)target=(await discoverBridges(factory,endpoints.filter(e=>e!==pairing.endpoint))).find(b=>b.bridgeId===pairing.bridgeId);
 if(!target)throw Error('请打开已连接的 Obsidian 笔记库');
 return{...pairing,endpoint:target.endpoint,name:target.name};
}
export function requestPairing(bridge:LocalBridge,clientId:string,factory:SocketFactory,waiting:()=>void,signal:AbortSignal):Promise<Pairing>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(Error('已取消连接'));return;}let socket:WebSocket;try{checkEndpoint(bridge.endpoint);socket=factory(bridge.endpoint);}catch(e){reject(e);return;}
  const requestId=crypto.randomUUID();let done=false;let keepalive:ReturnType<typeof setInterval>|undefined;
  const finish=(error?:Error,pairing?:Pairing)=>{if(done)return;done=true;clearTimeout(timer);clearInterval(keepalive);signal.removeEventListener('abort',abort);socket.close();if(error)reject(error);else resolve(pairing!);};
  const timer=setTimeout(()=>finish(Error('连接确认已超时，请重试')),95000),abort=()=>finish(Error('已取消连接'));signal.addEventListener('abort',abort,{once:true});
  socket.onopen=()=>{socket.send(JSON.stringify({version:1,type:'pair-request',requestId,payload:{bridgeId:bridge.bridgeId,clientId,name:'公众号图片助手'}}));keepalive=setInterval(()=>{if(socket.readyState===1)socket.send(JSON.stringify({version:1,type:'ping',requestId:crypto.randomUUID(),payload:{}}))},20000);};
  socket.onmessage=event=>{try{const m=parseMessage(String(event.data));if(m.requestId!==requestId)return;if(m.type==='pair-waiting')waiting();else if(m.type==='pair-denied')finish(Error('已在 Obsidian 取消连接'));else if(m.type==='pair-granted'&&m.payload.bridgeId===bridge.bridgeId)finish(undefined,{endpoint:bridge.endpoint,token:m.payload.token,clientId,bridgeId:bridge.bridgeId,name:m.payload.name});}catch{finish(Error('授权信息无效，请更新两端插件'))}};
  socket.onerror=()=>finish(Error('无法连接 Obsidian，请保持笔记库打开'));socket.onclose=()=>finish(Error('连接未完成，请回到 Obsidian 检查后重试'));
 });
}

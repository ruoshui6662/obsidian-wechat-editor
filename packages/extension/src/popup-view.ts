import type {AssistantState} from './assistant';
interface PopupPort {send(message:Record<string,any>):Promise<any>;diagnostics(text:string):Promise<void>;version?:string}
export function mountPopup(doc:Document,port:PopupPort){
 let current:AssistantState={phase:'idle',message:'正在检查连接…',account:null,wechatMessage:'正在检查后台…'},destroyed=false;
 const byId=<T extends HTMLElement=HTMLElement>(id:string)=>doc.getElementById(id) as T;
 const primary=byId<HTMLButtonElement>('primary');
 const date=(time?:number)=>time?new Date(time).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
 function update(state:AssistantState){
  if(destroyed)return;current=state;const connected=state.phase==='connected',ready=connected&&!!state.account;
  byId('overall').textContent=ready?'可复制图文':connected?'已连接':state.busy?'连接中':state.phase==='paused'?'已暂停':'未连接';byId('overall').classList.toggle('ready',ready);
  byId('obsidian-status').textContent=connected?'已连接':state.busy?'连接中':state.phase==='paused'?'已暂停':state.phase==='reconnecting'?'恢复中':'未连接';byId('obsidian-status').classList.toggle('ready',connected);
  byId('vault-name').textContent=state.name||'本机笔记库';byId('vault-name').title=state.name||'';
  byId('wechat-badge').textContent=ready?'已就绪':'待登录';byId('wechat-badge').classList.toggle('ready',ready);
  byId('account-name').textContent=state.account?.name||'自动跟随已登录后台';byId('wechat-status').textContent=state.wechatMessage;byId('status').textContent=state.message;
  primary.disabled=!!state.busy;primary.textContent=state.busy?(state.phase==='approval'?'等待 Obsidian 确认…':'正在连接…'):connected?(ready?'检查连接':'打开公众号后台'):state.phase==='paused'?'恢复自动连接':'连接 Obsidian';
  byId('connected-at').textContent=date(state.connectedAt);byId('disconnect-reason').textContent=state.lastDisconnect?`${date(state.disconnectedAt)} · ${state.lastDisconnect}`:'—';byId('version').textContent=port.version||'—';
  const choices=byId('vault-choices');choices.replaceChildren();choices.hidden=!state.candidates?.length;
  for(const vault of state.candidates??[]){const button=doc.createElement('button');button.type='button';button.textContent=vault.name;button.addEventListener('click',()=>void action({type:'connect',bridgeId:vault.bridgeId}));choices.append(button);}
  byId<HTMLButtonElement>('retry').disabled=!!state.busy;byId<HTMLButtonElement>('diagnostics').disabled=false;
  byId('pause').textContent=state.phase==='paused'?'恢复自动连接':state.busy?'取消连接':'暂停自动连接';
 }
 async function action(message:Record<string,any>){try{const response=await port.send(message);if(response?.phase)update(response);else if(response?.error)byId('status').textContent=response.error;}catch{byId('status').textContent='操作未完成，请重新打开助手后重试';}}
 const listeners:Array<()=>void>=[];const click=(id:string,fn:()=>void)=>{byId(id).addEventListener('click',fn);listeners.push(()=>byId(id).removeEventListener('click',fn));};
 click('primary',()=>{const type=current.phase==='connected'?(current.account?'state':'open-wechat'):current.phase==='paused'?'retry':'connect';if(type==='connect')primary.disabled=true;void action({type});});
 click('retry',()=>void action({type:'retry'}));click('pause',()=>void action({type:current.phase==='paused'?'retry':'pause'}));click('disconnect',()=>void action({type:'disconnect'}));
 click('diagnostics',()=>{const report={extensionVersion:port.version,phase:current.phase,vault:current.name,message:current.message,wechatStatus:current.wechatMessage,connectedAt:current.connectedAt,lastReplyAt:current.lastReplyAt,lastDisconnect:current.lastDisconnect,disconnectedAt:current.disconnectedAt};void port.diagnostics(JSON.stringify(report,null,2)).then(()=>{byId('status').textContent='诊断已复制，不包含密钥、Cookie 或文章正文'},()=>{byId('status').textContent='复制未完成，请重试'});});
 const ready=action({type:'state'});return{ready,update,destroy:()=>{destroyed=true;listeners.forEach(fn=>fn())}};
}

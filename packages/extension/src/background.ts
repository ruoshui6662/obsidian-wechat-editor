import {ExtensionConnection,type Pairing} from './connection';
import {AssistantController} from './assistant';
import {discoverBridges,locatePairing,requestPairing} from './local-bridge';
import {resolveWechatSession} from './wechat-target';
import {readWechatAccount,uploadWechatImage} from './wechat-adapter';
const socket=(url:string)=>new WebSocket(url);
const connection:ExtensionConnection=new ExtensionConnection({
 load:async()=>{const saved=await chrome.storage.local.get(['pairing','paused']);return saved.paused?null:saved.pairing as Pairing??null;},
 socket,locate:pairing=>locatePairing(pairing,socket),save:pairing=>assistant.remember(pairing),
 readAccount:readWechatAccount,resolveSession:()=>resolveWechatSession({tabs:()=>chrome.tabs.query({url:'https://mp.weixin.qq.com/*'}),focused:()=>chrome.tabs.query({url:'https://mp.weixin.qq.com/*',active:true,lastFocusedWindow:true}),read:readWechatAccount}),
 upload:uploadWechatImage,status:()=>{},state:state=>assistant.update(state),
});
const assistant:AssistantController=new AssistantController({
 store:{get:()=>chrome.storage.local.get(['pairing','paused','clientId','assistantState']),set:value=>chrome.storage.local.set(value),remove:key=>chrome.storage.local.remove(key)},connection,
 discover:()=>discoverBridges(socket),pair:(bridge,id,waiting,signal)=>requestPairing(bridge,id,socket,waiting,signal),
 publish:state=>{void chrome.storage.local.set({assistantState:state});},
});
const initialize=async()=>{if(!await chrome.alarms.get('reconnect'))await chrome.alarms.create('reconnect',{periodInMinutes:1});await assistant.initialize();};
chrome.runtime.onInstalled.addListener(()=>void initialize());
chrome.runtime.onStartup.addListener(()=>void initialize());
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='reconnect')void assistant.refresh();});
let tabRefresh:ReturnType<typeof setTimeout>|undefined;
function refreshTabs(){clearTimeout(tabRefresh);tabRefresh=setTimeout(()=>void assistant.refresh(),500);}
chrome.tabs.onActivated.addListener(refreshTabs);chrome.tabs.onRemoved.addListener(refreshTabs);
chrome.tabs.onUpdated.addListener((_id,change,tab)=>{if((change.status==='complete'||change.url)&&tab.url?.startsWith('https://mp.weixin.qq.com/'))refreshTabs();});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('popup.html'))return;
 const run=async()=>{
  if(message.type==='state')return await assistant.refresh();
  if(message.type==='connect'){void assistant.connect(typeof message.bridgeId==='string'?message.bridgeId:undefined);return{ok:true};}
  if(message.type==='retry')await assistant.retry();
  else if(message.type==='pause')await assistant.pause();
  else if(message.type==='disconnect')await assistant.unlink();
  else if(message.type==='open-wechat'){const tabs=await chrome.tabs.query({url:'https://mp.weixin.qq.com/*'});const target=tabs.find(t=>t.active)||tabs[0];if(target?.id){await chrome.tabs.update(target.id,{active:true});await chrome.windows.update(target.windowId,{focused:true});}else await chrome.tabs.create({url:'https://mp.weixin.qq.com/'});}
  return assistant.snapshot;
 };
 void run().then(respond,()=>respond({error:'操作未完成，请重试'}));return true;
});
void initialize();

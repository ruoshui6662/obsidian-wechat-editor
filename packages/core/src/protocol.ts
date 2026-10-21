import type { Account } from './types';
export type MessageType='hello'|'hello-ok'|'account'|'account-check'|'upload'|'upload-result'|'error'|'cancel'|'ping'|'pong'|'discover'|'discovery'|'pair-request'|'pair-waiting'|'pair-granted'|'pair-denied';
export interface BridgeMessage {version:1;type:MessageType;requestId:string;jobId?:string;accountId?:string;payload:any}
export const MAX_MESSAGE_BYTES=16*1024*1024;
export function isAccount(value:unknown):value is Account {const a=value as Account;return !!a&&typeof a.id==='string'&&a.id.length>0&&a.id.length<=256&&typeof a.name==='string'&&a.name.length<=256;}
export function isWechatImageURL(value:unknown):value is string{
 if(typeof value!=='string')return false;try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&u.hostname==='mmbiz.qpic.cn'&&!u.username&&!u.password;}catch{return false;}
}
export function parseMessage(raw:string):BridgeMessage{
 if(new TextEncoder().encode(raw).length>MAX_MESSAGE_BYTES)throw Error('消息过大');
 const m=JSON.parse(raw) as BridgeMessage;
 if(!m||m.version!==1||typeof m.requestId!=='string'||!m.requestId||m.requestId.length>128||!['hello','hello-ok','account','account-check','upload','upload-result','error','cancel','ping','pong','discover','discovery','pair-request','pair-waiting','pair-granted','pair-denied'].includes(m.type)||m.payload===null||typeof m.payload!=='object')throw Error('消息格式无效');
 if(m.jobId!==undefined&&(typeof m.jobId!=='string'||m.jobId.length>128))throw Error('任务标识无效');
 if(m.accountId!==undefined&&(typeof m.accountId!=='string'||m.accountId.length>256))throw Error('账号标识无效');
 const p=m.payload;
 if(Array.isArray(p))throw Error('消息格式无效');
 const label=(v:unknown,max=128)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
 if(m.type==='pair-request'&&(!label(p.bridgeId)||!label(p.clientId)||!label(p.name,80)))throw Error('授权请求无效');
 if(m.type==='discovery'&&(p.product!=='wechat-layout'||!label(p.bridgeId)||!label(p.name,80)))throw Error('服务信息无效');
 if(m.type==='pair-granted'&&(!label(p.bridgeId)||!label(p.name,80)||typeof p.token!=='string'||!/^[a-f0-9]{64}$/.test(p.token)))throw Error('授权信息无效');
 if(m.type==='hello'&&p.clientId!==undefined&&!label(p.clientId))throw Error('助手标识无效');
 if(m.type==='hello'&&(typeof p.token!=='string'||p.token.length>256||(p.account!==null&&!isAccount(p.account))))throw Error('配对数据无效');
 if(m.type==='account'&&p.account!==null&&!isAccount(p.account))throw Error('账号数据无效');
 if(m.type==='upload-result'&&(typeof p.key!=='string'||!isWechatImageURL(p.url)))throw Error('上传返回地址无效');
 if(m.type==='upload'&&(typeof p.key!=='string'||typeof p.base64!=='string'||typeof p.filename!=='string'||p.filename.length>512||!['image/png','image/jpeg','image/gif','image/webp'].includes(p.mime)||!Number.isInteger(p.size)||p.size<=0||p.size>10*1024*1024||typeof p.sha256!=='string'||!/^[a-f0-9]{64}$/.test(p.sha256)))throw Error('上传数据无效');
 if(m.type==='error'&&(typeof p.message!=='string'||p.message.length>1000||typeof p.code!=='string'||p.code.length>128))throw Error('错误消息无效');
 return m;
}

import type {Account,PreparedAsset} from '../../core/src/types';
import {LayoutError} from '../../core/src/types';
import {isWechatImageURL} from '../../core/src/protocol';
import {wechatPageOperation,type PageAsset,type PageResult} from './wechat-page';
type Runner=(tabId:number,operation:'read'|'upload',accountId?:string,asset?:PageAsset)=>Promise<PageResult>;
const run:Runner=async(tabId,operation,accountId,asset)=>{
 const tab=await chrome.tabs.get(tabId);if(!tab.url?.startsWith('https://mp.weixin.qq.com/'))throw new LayoutError('wechat-tab','请选择已登录的公众号后台标签页。');
 const result=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:wechatPageOperation,args:[operation,accountId||'',asset||null]});
 if(!result[0]?.result)throw new LayoutError('wechat-page','无法读取公众号后台，请刷新该标签页。');return result[0].result;
};
export async function readWechatAccount(tabId:number):Promise<Account>{const r=await run(tabId,'read');if(!r.ok||!r.account)throw new LayoutError(r.code||'wechat-account',r.message||'未识别公众号。');return r.account;}
export async function uploadWechatImage(tabId:number,asset:PreparedAsset,expectedAccountId:string,signal:AbortSignal,runner:Runner=run,timeoutMs=90000):Promise<string>{
 let raw='';for(let p=0;p<asset.bytes.length;p+=32768)raw+=String.fromCharCode(...asset.bytes.subarray(p,p+32768));
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(asset.bytes)))).map(n=>n.toString(16).padStart(2,'0')).join('');
 return new Promise((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);};
  const abort=()=>{cleanup();reject(new LayoutError('cancelled','已取消本次上传。'));};
  const timer=setTimeout(()=>{cleanup();reject(new LayoutError('upload-timeout','图片上传超时，请重试。'));},timeoutMs);
  if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});
  runner(tabId,'upload',expectedAccountId,{key:asset.key,base64:btoa(raw),size:asset.bytes.length,sha256,mime:asset.mime,filename:asset.filename}).then(r=>{
   cleanup();if(!r.ok||!isWechatImageURL(r.url)||r.account?.id!==expectedAccountId)reject(new LayoutError(r.code||'wechat-upload',r.message||'图片上传失败，请重新确认公众号。'));else resolve(r.url);
  },e=>{cleanup();reject(e)});
 });
}

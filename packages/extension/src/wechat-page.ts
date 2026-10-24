export interface PageAsset {key:string;base64:string;size:number;sha256:string;mime:string;filename:string}
export interface PageResult {ok:boolean;account?:{id:string;name:string};url?:string;message?:string;code?:string}
// Executed in the selected WeChat tab's MAIN world. Keep this function closure-free.
export async function wechatPageOperation(operation:'read'|'upload'|'cancel',expectedAccountId?:string,asset?:PageAsset|null,requestId?:string,deadline?:number):Promise<PageResult>{
 // Only operation IDs/controllers live in the shared MAIN-world registry, never image or session data.
 type Entry={controller?:AbortController;timer?:ReturnType<typeof setTimeout>};
 const scope=globalThis as typeof globalThis&{__wechatLayoutUploads?:Map<string,Entry>};
 const registry=scope.__wechatLayoutUploads??new Map<string,Entry>();
 const release=(id:string,entry:Entry)=>{
  if(registry.get(id)!==entry)return;clearTimeout(entry.timer);registry.delete(id);
  if(registry.size===0&&scope.__wechatLayoutUploads===registry)delete scope.__wechatLayoutUploads;
 };
 if(operation==='cancel'){
  if(!requestId)return{ok:true};
  const active=registry.get(requestId);
  if(active?.controller){active.controller.abort('cancelled');return{ok:true};}
  if(!active&&(!deadline||deadline>Date.now())){
   const entry:Entry={};scope.__wechatLayoutUploads=registry;registry.set(requestId,entry);
   entry.timer=setTimeout(()=>release(requestId,entry),Math.max(0,(deadline||Date.now()+95000)-Date.now()));
  }
  return{ok:true};
 }
 // A queued injection must stay cancelled even after its bounded tombstone has expired.
 if(operation==='upload'&&deadline&&Date.now()>=deadline)return{ok:false,code:'upload-timeout',message:'图片上传超时，请重试。'};
 if(operation==='upload'&&requestId&&registry.has(requestId)){
  const previous=registry.get(requestId)!;
  if(!previous.controller)release(requestId,previous);
  return{ok:false,code:'cancelled',message:'已取消本次上传。'};
 }
 const timeout=new AbortController();const entry:Entry={controller:timeout};
 if(operation==='upload'&&requestId){scope.__wechatLayoutUploads=registry;registry.set(requestId,entry);}
 const timer=setTimeout(()=>timeout.abort('timeout'),Math.min(operation==='read'?6000:85000,deadline?Math.max(0,deadline-Date.now()):Infinity));
 const checkCancelled=()=>{if(!timeout.signal.aborted&&deadline&&Date.now()>=deadline)timeout.abort('timeout');if(timeout.signal.aborted)throw Error('aborted');};
 try{
  const readContext=async()=>{
   let html='';
   // Retry only this read's transport once. Parsing/account checks and the upload POST never retry.
   for(let attempt=0;attempt<2;attempt++){
    checkCancelled();
    try{
     const response=await fetch('https://mp.weixin.qq.com/',{credentials:'include',cache:'no-store',signal:timeout.signal});
     if(!response.ok)throw Error('无法读取公众号登录状态，请重新打开后台。');
     html=await response.text();break;
    }catch(e){checkCancelled();if(attempt===1)throw e;}
   }
   checkCancelled();
   const read=(key:string)=>{
    const match=html.match(new RegExp(String.raw`(?:^|[^\w$])["']?${key}["']?\s*[:=]\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|(\d+))`));
    return (match?.[1]??match?.[2]??match?.[3]??'').replace(/\\x([a-f\d]{2})/gi,(_,n)=>String.fromCharCode(parseInt(n,16))).replace(/\\u([a-f\d]{4})/gi,(_,n)=>String.fromCharCode(parseInt(n,16))).replace(/\\([\\"'])/g,'$1').replace(/&amp;/g,'&');
   };
   const context={t:read('t')||read('token'),user_name:read('user_name'),nick_name:read('nick_name'),ticket:read('ticket'),time:read('time')};
   if(!context.user_name||!context.t)throw Error('未识别到公众号，请先登录或重新打开公众号后台。');
   return context;
  };
  let bytes:Uint8Array<ArrayBuffer>|undefined;
  if(operation==='upload'){
   if(!asset)throw Error('图片数据为空，请重新复制。');
   const raw=atob(asset.base64);bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');checkCancelled();
   if(bytes.byteLength!==asset.size||hash!==asset.sha256||bytes.byteLength>10*1024*1024)throw Error('图片传输校验失败，请重新复制。');
  }
  const context=await readContext(),account={id:context.user_name,name:context.nick_name||context.user_name};
  if(expectedAccountId&&account.id!==expectedAccountId)return{ok:false,code:'account-changed',message:'公众号已变化，请重新复制。'};
  if(operation==='read')return{ok:true,account};
  if(!asset||!bytes||!context.ticket)throw Error('当前登录缺少上传信息，请重新打开公众号后台。');
  const form=new FormData();const now=Date.now();
  form.append('type',asset.mime);form.append('id',String(now));form.append('name',asset.filename);form.append('lastModifiedDate',new Date().toString());form.append('size',String(bytes.byteLength));form.append('file',new Blob([bytes],{type:asset.mime}),asset.filename);
  const url=new URL('https://mp.weixin.qq.com/cgi-bin/filetransfer');
  const params={action:'upload_material',f:'json',scene:'8',writetype:'doublewrite',groupid:'1',ticket_id:account.id,ticket:String(context.ticket),svr_time:String(context.time||Math.floor(now/1000)),token:String(context.t),lang:'zh_CN',seq:String(now),t:String(Math.random())};
  for(const [k,v]of Object.entries(params))url.searchParams.set(k,v);
  checkCancelled();const response=await fetch(url.href,{method:'POST',credentials:'include',body:form,signal:timeout.signal});
  if(!response.ok)throw Error(`图片上传请求失败（HTTP ${response.status}）。`);
  const result=await response.json();checkCancelled();
  if((result.base_resp?.ret!==undefined&&result.base_resp.ret!==0)||result.base_resp?.err_msg!=='ok')throw Error(`微信拒绝图片上传（代码 ${String(result.base_resp?.ret??'未知')}），请检查登录状态后重试。`);
  let imageURL:URL;try{imageURL=new URL(result.cdn_url);}catch{throw Error('微信未返回有效图片地址，请重试。');}
  if(imageURL.hostname!=='mmbiz.qpic.cn'||!['https:','http:'].includes(imageURL.protocol)||imageURL.username||imageURL.password)throw Error('微信未返回有效图片地址，请重试。');
  const current=await readContext();
  if(current.user_name!==account.id)return{ok:false,code:'account-changed',message:'上传期间公众号已变化，请重新复制。'};
  return{ok:true,account,url:imageURL.href};
 }catch(e){return{ok:false,code:timeout.signal.aborted?(timeout.signal.reason==='cancelled'?'cancelled':'upload-timeout'):'wechat-upload',message:timeout.signal.aborted?(timeout.signal.reason==='cancelled'?'已取消本次上传。':'图片上传超时，请重试。'):e instanceof Error?e.message:'微信图片处理失败，请重试。'};}finally{clearTimeout(timer);if(operation==='upload'&&requestId)release(requestId,entry);}
}

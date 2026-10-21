import {it,expect} from 'vitest';
import {WebSocket as Client} from 'ws';
import {BridgeServer} from '../../packages/plugin/src/bridge';
import {ExtensionConnection} from '../../packages/extension/src/connection';
import {discoverBridges,requestPairing} from '../../packages/extension/src/local-bridge';
import {tinyAsset,testAccount} from '../helpers/fakes';
it('discovers, approves, authenticates, resolves a new tab, and transfers an image across the real local bridge',async()=>{
 const server=new BridgeServer({portStart:0,portEnd:0,bridgeId:'main',name:'主库',requestPairing:async()=>true});const {endpoint}=await server.start();
 const sockets:Client[]=[];const factory=(url:string)=>{const s=new Client(url,{origin:'chrome-extension://'+'a'.repeat(32)});sockets.push(s);return s as unknown as WebSocket};
 let connection:ExtensionConnection|undefined;
 try{
  const found=await discoverBridges(factory,[endpoint]);expect(found).toEqual([{endpoint,bridgeId:'main',name:'主库'}]);const pairing=await requestPairing(found[0],'browser',factory,()=>{},new AbortController().signal);
  let ready!:()=>void;const recognized=new Promise<void>(r=>ready=r);let uploadedTab=0;
  connection=new ExtensionConnection({load:async()=>pairing,socket:factory,readAccount:async()=>{throw Error('must not use a stored tab id')},resolveSession:async()=>({tabId:99,account:testAccount}),upload:async(tabId)=>{uploadedTab=tabId;return'https://mmbiz.qpic.cn/current'},status:()=>{},state:state=>{if(state.account)ready()}});
  await connection.restore();await recognized;
  // The account publication travels over the real socket after local state updates.
  await new Promise<void>((resolve,reject)=>{let tries=0;const check=()=>{if(server.getAccount())resolve();else if(++tries>100)reject(Error('account publication timed out'));else setTimeout(check,5)};check();});
  await server.verifyAccount(testAccount,new AbortController().signal);expect(await server.upload(tinyAsset(),testAccount,new AbortController().signal)).toBe('https://mmbiz.qpic.cn/current');expect(uploadedTab).toBe(99);
 }finally{connection?.stop();sockets.forEach(s=>s.terminate());await server.stop();}
});

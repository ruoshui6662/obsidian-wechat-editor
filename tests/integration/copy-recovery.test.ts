import {afterEach,it,expect,vi} from 'vitest';
import {WebSocket} from 'ws';
import {BridgeServer} from '../../packages/plugin/src/bridge';
import {ExtensionConnection} from '../../packages/extension/src/connection';
import {CopyJobController} from '../../packages/core/src/job';
import {parseArticle} from '../../packages/core/src/parse';
import {renderArticle} from '../../packages/core/src/render';
import {DEFAULT_LAYOUT} from '../../packages/core/src/styles';
import {testAccount,tinyAsset,deferred} from '../helpers/fakes';
const cleanups:Array<()=>void|Promise<void>>=[];
afterEach(async()=>{for(const cleanup of cleanups.splice(0).reverse())await cleanup();});
it('one copy finishes through the real bridge after a temporary account error and transport reconnect',async()=>{
 const bridge=new BridgeServer({portStart:0,portEnd:0}),info=await bridge.start();cleanups.push(()=>bridge.stop());const sockets:WebSocket[]=[],upload=deferred<string>();let uploads=0,uploadSignal:AbortSignal|undefined,readFails=false;
 const connection=new ExtensionConnection({load:async()=>({endpoint:info.endpoint,token:info.pairingToken,tabId:1}),socket:url=>{const s=new WebSocket(url,{origin:'chrome-extension://'+'a'.repeat(32)});sockets.push(s);return s as any;},readAccount:async()=>{if(readFails)throw Error('network');return testAccount;},upload:async(_tab,_asset,_account,signal)=>{uploads++;uploadSignal=signal;return upload.promise;},status:()=>{}});cleanups.push(()=>connection.stop());await connection.restore();await vi.waitFor(()=>expect(bridge.getAccount()).toEqual(testAccount));
 const writes:string[]=[];const article=parseArticle('正文\n\n![[照片.png]]','稿.md');const asset={...tinyAsset(),occurrenceIds:[article.images[0].occurrenceId]};
 const controller=new CopyJobController({verifyAccount:(account,signal)=>bridge.verifyAccount(account,signal),prepare:async()=>[asset],upload:(asset,account,signal)=>bridge.upload(asset,account,signal),render:(snapshot,map)=>renderArticle(snapshot.article,snapshot.layout,map,snapshot.overrides),writeClipboard:async output=>{writes.push(output.html);},isCurrent:s=>bridge.getAccount()?.id===s.account.id,onEvent:()=>{}});cleanups.push(()=>controller.cancel());
 const task=controller.run({id:'job',article,layout:DEFAULT_LAYOUT,overrides:{},account:testAccount,revision:'1'});void task.catch(()=>{});await vi.waitFor(()=>expect(uploads).toBe(1));readFails=true;await connection.refreshAccount();expect(bridge.getAccount()).toEqual(testAccount);readFails=false;sockets[0].terminate();await vi.waitFor(()=>expect(bridge.isConnected()).toBe(false));expect(uploadSignal!.aborted).toBe(false);await vi.waitFor(()=>expect(sockets.length).toBe(2),{timeout:3000});await vi.waitFor(()=>expect(bridge.isConnected()).toBe(true));upload.resolve('https://mmbiz.qpic.cn/recovered');await task;expect(uploads).toBe(1);expect(writes).toHaveLength(1);expect(writes[0]).toContain('https://mmbiz.qpic.cn/recovered');
});

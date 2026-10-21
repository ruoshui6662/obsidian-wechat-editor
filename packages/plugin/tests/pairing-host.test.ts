import {afterEach,it,expect,vi} from 'vitest';
import WechatLayoutPlugin from '../src/main';
import {BridgeServer} from '../src/bridge';
import {loadSettings} from '../src/settings';
afterEach(()=>vi.restoreAllMocks());
function setup(){
 const plugin=new WechatLayoutPlugin({vault:{getName:()=>"主库"}} as any,{} as any);plugin.settings=loadSettings({});let endpoint='';
 vi.spyOn(BridgeServer.prototype,'getInfo').mockImplementation(()=>({endpoint,pairingToken:'test-token',origin:undefined}));
 return{plugin,ready:()=>{endpoint='ws://127.0.0.1:17836';return{endpoint,pairingToken:'test-token'}}};
}
it('bridgeStartupRefreshesAnAlreadyOpenPanel',async()=>{
 const {plugin,ready}=setup();let complete!:()=>void;vi.spyOn(BridgeServer.prototype,'start').mockImplementation(()=>new Promise(resolve=>{complete=()=>resolve(ready())}));
 const setState=vi.fn();(plugin as any).views.add({panel:{setState}});const starting=(plugin as any).startBridge();expect(plugin.state().pairingReady).toBe(false);complete();await starting;
 expect(setState).toHaveBeenCalledWith(expect.objectContaining({pairingReady:true}));
});
it('pairingRetriesFailedStartupAndReturnsActualFailure',async()=>{
 const {plugin,ready}=setup();const start=vi.spyOn(BridgeServer.prototype,'start').mockRejectedValueOnce(Error('端口不可用')).mockImplementationOnce(async()=>ready());
 await expect(plugin.getPairingInfo()).rejects.toThrow('端口不可用');expect(JSON.parse(await plugin.getPairingInfo()).endpoint).toBe('ws://127.0.0.1:17836');expect(start).toHaveBeenCalledTimes(2);
});
it('pairingWaitsForCurrentStartupInsteadOfStartingASecondListener',async()=>{
 const {plugin,ready}=setup();let complete!:()=>void;const start=vi.spyOn(BridgeServer.prototype,'start').mockImplementation(()=>new Promise(resolve=>{complete=()=>resolve(ready())}));
 const a=plugin.getPairingInfo(),b=plugin.getPairingInfo();complete();await expect(a).resolves.toContain('test-token');await expect(b).resolves.toContain('test-token');expect(start).toHaveBeenCalledTimes(1);
});

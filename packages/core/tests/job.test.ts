import { describe,it,expect,vi } from 'vitest';
import { CopyJobController, type JobDependencies, type Snapshot, type JobEvent } from '../src/job';
import { parseArticle } from '../src/parse';
import { DEFAULT_LAYOUT } from '../src/styles';
import { deferred, tinyAsset, testAccount } from '../../../tests/helpers/fakes';
const snapshot=():Snapshot=>({id:'job-one',article:parseArticle('![[a.png]]\n\n![[b.png]]','稿.md'),layout:DEFAULT_LAYOUT,overrides:{},account:testAccount,revision:'one'});
function setup(extra:Partial<JobDependencies>={}){
 const events:JobEvent[]=[];const writes:string[]=[];
 const deps:JobDependencies={prepare:async()=>[{...tinyAsset('a'),occurrenceIds:['img-0']},{...tinyAsset('b'),occurrenceIds:['img-1']}],upload:async a=>'https://mmbiz.qpic.cn/'+a.key,render:(_s,map)=>({html:[...map.values()].join(','),text:'文字',diagnostics:[]}),writeClipboard:async r=>{writes.push(r.html)},isCurrent:()=>true,onEvent:e=>events.push(e),...extra};
 return {controller:new CopyJobController(deps),events,writes};
}
describe('copy jobs',()=>{
 it('renderErrorsBlockClipboardEvenAfterEveryAssetUploaded',async()=>{const s=setup({render:()=>({html:'图片不完整',text:'',diagnostics:[{code:'untracked-image',severity:'error',message:'存在未识别的图片'}]})});await expect(s.controller.run(snapshot())).rejects.toMatchObject({code:'untracked-image'});expect(s.writes).toHaveLength(0);expect(s.events.some(e=>e.type==='copied')).toBe(false);});
 it('cachedAndImageFreeCopiesVerifyCurrentAccountBeforeClipboard',async()=>{let checks=0;const s=setup({verifyAccount:async()=>{checks++;if(checks===3)throw Error('账号已变化')}} as Partial<JobDependencies>);await s.controller.run(snapshot());expect(checks).toBe(2);await expect(s.controller.run(snapshot())).rejects.toThrow('账号已变化');expect(s.writes).toHaveLength(1);const empty=snapshot();empty.article=parseArticle('没有图片','稿.md');const noImages=setup({prepare:async()=>[],verifyAccount:async()=>{throw Error('已退出登录')}} as Partial<JobDependencies>);await expect(noImages.controller.run(empty)).rejects.toThrow('已退出登录');expect(noImages.writes).toHaveLength(0);});
 it('partialUploadFailureNeverWritesClipboard',async()=>{const s=setup({upload:async a=>{if(a.key==='b')throw Error('失败');return 'https://mmbiz.qpic.cn/a'}});await expect(s.controller.run(snapshot())).rejects.toThrow();expect(s.writes).toHaveLength(0);expect(s.events.at(-1)?.type).toBe('failed');});
 it('clipboardFailureNeverEmitsCopied',async()=>{const s=setup({writeClipboard:async()=>{throw Error('无权限')}});await expect(s.controller.run(snapshot())).rejects.toThrow('无权限');expect(s.events.some(e=>e.type==='copied')).toBe(false);});
 it.each(['editingDuringUploadRejectsStaleSnapshot','accountSwitchRejectsStaleSnapshot'])('%s',async()=>{let current=true;const s=setup({isCurrent:()=>current,upload:async()=>{current=false;return 'https://mmbiz.qpic.cn/a'}});await expect(s.controller.run(snapshot())).rejects.toMatchObject({code:'stale-snapshot'});expect(s.writes).toHaveLength(0);});
 it('retryReusesOnlySuccessfulUploads',async()=>{const calls:string[]=[];let failed=false;const s=setup({upload:async a=>{calls.push(a.key);if(a.key==='b'&&!failed){failed=true;throw Error('网络中断')}return 'https://mmbiz.qpic.cn/'+a.key}});await expect(s.controller.run(snapshot())).rejects.toThrow();await s.controller.run(snapshot());expect(calls).toEqual(['a','b','b']);expect(s.writes).toHaveLength(1);expect(s.events.at(-1)?.type).toBe('copied');});
 it('cancelDropsLateResult',async()=>{const wait=deferred<string>();const entered=deferred<void>();const s=setup({upload:async()=>{entered.resolve();return wait.promise}});const task=s.controller.run(snapshot());await entered.promise;s.controller.cancel();wait.resolve('https://mmbiz.qpic.cn/a');await expect(task).rejects.toMatchObject({code:'cancelled'});expect(s.writes).toHaveLength(0);});
 it('missingOccurrenceCannotBeCopied',async()=>{const s=setup({prepare:async()=>[]});await expect(s.controller.run(snapshot())).rejects.toMatchObject({code:'missing-prepared-image'});expect(s.writes).toHaveLength(0);});
});
it('parentCancellationReachesPreparationAndPreventsUpload',async()=>{
 const {CopyJobController}=await import('../src/job');const parent=new AbortController();let preparationSignal:AbortSignal|undefined;let release!:(a:any[])=>void;const upload=vi.fn();
 const job=new CopyJobController({prepare:async(_s,signal)=>{preparationSignal=signal;return new Promise(resolve=>release=resolve);},upload,render:()=>({html:'',text:'',diagnostics:[]}),writeClipboard:async()=>{},isCurrent:()=>true,onEvent:()=>{}});
 const pending=job.run({article:{diagnostics:[],images:[]} as any} as any,parent.signal),result=pending.catch(e=>e);await vi.waitFor(()=>expect(release).toBeDefined());parent.abort();expect(preparationSignal?.aborted).toBe(true);expect(await result).toMatchObject({code:'cancelled'});release([]);expect(upload).not.toHaveBeenCalled();
});
it('passesBakedGeometryToRenderingOnInitialAndCachedCopies',async()=>{
 const geometry={naturalWidth:1200,paddingRatio:0.05},maps:unknown[]=[],upload=vi.fn(async()=> 'https://mmbiz.qpic.cn/a');
 const s=setup({prepare:async()=>[{...tinyAsset('a'),geometry,occurrenceIds:['img-0','img-1']}],upload,render:(_s,_urls,map)=>{maps.push(map.get('img-0'),map.get('img-1'));return{html:'ok',text:'ok',diagnostics:[]};}});await s.controller.run(snapshot());await s.controller.run(snapshot());expect(maps).toEqual([geometry,geometry,geometry,geometry]);expect(upload).toHaveBeenCalledTimes(1);
});

import type { Account, PreparedAsset } from '../../packages/core/src/types';
export const testAccount:Account={id:'account-test',name:'测试公众号'};
export const tinyAsset=(key='asset-one'):PreparedAsset=>({key,bytes:new Uint8Array([1,2,3]),mime:'image/png',filename:'测试.png',occurrenceIds:[key]});
export function deferred<T>(){let resolve!:(value:T)=>void;let reject!:(reason?:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};}

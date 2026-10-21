import type {ImageGeometry} from '../../core/src/types';
type PreviewAsset={bytes:Uint8Array;mime:string;geometry?:ImageGeometry};
type Entry={promise:Promise<string>;url?:string;geometry?:ImageGeometry};
/** Owns preview URLs and shares in-flight image work across text refreshes. */
export class PreviewAssets {
 private entries=new Map<string,Entry>();
 geometry(key:string){return this.entries.get(key)?.geometry;}
 ready(key:string){return this.entries.get(key)?.url;}
 get(key:string,load:()=>Promise<PreviewAsset>):Promise<string>{
  const existing=this.entries.get(key);if(existing)return existing.promise;
  const entry={} as Entry;
  entry.promise=Promise.resolve().then(load).then(asset=>{
   if(this.entries.get(key)!==entry)throw Error('预览内容已更新。');
   const url=URL.createObjectURL(new Blob([new Uint8Array(asset.bytes)],{type:asset.mime}));entry.url=url;entry.geometry=asset.geometry;return url;
  }).catch(error=>{if(this.entries.get(key)===entry)this.entries.delete(key);throw error;});
  this.entries.set(key,entry);return entry.promise;
 }
 retain(keys:ReadonlySet<string>){for(const [key,entry]of this.entries)if(!keys.has(key)){this.entries.delete(key);if(entry.url)URL.revokeObjectURL(entry.url);}}
 clear(){this.retain(new Set());}
}

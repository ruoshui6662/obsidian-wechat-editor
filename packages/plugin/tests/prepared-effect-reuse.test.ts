import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {parseArticle} from '../../core/src/parse';
import {normalizeImage} from '../../core/src/styles';
import {prepareAssets,type EffectRenderer} from '../src/vault-assets';
it('bakes repeated source and visual effects once while retaining every occurrence',async()=>{
 const bytes=await readFile('fixtures/vault/表情.png'),article=parseArticle('![[图.png]]\n\n![[图.png]]\n\n![[图.png]]','稿.md');let renders=0,reads=0;
 const styles=new Map(article.images.map((ref,index)=>[ref.occurrenceId,normalizeImage({radius:4,bakeEffects:true,shadow:index*6,marginAfter:index*8})]));
 const assets=await prepareAssets(article,async()=>{reads++;return{bytes,filename:'图.png'};},styles,async()=>{renders++;return{bytes,mime:'image/png',geometry:{naturalWidth:64,paddingRatio:0}};},()=>200);
 expect(reads).toBe(1);expect(renders).toBe(1);expect(assets).toHaveLength(1);expect(assets[0].occurrenceIds).toEqual(['img-0','img-1','img-2']);expect(assets[0].geometry).toEqual({naturalWidth:64,paddingRatio:0});
});
it('keeps distinct source, baked style and reading width variants separate',async()=>{
 const bytes=await readFile('fixtures/vault/表情.png'),article=parseArticle('![[图.png]]\n\n![[图.png]]\n\n![[图.png]]\n\n![[另一图.png]]\n\n![[图.png]]','稿.md'),inputs:string[]=[];
 const styles=new Map(article.images.map(ref=>[ref.occurrenceId,normalizeImage({radius:ref.occurrenceId==='img-2'?8:4,bakeEffects:true})]));
 const effect:EffectRenderer=async(input,_mime,style,width)=>{inputs.push(`${style.radius}:${width}`);return{bytes:new Uint8Array([...input,inputs.length]),mime:'image/png'};};
 const assets=await prepareAssets(article,async()=>({bytes,filename:'图.png'}),styles,effect,ref=>ref.occurrenceId==='img-1'?300:200);
 expect(inputs).toEqual(['4:200','4:300','8:200','4:200']);expect(assets.map(asset=>asset.occurrenceIds)).toEqual([['img-0','img-4'],['img-1'],['img-2'],['img-3']]);
});
it('reuses equivalent default and explicit preserved backgrounds',async()=>{
 const bytes=await readFile('fixtures/vault/表情.png'),article=parseArticle('![[图.png]]\n\n![[图.png]]','稿.md');let renders=0;
 const styles=new Map([['img-0',normalizeImage({radius:4,bakeEffects:true})],['img-1',normalizeImage({radius:4,bakeEffects:true,backgroundMode:'preserve',background:'#ff0000',borderColor:'#00ff00'})]]);
 const assets=await prepareAssets(article,async()=>({bytes,filename:'图.png'}),styles,async()=>{renders++;return{bytes,mime:'image/png'};});
 expect(renders).toBe(1);expect(assets[0].occurrenceIds).toEqual(['img-0','img-1']);
});

import { describe,it,expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parseArticle } from '../../core/src/parse';
import { resolveVaultAsset, prepareAssets, inspectImage } from '../src/vault-assets';
import { DEFAULT_IMAGE } from '../../core/src/styles';
const ref=(s:string)=>parseArticle(`![[${s}]]`,'稿.md').images[0];
const image=()=>readFile('fixtures/vault/图片 空格/配图.png');
describe('Vault assets',()=>{
 it('mixedWikiAndMarkdownPathsDoNotShareTheWrongOriginal',async()=>{const bytes=await image();const a=parseArticle('![[100%20.png]]\n\n![](100%20.png)','稿.md');const read=async(r:typeof a.images[number])=>resolveVaultAsset(r,'稿.md',{listFiles:()=>['100%20.png','100 .png'],readBinary:async p=>p==='100%20.png'?bytes:new Uint8Array([...bytes,1])});const assets=await prepareAssets(a,read,new Map(),async()=>{throw Error('not baking')});expect(assets).toHaveLength(2);});
 it.each(['100%20.png','100%.png'])('wikiPathsKeepLiteralPercentCharacters: %s',async name=>{let read='';await resolveVaultAsset(ref(name),'稿.md',{listFiles:()=>[name,'100 .png'],readBinary:async p=>{read=p;return image();}});expect(read).toBe(name);});
 it('resolvesEncodedChineseRelativePath',async()=>{
  const result=await resolveVaultAsset(parseArticle('![](图片%20空格/配图.png)','稿.md').images[0],'稿.md',{listFiles:()=>['图片 空格/配图.png'],readBinary:async p=>{expect(p).toBe('图片 空格/配图.png');return image();}});
  expect(result.filename).toBe('配图.png');
 });
 it('ambiguousBasenameReportsError',async()=>{
  await expect(resolveVaultAsset(ref('同名.png'),'稿.md',{listFiles:()=>['一/同名.png','二/同名.png'],readBinary:image})).rejects.toMatchObject({code:'ambiguous-image'});
 });
 it('rejectsParentEscapeAndOutsideSymlink',async()=>{
  const vault={listFiles:()=>['link.png'],readBinary:image,rootRealPath:'/vault',realPath:async()=>'/outside/private.png'};
  await expect(resolveVaultAsset(ref('../../private.png'),'稿.md',vault)).rejects.toMatchObject({code:'outside-vault'});
  await expect(resolveVaultAsset(ref('link.png'),'稿.md',vault)).rejects.toMatchObject({code:'outside-vault'});
 });
 it('sameAssetReusesBytesButKeepsOccurrences',async()=>{
  const a=parseArticle('![[a.png|200]]\n\n![[a.png|400]]','稿.md');
  const assets=await prepareAssets(a,async()=>({bytes:await image(),filename:'a.png'}),new Map(),async()=>{throw Error('not expected')});
  expect(assets).toHaveLength(1);expect(assets[0].occurrenceIds).toEqual(['img-0','img-1']);
 });
 it('gifBytesRemainUnchanged',async()=>{
  const bytes=await readFile('fixtures/vault/动画.gif');let called=false;
  const assets=await prepareAssets(parseArticle('![[a.gif]]','稿.md'),async()=>({bytes,filename:'a.gif'}),new Map([['img-0',{...DEFAULT_IMAGE,bakeEffects:true,shadow:8}]]),async()=>{called=true;throw Error('no')});
  expect(Buffer.from(assets[0].bytes)).toEqual(bytes);expect(called).toBe(false);
 });
 it('animatedWebpIsRejected',()=>{
  const bytes=Buffer.alloc(30);bytes.write('RIFF');bytes.write('WEBP',8);bytes.write('VP8X',12);bytes.writeUInt32LE(10,16);bytes[20]=2;
  expect(()=>inspectImage(bytes)).toThrow(/动画/);
 });
 it('styleBakeChangesAssetKey',async()=>{
  const a=parseArticle('![[a.png]]','稿.md');const bytes=await image();
  const read=async()=>({bytes,filename:'a.png'});const effect=async()=>({bytes:new Uint8Array([...bytes,0]),mime:'image/png'});
  const one=await prepareAssets(a,read,new Map(),effect);
  const two=await prepareAssets(a,read,new Map([['img-0',{...DEFAULT_IMAGE,bakeEffects:true,radius:4,shadow:8}]]),effect);
  expect(one[0].key).not.toBe(two[0].key);
 });
 it('rejectsOversizedDecodedImages',()=>{
  const bytes=Buffer.alloc(24);Buffer.from('89504e470d0a1a0a','hex').copy(bytes);bytes.writeUInt32BE(50000,16);bytes.writeUInt32BE(50000,20);
  expect(()=>inspectImage(bytes)).toThrow(/像素/);
 });
 it('recognizesAllCommittedImageFormats',async()=>{
  for(const [name,mime] of [['照片.jpg','image/jpeg'],['静态.webp','image/webp'],['动画.gif','image/gif'],['表情.png','image/png']])expect(inspectImage(await readFile('fixtures/vault/'+name)).mime).toBe(mime);
 });
});

import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {localizeRemoteImages} from '../src/remote-images';
import {parseArticle} from '../../core/src/parse';
const png=await readFile('fixtures/vault/表情.png');
function setup(){const saved=new Map<string,Uint8Array>(),requests:string[]=[];let current=true;return{saved,requests,setStale:()=>{current=false},port:{directory:'文章/附件/稿/网络图片-test',isCurrent:()=>current,download:async(url:string)=>{requests.push(url);return new Uint8Array(png);},save:async(path:string,bytes:Uint8Array)=>{if(saved.has(path))throw Error('exists');saved.set(path,bytes);}}};}
it('downloads every remote image including WeChat URLs and names by all-image article order',async()=>{
 const s=setup(),source='![[已有.png]]\n\n![](https://mmbiz.qpic.cn/a/640?wx_fmt=png) ^pic\n\n段落 ![描述](https://example.org/photo)';
 const result=await localizeRemoteImages(source,'文章/稿.md',s.port);
 expect([...s.saved.keys()]).toEqual(['文章/附件/稿/网络图片-test/图2.png','文章/附件/稿/网络图片-test/图3.png']);
 const images=parseArticle(result.source,'文章/稿.md').images;expect(images.map(i=>i.source)).toEqual(['已有.png','附件/稿/网络图片-test/图2.png','附件/稿/网络图片-test/图3.png']);
 expect(images.map(i=>i.alt)).toEqual(['','','描述']);expect(result.source).toContain('^pic');expect(s.requests).toHaveLength(2);
});
it('does not replace matching URLs in code, prose or normal links and supports reference images',async()=>{
 const s=setup(),url='https://example.org/a',source='`![]('+url+')` [链接]('+url+')\n\n> ![说明][ref]\n\n[ref]: '+url+' "图片标题"\n\n![说明]('+url+')';
 const result=await localizeRemoteImages(source,'文章/稿.md',s.port);
 expect(result.source).toContain('`![]('+url+')` [链接]('+url+')');expect(result.source).toContain('[ref]: '+url);expect(result.source).toContain('> ![说明](<附件/稿/网络图片-test/图1.png>)');expect([...s.saved.keys()].at(-1)).toContain('图2.png');expect(s.requests).toHaveLength(1);
});
it('localizes wiki network images and repeated images separately without showing filenames as captions',async()=>{
 const s=setup(),result=await localizeRemoteImages('![[https://example.org/a.png|200]]\n\n![](https://example.org/a.png)','文章/稿.md',s.port);
 const images=parseArticle(result.source,'文章/稿.md').images;expect(images.map(i=>i.alt)).toEqual(['','']);expect(images[0].width).toBe(200);expect(s.requests).toHaveLength(1);expect(s.saved.size).toBe(2);
});
it('validates all downloads before saving any attachment',async()=>{
 const s=setup();s.port.download=async(url:string)=>url.endsWith('/bad')?new TextEncoder().encode('<html>Forbidden</html>'):new Uint8Array(png);
 await expect(localizeRemoteImages('![](https://example.org/a)\n\n![](https://example.org/bad)','文章/稿.md',s.port)).rejects.toThrow(/图2/);expect(s.saved.size).toBe(0);
});
it('refuses stale source before writing attachments',async()=>{
 const s=setup();s.port.download=async()=>{s.setStale();return new Uint8Array(png);};await expect(localizeRemoteImages('![](https://example.org/a)','文章/稿.md',s.port)).rejects.toThrow(/变化/);expect(s.saved.size).toBe(0);
});
it('does not download again after links have become local',async()=>{
 const s=setup(),first=await localizeRemoteImages('![](https://example.org/a)','文章/稿.md',s.port);s.requests.length=0;const second=await localizeRemoteImages(first.source,'文章/稿.md',s.port);expect(second.source).toBe(first.source);expect(second.count).toBe(0);expect(s.requests).toHaveLength(0);
});
it('keeps image order and exact edit ranges in headings, lists, tables, frontmatter and CRLF notes',async()=>{
 const s=setup(),source='---\r\ntitle: 稿\r\n---\r\n# ![](https://example.org/a)\r\n\r\n- ![](https://example.org/b)\r\n\r\n| 图片 |\r\n| --- |\r\n| ![](https://example.org/c) |';
 const result=await localizeRemoteImages(source,'文章/稿.md',s.port);expect(result.count).toBe(3);expect([...s.saved.keys()].map(p=>p.split('/').at(-1))).toEqual(['图1.png','图2.png','图3.png']);expect(result.source).toContain('title: 稿\r\n');expect(result.source).toContain('- ![](<附件/稿/网络图片-test/图2.png>)');expect(parseArticle(result.source,'文章/稿.md').images).toHaveLength(3);
});
it('preserves GIF bytes and its extension rather than converting animation to a static image',async()=>{
 const s=setup(),gif=await readFile('fixtures/vault/动画.gif');s.port.download=async()=>new Uint8Array(gif);await localizeRemoteImages('![](https://example.org/640)','文章/稿.md',s.port);expect([...s.saved.keys()]).toEqual(['文章/附件/稿/网络图片-test/图1.gif']);expect(Buffer.from([...s.saved.values()][0])).toEqual(gif);
});
it('preserves escaped alt text rather than adding visible backslashes',async()=>{
 const s=setup(),source='![a\\[b\\]](https://example.org/a)';const result=await localizeRemoteImages(source,'文章/稿.md',s.port);expect(result.source).toBe('![a\\[b\\]](<附件/稿/网络图片-test/图1.png>)');
});
it('supports multiline quote image markup and CRLF multiline alt without changing surrounding quote text',async()=>{
 const s=setup(),source='> 文字\r\n> ![说\r\n> 明](https://example.org/a\r\n> "caption")\r\n> 后文';const result=await localizeRemoteImages(source,'文章/稿.md',s.port);expect(result.count).toBe(1);expect(result.source).toContain('> 文字\r\n> ![说 明](<附件/稿/网络图片-test/图1.png>)\r\n> 后文');
});
it('keeps escaped table pipes in width-bearing image alt when rewriting a table cell',async()=>{
 const s=setup(),source='| ![a\\|200](https://example.org/a) |\n| --- |';const result=await localizeRemoteImages(source,'文章/稿.md',s.port);expect(result.source).toContain('![a\\|200](<附件/稿/网络图片-test/图1.png>)');const image=parseArticle(result.source,'文章/稿.md').images[0];expect(image.width).toBe(200);expect(image.alt).toBe('a');
});
it('maps image edits correctly after emoji and supplementary Unicode characters',async()=>{
 const s=setup(),source='😀 ![🌿配图](https://example.org/a)';const result=await localizeRemoteImages(source,'文章/稿.md',s.port);expect(result.source).toBe('😀 ![🌿配图](<附件/稿/网络图片-test/图1.png>)');
});

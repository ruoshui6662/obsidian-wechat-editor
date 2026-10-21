import {it,expect} from 'vitest';
import {parseArticle} from '../../core/src/parse';
import {DEFAULT_LAYOUT} from '../../core/src/styles';
import {applyTemplate} from '../src/templates';
it('templateAssetsJoinUploadManifest',()=>{const input=parseArticle('---\ntitle: 正文\n---\n# 正文\n\n![[正文.png]] ^body','稿.md');const result=applyTemplate(input,{id:'t',name:'模板',layout:DEFAULT_LAYOUT,headerMarkdown:'![[头图.png]]',footerMarkdown:'![[尾图.png]]'});expect(result.images.map(i=>i.source)).toEqual(['头图.png','正文.png','尾图.png']);expect(new Set(result.images.map(i=>i.occurrenceId)).size).toBe(3);expect(result.blocks.find(b=>b.blockId==='body')?.range.startLine).toBe(5);expect(input.images).toHaveLength(1);});

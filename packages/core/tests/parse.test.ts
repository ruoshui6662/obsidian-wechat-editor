import { describe, expect, it } from 'vitest';
import { parseArticle } from '../src/parse';
import { parseWikiImage } from '../src/wikilinks';

describe('article parsing', () => {
  it('discoversImagesInsideTableCells',()=>{const a=parseArticle('| 图 |\n|---|\n| ![](a.png) |','稿.md');expect(a.images.map(i=>i.source)).toEqual(['a.png']);});
  it('localBlockIdPreservesReferenceImageEnvironment',()=>{const a=parseArticle('![说明][ref]\n^wx-one\n\n[ref]: a.png','稿.md');expect(a.images.map(i=>i.source)).toEqual(['a.png']);expect(a.blocks[0].blockId).toBe('wx-one');});
  it('parseArticleKeepsNestedImageOccurrences', () => {
    const a = parseArticle('- ![[图片.png]]\n\n> ![[图片.png]]\n\n![](./其他图.jpg)', '文章.md');
    expect(a.images.map(i => i.source)).toEqual(['图片.png','图片.png','./其他图.jpg']);
    expect(new Set(a.images.map(i => i.occurrenceId)).size).toBe(3);
  });
  it('parseArticleDistinguishesInlineEmoji', () => {
    const a = parseArticle('你好 ![[表情.png|24]] 世界\n\n![[照片.png|480x360]]', '稿.md');
    expect(a.images.map(i => [i.mode,i.width,i.height])).toEqual([['inline',24,undefined],['block',480,360]]);
  });
  it('wikiSyntaxInsideCodeStaysText', () => {
    expect(parseArticle('`![[x.png]]`\n\n```md\n![[y.png]]\n```', '稿.md').images).toHaveLength(0);
  });
  it('extractsOnlyMatchingTitle', () => {
    const a = parseArticle('---\ntitle: 标题\n---\n# 标题\n\n# 其他标题\n\n正文', '文件.md');
    expect(a.title).toBe('标题');
    expect(a.tokens.filter(t => t.type==='heading_open')).toHaveLength(1);
    expect(a.tokens.find(t=>t.type==='inline')?.content).toBe('其他标题');
  });
  it('keepsAMismatchedFirstHeadingAndReportsBadYaml', () => {
    expect(parseArticle('# 内容标题', '文件.md').tokens[0].type).toBe('heading_open');
    expect(parseArticle('---\na: [\n---\n正文','文件.md').diagnostics[0].code).toBe('invalid-frontmatter');
  });
  it('stripsBlockIdsWithoutLosingTheirSourceRange', () => {
    const a=parseArticle('段落\n^wx-one\n\n![[图.png]] ^wx-two','稿.md');
    expect(a.blocks.filter(b=>b.blockId).map(b=>b.blockId)).toEqual(['wx-one','wx-two']);
    expect(a.images[0].range.startLine).toBe(3);
  });
  it('supportsReferenceImagesAndDoesNotTreatNoteEmbedsAsImages', () => {
    const a=parseArticle('![说明][ref]\n\n[ref]: images/a.png\n\n![[另一篇笔记]]','稿.md');
    expect(a.images.map(i=>i.source)).toEqual(['images/a.png']);
    expect(a.diagnostics.some(d=>d.code==='unsupported-note-embed')).toBe(true);
  });
  it('parsesWikiDimensions',()=>{
    expect(parseWikiImage('image.png|480x360')).toEqual({source:'image.png',width:480,height:360});
    expect(parseWikiImage('image.png|caption')).toEqual({source:'image.png'});
  });
});

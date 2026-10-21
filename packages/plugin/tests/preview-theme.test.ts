// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {ArticlePreview} from '../src/article-preview';
import {parseArticle} from '../../core/src/parse';
import {renderArticle} from '../../core/src/render';
import {ARTICLE_THEMES} from '../../core/src/themes';
import type {PanelState} from '../src/view';
const previews:ArticlePreview[]=[];
afterEach(()=>{previews.splice(0).forEach(p=>p.destroy());document.body.replaceChildren();document.body.className='';document.body.removeAttribute('style');});
function setup(){
 const root=document.createElement('div');document.body.append(root);const preview=new ArticlePreview(root);previews.push(preview);
 const state:PanelState={article:parseArticle('### 标题\n\n正文 **重点**\n\n> 引用\n\n| 表头 |\n|---|\n| 内容 |\n\n![[图.png]] ^pic','稿.md'),layout:{...ARTICLE_THEMES.find(t=>t.id==='technology')!.layout},overrides:{pic:{image:{background:'#ffffff',backgroundMode:'solid',borderColor:'#dddddd',borderWidth:1}}},sources:new Map([['img-0','blob:original-image']]),account:null,pairingReady:false};
 preview.setState(state);const host=root.querySelector<HTMLElement>('.wx-paper')!,paper=host.shadowRoot!,scroll=root.querySelector<HTMLElement>('.wx-preview-scroll')!;return{root,preview,state,host,paper,scroll};
}
const tick=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
it('darkThemeAlreadyActiveUsesReadablePaperTextAndQuoteSurfaces',()=>{
 document.body.classList.add('theme-dark');document.body.style.setProperty('--background-primary','#202124');document.body.style.setProperty('--background-secondary','#292a2d');document.body.style.setProperty('--text-normal','#eeeeee');document.body.style.setProperty('--background-modifier-border','#44464b');
 const s=setup();expect(s.host.dataset.previewTheme).toBe('dark');expect(s.paper.querySelector('section')!.style.backgroundColor).toBe('rgb(32, 33, 36)');expect(s.paper.querySelector('p')!.style.color).not.toBe('rgb(51, 51, 51)');expect(s.paper.querySelector('blockquote')!.style.backgroundColor).toBe('rgb(41, 42, 45)');expect(s.paper.querySelector('th')!.style.backgroundColor).toBe('rgb(41, 42, 45)');
});
it('liveThemeTogglePreservesImageNodesReadingPositionAndExportColors',async()=>{
 const s=setup(),before=renderArticle(s.state.article!,s.state.layout,s.state.sources,s.state.overrides).html,image=s.paper.querySelector('img')!,originalText=s.paper.querySelector('p')!.getAttribute('style');s.scroll.scrollTop=240;document.body.classList.add('theme-dark');await tick();
 expect(s.host.dataset.previewTheme).toBe('dark');expect(s.paper.querySelector('img')).toBe(image);expect(s.scroll.scrollTop).toBe(240);expect(s.paper.querySelector('p')!.getAttribute('style')).not.toBe(originalText);expect(renderArticle(s.state.article!,s.state.layout,s.state.sources,s.state.overrides).html).toBe(before);
 document.body.classList.replace('theme-dark','theme-light');await tick();expect(s.host.dataset.previewTheme).toBe('light');expect(s.paper.querySelector('p')!.getAttribute('style')).toBe(originalText);expect(s.paper.querySelector('section')!.style.backgroundColor).toBe('rgb(255, 255, 255)');expect(s.scroll.scrollTop).toBe(240);
});
it('darkPreviewKeepsImageColorsBordersAndBlueHeadingSegmentsUnchanged',async()=>{
 const s=setup(),image=s.paper.querySelector('img')!,imageStyle=image.getAttribute('style'),marker=s.paper.querySelector('[data-wx-heading-bar]')!,markerStyle=marker.innerHTML;document.body.classList.add('theme-dark');await tick();expect(image.getAttribute('style')).toBe(imageStyle);expect(image.src).toBe('blob:original-image');expect(image.style.filter).toBe('');expect(marker.innerHTML).toBe(markerStyle);
});
it('themeColorsRefreshInPlaceAndHiddenPagesFollowTheLatestTheme',async()=>{
 const s=setup();s.preview.setActive(false);document.body.classList.add('theme-dark');document.body.style.setProperty('--background-primary','#242424');await tick();s.preview.setState({...s.state,article:parseArticle('更新正文','稿.md')});s.preview.setActive(true);expect(s.paper.querySelector('section')!.style.backgroundColor).toBe('rgb(36, 36, 36)');expect(s.paper.textContent).toContain('更新正文');
 const image=s.paper.querySelector('p');document.body.style.setProperty('--background-primary','#303030');await tick();expect(s.paper.querySelector('section')!.style.backgroundColor).toBe('rgb(48, 48, 48)');expect(s.paper.querySelector('p')).toBe(image);
});
it('destroyDisconnectsTheThemeObserver',async()=>{
 const s=setup();s.preview.destroy();document.body.classList.add('theme-dark');await tick();expect(s.host.dataset.previewTheme).toBe('light');expect(s.root.children).toHaveLength(0);
});

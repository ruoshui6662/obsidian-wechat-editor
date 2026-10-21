// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
import WechatLayoutPlugin from '../src/main';
import {loadSettings} from '../src/settings';
import {Modal} from '../../../tests/helpers/obsidian';
import {parseArticle} from '../../core/src/parse';
import {imageInsets,mergeImageStyles} from '../../core/src/styles';
function setup(){
 const plugin=new WechatLayoutPlugin({} as any,{} as any);plugin.settings=loadSettings({notes:{'稿.md':{layout:{fontSize:19,includeTitle:true},overrides:{a:{text:{fontSize:21},image:{radius:24}},b:{image:{shadow:4}}}}}});plugin.activeNote={path:'稿.md',extension:'md'} as any;plugin.article=parseArticle('![[A.png]] ^a\n\n![[B.png]] ^b','稿.md');plugin.refresh=async()=>{};
 return plugin;
}
it('settingImageDefaultsPreservesIndividualStylesAndCanBeUndone',async()=>{
 const plugin=setup();const before=structuredClone(plugin.noteSettings());
 await plugin.changeAllImages({radius:8},'default');
 expect(plugin.noteSettings().overrides.a.image!.radius).toBe(24);
 expect(plugin.noteSettings().overrides.b.image!.shadow).toBe(4);
 expect(plugin.noteSettings().overrides['*'].image!.radius).toBe(8);
 expect(plugin.host().undoAppearance).toBeTypeOf('function');
 await plugin.host().undoAppearance!();expect(plugin.noteSettings()).toEqual(before);
});
it('unifyingImagesClearsOnlyImageOverridesAndUndoRestoresThem',async()=>{
 const plugin=setup();const before=structuredClone(plugin.noteSettings());
 await plugin.changeAllImages({radius:8},'all');
 expect(plugin.noteSettings().overrides.a).toEqual({text:{fontSize:21}});
 expect(plugin.noteSettings().overrides.b).toBeUndefined();
 expect(plugin.state().canUndoAppearance).toBe(true);
 await plugin.host().undoAppearance!();expect(plugin.noteSettings()).toEqual(before);
});
it('themeSwitchKeepsLocalImagesTitleAndHeaderFooterAssociation',async()=>{
 const plugin=setup();plugin.settings.templates=[{id:'own',name:'我的',layout:plugin.settings.layout,headerMarkdown:'头部',footerMarkdown:'尾部'}];plugin.noteSettings().templateId='own';
 expect(plugin.host().applyArticleTheme).toBeTypeOf('function');
 await plugin.host().applyArticleTheme!('technology');
 expect(plugin.state().layout).toMatchObject({themeId:'technology',fontSize:16,includeTitle:true});
 expect(plugin.noteSettings().templateId).toBe('own');expect(plugin.noteSettings().overrides.a.image!.radius).toBe(24);
 await plugin.host().undoAppearance!();expect(plugin.state().layout.fontSize).toBe(19);
});
it('laterManualChangesInvalidateAppearanceUndoInsteadOfOverwritingThem',async()=>{
 const plugin=setup();await plugin.changeAllImages({radius:8},'default');plugin.host().changeLayout({fontSize:23});
 expect(plugin.state().canUndoAppearance).toBe(false);await plugin.host().undoAppearance!();expect(plugin.state().layout.fontSize).toBe(23);
});
it('newInstallStartsWithDailyThemeWhileExistingSettingsAndPairingStayIntact',()=>{
 expect(loadSettings({}).layout.themeId).toBe('daily');
 const old={layout:{fontSize:15},bridgeToken:'a'.repeat(64),notes:{'稿.md':{overrides:{a:{image:{radius:9}}}}}};
 const loaded=loadSettings(old);expect(loaded.layout.themeId).toBeUndefined();expect(loaded.layout.fontSize).toBe(15);expect(loaded.bridgeToken).toBe(old.bridgeToken);expect(loaded.notes['稿.md'].overrides.a.image!.radius).toBe(9);
});
it('themeAndGlobalImageDefaultsSurvivePersonalSchemeSaveAndReload',async()=>{
 const plugin=setup();await plugin.applyArticleTheme('technology');await plugin.changeAllImages({radius:12,widthPercent:null},'default');
 plugin.editTemplate(true);const modal=Modal.latest!;modal.contentEl.querySelector<HTMLButtonElement>('button')!.click();
 await vi.waitFor(()=>expect(plugin.settings.templates).toHaveLength(1));const loaded=loadSettings(JSON.parse(JSON.stringify(plugin.settings)));const template=loaded.templates[0];expect(template.layout.themeId).toBe('technology');expect(template.imageDefault).toMatchObject({radius:12,widthPercent:null});expect(loaded.notes['稿.md'].overrides.a.image!.radius).toBe(24);
});
it('unifyNeedsConfirmationAndCancelledOrStaleRequestsDoNotChangeAnything',async()=>{
 const plugin=setup(),before=structuredClone(plugin.noteSettings());const cancel=plugin.host().changeAllImages!({radius:8},'all');
 expect(plugin.noteSettings()).toEqual(before);Modal.latest!.contentEl.querySelector<HTMLButtonElement>('[data-action=cancel-unify]')!.click();expect(await cancel).toBe(false);expect(plugin.noteSettings()).toEqual(before);
 const pending=plugin.host().changeAllImages!({radius:8},'all');plugin.host().changeLayout({fontSize:23});Modal.latest!.contentEl.querySelector<HTMLButtonElement>('[data-action=confirm-unify]')!.click();await expect(pending).rejects.toThrow('已变化');expect(plugin.noteSettings().overrides.a.image!.radius).toBe(24);
});
it('resetOneImageRestoresGlobalInheritanceAndLeavesTheOtherOccurrenceAlone',async()=>{
 const plugin=setup();await plugin.changeAllImages({radius:8},'default');await plugin.host().resetImageStyle!('block-0');
 expect(plugin.noteSettings().overrides.a).toEqual({text:{fontSize:21}});expect(plugin.noteSettings().overrides.b.image!.shadow).toBe(4);expect(plugin.state().overrides['*'].image!.radius).toBe(8);
});
it('copyCarriesTheSameThemeAndResolvedImageStylesAsPreview',async()=>{
 const plugin=setup();await plugin.applyArticleTheme('technology');let snapshot:any;
 plugin.bridge={isConnected:()=>true,getInfo:()=>({endpoint:'ws://127.0.0.1:17836'}),getAccount:()=>({id:'account',name:'测试'})} as any;plugin.controller={cancel:()=>{},run:async (value:any)=>{snapshot=value;}} as any;plugin.readSource=async()=>plugin.article!.source;
 await plugin.copy();expect(snapshot.layout).toEqual(plugin.state().layout);expect(snapshot.overrides).toEqual(plugin.state().overrides);expect(snapshot.overrides['*'].image).toMatchObject({radius:8,bakeEffects:true});expect(snapshot.overrides.a.image.radius).toBe(24);
});
it('promotingLegacyLocalSpacingReplacesThePreviouslyAbsoluteGlobalSide',async()=>{
 const plugin=setup();plugin.noteSettings().overrides['*']={image:{leftInset:16,rightInset:16}};plugin.noteSettings().overrides.a.image!.marginLeft=8;
 const selected=mergeImageStyles(plugin.state().overrides['*'].image,plugin.noteSettings().overrides.a.image);
 expect(imageInsets(selected,16).left).toBe(24);await plugin.changeAllImages(selected,'default');
 expect(imageInsets(mergeImageStyles(plugin.state().overrides['*'].image),16).left).toBe(24);expect(plugin.noteSettings().overrides.a.image!.marginLeft).toBe(8);
});

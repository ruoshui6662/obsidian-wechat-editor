import {expect,it} from 'vitest';
import {describeShadow,IMAGE_APPEARANCES,softShadow,matchesAppearance} from '../src/image-appearance';
import {normalizeImage,mergeImageStyles} from '../src/styles';
import {loadSettings} from '../../plugin/src/settings';
it('unspecifiedShadowsUseTheSameLightEdgeDescription',()=>{expect(describeShadow(normalizeImage({shadow:6}))).toEqual({opacity:10,blur:8,offsetY:1});expect(describeShadow(normalizeImage({shadow:0,shadowOpacity:40}))).toEqual({opacity:0,blur:0,offsetY:0});});
it('legacyLocalShadowOverridesMaskAdvancedGlobalShadowFields',()=>{
 for(const preset of IMAGE_APPEARANCES){expect(describeShadow(mergeImageStyles(preset.style,{shadow:12,radius:8,bakeEffects:true}))).toEqual({opacity:12,blur:14,offsetY:2});}
 expect(describeShadow(mergeImageStyles(IMAGE_APPEARANCES[0].style,{shadow:12,shadowOpacity:10}))).toEqual({opacity:10,blur:14,offsetY:2});
 const soft=IMAGE_APPEARANCES.find(p=>p.id==='shadow')!;expect(describeShadow(mergeImageStyles(soft.style,{shadowOpacity:10}))).toEqual({opacity:10,blur:8,offsetY:1});
});
it('softPresetSeparatesDarknessSoftnessAndOffset',()=>{const preset=IMAGE_APPEARANCES.find(p=>p.id==='shadow')!;expect(preset.style).toMatchObject({radius:4,shadow:6,borderWidth:0,backgroundMode:'preserve',shadowOpacity:10,shadowBlur:8,shadowOffsetY:1});expect(describeShadow(normalizeImage(preset.style))).toEqual({opacity:10,blur:8,offsetY:1});expect(softShadow(6)).toMatchObject({shadowOpacity:10,shadowBlur:8,shadowOffsetY:1});});
it('completeAppearancesReplaceEveryDecorationButKeepGeometry',()=>{
 const geometries={alignment:'center' as const,leftInset:8,rightInset:24,widthPercent:55,marginBefore:6,marginAfter:30};
 for(const preset of IMAGE_APPEARANCES){const a=normalizeImage({...geometries,radius:27,borderWidth:7,borderColor:'#ff0000',background:'#112233',backgroundMode:'solid',shadow:29,shadowOpacity:45,shadowBlur:70,shadowOffsetY:20,...preset.style}),b=normalizeImage({...geometries,...preset.style});expect(a).toEqual(b);expect(a).toMatchObject(geometries);expect(matchesAppearance(a,preset)).toBe(true);}
});
it('customShadowFieldsAndBackgroundStrategyRoundTripAndRejectInvalidValues',()=>{
 const data=loadSettings({notes:{'稿.md':{overrides:{a:{image:{backgroundMode:'preserve',shadowOpacity:10,shadowBlur:8,shadowOffsetY:1}}}}},templates:[{id:'t',name:'个人',imageDefault:{backgroundMode:'solid',shadowOpacity:14,shadowBlur:20,shadowOffsetY:3}}]});expect(data.notes['稿.md'].overrides.a.image).toMatchObject({backgroundMode:'preserve',shadowOpacity:10,shadowBlur:8,shadowOffsetY:1});expect(data.templates[0].imageDefault).toMatchObject({backgroundMode:'solid',shadowOpacity:14});expect(normalizeImage({shadowOpacity:999,shadowBlur:999,shadowOffsetY:-1})).toMatchObject({shadowOpacity:50,shadowBlur:80,shadowOffsetY:0});expect(normalizeImage({backgroundMode:'url(bad)'} as any).backgroundMode).toBeUndefined();
});
it('appearanceSelectionDoesNotMislabelCustomColorOrAdvancedShadowParameters',()=>{const preset=IMAGE_APPEARANCES.find(p=>p.id==='floating')!;expect(matchesAppearance(normalizeImage({...preset.style,background:'#ffeedd'}),preset)).toBe(false);expect(matchesAppearance(normalizeImage({...preset.style,shadowOpacity:40}),preset)).toBe(false);});
it('cssFallbackUsesIndependentShadowAndExplicitBackgroundStrategy',async()=>{
 const {parseArticle}=await import('../src/parse'),{renderArticle}=await import('../src/render'),{DEFAULT_LAYOUT}=await import('../src/styles'),{JSDOM}=await import('jsdom');
 const article=parseArticle('![[图.png]] ^pic','稿.md'),style=normalizeImage({shadow:6,shadowOpacity:10,shadowBlur:8,shadowOffsetY:1,backgroundMode:'solid',background:'#ffeedd'});const d=new JSDOM(renderArticle(article,DEFAULT_LAYOUT,new Map([['img-0','https://mmbiz.qpic.cn/a']]),{pic:{image:style}}).html).window.document;const image=d.querySelector('img')!;expect(image.style.boxShadow).toBe('0 1px 8px rgba(0,0,0,0.1)');expect(image.style.backgroundColor).toBe('rgb(255, 238, 221)');
 const transparent=new JSDOM(renderArticle(article,DEFAULT_LAYOUT,new Map([['img-0','https://mmbiz.qpic.cn/a']]),{pic:{image:{...style,backgroundMode:'preserve'}}}).html).window.document.querySelector('img')!;expect(transparent.style.filter).toBe('');expect(transparent.style.boxShadow).toBe('0 1px 8px rgba(0,0,0,0.1)');
});

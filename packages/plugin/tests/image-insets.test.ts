// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
import {ImageInspector} from '../src/image-inspector';
import {loadSettings} from '../src/settings';
import {normalizeImage,mergeImageStyles} from '../../core/src/styles';
it('legacyExtraWhitespaceIsShownAsItsRealInsetAndChoosing16Stores16AsTheTarget',async()=>{
 const root=document.createElement('div');document.body.append(root);let patch:any;
 const inspector=new ImageInspector(root,false,{stateChanged:()=>{},change:async value=>{patch=value;}});
 inspector.sync(normalizeImage({alignment:'justify',marginLeft:16,marginRight:16}),'图.png',16);
 const select=root.querySelector<HTMLSelectElement>('[data-number-select=marginLeft]')!;expect(select.value).toBe('32');select.value='16';select.dispatchEvent(new Event('change'));
 await vi.waitFor(()=>expect(patch).toMatchObject({leftInset:16}));expect(select.value).toBe('16');
 expect(root.querySelector<HTMLSelectElement>('[data-number-select=marginRight]')!.value).toBe('32');inspector.dispose();root.remove();
});
it('newInsetRoundTripsAndExplicitLegacyLocalValuesStillBeatNewGlobalInsets',()=>{
 const saved=loadSettings({notes:{'稿.md':{overrides:{'*':{image:{leftInset:16,rightInset:16}},pic:{image:{marginLeft:8}}}}}});
 expect(saved.notes['稿.md'].overrides['*'].image).toMatchObject({leftInset:16,rightInset:16});
 const merged=mergeImageStyles(saved.notes['稿.md'].overrides['*'].image,saved.notes['稿.md'].overrides.pic.image);
 expect(merged.leftInset).toBeUndefined();expect(merged.marginLeft).toBe(8);expect(merged.rightInset).toBe(16);
 const reset=mergeImageStyles({leftInset:24},{leftInset:null,marginLeft:0});expect(reset.leftInset).toBeNull();expect(reset.marginLeft).toBe(0);
});

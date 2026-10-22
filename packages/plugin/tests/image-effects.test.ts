import {it,expect} from 'vitest';
import {effectBounds} from '../src/image-effects';
import {DEFAULT_IMAGE} from '../../core/src/styles';
it('shadowNeverAddsABlankFrameToThePhoto',()=>{const b=effectBounds(200,100,{...DEFAULT_IMAGE,shadow:8,borderWidth:2});expect(b.width).toBe(200);expect(b.height).toBe(100);expect(b.padding).toBe(0);});

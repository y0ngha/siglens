import { describe, expect, it } from 'vitest';
import { labelHalo } from '@/widgets/chart/utils/labelHalo';

describe('labelHalo', () => {
    it('surrounds the glyphs on all four sides plus a soft blur in the given color', () => {
        const halo = labelHalo('#09090b');
        expect(halo.split(', ')).toEqual([
            '1px 0 0 #09090b',
            '-1px 0 0 #09090b',
            '0 1px 0 #09090b',
            '0 -1px 0 #09090b',
            '0 0 2px #09090b',
        ]);
    });
});

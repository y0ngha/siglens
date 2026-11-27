import { describe, expect, it } from 'vitest';
import { benchmarkPoolName } from '../benchmarkPoolName';

const NAMES = { primary: '기본 문항', aux: '보조 문항' };

describe('benchmarkPoolName', () => {
    it('replaces the internal pool ids with their display names', () => {
        expect(benchmarkPoolName('primary', NAMES)).toBe('기본 문항');
        expect(benchmarkPoolName('aux', NAMES)).toBe('보조 문항');
    });

    it('keeps a pool id that is already a display name', () => {
        expect(benchmarkPoolName('L5', NAMES)).toBe('L5');
    });

    it('does not resolve inherited object keys as pool names', () => {
        expect(benchmarkPoolName('toString', NAMES)).toBe('toString');
    });
});

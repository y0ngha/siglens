import { describe, expect, it } from 'vitest';
import { COMPOSITE_TERM, axisTerm } from '../../utils/axisTerm';

describe('axisTerm', () => {
    it('미국 점수표는 모든 축에 시장 공통 풀이를 쓴다', () => {
        expect(axisTerm('insider', 'us')).toBe('form4');
        expect(axisTerm('largeHolders', 'us')).toBe('largeHolder13dg');
    });

    it('한국 점수표는 한국 전용 풀이가 있는 축(임원·대량보유)에 그것을 쓴다', () => {
        expect(axisTerm('insider', 'kr')).toBe('krInsider');
        expect(axisTerm('largeHolders', 'kr')).toBe('krMajorHolder');
    });

    it('한국 점수표에서도 한국 전용 풀이가 없는 축은 공통 풀이로 되돌아간다', () => {
        expect(axisTerm('institutional', 'kr')).toBe('institutionalHolding');
        expect(axisTerm('short', 'kr')).toBe('shortInterest');
        expect(axisTerm('dilution', 'kr')).toBe('dilution');
    });
});

describe('COMPOSITE_TERM', () => {
    it('시장마다 종합 점수 풀이가 다르다', () => {
        expect(COMPOSITE_TERM).toEqual({ us: 'flowScore', kr: 'krFlowScore' });
    });
});

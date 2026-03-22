import { detectPatterns } from '@/domain/patterns/detect';
import type { Bar, PatternType } from '@/domain/types';

const TEST_BAR_COUNT = 20;

function makeBar(i: number): Bar {
    return {
        time: 1700000000 + i * 60,
        open: 100,
        high: 105,
        low: 95,
        close: 100,
        volume: 1000,
    };
}

const ALL_PATTERN_TYPES: PatternType[] = [
    'head_and_shoulders',
    'inverse_head_and_shoulders',
    'ascending_wedge',
    'descending_wedge',
    'double_top',
    'double_bottom',
];

const bars: Bar[] = Array.from({ length: TEST_BAR_COUNT }, (_, i) =>
    makeBar(i)
);

describe('detectPatterns', () => {
    describe('bars가 비어 있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(detectPatterns([], ALL_PATTERN_TYPES)).toEqual([]);
        });
    });

    describe('activePatterns가 비어 있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(detectPatterns(bars, [])).toEqual([]);
        });
    });

    describe('bars와 activePatterns가 모두 있을 때', () => {
        it('빈 배열을 반환한다 — 실제 감지는 AI가 skills/*.md 기준으로 수행한다', () => {
            expect(detectPatterns(bars, ALL_PATTERN_TYPES)).toEqual([]);
        });
    });
});

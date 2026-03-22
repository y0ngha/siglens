import { detectPatterns } from '@/domain/patterns/detect';
import type { Bar, PatternType } from '@/domain/types';

const TEST_BAR_COUNT = 20;

function makeBar(i: number): Bar {
    return {
        time: 1700000000 + i * 60,
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 105 + i,
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

describe('detectPatterns', () => {
    describe('bars가 비어 있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(detectPatterns([], ALL_PATTERN_TYPES)).toEqual([]);
        });
    });

    describe('activePatterns가 비어 있을 때', () => {
        it('빈 배열을 반환한다', () => {
            const bars = Array.from({ length: TEST_BAR_COUNT }, (_, i) =>
                makeBar(i)
            );
            expect(detectPatterns(bars, [])).toEqual([]);
        });
    });

    describe('bars와 activePatterns 모두 있을 때', () => {
        it('패턴 감지는 AI(buildPrompt)가 담당하므로 빈 배열을 반환한다', () => {
            const bars = Array.from({ length: TEST_BAR_COUNT }, (_, i) =>
                makeBar(i)
            );
            expect(detectPatterns(bars, ALL_PATTERN_TYPES)).toEqual([]);
        });
    });

    describe('반환 타입', () => {
        it('항상 배열을 반환한다', () => {
            const bars = Array.from({ length: TEST_BAR_COUNT }, (_, i) =>
                makeBar(i)
            );
            const result = detectPatterns(bars, ['double_top']);
            expect(Array.isArray(result)).toBe(true);
        });
    });
});

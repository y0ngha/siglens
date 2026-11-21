import { describe, expect, it } from 'vitest';
import { compactFearGreedHistory } from '../../lib/compactFearGreedHistory';

describe('compactFearGreedHistory', () => {
    it('앞쪽 워밍업 null 구간만 잘라 낸다', () => {
        expect(
            compactFearGreedHistory([
                { date: '2026-01-01', score: null, label: null },
                { date: '2026-01-02', score: null, label: null },
                { date: '2026-01-03', score: 40, label: 'FEAR' },
            ])
        ).toEqual([{ date: '2026-01-03', score: 40, label: 'FEAR' }]);
    });

    it('중간의 null은 남긴다', () => {
        expect(
            compactFearGreedHistory([
                { date: '2026-01-01', score: 40, label: 'FEAR' },
                { date: '2026-01-02', score: null, label: null },
                { date: '2026-01-03', score: 60, label: 'GREED' },
            ])
        ).toEqual([
            { date: '2026-01-01', score: 40, label: 'FEAR' },
            { date: '2026-01-02', score: null, label: null },
            { date: '2026-01-03', score: 60, label: 'GREED' },
        ]);
    });

    it('점수는 정수로 반올림하고 라벨은 그대로 둔다', () => {
        expect(
            compactFearGreedHistory([
                { date: '2026-01-01', score: 24.49, label: 'EXTREME_FEAR' },
                { date: '2026-01-02', score: 24.5, label: 'EXTREME_FEAR' },
            ])
        ).toEqual([
            { date: '2026-01-01', score: 24, label: 'EXTREME_FEAR' },
            { date: '2026-01-02', score: 25, label: 'EXTREME_FEAR' },
        ]);
    });

    it('빈 이력과 전부 null인 이력은 빈 배열이다', () => {
        expect(compactFearGreedHistory([])).toEqual([]);
        expect(
            compactFearGreedHistory([
                { date: '2026-01-01', score: null, label: null },
            ])
        ).toEqual([]);
    });
});

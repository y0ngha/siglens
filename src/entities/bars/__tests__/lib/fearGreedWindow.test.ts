import { describe, expect, it } from 'vitest';
import {
    pointBefore,
    scoredHistory,
    scoreExtremes,
    TRADING_DAYS,
    yearScoreExtremes,
    type ScoredPoint,
} from '@/entities/bars/lib/fearGreedWindow';

const pts = (scores: number[]): ScoredPoint[] =>
    scores.map((score, i) => ({
        date: `d${i}`,
        score,
        label: 'NEUTRAL' as const,
    }));

describe('fearGreedWindow', () => {
    it('scoredHistory drops warm-up points', () => {
        const out = scoredHistory([
            { date: 'a', score: null, label: null },
            { date: 'b', score: 50, label: 'NEUTRAL' },
        ]);
        expect(out).toEqual([{ date: 'b', score: 50, label: 'NEUTRAL' }]);
    });

    it('pointBefore counts back from the latest and is null when too short', () => {
        expect(pointBefore(pts([1, 2, 3]), 2)?.date).toBe('d0');
        expect(pointBefore(pts([1, 2, 3]), 3)).toBeNull();
    });

    it('scoreExtremes keeps the earliest point on ties and is null when empty', () => {
        const r = scoreExtremes(pts([20, 10, 10, 20]))!;
        expect(r.min.date).toBe('d1');
        expect(r.max.date).toBe('d0');
        expect(scoreExtremes([])).toBeNull();
    });

    it('yearScoreExtremes only looks at the last 252 points', () => {
        const scores = Array.from({ length: TRADING_DAYS.year + 1 }, () => 50);
        scores[0] = 0;
        expect(yearScoreExtremes(pts(scores))!.min.score).toBe(50);
    });
});

import { describe, expect, it } from 'vitest';
import { scoredHistory } from '@/entities/bars/lib/fearGreedWindow';
import { buildFearGreedHistoryView } from '@/features/agent-tools/server/tools/getBarsIndicators';
import { defined } from '@/shared/test-utils/defined';
import {
    buildFearGreedPeriodComparisonLine,
    buildFearGreedYearRangeLine,
} from '@/views/symbol/fearGreed/utils/fearGreedFacts';

/**
 * 에이전트 `get_bars_indicators`의 공포·탐욕 비교점(`buildFearGreedHistoryView`)이 종목 공포·탐욕 페이지의
 * 크롤 문장과 같은 지점을 가리키는지. 도구는 features, 문장은 views에 있어 views 쪽에서 둘을 함께 본다.
 */
describe('buildFearGreedHistoryView ↔ 페이지 공포·탐욕 문장', () => {
    const series = (n: number, withWarmup = 0) => [
        ...Array.from({ length: withWarmup }, (_, i) => ({
            date: `w${i}`,
            score: null,
            label: null,
        })),
        ...Array.from({ length: n }, (_, i) => ({
            date: `d${i}`,
            score: i + 0.4,
            label: 'NEUTRAL' as const,
        })),
    ];

    it('페이지의 연간 범위·기간 비교 문장과 같은 지점을 가리킨다', () => {
        const history = series(300, 10);
        const v = buildFearGreedHistoryView(history);
        const points = scoredHistory(history);
        const echo = (key: string, values?: Record<string, unknown>) =>
            JSON.stringify([key, values]);
        const range = JSON.parse(
            defined(buildFearGreedYearRangeLine(points, echo as never))
        )[1];
        expect(range.v1).toBe(v.yearMin?.score);
        expect(range.v2).toBe(v.yearMin?.date);
        expect(range.v3).toBe(v.yearMax?.score);
        expect(range.v4).toBe(v.yearMax?.date);
        // 주/월/년 전 점수는 페이지 문장이 쓰는 `pointBefore`와 같은 값.
        const periods = buildFearGreedPeriodComparisonLine(
            points,
            echo as never,
            echo as never
        );
        for (const p of [v.weekAgo, v.monthAgo, v.yearAgo])
            expect(periods).toContain(String(p?.score));
    });
});

import { describe, expect, it } from 'vitest';
import { summarizeAnalystTargets } from '../summarizeAnalystTargets';

const targets = (
    yahoo: { mean: number | null; analysts: number | null } | null,
    sourcesDisagree = false
) => ({
    targets: {
        yahoo:
            yahoo === null
                ? null
                : { ...yahoo, median: null, low: null, high: null },
        fmp: null,
        gapPct: null,
        sourcesDisagree,
    },
});

describe('summarizeAnalystTargets', () => {
    it('Yahoo 평균·애널리스트 수만 남긴다(불일치는 렌더 때 계산)', () => {
        expect(
            summarizeAnalystTargets(
                targets({ mean: 276.56, analysts: 53 }, true)
            )
        ).toEqual({
            yahooMean: 276.56,
            yahooAnalysts: 53,
        });
    });

    it('애널리스트 수를 모르면 null 그대로', () => {
        expect(
            summarizeAnalystTargets(targets({ mean: 10, analysts: null }))
                ?.yahooAnalysts
        ).toBeNull();
    });

    it('Yahoo 목표가나 평균이 없으면 null', () => {
        expect(summarizeAnalystTargets(targets(null))).toBeNull();
        expect(
            summarizeAnalystTargets(targets({ mean: null, analysts: 5 }))
        ).toBeNull();
    });
});

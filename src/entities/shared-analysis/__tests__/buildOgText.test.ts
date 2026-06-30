import { buildOgText } from '@/entities/shared-analysis/server/buildOgText';
import type { SharedAnalysisSnapshot } from '@/entities/shared-analysis/types';

function snap(kind: string, result: unknown): SharedAnalysisSnapshot {
    return {
        kind,
        symbol: 'AAPL',
        context: {
            symbol: 'AAPL',
            displayName: 'Apple',
            assetClass: 'us_equity',
        },
        result,
    } as unknown as SharedAnalysisSnapshot;
}

describe('buildOgText', () => {
    it('chart: uses trend + summary first line', () => {
        const out = buildOgText(
            snap('chart', { trend: 'bullish', summary: '상승 추세\n둘째 줄' })
        );
        expect(out.description).toContain('상승');
        expect(out.description).not.toContain('둘째 줄');
    });
    it('news: uses overallSentiment + currentDriverKo', () => {
        const out = buildOgText(
            snap('news', {
                overallSentiment: 'bearish',
                currentDriverKo: '악재 지속',
            })
        );
        expect(out.description).toContain('악재 지속');
    });
    it('fear-greed: uses label + score', () => {
        const out = buildOgText(
            snap('fear-greed', { label: 'EXTREME_FEAR', score: 12 })
        );
        expect(out.description).toContain('12');
    });
    it('overall: derives direction from scenarios when no top-level field', () => {
        const out = buildOgText(
            snap('overall', {
                headlineKo: '혼조세 전망',
                scenarios: [
                    { name: 'bearish' },
                    { name: 'bearish' },
                    { name: 'bullish' },
                ],
            })
        );
        expect(out.description).toContain('혼조세 전망');
    });
    it('options: derives from tone/signals + summary', () => {
        const out = buildOgText(
            snap('options', {
                summary: '콜 우위',
                signals: [{ kind: 'bullish' }],
            })
        );
        expect(out.description).toContain('콜 우위');
    });
    it('clamps tweet text to the max length', () => {
        const long = 'x'.repeat(500);
        const out = buildOgText(
            snap('chart', { trend: 'neutral', summary: long })
        );
        expect(out.tweet.length).toBeLessThanOrEqual(180);
    });

    // ── T3: fundamental, financials, congress + ?? fallback paths ─────────────

    it('fundamental: uses overallSentiment + overallConclusionKo', () => {
        const out = buildOgText(
            snap('fundamental', {
                overallSentiment: 'bullish',
                overallConclusionKo: '실적 개선 기대',
            })
        );
        expect(out.description).toContain('강세');
        expect(out.description).toContain('실적 개선 기대');
    });

    it('financials: uses overallSentiment + overallConclusionKo', () => {
        const out = buildOgText(
            snap('financials', {
                overallSentiment: 'bearish',
                overallConclusionKo: '매출 감소 우려',
            })
        );
        expect(out.description).toContain('약세');
        expect(out.description).toContain('매출 감소 우려');
    });

    it('congress: uses overallSentiment + summaryKo', () => {
        const out = buildOgText(
            snap('congress', {
                overallSentiment: 'neutral',
                summaryKo: '의회 매수 지속',
            })
        );
        expect(out.description).toContain('중립');
        expect(out.description).toContain('의회 매수 지속');
    });

    it('fundamental: falls back to "neutral" when overallSentiment is absent', () => {
        const out = buildOgText(snap('fundamental', {}));
        // direction maps "neutral" → "중립"
        expect(out.description).toContain('중립');
    });

    it('financials: falls back to "neutral" when overallSentiment is absent', () => {
        const out = buildOgText(snap('financials', {}));
        expect(out.description).toContain('중립');
    });

    it('congress: falls back to "neutral" when overallSentiment is absent', () => {
        const out = buildOgText(snap('congress', {}));
        expect(out.description).toContain('중립');
    });

    it('overall: falls back to "neutral" when scenarios is absent', () => {
        const out = buildOgText(snap('overall', { headlineKo: '혼조세' }));
        // majorityName([]) === 'neutral' → "중립"
        expect(out.description).toContain('중립');
    });

    it('overall: falls back to "neutral" when scenarios entries have no name', () => {
        const out = buildOgText(
            snap('overall', {
                headlineKo: '불확실',
                // scenarios with no name property → counts map stays empty → best stays 'neutral'
                scenarios: [{}, {}],
            })
        );
        expect(out.description).toContain('중립');
    });
});

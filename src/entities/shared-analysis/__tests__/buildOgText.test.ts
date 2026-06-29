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
});

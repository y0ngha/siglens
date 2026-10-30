import type { Mock } from 'vitest';
import {
    computeFearGreedIndex,
    type FearGreedSnapshot,
} from '@y0ngha/siglens-core';
import { getTranslations } from 'next-intl/server';
import { buildFearGreedSummaryModel } from '../utils/fearGreedSummaryModel';
import type { FearGreedSummaryTranslators } from '../utils/fearGreedSummaryModel';

// 실제 walk-forward 점수는 90+ 봉 픽스처가 필요하다 — 스냅샷 산출부만 대체한다.
vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    computeFearGreedIndex: vi.fn(),
}));

const SNAPSHOT: FearGreedSnapshot = {
    score: 61.6,
    label: 'GREED',
    groups: [],
    confidence: 'normal',
    sampleSize: 220,
    warning: null,
};

let translators: FearGreedSummaryTranslators;
beforeAll(async () => {
    const [tLabel, tFacts, tFactor] = await Promise.all([
        getTranslations({ locale: 'ko', namespace: 'shared.enumLabel' }),
        getTranslations({
            locale: 'ko',
            namespace: 'views.symbol.fearGreedFacts',
        }),
        getTranslations({
            locale: 'ko',
            namespace: 'shared.lib.fearGreedFactor',
        }),
    ]);
    translators = { tLabel, tFacts, tFactor };
});

describe('buildFearGreedSummaryModel', () => {
    it('스냅샷을 계산할 수 없으면 null이다', () => {
        (computeFearGreedIndex as Mock).mockReturnValue(null);
        expect(
            buildFearGreedSummaryModel(
                { bars: [], buySellVolume: [], market: null, locale: 'ko' },
                translators
            )
        ).toBeNull();
    });

    it('점수를 반올림하고 마지막 봉의 UTC 날짜를 기준 시점으로 단다', () => {
        (computeFearGreedIndex as Mock).mockReturnValue(SNAPSHOT);
        const time = Math.floor(Date.UTC(2026, 9, 27, 20) / 1000);
        const model = buildFearGreedSummaryModel(
            {
                bars: [
                    { time, open: 1, high: 2, low: 0.5, close: 1.5, volume: 9 },
                ],
                buySellVolume: [{ buyVolume: 6, sellVolume: 4 }],
                market: null,
                locale: 'ko',
            },
            translators
        );
        expect(model?.score).toBe(62);
        expect(model?.asOfLabel).toBe('2026-10-27');
    });

    it('봉이 없으면 기준 시점은 null이다', () => {
        (computeFearGreedIndex as Mock).mockReturnValue(SNAPSHOT);
        const model = buildFearGreedSummaryModel(
            { bars: [], buySellVolume: [], market: null, locale: 'ko' },
            translators
        );
        expect(model?.asOfLabel).toBeNull();
    });
});

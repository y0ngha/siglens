import { describe, expect, it } from 'vitest';
import { FEAR_GREED_DATA_MARKETS } from '@/shared/config/fearGreedData';
import { SITE_URL } from '@/shared/lib/seo';
import {
    hubView,
    scoredHistory,
} from '@/__tests__/utils/marketFearGreedHubView';
import { buildMarketFearGreedDatasetJsonLd } from '../marketFearGreedJsonLd';

const BASE = {
    market: 'us',
    name: '미국 공포 탐욕 지수',
    description: '미국 증시 전체의 매수 심리를 0~100 점수로 보여줍니다.',
    url: `${SITE_URL}/fear-greed`,
    locale: 'ko',
} as const;

const SNAPSHOT = {
    score: 24,
    label: 'EXTREME_FEAR',
    factors: [],
    confidence: 'normal',
    sampleSize: 200,
    asOf: '2026-11-05',
} as const;

const COMPARISONS = [
    { key: 'now', date: '2026-11-05', score: 24, label: 'EXTREME_FEAR' },
    { key: '1y', date: '2025-11-05', score: 33, label: 'FEAR' },
] as const;

function distributionOf(
    dataset: Record<string, unknown> | null
): ReadonlyArray<Record<string, unknown>> | undefined {
    return dataset?.distribution as
        | ReadonlyArray<Record<string, unknown>>
        | undefined;
}

describe('buildMarketFearGreedDatasetJsonLd', () => {
    it('판독값이 없으면 null이다', () => {
        expect(
            buildMarketFearGreedDatasetJsonLd({ ...BASE, view: hubView() })
        ).toBeNull();
    });

    it('비교점이 없으면 기간은 판독일 하루이고 distribution은 없다', () => {
        const dataset = buildMarketFearGreedDatasetJsonLd({
            ...BASE,
            view: hubView({ snapshot: SNAPSHOT }),
        });
        expect(dataset).toMatchObject({
            url: `${SITE_URL}/fear-greed`,
            temporalCoverage: '2026-11-05/2026-11-05',
            dateModified: '2026-11-05',
        });
        expect(dataset).not.toHaveProperty('distribution');
    });

    it('기록이 하한 미만이면 기존 비교점 기준 기간이고 distribution은 없다', () => {
        const dataset = buildMarketFearGreedDatasetJsonLd({
            ...BASE,
            view: hubView({
                snapshot: SNAPSHOT,
                comparisons: [...COMPARISONS],
                history: scoredHistory(19, '2026-11-05'),
            }),
        });
        expect(dataset).toMatchObject({
            temporalCoverage: '2025-11-05/2026-11-05',
        });
        expect(dataset).not.toHaveProperty('distribution');
    });

    it('기록의 마지막 날짜가 기준일과 다르면 distribution은 없다', () => {
        const dataset = buildMarketFearGreedDatasetJsonLd({
            ...BASE,
            view: hubView({
                snapshot: SNAPSHOT,
                history: scoredHistory(30, '2026-11-04'),
            }),
        });
        expect(dataset).not.toHaveProperty('distribution');
    });

    describe.each(FEAR_GREED_DATA_MARKETS)('%s 시장', market => {
        it.each(['ko', 'en'] as const)(
            '%s 로케일에서도 같은 절대 URL의 DataDownload 두 개를 싣는다',
            locale => {
                const dataset = buildMarketFearGreedDatasetJsonLd({
                    ...BASE,
                    market,
                    locale,
                    view: hubView({
                        snapshot: SNAPSHOT,
                        comparisons: [...COMPARISONS],
                        history: scoredHistory(30, '2026-11-05'),
                    }),
                });
                const hub =
                    market === 'us' ? '/fear-greed' : `/fear-greed/${market}`;
                expect(distributionOf(dataset)).toEqual([
                    {
                        '@type': 'DataDownload',
                        encodingFormat: 'text/csv',
                        contentUrl: `${SITE_URL}${hub}/data.csv`,
                    },
                    {
                        '@type': 'DataDownload',
                        encodingFormat: 'application/json',
                        contentUrl: `${SITE_URL}${hub}/data.json`,
                    },
                ]);
            }
        );
    });

    it('기간은 점수가 있는 첫 날부터 기준일까지다', () => {
        const history = scoredHistory(30, '2026-11-05');
        const dataset = buildMarketFearGreedDatasetJsonLd({
            ...BASE,
            view: hubView({
                snapshot: SNAPSHOT,
                comparisons: [...COMPARISONS],
                history,
            }),
        });
        expect(dataset).toMatchObject({
            temporalCoverage: `${history[0].date}/2026-11-05`,
            dateModified: '2026-11-05',
        });
    });
});

import { describe, expect, it } from 'vitest';
import { SITE_URL } from '@/shared/lib/seo';
import { buildMarketFearGreedDatasetJsonLd } from '../marketFearGreedJsonLd';

const BASE = {
    name: '미국 공포 탐욕 지수',
    description: '미국 증시 전체의 매수 심리를 0~100 점수로 보여줍니다.',
    url: `${SITE_URL}/fear-greed`,
    locale: 'ko',
} as const;

describe('buildMarketFearGreedDatasetJsonLd', () => {
    it('판독값이 없으면 null이다', () => {
        expect(
            buildMarketFearGreedDatasetJsonLd({
                ...BASE,
                view: { snapshot: null, comparisons: [] },
            })
        ).toBeNull();
    });

    it('비교점이 없으면 기간은 판독일 하루다', () => {
        const dataset = buildMarketFearGreedDatasetJsonLd({
            ...BASE,
            view: {
                snapshot: {
                    score: 24,
                    label: 'EXTREME_FEAR',
                    factors: [],
                    confidence: 'normal',
                    sampleSize: 200,
                    asOf: '2026-11-05',
                },
                comparisons: [],
            },
        });
        expect(dataset).toMatchObject({
            url: `${SITE_URL}/fear-greed`,
            temporalCoverage: '2026-11-05/2026-11-05',
            dateModified: '2026-11-05',
        });
    });
});

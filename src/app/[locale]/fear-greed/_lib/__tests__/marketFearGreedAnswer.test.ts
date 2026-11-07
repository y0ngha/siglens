import { describe, expect, it } from 'vitest';
import type { MarketFearGreedView } from '@/entities/market-fear-greed/model';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
import { fearGreedCopyFor } from '../../copy';
import {
    composeMarketFearGreedTitle,
    marketFearGreedMetaFacts,
    pickFactorExtremes,
} from '../marketFearGreedAnswer';

const SNAPSHOT = {
    score: 24,
    label: 'EXTREME_FEAR',
    factors: [],
    confidence: 'normal',
    sampleSize: 200,
    asOf: '2026-11-05',
} as const satisfies MarketFearGreedView['snapshot'];

describe('marketFearGreedMetaFacts', () => {
    it('판독값이 없으면 null이다', () => {
        expect(
            marketFearGreedMetaFacts({ snapshot: null, comparisons: [] })
        ).toBeNull();
    });

    it('현재 점·과거 점을 1주·1개월·1년 전 사실로 옮긴다', () => {
        const facts = marketFearGreedMetaFacts({
            snapshot: SNAPSHOT,
            comparisons: [
                {
                    key: 'now',
                    date: '2026-11-05',
                    score: 24,
                    label: 'EXTREME_FEAR',
                },
                { key: '1w', date: '2026-10-29', score: 36, label: 'FEAR' },
                { key: '1m', date: '2026-10-06', score: 51, label: 'NEUTRAL' },
                { key: '1y', date: '2025-11-05', score: 34, label: 'FEAR' },
            ],
        });
        expect(facts).toEqual({
            date: '2026-11-05',
            score: 24,
            label: 'EXTREME_FEAR',
            past: [
                { period: 'week', score: 36 },
                { period: 'month', score: 51 },
                { period: 'year', score: 34 },
            ],
            range: null,
        });
    });

    /**
     * 이력이 짧으면 비교점이 가장 이른 세션으로 당겨진다(시장 뷰는 `clamped`를 싣지 않는다).
     * 몇 주 전 세션을 "1년 전"이라고 부르면 답 문장이 사실과 달라진다.
     */
    it('이력이 짧아 당겨진 비교점은 기간 이름으로 싣지 않는다', () => {
        const facts = marketFearGreedMetaFacts({
            snapshot: SNAPSHOT,
            comparisons: [
                {
                    key: 'now',
                    date: '2026-11-05',
                    score: 24,
                    label: 'EXTREME_FEAR',
                },
                { key: '1w', date: '2026-10-29', score: 36, label: 'FEAR' },
                { key: '1m', date: '2026-10-20', score: 40, label: 'FEAR' },
                { key: '1y', date: '2026-10-20', score: 40, label: 'FEAR' },
            ],
        });
        expect(facts?.past).toEqual([{ period: 'week', score: 36 }]);
    });
});

describe('composeMarketFearGreedTitle', () => {
    const tSeo = catalogTranslator('shared.seo');
    const tLabel = catalogTranslator('shared.enumLabel');

    it('판독값의 기준일·점수·단계로 제목을 만든다(가운뎃점 없이)', () => {
        const title = composeMarketFearGreedTitle(
            { snapshot: SNAPSHOT, comparisons: [] },
            '코스피 공포탐욕지수',
            tSeo,
            tLabel
        );
        expect(title).toBe(
            '코스피 공포탐욕지수 24점(극심한 공포) 11월 5일 기준'
        );
        expect(title).not.toContain('·');
    });

    it('판독값이 없으면 null이다', () => {
        expect(
            composeMarketFearGreedTitle(
                { snapshot: null, comparisons: [] },
                '코스피 공포탐욕지수',
                tSeo,
                tLabel
            )
        ).toBeNull();
    });

    it('세 시장의 점수형 제목 주어와 템플릿 제목이 서로 겹치지 않는다', () => {
        const copies = (['us', 'kr', 'crypto'] as const).map(market =>
            fearGreedCopyFor(market, tSeo)
        );
        expect(new Set(copies.map(c => c.titleSubject)).size).toBe(3);
        expect(new Set(copies.map(c => c.title)).size).toBe(3);
    });
});

describe('pickFactorExtremes', () => {
    it('백분위 최저·최고 요인을 반올림해 고른다', () => {
        expect(
            pickFactorExtremes([
                { key: 'momentum', rawValue: 0, percentile: 13.4 },
                { key: 'volatility', rawValue: 0, percentile: 0.6 },
                { key: 'breadth', rawValue: 0, percentile: 99.6 },
            ])
        ).toEqual({
            fear: { key: 'volatility', percentile: 1 },
            greed: { key: 'breadth', percentile: 100 },
        });
    });

    it('모든 요인이 한쪽에 몰려 있거나 반올림 뒤 같으면 null이다(사실과 어긋난 문장을 내지 않는다)', () => {
        // 모두 탐욕 쪽 — "백분위 70이 가장 공포 쪽"이라고 말하지 않는다.
        expect(
            pickFactorExtremes([
                { key: 'a', rawValue: 0, percentile: 70 },
                { key: 'b', rawValue: 0, percentile: 95 },
            ])
        ).toBeNull();
        // 반올림 뒤 둘 다 50.
        expect(
            pickFactorExtremes([
                { key: 'a', rawValue: 0, percentile: 49.6 },
                { key: 'b', rawValue: 0, percentile: 50.4 },
            ])
        ).toBeNull();
    });

    it('요인이 둘 미만이거나 모두 같은 백분위면 null이다', () => {
        expect(pickFactorExtremes([])).toBeNull();
        expect(
            pickFactorExtremes([{ key: 'a', rawValue: 0, percentile: 50 }])
        ).toBeNull();
        expect(
            pickFactorExtremes([
                { key: 'a', rawValue: 0, percentile: 50 },
                { key: 'b', rawValue: 0, percentile: 50 },
            ])
        ).toBeNull();
    });
});

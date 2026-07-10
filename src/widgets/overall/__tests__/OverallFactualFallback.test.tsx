// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { OverallFactualFallback } from '@/widgets/overall';

function makeNewsItem(
    id: string,
    overrides: Partial<NewsDisplayItem> = {}
): NewsDisplayItem {
    return {
        id,
        publishedAt: '2026-05-06T00:00:00.000Z',
        titleEn: `English headline ${id}`,
        titleKo: null,
        sentiment: null,
        category: null,
        bodyKo: null,
        summaryKo: null,
        priceImpact: null,
        url: `https://example.com/${id}`,
        source: 'Example',
        ...overrides,
    };
}

describe('OverallFactualFallback', () => {
    it('renders equity axes and news enrichment state', () => {
        render(
            <OverallFactualFallback
                symbol="AAPL"
                displayName="Apple Inc."
                assetClass="equity"
                newsItems={[
                    makeNewsItem('news-1', { sentiment: 'bullish' }),
                    makeNewsItem('news-2'),
                    makeNewsItem('news-3', { sentiment: 'neutral' }),
                ]}
            />
        );

        const section = screen.getByRole('region', {
            name: 'Apple Inc. 종합 분석 데이터 상태',
        });
        expect(section).toHaveTextContent(
            'Apple Inc. (AAPL) 종합 분석은 차트, 뉴스, 펀더멘털, 옵션, 공포 탐욕 지수를 함께 봅니다.'
        );
        expect(section).toHaveTextContent(
            '현재 서버가 확인한 최근 뉴스는 3건이며, 이 중 2건은 AI 뉴스 카드 분석이 완료됐습니다.'
        );
        expect(section).toHaveTextContent(
            '종합 AI 결론이 아직 캐시되지 않았습니다. 분석 결과가 준비되면 강세, 중립, 약세 시나리오와 위험 요인이 이 영역에 표시됩니다.'
        );
    });

    it('renders crypto axes without equity-only wording', () => {
        render(
            <OverallFactualFallback
                symbol="BTCUSD"
                displayName="Bitcoin"
                assetClass="crypto"
                newsItems={[makeNewsItem('crypto-1', { sentiment: 'bearish' })]}
            />
        );

        const section = screen.getByRole('region', {
            name: 'Bitcoin 종합 분석 데이터 상태',
        });
        expect(section).toHaveTextContent(
            'Bitcoin (BTCUSD) 종합 분석은 차트, 뉴스, 공포 탐욕 지수를 함께 봅니다.'
        );
        expect(section).not.toHaveTextContent('펀더멘털');
        expect(section).not.toHaveTextContent('옵션');
    });

    it('renders an honest empty news state', () => {
        render(
            <OverallFactualFallback
                symbol="AAPL"
                displayName="Apple Inc."
                assetClass="equity"
                newsItems={[]}
            />
        );

        const section = screen.getByRole('region', {
            name: 'Apple Inc. 종합 분석 데이터 상태',
        });
        expect(section).toHaveTextContent(
            '최근 뉴스 데이터는 아직 준비되지 않았습니다. 뉴스 카드가 분석되면 종합 분석의 뉴스 축 상태도 함께 반영됩니다.'
        );
        expect(section).not.toHaveTextContent('현재 서버가 확인한 최근 뉴스는');
    });
});

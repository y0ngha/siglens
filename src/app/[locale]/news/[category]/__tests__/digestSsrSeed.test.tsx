/**
 * D3 follow-up: SSR seed integration test for the `/news/[category]` digest.
 *
 * Unlike page.test.tsx (which stubs `MarketNewsDigest` entirely), this file
 * renders the REAL `MarketNewsDigest` widget so we can assert the prerendered
 * HTML actually contains the digest text when `peekMarketNewsDigestStatic`
 * hits — the whole point of the seed is that a crawler's first paint (SSR
 * HTML) has the AI narrative, not a skeleton.
 */

vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));

vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn().mockResolvedValue([
        {
            id: 'r1',
            symbol: '__NEWS_CRYPTO__',
            source: 'CoinWire',
            url: 'https://example.com/btc',
            publishedAt: '2026-06-15T10:00:00.000Z',
            titleEn: 'BTC up',
            titleKo: '비트코인 상승',
            bodyEn: null,
            bodyKo: null,
            summaryKo: '요약',
            sentiment: 'bullish', // enriched → hasEnrichedNews=true → no cards-wait polling
            category: 'crypto',
            priceImpact: 'high',
            tickers: ['BTCUSD'],
            analyzedAt: new Date('2026-06-15T10:05:00.000Z'),
        },
    ]),
}));

vi.mock('@/entities/market-news/api', () => ({
    getMarketNewsCards: vi.fn().mockResolvedValue([]),
}));

const { mockPeekMarketNewsDigestStatic } = vi.hoisted(() => ({
    mockPeekMarketNewsDigestStatic: vi.fn(),
}));
vi.mock('@/entities/market-news/api/marketNewsDigestStaticCache', () => ({
    peekMarketNewsDigestStatic: mockPeekMarketNewsDigestStatic,
}));

vi.mock('@/entities/market-news/actions', () => ({
    ensureMarketNewsCardsAnalyzedAction: vi.fn().mockResolvedValue(undefined),
    getMarketNewsCardsAction: vi.fn(),
    submitMarketNewsDigestAction: vi.fn(),
}));

// Never resolves — client-side digest stays "loading" so the seed is the
// only thing that can put text on screen (mirrors useMarketNewsDigest.test.tsx).
vi.mock('@/widgets/market-news/utils/fetchMarketNewsDigest', () => ({
    fetchMarketNewsDigest: vi.fn(() => new Promise(() => {})),
}));

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import CategoryNewsPage from '../page';

const DIGEST_FIXTURE: NewsAnalysisResponse = {
    currentDriverKo: 'SSR 시드로 노출되는 다이제스트 서술입니다.',
    keyEventsKo: ['시드 이벤트 하나'],
    upcomingEventsKo: [],
    overallSentiment: 'bullish',
};

function makeQueryWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    };
}

describe('/news/[category] 페이지의 다이제스트 SSR 시드는', () => {
    afterEach(() => {
        mockPeekMarketNewsDigestStatic.mockReset();
    });

    it('(Happy) peek 히트 시 prerender된 HTML에 다이제스트 본문이 그대로 실린다', async () => {
        mockPeekMarketNewsDigestStatic.mockResolvedValue(DIGEST_FIXTURE);

        render(
            await CategoryNewsPage({
                params: Promise.resolve({ locale: 'ko', category: 'crypto' }),
            }),
            { wrapper: makeQueryWrapper() }
        );

        // 실제 위젯(mock 아님)이 SSR 시드를 즉시 렌더한다 — 스켈레톤이 아니다.
        expect(
            screen.getByText('SSR 시드로 노출되는 다이제스트 서술입니다.')
        ).toBeInTheDocument();
        expect(screen.getByText('시드 이벤트 하나')).toBeInTheDocument();
        // 스켈레톤(로딩) 문구가 없어야 한다 — seed가 스켈레톤을 대체했다.
        expect(
            screen.queryByText('AI 다이제스트 생성 중이에요…')
        ).not.toBeInTheDocument();
    });

    it('(Worst) peek 미스(null) 시 스켈레톤(로딩) 상태로 떨어진다', async () => {
        mockPeekMarketNewsDigestStatic.mockResolvedValue(null);

        render(
            await CategoryNewsPage({
                params: Promise.resolve({ locale: 'ko', category: 'crypto' }),
            }),
            { wrapper: makeQueryWrapper() }
        );

        expect(
            screen.queryByText('SSR 시드로 노출되는 다이제스트 서술입니다.')
        ).not.toBeInTheDocument();
        // DigestStatusCard(로딩 스켈레톤)의 상태 문구가 대신 뜬다.
        expect(
            screen.getByText('AI 다이제스트 생성 중이에요…')
        ).toBeInTheDocument();
    });

    it('(Happy) peek 결과를 category/locale과 함께 호출한다', async () => {
        mockPeekMarketNewsDigestStatic.mockResolvedValue(null);

        await CategoryNewsPage({
            params: Promise.resolve({ locale: 'ko', category: 'crypto' }),
        });

        expect(mockPeekMarketNewsDigestStatic).toHaveBeenCalledWith(
            'crypto',
            'ko'
        );
    });
});

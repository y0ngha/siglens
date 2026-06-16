import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MarketNewsCard } from '../MarketNewsCard';
import type { MarketNewsCardItem } from '@/entities/market-news/actions';

const BASE: MarketNewsCardItem = {
    id: 'm1',
    url: 'https://example.com/btc',
    source: 'CoinWire',
    publishedAt: '2026-06-15T10:00:00Z',
    titleEn: 'BTC hits record',
    titleKo: 'BTC 상승',
    summaryKo: 'BTC 요약이에요.',
    bodyKo: null,
    sentiment: 'bullish' as const,
    priceImpact: 'high' as const,
    category: 'macro' as const,
    tickers: [],
};

describe('MarketNewsCard는', () => {
    it('암호화폐 티커 칩을 표시하되 딥링크는 걸지 않는다', () => {
        render(
            <MarketNewsCard
                category="crypto"
                item={{ ...BASE, tickers: ['BTCUSD'] }}
            />
        );
        const chip = screen.getByText('BTCUSD');
        // For non-stock categories, the chip must NOT be wrapped in an anchor.
        expect(chip.closest('a')).toBeNull();
    });

    it('주식 티커 칩은 /[symbol]로 딥링크한다', () => {
        render(
            <MarketNewsCard
                category="stock"
                item={{ ...BASE, tickers: ['AAPL'] }}
            />
        );
        expect(screen.getByText('AAPL').closest('a')).toHaveAttribute(
            'href',
            '/AAPL'
        );
    });

    it('티커가 없으면 칩 영역을 렌더하지 않는다', () => {
        render(
            <MarketNewsCard
                category="general"
                item={{ ...BASE, tickers: [] }}
            />
        );
        expect(screen.queryByTestId('ticker-chips')).toBeNull();
    });
});

import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeAll } from 'vitest';
import { getTranslations } from 'next-intl/server';
import { MarketNewsCard } from '../MarketNewsCard';
import { sentimentLabel, SENTIMENT_CLASS } from '../utils/sentimentConstants';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';
import type { MarketNewsCardItem } from '@/entities/market-news';

let t: EnumLabelTranslator;
beforeAll(async () => {
    t = await getTranslations({ locale: 'ko', namespace: 'shared.enumLabel' });
});

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

    it('pending 상태(sentiment === null)에서 AnalysisSkeleton을 렌더하고 감성 배지 텍스트는 DOM에 없다', () => {
        render(
            <MarketNewsCard
                category="crypto"
                item={{
                    ...BASE,
                    sentiment: null,
                    priceImpact: null,
                    category: null,
                    summaryKo: null,
                }}
            />
        );
        // AnalysisSkeleton renders "AI 분석 중…" text
        expect(screen.getByText('AI 분석 중…')).toBeInTheDocument();
        // Sentiment badge text (e.g. '긍정') must not be in the DOM
        expect(screen.queryByText(sentimentLabel('bullish', t))).toBeNull();
    });

    it('priceImpact === "high"일 때 카드 루트에 border-l-ui-warning 클래스가 있다', () => {
        render(
            <MarketNewsCard
                category="crypto"
                item={{ ...BASE, priceImpact: 'high' }}
            />
        );
        // The article element is the card root
        const article = screen.getByRole('article');
        expect(article.className).toContain('border-l-ui-warning');
    });

    it('titleKo === null이면 titleEn을 렌더한다', () => {
        render(
            <MarketNewsCard
                category="general"
                item={{ ...BASE, titleKo: null, titleEn: 'English Headline' }}
            />
        );
        expect(screen.getByText('English Headline')).toBeInTheDocument();
    });

    it('summaryKo가 있으면 해당 텍스트를 렌더한다', () => {
        render(
            <MarketNewsCard
                category="general"
                item={{ ...BASE, summaryKo: 'BTC 요약이에요.' }}
            />
        );
        expect(screen.getByText('BTC 요약이에요.')).toBeInTheDocument();
    });

    /** 회귀 가드 — NewsList와 같은 사고. 제목만 로케일을 타면 안 된다. */
    it('사이드카 번역이 있으면 요약·본문을 그 언어로 렌더한다', () => {
        render(
            <MarketNewsCard
                category="general"
                item={{
                    ...BASE,
                    summaryKo: 'BTC 요약이에요.',
                    bodyKo: 'BTC 본문이에요.',
                    summaryLocalized: 'BTC summary here.',
                    bodyLocalized: 'BTC body here.',
                }}
            />
        );
        expect(screen.getByText('BTC summary here.')).toBeInTheDocument();
        expect(screen.getByText('BTC body here.')).toBeInTheDocument();
        expect(screen.queryByText('BTC 요약이에요.')).not.toBeInTheDocument();
        expect(screen.queryByText('BTC 본문이에요.')).not.toBeInTheDocument();
    });

    it('sentiment === "bullish"이면 배지에 "긍정" 레이블과 bullish 클래스가 있다', () => {
        render(
            <MarketNewsCard
                category="crypto"
                item={{ ...BASE, sentiment: 'bullish' }}
            />
        );
        const badge = screen.getByText(sentimentLabel('bullish', t));
        expect(badge).toBeInTheDocument();
        expect(badge.className).toContain(
            SENTIMENT_CLASS['bullish'].split(' ')[0]
        );
    });

    it('주식 카드에 tickers=[AAPL, MSFT]이면 두 개의 ticker-chip이 올바른 href로 렌더된다 (S21)', () => {
        render(
            <MarketNewsCard
                category="stock"
                item={{ ...BASE, tickers: ['AAPL', 'MSFT'] }}
            />
        );
        const chips = screen.getAllByTestId('ticker-chip');
        expect(chips).toHaveLength(2);
        expect(chips[0]).toHaveAttribute('href', '/AAPL');
        expect(chips[1]).toHaveAttribute('href', '/MSFT');
    });
});

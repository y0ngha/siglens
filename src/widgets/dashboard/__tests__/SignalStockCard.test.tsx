import { render, screen } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { SignalStockCard } from '@/widgets/dashboard/SignalStockCard';
import type { StockWithConflict } from '@y0ngha/siglens-core';

vi.mock('next/link', () => ({
    default: ({
        children,
        href,
        title,
    }: {
        children: React.ReactNode;
        href: string;
        title?: string;
    }) => (
        <a href={href} title={title}>
            {children}
        </a>
    ),
}));

vi.mock('@/shared/lib/cardStyles', () => ({
    CARD_LINK_CLASSES: 'card-link',
}));

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/shared/lib/priceFormat', () => ({
    formatPriceChange: (percent: number) => ({
        sign: percent >= 0 ? '+' : '-',
        colorClass: percent >= 0 ? 'text-green' : 'text-red',
        arrow: percent >= 0 ? '▲' : '▼',
        arrowLabel: percent >= 0 ? '상승' : '하락',
    }),
    formatUsdPrice: (price: number) => price.toFixed(2),
}));

vi.mock('@/widgets/dashboard/ui/signal/SignalBadge', () => ({
    SignalBadge: ({ type }: { type: string }) => (
        <span data-testid={`badge-${type}`}>{type}</span>
    ),
}));

const STOCK: StockWithConflict = {
    symbol: 'AAPL',
    koreanName: '애플',
    sectorSymbol: 'XLK',
    price: 180.25,
    changePercent: 2.5,
    trend: 'uptrend',
    signals: [
        {
            type: 'golden_cross',
            direction: 'bullish',
            phase: 'confirmed',
            detectedAt: 0,
        },
        {
            type: 'rsi_oversold',
            direction: 'bullish',
            phase: 'confirmed',
            detectedAt: 0,
        },
    ],
};

describe('SignalStockCard', () => {
    it('renders symbol and korean name', () => {
        render(
            <SignalStockCard tickerIsReadable currencySymbol="$" data={STOCK} />
        );
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('애플')).toBeInTheDocument();
    });

    it('renders price', () => {
        render(
            <SignalStockCard tickerIsReadable currencySymbol="$" data={STOCK} />
        );
        expect(screen.getByText('$180.25')).toBeInTheDocument();
    });

    it('통화 기호를 그대로 쓴다 (KR = ₩)', () => {
        render(
            <SignalStockCard tickerIsReadable currencySymbol="₩" data={STOCK} />
        );
        expect(screen.getByText('₩180.25')).toBeInTheDocument();
        expect(screen.queryByText('$180.25')).not.toBeInTheDocument();
    });

    it('links to the symbol page', () => {
        render(
            <SignalStockCard tickerIsReadable currencySymbol="$" data={STOCK} />
        );
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/AAPL');
    });

    /**
     * 링크 제목은 카드에 보이는 이름과 같은 소스(`assetLabel`)를 써야 한다 — 카드는
     * 이름인데 툴팁만 티커면 한 카드가 두 이름으로 읽힌다.
     */
    it.each([
        ['ko', '애플 분석'],
        ['en', 'Analyze Apple'],
        ['ja', 'Appleを分析'],
    ] as const)('%s: 링크 제목이 표시 이름을 쓴다', (locale, title) => {
        renderWithIntl(
            <SignalStockCard
                tickerIsReadable
                currencySymbol="$"
                data={STOCK}
            />,
            { locale }
        );
        expect(screen.getByRole('link')).toHaveAttribute('title', title);
    });

    it('renders signal badges', () => {
        render(
            <SignalStockCard tickerIsReadable currencySymbol="$" data={STOCK} />
        );
        expect(screen.getByTestId('badge-golden_cross')).toBeInTheDocument();
        expect(screen.getByTestId('badge-rsi_oversold')).toBeInTheDocument();
    });

    it('renders conflict info when present', () => {
        const stockWithConflict: StockWithConflict = {
            ...STOCK,
            conflict: { bullishCount: 3, bearishCount: 2 },
        };
        render(
            <SignalStockCard
                tickerIsReadable
                currencySymbol="$"
                data={stockWithConflict}
            />
        );
        expect(screen.getByText(/상승 3건/)).toBeInTheDocument();
        expect(screen.getByText(/하락 2건/)).toBeInTheDocument();
    });

    /** 카드가 prop을 QuoteHeader로 넘기는지 — 그 한 줄이 빠지면 조용히 티커 우선 배치로 돌아간다. */
    it('tickerIsReadable=false면 한국어명이 먼저 렌더된다', () => {
        render(
            <SignalStockCard
                tickerIsReadable={false}
                currencySymbol="₩"
                data={{ ...STOCK, symbol: '005930.KS', koreanName: '삼성전자' }}
            />
        );

        const row = screen.getByText('삼성전자').closest('div');
        expect(row).toHaveTextContent('삼성전자');
        expect(row).not.toHaveTextContent('005930.KS');
        expect(screen.getByText('005930.KS')).toBeInTheDocument();
    });

    it('does not render conflict info when absent', () => {
        render(
            <SignalStockCard tickerIsReadable currencySymbol="$" data={STOCK} />
        );
        expect(screen.queryByText(/상승.*건/)).not.toBeInTheDocument();
    });

    it('큐레이션 밖(noindex 롱테일) 종목은 링크 없는 카드로 렌더한다', () => {
        render(
            <SignalStockCard
                tickerIsReadable
                currencySymbol="$"
                data={{ ...STOCK, symbol: 'ZZZNOTREAL', koreanName: '미상' }}
            />
        );
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.getByText('ZZZNOTREAL')).toBeInTheDocument();
    });

    it('큐레이션 종목은 /{symbol} 링크 카드다', () => {
        render(
            <SignalStockCard tickerIsReadable currencySymbol="$" data={STOCK} />
        );
        expect(screen.getByRole('link')).toHaveAttribute('href', '/AAPL');
    });
});

import { render, screen } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { IndexCard } from '@/widgets/dashboard/IndexCard';
import type { MarketIndexData, MarketSectorData } from '@y0ngha/siglens-core';

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
    CARD_LINK_CLASSES: 'card-link-mock',
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

const INDEX_DATA: MarketIndexData = {
    symbol: 'SPY',
    fmpSymbol: '^GSPC',
    koreanName: 'S&P 500',
    displayName: 'S&P 500 Index',
    price: 5012.34,
    changesPercentage: 1.25,
};

const SECTOR_DATA: MarketSectorData = {
    symbol: 'XLK',
    sectorName: 'Technology',
    koreanName: '기술',
    price: 200.5,
    changesPercentage: -0.75,
};

describe('IndexCard', () => {
    it('renders symbol and price', () => {
        render(
            <IndexCard tickerIsReadable currencySymbol="$" data={INDEX_DATA} />
        );
        expect(screen.getByText('SPY')).toBeInTheDocument();
        expect(screen.getByText('$5012.34')).toBeInTheDocument();
    });

    /**
     * `$`가 컴포넌트에 박혀 있던 시절 `/market/kr`은 코스피를 `$6,869.83`으로 그렸다 —
     * 렌더도 숫자도 맞아서 실증 전까지 아무도 못 봤다.
     */
    it('통화 기호를 그대로 쓴다 (KR = ₩)', () => {
        render(
            <IndexCard tickerIsReadable currencySymbol="₩" data={INDEX_DATA} />
        );
        expect(screen.getByText('₩5012.34')).toBeInTheDocument();
        expect(screen.queryByText('$5012.34')).not.toBeInTheDocument();
    });

    it('renders korean name', () => {
        render(
            <IndexCard tickerIsReadable currencySymbol="$" data={INDEX_DATA} />
        );
        expect(screen.getByText('S&P 500')).toBeInTheDocument();
    });

    /**
     * 지수명은 config 상수에 한국어로만 있다. 심볼로 카탈로그를 찾는지,
     * 그리고 **카탈로그에 없는 심볼은 폴백**으로 떨어지는지 함께 본다 —
     * 폴백이 없으면 카드에 원시 키(`widgets.dashboard.assetName.SPY`)가 찍힌다.
     */
    it('en: 카탈로그에 있는 지수는 그 로케일 이름으로 표시한다', () => {
        renderWithIntl(
            <IndexCard
                tickerIsReadable
                currencySymbol="$"
                data={{ ...INDEX_DATA, symbol: 'IXIC' }}
            />,
            { locale: 'en' }
        );
        expect(screen.getByText('NASDAQ Composite')).toBeInTheDocument();
    });

    it('카탈로그에 없는 심볼은 koreanName으로 떨어진다', () => {
        renderWithIntl(
            <IndexCard tickerIsReadable currencySymbol="$" data={INDEX_DATA} />,
            { locale: 'en' }
        );
        expect(screen.getByText('S&P 500')).toBeInTheDocument();
        expect(
            screen.queryByText(/widgets\.dashboard\.assetName/)
        ).not.toBeInTheDocument();
    });

    it('renders percentage change', () => {
        render(
            <IndexCard tickerIsReadable currencySymbol="$" data={INDEX_DATA} />
        );
        expect(screen.getByText(/1\.25%/)).toBeInTheDocument();
    });

    it('wraps in a Link when href is provided', () => {
        render(
            <IndexCard
                tickerIsReadable
                currencySymbol="$"
                data={INDEX_DATA}
                href="/SPY"
            />
        );
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/SPY');
        expect(link).toHaveAttribute('title', 'S&P 500 Index 분석');
    });

    it('does not wrap in a Link when href is absent', () => {
        render(
            <IndexCard tickerIsReadable currencySymbol="$" data={INDEX_DATA} />
        );
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    /**
     * 카드가 prop을 QuoteHeader로 넘기지 않으면 한국 화면 제목이 KRX 숫자로 남는다.
     * QuoteHeader 단위 테스트만으로는 그 한 줄 전달이 고정되지 않는다.
     */
    it('tickerIsReadable=false면 한국어명이 먼저 렌더된다', () => {
        const { container } = render(
            <IndexCard
                tickerIsReadable={false}
                currencySymbol="₩"
                data={{
                    symbol: '091160.KS',
                    fmpSymbol: '091160.KS',
                    displayName: 'KODEX 반도체',
                    koreanName: '반도체',
                    price: 125405,
                    changesPercentage: -0.67,
                }}
            />
        );

        const firstText = container.querySelector('div > *');
        expect(firstText).toHaveTextContent('반도체');
        expect(firstText).not.toHaveTextContent('091160.KS');
        // 티커는 DOM에 남는다 — 시각적 우선순위만 바뀐다.
        expect(screen.getByText('091160.KS')).toBeInTheDocument();
    });

    it('uses sectorName as label for sector data', () => {
        render(
            <IndexCard
                tickerIsReadable
                currencySymbol="$"
                data={SECTOR_DATA}
                href="/XLK"
            />
        );
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('title', 'Technology 분석');
    });
});

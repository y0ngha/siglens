vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));
vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));
vi.mock('@/shared/config/popular-tickers', () => ({
    TICKER_CATEGORIES: [
        {
            id: 'megacap',
            label: '메가캡·지수',
            tickers: ['AAPL', 'MSFT'],
        },
        {
            id: 'ai-semiconductor',
            label: 'AI·반도체',
            tickers: ['NVDA'],
        },
    ],
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import { TickerCategories } from '../TickerCategories';

describe('TickerCategories', () => {
    it('renders category headings', () => {
        render(<TickerCategories />);

        expect(
            screen.getByRole('heading', { name: /메가캡·지수/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: /AI·반도체/ })
        ).toBeInTheDocument();
    });

    it('renders ticker links with correct hrefs', () => {
        render(<TickerCategories />);

        const aaplLink = screen.getByRole('link', { name: /AAPL/ });
        expect(aaplLink).toHaveAttribute('href', '/AAPL');

        const nvdaLink = screen.getByRole('link', { name: /NVDA/ });
        expect(nvdaLink).toHaveAttribute('href', '/NVDA');
    });

    it('renders the section heading', () => {
        render(<TickerCategories />);

        expect(
            screen.getByRole('heading', { name: /섹터별 인기 종목/ })
        ).toBeInTheDocument();
    });

    it('has a navigation landmark', () => {
        render(<TickerCategories />);

        expect(
            screen.getByRole('navigation', { name: /섹터별 인기 종목 탐색/ })
        ).toBeInTheDocument();
    });

    it('renders ticker lists with aria-labels', () => {
        render(<TickerCategories />);

        expect(
            screen.getByRole('list', { name: /메가캡·지수 섹터 종목 목록/ })
        ).toBeInTheDocument();
    });
});

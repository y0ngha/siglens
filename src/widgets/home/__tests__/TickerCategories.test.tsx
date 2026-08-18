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
    // 목이 KR 카테고리를 갖지 않으므로 빈 집합이다 — `TickerCategories`가 한국
    // 섹션을 렌더하지 않고, 이 파일들은 미국 그리드만 검증한다.
    KR_CATEGORY_IDS: new Set<string>(),
    TICKER_CATEGORIES: [
        {
            id: 'megacap',
            label: '메가캡·지수',
            items: [
                { symbol: 'AAPL', name: '애플' },
                { symbol: 'MSFT', name: '마이크로소프트' },
            ],
        },
        {
            id: 'ai-semiconductor',
            label: 'AI·반도체',
            items: [{ symbol: 'NVDA', name: '엔비디아' }],
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

    it('KR 카테고리가 없으면 한국 섹션을 아예 렌더하지 않는다', () => {
        // `CategoryCardGrid`는 `cards: []`여도 nav+h2를 그린다 — 가드가 없으면
        // 제목만 있는 빈 섹션이 나간다. 이 파일의 목이 바로 그 상태를 만든다.
        render(<TickerCategories />);
        expect(
            screen.queryByRole('navigation', {
                name: '한국 섹터별 인기 종목 탐색',
            })
        ).toBeNull();
    });

    it('renders the section heading', () => {
        render(<TickerCategories />);

        expect(
            screen.getByRole('heading', { name: '미국 섹터별 인기 종목' })
        ).toBeInTheDocument();
    });

    it('has a navigation landmark', () => {
        render(<TickerCategories />);

        expect(
            screen.getByRole('navigation', {
                name: '미국 섹터별 인기 종목 탐색',
            })
        ).toBeInTheDocument();
    });

    it('renders ticker lists with aria-labels', () => {
        render(<TickerCategories />);

        expect(
            screen.getByRole('list', { name: /메가캡·지수 종목 목록/ })
        ).toBeInTheDocument();
    });
});

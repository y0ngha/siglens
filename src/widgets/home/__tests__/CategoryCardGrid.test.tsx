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

import React from 'react';
import { render, screen } from '@testing-library/react';

import { CategoryCardGrid, type CategoryCard } from '../ui/CategoryCardGrid';

const CARDS: CategoryCard[] = [
    {
        id: 'major',
        label: '메이저',
        borderColor: 'border-l-primary-400',
        textColor: 'text-primary-400',
        items: [{ symbol: 'BTCUSD', name: '비트코인' }],
    },
];

describe('CategoryCardGrid', () => {
    it('섹션 헤딩과 nav 랜드마크를 렌더한다', () => {
        render(
            <CategoryCardGrid
                heading="암호화폐 인기 종목"
                ariaLabel="암호화폐 인기 종목 탐색"
                cards={CARDS}
            />
        );
        expect(
            screen.getByRole('heading', { name: '암호화폐 인기 종목' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('navigation', { name: '암호화폐 인기 종목 탐색' })
        ).toBeInTheDocument();
    });

    it('카드 라벨을 헤딩으로 렌더한다', () => {
        render(<CategoryCardGrid heading="h" ariaLabel="a" cards={CARDS} />);
        expect(
            screen.getByRole('heading', { name: '메이저' })
        ).toBeInTheDocument();
    });

    it('칩에 한글명과 티커를 모두 표시하고 /symbol로 링크한다', () => {
        render(<CategoryCardGrid heading="h" ariaLabel="a" cards={CARDS} />);
        const link = screen.getByRole('link', { name: /BTCUSD/ });
        expect(link).toHaveAttribute('href', '/BTCUSD');
        expect(link).toHaveTextContent('비트코인');
        expect(link).toHaveTextContent('BTCUSD');
    });
});

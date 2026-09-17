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

    it('cards가 빈 배열이면 카드 없이 nav를 렌더한다', () => {
        render(
            <CategoryCardGrid
                heading="테스트"
                ariaLabel="테스트 탐색"
                cards={[]}
            />
        );
        expect(
            screen.getByRole('navigation', { name: '테스트 탐색' })
        ).toBeInTheDocument();
        expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
    });
});

/**
 * 카드가 티커 칩만 나열하면 크롤러가 받는 것은 링크 묶음뿐이다(2026-09 구글 정책
 * 감사 L20). 카테고리가 무엇을 묶은 것인지 한 문장이 h3 아래 있어야 한다.
 */
describe('CategoryCardGrid 카테고리 설명', () => {
    it('descriptionKey가 있으면 h3 아래 한 줄 설명을 렌더한다', () => {
        render(
            <CategoryCardGrid
                heading="암호화폐 인기 종목"
                ariaLabel="암호화폐 인기 종목 탐색"
                cards={[
                    {
                        ...CARDS[0],
                        descriptionKey: 'categoryDescription.Major',
                    },
                ]}
            />
        );

        const description = screen.getByText(
            /시가총액 상위 암호화폐 — 시장 전체 흐름의 기준이 됩니다\./
        );
        expect(description.tagName).toBe('P');
        expect(
            screen.getByRole('heading', { level: 3 }).nextElementSibling
        ).toBe(description);
    });

    it('descriptionKey가 없으면 설명 단락을 만들지 않는다', () => {
        const { container } = render(
            <CategoryCardGrid
                heading="암호화폐 인기 종목"
                ariaLabel="암호화폐 인기 종목 탐색"
                cards={CARDS}
            />
        );
        expect(container.querySelectorAll('p')).toHaveLength(0);
    });
});

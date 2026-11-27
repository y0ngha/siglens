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

vi.mock('@/features/watchlist/ui/WatchlistPillToggle', () => ({
    WatchlistPillToggle: ({
        symbol,
        source,
    }: {
        symbol: string;
        source: string;
    }) => <button data-testid={`star-${symbol}`}>{source}</button>,
}));
vi.mock('@/features/watchlist/ui/WatchlistPillScope', () => ({
    WatchlistPillScope: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="pill-scope">{children}</div>
    ),
}));

import { render, screen } from '@testing-library/react';
import React from 'react';
import { defined } from '@/shared/test-utils/defined';
import {
    CategoryCardGridBody,
    type CategoryCard,
} from '../../ui/CategoryCardGrid';

const CARDS: CategoryCard[] = [
    {
        id: 'major',
        label: '메이저',
        borderColor: 'border-l-primary-400',
        textColor: 'text-primary-400',
        items: [{ symbol: 'BTCUSD', name: '비트코인' }],
    },
];

const BASE_CARD = defined(CARDS[0]);

describe('CategoryCardGridBody', () => {
    it('제목과 nav 랜드마크는 그리지 않는다(PopularTickers가 소유한다)', () => {
        render(<CategoryCardGridBody cards={CARDS} />);
        expect(screen.queryByRole('navigation')).toBeNull();
        expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    });

    it('카드 라벨을 헤딩으로 렌더한다', () => {
        render(<CategoryCardGridBody cards={CARDS} />);
        expect(
            screen.getByRole('heading', { name: '메이저' })
        ).toBeInTheDocument();
    });

    it('칩에 한글명과 티커를 모두 표시하고 /symbol로 링크한다', () => {
        render(<CategoryCardGridBody cards={CARDS} />);
        const link = screen.getByRole('link', { name: /BTCUSD/ });
        expect(link).toHaveAttribute('href', '/BTCUSD');
        expect(link).toHaveTextContent('비트코인');
        expect(link).toHaveTextContent('BTCUSD');
    });

    it('카드 요소에 DOM id를 달지 않는다(카테고리 id가 문서 내에서 겹칠 수 있다)', () => {
        const { container } = render(<CategoryCardGridBody cards={CARDS} />);

        expect(container.querySelector('#major')).toBeNull();
        expect(container.querySelector('[id]')).toBeNull();
    });

    it('labelKey가 있으면 h3 제목과 종목 목록 aria-label이 같은 번역 제목을 쓴다', () => {
        render(
            <CategoryCardGridBody
                cards={[
                    {
                        ...BASE_CARD,
                        label: '원문 라벨',
                        labelKey: 'tickerCategory.Major',
                    },
                ]}
            />
        );

        const title = screen.getByRole('heading', { level: 3 }).textContent;
        expect(title).toBe('메이저');
        expect(screen.getByRole('list').getAttribute('aria-label')).toContain(
            title
        );
    });

    it('cards가 빈 배열이면 카드를 그리지 않는다', () => {
        render(<CategoryCardGridBody cards={[]} />);
        expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
    });

    it('첫 3장은 항상 보이고 4번째부터 접힘 클래스를 단다(DOM에서는 빼지 않는다)', () => {
        const many: CategoryCard[] = Array.from({ length: 8 }, (_, i) => ({
            ...BASE_CARD,
            id: `c${i}`,
            label: `카드${i}`,
            items: [{ symbol: `S${i}`, name: `종목${i}` }],
        }));
        const { container } = render(<CategoryCardGridBody cards={many} />);

        const cards = Array.from(
            container.querySelectorAll<HTMLElement>('div.border-l-2')
        );
        expect(cards).toHaveLength(8);
        const collapsed = cards.map(
            card =>
                /group-data-\[collapsed=true\]\/grid:([\w-]+:)?hidden/.exec(
                    card.className
                )?.[0] ?? null
        );
        expect(collapsed).toEqual([
            null,
            null,
            null,
            'group-data-[collapsed=true]/grid:max-md:hidden',
            'group-data-[collapsed=true]/grid:max-lg:hidden',
            'group-data-[collapsed=true]/grid:max-lg:hidden',
            'group-data-[collapsed=true]/grid:hidden',
            'group-data-[collapsed=true]/grid:hidden',
        ]);
        expect(container.querySelectorAll('a')).toHaveLength(8);
    });
});

/**
 * 카드가 티커 칩만 나열하면 크롤러가 받는 것은 링크 묶음뿐이다(검색 노출 정책).
 * 카테고리가 무엇을 묶은 것인지 한 문장이 h3 아래 있어야 한다.
 */
describe('CategoryCardGridBody 카테고리 설명', () => {
    it('descriptionKey가 있으면 h3 아래 한 줄 설명을 렌더한다', () => {
        render(
            <CategoryCardGridBody
                cards={[
                    {
                        ...BASE_CARD,
                        descriptionKey: 'categoryDescription.Major',
                    },
                ]}
            />
        );

        const description = screen.getByText(
            /시가총액 상위 암호화폐입니다\. 시장 전체 흐름의 기준이 됩니다\./
        );
        expect(description.tagName).toBe('P');
        expect(
            screen.getByRole('heading', { level: 3 }).nextElementSibling
        ).toBe(description);
    });

    it('descriptionKey가 없으면 설명 단락을 만들지 않는다', () => {
        const { container } = render(<CategoryCardGridBody cards={CARDS} />);
        expect(container.querySelectorAll('p')).toHaveLength(0);
    });

    it('watchlistSource가 있으면 알약마다 링크와 형제인 ★를 붙인다', () => {
        render(
            <CategoryCardGridBody
                cards={CARDS}
                watchlistSource="home_popular"
            />
        );
        const star = screen.getByTestId('star-BTCUSD');
        expect(star).toHaveTextContent('home_popular');
        // ★는 링크 안이 아니라 옆에 있다 — 누르면 담기만 하고 이동하지 않는다.
        expect(star.closest('a')).toBeNull();
    });

    it('watchlistSource가 없으면 ★를 그리지 않는다', () => {
        render(<CategoryCardGridBody cards={CARDS} />);
        expect(screen.queryByTestId('star-BTCUSD')).toBeNull();
    });

    it('watchlistSource가 있으면 ★들을 관심종목 스코프 하나로 감싼다', () => {
        render(
            <CategoryCardGridBody
                cards={CARDS}
                watchlistSource="home_popular"
            />
        );
        const scopes = screen.getAllByTestId('pill-scope');
        expect(scopes).toHaveLength(1);
        expect(scopes[0]).toContainElement(screen.getByTestId('star-BTCUSD'));
    });

    it('watchlistSource가 없으면 관심종목 스코프를 두지 않는다', () => {
        render(<CategoryCardGridBody cards={CARDS} />);
        expect(screen.queryByTestId('pill-scope')).toBeNull();
    });
});

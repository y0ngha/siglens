// 관심종목 ★는 React Query(`useWatchlist`)를 쓴다 — 이 테스트의 관심사가 아니라 비운다.
vi.mock('@/features/watchlist/ui/WatchlistPillToggle', () => ({
    WatchlistPillToggle: () => null,
}));
vi.mock('@/features/watchlist/ui/WatchlistPillScope', () => ({
    WatchlistPillScope: ({
        children,
    }: {
        children: import('react').ReactNode;
    }) => children,
}));

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

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { CRYPTO_CATEGORIES } from '@/shared/config/crypto-categories';
import {
    KR_CATEGORY_IDS,
    POPULAR_TICKERS,
    TICKER_CATEGORIES,
} from '@/shared/config/popular-tickers';
import { HOME_POPULAR_ANCHOR_ID } from '@/shared/config/watchlist';
import { defined } from '@/shared/test-utils/defined';
import { PopularTickers } from '../PopularTickers';

const US_CATEGORIES = TICKER_CATEGORIES.filter(c => !KR_CATEGORY_IDS.has(c.id));
const KR_CATEGORIES = TICKER_CATEGORIES.filter(c => KR_CATEGORY_IDS.has(c.id));

const symbolsOf = (categories: typeof TICKER_CATEGORIES) =>
    categories.flatMap(c => c.items.map(item => item.symbol));

const hrefsIn = (root: HTMLElement) =>
    new Set(
        Array.from(root.querySelectorAll('a')).map(a => a.getAttribute('href'))
    );

function panelOf(name: string): HTMLElement {
    return document.getElementById(
        screen.getByRole('tab', { name }).getAttribute('aria-controls') ?? ''
    ) as HTMLElement;
}

describe('PopularTickers 구조', () => {
    it('h2 하나와 그것으로 이름 붙은 nav 랜드마크, 홈 앵커 id를 가진다', () => {
        render(<PopularTickers />);

        expect(
            screen.getByRole('heading', { level: 2, name: '인기 종목' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('navigation', { name: '인기 종목' })
        ).toHaveAttribute('id', HOME_POPULAR_ANCHOR_ID);
    });

    it('탭은 미국 주식, 한국 주식, 암호화폐 순이고 미국이 기본이다', () => {
        render(<PopularTickers />);

        const tabs = screen.getAllByRole('tab');
        expect(tabs.map(tab => tab.textContent)).toEqual([
            '미국 주식',
            '한국 주식',
            '암호화폐',
        ]);
        expect(tabs.map(tab => tab.getAttribute('aria-selected'))).toEqual([
            'true',
            'false',
            'false',
        ]);
        expect(
            screen.getByRole('tablist', { name: '시장 선택' })
        ).toBeInTheDocument();
    });

    it('활성 패널만 보이고 나머지는 hidden이다', () => {
        render(<PopularTickers />);

        expect(panelOf('미국 주식')).not.toHaveAttribute('hidden');
        expect(panelOf('한국 주식')).toHaveAttribute('hidden');
        expect(panelOf('암호화폐')).toHaveAttribute('hidden');
    });
});

/**
 * 이 격자는 저장소 전체에서 종목 페이지로 가는 **유일한 크롤 가능한 `<a>`**다(검색 자동완성은
 * `<button>` + `router.push`). 탭·접기로 줄인 화면이라도 서버 HTML에는 모든 종목이 있어야 한다.
 * 실제 설정을 렌더한다 — 목을 쓰면 검사하려는 대상이 사라진다.
 */
describe('PopularTickers 크롤 커버리지', () => {
    it('활성 탭과 관계없이 모든 미국·한국·암호화폐 종목이 링크로 렌더된다', () => {
        const { container } = render(<PopularTickers />);
        const hrefs = hrefsIn(container);

        const expected = [
            ...symbolsOf(TICKER_CATEGORIES),
            ...CRYPTO_CATEGORIES.flatMap(c => c.items.map(i => i.symbol)),
        ];
        expect(expected.length).toBeGreaterThan(80);
        expected.forEach(symbol => expect(hrefs).toContain(`/${symbol}`));
    });

    it('모든 KR 인기 종목이 한국 패널 안에 있고 미국 패널에는 KR 종목이 없다', () => {
        render(<PopularTickers />);

        const krPopular = POPULAR_TICKERS.filter(t => /\.K[SQ]$/.test(t));
        const krHrefs = hrefsIn(panelOf('한국 주식'));
        expect(krHrefs.size).toBe(symbolsOf(KR_CATEGORIES).length);
        krPopular.forEach(symbol => expect(krHrefs).toContain(`/${symbol}`));

        const usHrefs = [...hrefsIn(panelOf('미국 주식'))];
        expect(usHrefs.filter(h => /\.K[SQ]$/.test(h ?? ''))).toEqual([]);
        expect(new Set(usHrefs)).toEqual(
            new Set(symbolsOf(US_CATEGORIES).map(s => `/${s}`))
        );
    });

    it('접힌 카드도 DOM에 남는다(링크 수가 접기 전후로 같다)', async () => {
        const user = userEvent.setup();
        const { container } = render(<PopularTickers />);
        const before = container.querySelectorAll('a').length;

        await user.click(
            within(panelOf('미국 주식')).getByRole('button', {
                name: '모든 업종 보기',
            })
        );

        expect(container.querySelectorAll('a').length).toBe(before);
    });
});

describe('PopularTickers 접기', () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    afterEach(() => {
        Element.prototype.scrollIntoView = originalScrollIntoView;
    });

    const cardsOf = (panel: HTMLElement) =>
        Array.from(panel.querySelectorAll('h3')).map(
            h3 => h3.closest('div[class*="border-l-2"]') as HTMLElement
        );

    it('패널은 접힌 채 시작하고 4번째 이후 카드에만 숨김 클래스를 건다', () => {
        render(<PopularTickers />);
        const panel = panelOf('미국 주식');

        expect(panel).toHaveAttribute('data-collapsed', 'true');
        const cards = cardsOf(panel);
        expect(cards.length).toBe(US_CATEGORIES.length);
        // 모바일 3개, md 4개, lg 6개까지는 보인다.
        cards.slice(0, 3).forEach(card => {
            expect(card.className).not.toMatch(/data-\[collapsed=true\]/);
        });
        expect(cards[3]?.className).toContain(
            'group-data-[collapsed=true]/grid:max-md:hidden'
        );
        [4, 5].forEach(index =>
            expect(cards[index]?.className).toContain(
                'group-data-[collapsed=true]/grid:max-lg:hidden'
            )
        );
        cards
            .slice(6)
            .forEach(card =>
                expect(card.className).toContain(
                    'group-data-[collapsed=true]/grid:hidden'
                )
            );
    });

    it('버튼은 aria-expanded와 aria-controls를 갖고 누르면 펼침/접힘이 바뀐다', async () => {
        const user = userEvent.setup();
        render(<PopularTickers />);
        const panel = panelOf('미국 주식');
        const button = within(panel).getByRole('button', {
            name: '모든 업종 보기',
        });

        expect(button).toHaveAttribute('aria-expanded', 'false');
        // 컨트롤 대상은 패널이 아니라 접히는 카드 격자다.
        const grid = defined(
            document.getElementById(button.getAttribute('aria-controls') ?? '')
        );
        expect(panel.contains(grid)).toBe(true);
        expect(grid).not.toBe(panel);
        expect(grid.querySelectorAll('h3').length).toBe(US_CATEGORIES.length);

        await user.click(button);

        expect(panel).toHaveAttribute('data-collapsed', 'false');
        const collapse = within(panel).getByRole('button', { name: '접기' });
        expect(collapse).toHaveAttribute('aria-expanded', 'true');
        expect(collapse).toHaveFocus();

        await user.click(collapse);
        expect(panel).toHaveAttribute('data-collapsed', 'true');
    });

    it('접으면 다음 프레임에 버튼을 뷰포트 안으로 가져오고, 펼칠 때는 스크롤하지 않는다', async () => {
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        const user = userEvent.setup();
        render(<PopularTickers />);
        const panel = panelOf('미국 주식');

        await user.click(
            within(panel).getByRole('button', { name: '모든 업종 보기' })
        );
        expect(scrollIntoView).not.toHaveBeenCalled();

        const collapse = within(panel).getByRole('button', { name: '접기' });
        await user.click(collapse);

        await vi.waitFor(() =>
            expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
        );
        expect(scrollIntoView.mock.contexts).toEqual([collapse]);
    });

    it('카드가 3개 이하인 암호화폐 패널에는 버튼이 없다', () => {
        render(<PopularTickers />);

        expect(CRYPTO_CATEGORIES.length).toBeLessThanOrEqual(3);
        expect(within(panelOf('암호화폐')).queryByRole('button')).toBeNull();
    });

    it('한 패널을 펼쳐도 다른 패널은 접힌 채다', async () => {
        const user = userEvent.setup();
        render(<PopularTickers />);

        await user.click(
            within(panelOf('미국 주식')).getByRole('button', {
                name: '모든 업종 보기',
            })
        );

        expect(panelOf('한국 주식')).toHaveAttribute('data-collapsed', 'true');
    });
});

describe('PopularTickers 탭 전환', () => {
    it('탭을 누르면 그 패널이 보이고 앞 패널은 hidden이 된다', async () => {
        const user = userEvent.setup();
        render(<PopularTickers />);

        await user.click(screen.getByRole('tab', { name: '한국 주식' }));

        expect(panelOf('한국 주식')).not.toHaveAttribute('hidden');
        expect(panelOf('미국 주식')).toHaveAttribute('hidden');
        expect(screen.getByRole('tab', { name: '한국 주식' })).toHaveAttribute(
            'aria-selected',
            'true'
        );
    });

    it('화살표 키로 다음 탭으로 옮기고 활성화한다', async () => {
        const user = userEvent.setup();
        render(<PopularTickers />);

        screen.getByRole('tab', { name: '미국 주식' }).focus();
        await user.keyboard('{ArrowRight}');

        expect(screen.getByRole('tab', { name: '한국 주식' })).toHaveFocus();
        expect(screen.getByRole('tab', { name: '한국 주식' })).toHaveAttribute(
            'aria-selected',
            'true'
        );
        expect(panelOf('한국 주식')).not.toHaveAttribute('hidden');
    });

    it('비활성 탭 선택 후에도 서버가 낸 링크는 그대로다', async () => {
        const user = userEvent.setup();
        const { container } = render(<PopularTickers />);
        const before = hrefsIn(container);

        await user.click(screen.getByRole('tab', { name: '암호화폐' }));

        expect(hrefsIn(container)).toEqual(before);
    });
});

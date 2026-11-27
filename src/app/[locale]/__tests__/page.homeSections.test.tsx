vi.mock('@/widgets/home/HeroIllustration', () => ({
    HeroIllustration: () => null,
}));
vi.mock('@/features/watchlist/ui/HomeWatchlistCard', () => ({
    HomeWatchlistCard: () => (
        <section aria-label="내 관심종목">
            <h2>내 관심종목</h2>
        </section>
    ),
}));
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
vi.mock('@/features/ticker-search/ui/SymbolSearchPanel', () => ({
    SymbolSearchPanel: () => null,
}));
// 오늘의 시장 로더는 FMP·DB 캐시를 읽는다 — 화면에 그려질 값만 고정한다.
vi.mock('@/app/[locale]/(home)/_lib/loadHomeTodayMarket', () => ({
    loadHomeTodayMarket: vi.fn(async () => ({
        fearGreed: {
            us: { date: '2026-11-13', score: 45.6, label: 'NEUTRAL' },
            kr: null,
            crypto: null,
        },
        signals: {
            us: {
                computedAt: '2026-11-14T21:00:00.000Z',
                rows: [
                    {
                        symbol: 'NVDA',
                        koreanName: '엔비디아',
                        changePercent: 2.5,
                        signalType: 'golden_cross',
                        expected: false,
                    },
                ],
            },
            kr: { rows: [], computedAt: null },
        },
    })),
}));
const launched = vi.hoisted(() => ({ value: false }));
vi.mock(
    '@/entities/mail-alert/lib/mailAlertConstants',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@/entities/mail-alert/lib/mailAlertConstants')
        >()),
        isMailAlertLaunched: () => launched.value,
    })
);
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

import { render } from '@testing-library/react';
import React from 'react';
import Home from '@/app/[locale]/(home)/page';
import { GUIDE_CATEGORIES } from '@/entities/guide/types';
import {
    SIGNAL_HUBS,
    signalHubPath,
} from '@/entities/signal-history/lib/signalHubs';
import { loadShowcaseSkills } from '@/entities/skill/api';
import { CRYPTO_CATEGORIES } from '@/shared/config/crypto-categories';
import { TICKER_CATEGORIES } from '@/shared/config/popular-tickers';
import { guidePathForSkill } from '@/shared/lib/guideLinkLookup';
import { guideCategoryPath, GUIDE_PATH } from '@/shared/lib/guidePaths';
import { defined } from '@/shared/test-utils/defined';
import {
    filterSkillsByTab,
    INITIAL_VISIBLE_COUNT,
    SKILL_TABS,
} from '@/widgets/home/utils/skillTabs';

/**
 * 홈 섹션 구성(WP-25 PR-2) — 순서, 접힌 콘텐츠의 서버 HTML 보존, 메일 카드 자리.
 *
 * 줄이기 작업이 가장 쉽게 깨는 것은 내부 링크다. 인기 종목은 탭·접기로, 기법 카드는 닫힌
 * `<details>`로, FAQ는 `<details>`로 접히지만 **DOM에는 전부 남아야** 크롤러가 따라간다.
 * 그래서 이 파일은 위젯을 목으로 대체하지 않고 실제 인기 종목·기법 목록(`skills/` 파일)·
 * 오늘의 시장을 렌더해 링크 집합을 단언한다.
 */
vi.stubGlobal(
    'ResizeObserver',
    class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
    }
);

async function renderHome(locale: string) {
    return render(await Home({ params: Promise.resolve({ locale }) }));
}

/** `<main>` 안의 링크 — 머리말·바닥글·JSON-LD `<script>`는 세지 않는다. */
function mainHrefs(container: HTMLElement): Set<string> {
    const main = container.querySelector('main');
    return new Set(
        Array.from(main?.querySelectorAll('a[href]') ?? []).map(
            a => a.getAttribute('href') ?? ''
        )
    );
}

describe('홈 섹션 순서', () => {
    it('ko: 오늘의 시장 → 내 관심종목 → 가격대 → 종목 레이더 → 인기 종목 → FAQ', async () => {
        const { container } = await renderHome('ko');

        const h2s = Array.from(container.querySelectorAll('main h2')).map(
            h => h.textContent
        );
        const named = [
            '오늘의 시장',
            '내 관심종목',
            '가격대는 이렇게 정해요',
            '인기 종목',
        ].map(name => h2s.indexOf(name));
        expect(named.every(index => index >= 0)).toBe(true);
        expect(named).toEqual([...named].sort((a, b) => a - b));

        const radar = h2s.findIndex(text => text?.includes('레이더'));
        expect(radar).toBeGreaterThan(h2s.indexOf('가격대는 이렇게 정해요'));
        expect(radar).toBeLessThan(h2s.indexOf('인기 종목'));
        expect(h2s.indexOf('인기 종목')).toBeLessThan(
            h2s.findIndex(text => text?.includes('자주 묻는 질문'))
        );
    });

    it('en: 종목 레이더(ko 전용)가 없다', async () => {
        const { container } = await renderHome('en');

        expect(
            Array.from(container.querySelectorAll('main h2')).some(h =>
                /레이더/.test(h.textContent ?? '')
            )
        ).toBe(false);
        expect(container.querySelectorAll('main h1')).toHaveLength(1);
    });
});

describe('홈 내부 링크는 접혀도 서버 HTML에 남는다', () => {
    it('모든 인기 종목(미국·한국·암호화폐) 링크가 탭·접기와 관계없이 있다', async () => {
        const { container } = await renderHome('ko');
        const hrefs = mainHrefs(container);

        const symbols = [
            ...TICKER_CATEGORIES.flatMap(c => c.items.map(i => i.symbol)),
            ...CRYPTO_CATEGORIES.flatMap(c => c.items.map(i => i.symbol)),
        ];
        expect(symbols.length).toBeGreaterThan(80);
        symbols.forEach(symbol => expect(hrefs).toContain(`/${symbol}`));
    });

    it('기법 카드의 가이드 링크는 닫힌 details 안에 그대로 있다', async () => {
        const { container } = await renderHome('ko');
        const skills = await loadShowcaseSkills();
        expect(skills.length).toBeGreaterThan(0);

        const closedSkillDetails = Array.from(
            container.querySelectorAll<HTMLDetailsElement>('main details')
        ).find(d =>
            d.querySelector('summary')?.textContent?.includes('분석 기법')
        );
        expect(closedSkillDetails).toBeDefined();
        expect(closedSkillDetails?.open).toBe(false);
        expect(closedSkillDetails?.querySelector('summary')?.textContent).toBe(
            `분석 기법 ${skills.length}개 보기`
        );

        const inside = new Set(
            Array.from(
                closedSkillDetails?.querySelectorAll('a[href]') ?? []
            ).map(a => a.getAttribute('href'))
        );
        // 각 탭이 처음 보여 주는 카드(탭마다 12장)의 가이드 링크는 전부 서버 HTML에 있다.
        const expected = SKILL_TABS.flatMap(tab =>
            filterSkillsByTab(skills, tab.value).slice(0, INITIAL_VISIBLE_COUNT)
        )
            .map(skill => guidePathForSkill(skill.name))
            .filter((path): path is string => path !== null);
        expect(expected.length).toBeGreaterThan(20);
        expected.forEach(path => expect(inside).toContain(path));
        expect(inside).toContain(GUIDE_PATH);
    });

    it('가이드 분류 5곳, 방법론, 백테스팅, 신호 허브 8곳 링크가 새로 생긴다', async () => {
        const { container } = await renderHome('ko');
        const hrefs = mainHrefs(container);

        GUIDE_CATEGORIES.forEach(category =>
            expect(hrefs).toContain(guideCategoryPath(category))
        );
        expect(hrefs).toContain('/methodology');
        expect(hrefs).toContain('/backtesting');
        expect(hrefs).toContain(GUIDE_PATH);
        SIGNAL_HUBS.forEach(hub =>
            expect(hrefs).toContain(signalHubPath(hub.slug))
        );
    });

    it('FAQ 답변 속 사이트 경로 링크는 접힌 문항에도 있다', async () => {
        const { container } = await renderHome('ko');

        const faqLinks = Array.from(
            container.querySelectorAll('main details a[href]')
        ).map(a => a.getAttribute('href'));
        expect(faqLinks).toContain('/market');
    });
});

describe('홈 메일 카드 자리', () => {
    const CARD_LINE =
        '공포 탐욕 지수가 극단적 공포나 극단적 탐욕에 들어서면 점수가 확정된 뒤 한국 시간 아침에 메일로 알려 드려요';

    it('공개 전에는 아무것도 그리지 않는다', async () => {
        launched.value = false;
        const { container } = await renderHome('ko');

        expect(container.textContent).not.toContain(CARD_LINE);
        expect(
            container.querySelector('button[aria-haspopup="dialog"]')
        ).toBeNull();
    });

    it('공개 후에는 오늘의 시장 카드 바깥, 그 뒤에 미국 시장 문구로 그린다', async () => {
        launched.value = true;
        const { container } = await renderHome('ko');

        const card = Array.from(container.querySelectorAll('p')).find(p =>
            p.textContent?.includes(CARD_LINE)
        );
        expect(card?.textContent).toBe(`미국 ${CARD_LINE}`);
        const todayMarket = defined(
            container.querySelector(
                'section[aria-labelledby="home-today-market-heading"]'
            )
        );
        const cardEl = defined(card);
        expect(todayMarket.contains(cardEl)).toBe(false);
        expect(
            todayMarket.compareDocumentPosition(cardEl) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });
});

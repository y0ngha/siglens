import { resolveAsyncServerTree } from '@/shared/test-utils/resolveAsyncServerTree';
import { render, screen } from '@testing-library/react';
import { Suspense, isValidElement } from 'react';
import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    type MockedFunction,
} from 'vitest';

vi.mock('@/widgets/economy/sections/EconomicCalendarGrid', () => ({
    EconomicCalendarGrid: () => null,
}));
vi.mock('@/widgets/economy/sections/KrEconomicIndicatorGrid', () => ({
    KrEconomicIndicatorGrid: ({ cards }: { cards: unknown[] }) => (
        <div data-testid="kr-indicator-grid">{cards.length}</div>
    ),
}));

vi.mock('@/entities/economy/api/getKrIndicatorCards', () => ({
    getKrIndicatorCards: vi.fn(),
}));
vi.mock('@/entities/economy/api/getCalendarFromDb', () => ({
    getCalendarFromDb: vi.fn(),
}));
vi.mock('@/entities/economy/api/resolveIndicatorLabels', () => ({
    resolveIndicatorLabels: vi.fn(),
}));

vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateIfDatabaseMissingAtBuild: vi.fn(async () => undefined),
}));

import { shortenRevalidateIfDatabaseMissingAtBuild } from '@/shared/cache/buildDegradedRevalidate';
import EconomyKrPage, {
    generateMetadata,
    revalidate,
} from '@/app/[locale]/economy/kr/page';
import { getKrIndicatorCards } from '@/entities/economy/api/getKrIndicatorCards';
import { getCalendarFromDb } from '@/entities/economy/api/getCalendarFromDb';
import { resolveIndicatorLabels } from '@/entities/economy/api/resolveIndicatorLabels';
import { KR_ECONOMY_INDICATORS } from '@/shared/config/economyIndicatorsKr';
import { SITE_URL } from '@/shared/lib/seo';
import { INDEXABLE_PAGE_ROBOTS } from '@/shared/test-utils/indexablePageRobots';

const mockCards = getKrIndicatorCards as MockedFunction<
    typeof getKrIndicatorCards
>;
const mockCalendar = getCalendarFromDb as MockedFunction<
    typeof getCalendarFromDb
>;
const mockLabels = resolveIndicatorLabels as MockedFunction<
    typeof resolveIndicatorLabels
>;

const CARD = {
    meta: KR_ECONOMY_INDICATORS[0],
    latest: 2.75,
    latestDate: '2026-07-16',
    changeFromPrevious: null,
    trend: [],
};

describe('/economy/kr page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCards.mockResolvedValue([]);
        mockCalendar.mockResolvedValue([]);
        mockLabels.mockResolvedValue({});
    });

    it('caches for a day — macro moves monthly and ingestion revalidates by tag', () => {
        expect(revalidate).toBe(86400);
    });

    it('self-canonicals once indicators exist', async () => {
        mockCards.mockResolvedValue([CARD]);

        const meta = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(meta.alternates?.canonical).toBe(`${SITE_URL}/economy/kr`);
        expect(meta.robots).toMatchObject(INDEXABLE_PAGE_ROBOTS);
    });

    it('noindexes while no indicator has been announced yet', async () => {
        const meta = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        // degraded(noindex)도 self-canonical — null로 비우면 신호가 사라진다. hreflang은 없다.
        expect(meta.alternates).toEqual({
            canonical: 'https://siglens.io/economy/kr',
        });
        expect(meta.robots).toEqual({ index: false, follow: true });
    });

    // 배포 빌드에는 DB가 없어 지표 카드이 빈 채로 구워진다 — 60초 revalidate 배선.
    // DB 판정 자체는 헬퍼 테스트가 고정하므로 여기서는 호출 여부만 본다.
    it('빌드타임 DB 부재 degrade revalidate 헬퍼를 부른다', async () => {
        vi.mocked(shortenRevalidateIfDatabaseMissingAtBuild).mockClear();

        mockCards.mockResolvedValue([CARD]);

        render(
            await resolveAsyncServerTree(
                await EconomyKrPage({
                    params: Promise.resolve({ locale: 'ko' }),
                })
            )
        );
        await vi.waitFor(() => {
            expect(
                shortenRevalidateIfDatabaseMissingAtBuild
            ).toHaveBeenCalled();
        });

        expect(shortenRevalidateIfDatabaseMissingAtBuild).toHaveBeenCalled();
    });

    it('reads only the KR calendar', async () => {
        // 국가 필터가 빠지면 미국·한국 이벤트가 한 캘린더에 섞여 나온다 —
        // 두 라우트가 같은 테이블을 쓰기 때문이다.
        mockCards.mockResolvedValue([CARD]);

        render(
            await resolveAsyncServerTree(
                await EconomyKrPage({
                    params: Promise.resolve({ locale: 'ko' }),
                })
            )
        );
        // async 서버 컴포넌트가 데이터를 읽는 시점이 렌더 뒤일 수 있어 직접 기다려 확인한다.
        const { getCalendarFromDb: reader } =
            await import('@/entities/economy/api/getCalendarFromDb');
        await vi.waitFor(() => {
            expect(reader).toHaveBeenCalledWith(expect.any(String), 'KR', 'ko');
        });
    });

    it('renders a KR title, never the US one', async () => {
        render(
            await resolveAsyncServerTree(
                await EconomyKrPage({
                    params: Promise.resolve({ locale: 'ko' }),
                })
            )
        );
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toHaveTextContent('한국 경제');
        expect(h1).not.toHaveTextContent('미국');
    });

    it('renders the region tab strip', async () => {
        render(
            await resolveAsyncServerTree(
                await EconomyKrPage({
                    params: Promise.resolve({ locale: 'ko' }),
                })
            )
        );
        const nav = screen.getByRole('navigation', { name: '지역 선택' });
        expect(nav).toHaveTextContent('미국');
        expect(nav).toHaveTextContent('한국');
    });

    /**
     * FAQ만 페이지 셸에서 낸다. 나머지(WebPage/Breadcrumb/Dataset)는 데이터가 있을
     * 때만 나가도록 `KrEconomyContent` 안으로 내려갔다 — 지표도 캘린더도 없는
     * 상태에서는 `generateMetadata`가 noindex를 거는데, 그때 "지표 N종을 6개월치
     * 담은 데이터셋"이라고 주장하면 모순이다.
     */
    it('셸에서는 FAQ 구조화데이터만 낸다', async () => {
        const { container } = render(
            await resolveAsyncServerTree(
                await EconomyKrPage({
                    params: Promise.resolve({ locale: 'ko' }),
                })
            )
        );
        const types = Array.from(
            container.querySelectorAll('script[type="application/ld+json"]')
        ).map(s => {
            try {
                return JSON.parse(s.textContent ?? '')['@type'];
            } catch {
                return null;
            }
        });
        expect(types).toContain('FAQPage');
        expect(types).not.toContain('Dataset');
    });
});

/**
 * 서버 데이터 섹션(`KrEconomyContent`)은 Suspense로 감싸지 않는다(2026-10-05) — 서버 데이터
 * 경계는 raw HTML에 `<template>` 숨김 청크를 남겨 JS 없는 크롤러에게 본문을 가린다.
 */
describe('/economy/kr 서버 데이터는 Suspense 경계 밖에 있다', () => {
    function containsSuspense(node: unknown): boolean {
        if (Array.isArray(node)) return node.some(containsSuspense);
        if (!isValidElement(node)) return false;
        if (node.type === Suspense) return true;
        return containsSuspense(
            (node.props as { children?: unknown }).children
        );
    }

    it('페이지 트리에 Suspense가 없다', async () => {
        const tree = await EconomyKrPage({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(containsSuspense(tree)).toBe(false);
    });
});

describe('/economy/kr 가시 브레드크럼', () => {
    it('BreadcrumbList와 같은 마디를 그린다', async () => {
        const { economyKrTitle } =
            await import('@/app/[locale]/economy/constants');
        const { getTranslations } = await import('next-intl/server');
        const { expectVisibleBreadcrumbLabels } =
            await import('@/__tests__/utils/expectVisibleBreadcrumb');

        const tSeo = await getTranslations({
            locale: 'ko',
            namespace: 'shared.seo',
        });

        expectVisibleBreadcrumbLabels(
            await EconomyKrPage({ params: Promise.resolve({ locale: 'ko' }) }),
            [economyKrTitle(tSeo)]
        );
    });
});

import { render, screen } from '@testing-library/react';
import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    type MockedFunction,
} from 'vitest';

vi.mock('@/widgets/economy', () => ({
    EconomicCalendar: () => null,
    EconomySkeleton: () => null,
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

import EconomyKrPage, {
    generateMetadata,
    revalidate,
} from '@/app/economy/kr/page';
import { getKrIndicatorCards } from '@/entities/economy/api/getKrIndicatorCards';
import { getCalendarFromDb } from '@/entities/economy/api/getCalendarFromDb';
import { resolveIndicatorLabels } from '@/entities/economy/api/resolveIndicatorLabels';
import { KR_ECONOMY_INDICATORS } from '@/shared/config/economyIndicatorsKr';
import { SITE_URL } from '@/shared/lib/seo';

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

        const meta = await generateMetadata();
        expect(meta.alternates?.canonical).toBe(`${SITE_URL}/economy/kr`);
        expect(meta.robots).toBeUndefined();
    });

    it('noindexes while no indicator has been announced yet', async () => {
        const meta = await generateMetadata();
        expect(meta.alternates?.canonical).toBeNull();
        expect(meta.robots).toEqual({ index: false, follow: true });
    });

    it('reads only the KR calendar', async () => {
        // 국가 필터가 빠지면 미국·한국 이벤트가 한 캘린더에 섞여 나온다 —
        // 두 라우트가 같은 테이블을 쓰기 때문이다.
        mockCards.mockResolvedValue([CARD]);

        render(await EconomyKrPage());
        // Suspense 안 async 컴포넌트라 렌더만으로는 호출되지 않을 수 있어 직접 확인한다.
        const { getCalendarFromDb: reader } =
            await import('@/entities/economy/api/getCalendarFromDb');
        await vi.waitFor(() => {
            expect(reader).toHaveBeenCalledWith(expect.any(String), 'KR');
        });
    });

    it('renders a KR title, never the US one', async () => {
        render(await EconomyKrPage());
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toHaveTextContent('한국 경제');
        expect(h1).not.toHaveTextContent('미국');
    });

    it('renders the region tab strip', async () => {
        render(await EconomyKrPage());
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
        const { container } = render(await EconomyKrPage());
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

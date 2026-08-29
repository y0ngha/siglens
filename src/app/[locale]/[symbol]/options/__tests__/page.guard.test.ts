/**
 * Page-level tab guard tests for the options page.
 *
 * Verifies that the equity-only guard (`isTabAllowedForSymbol`) runs before any
 * FMP/options data fetch, calls `notFound()` for crypto symbols, and does NOT
 * call it for equity symbols. The full page body is not exercised — this is a
 * guard-ordering test, not a render test.
 */

// vi.mock calls are hoisted above imports by vitest.
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: vi.fn(),
}));
vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    pickAssetName: (info: { name: string; koreanName?: string }) =>
        info.koreanName ?? info.name,
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        // Simulate the Next.js notFound() control-flow throw so the page body stops.
        throw new Error('NEXT_NOT_FOUND');
    }),
}));
// Heavy page-body dependencies — mock to prevent import-time side effects.
vi.mock('@/entities/options-chain/lib/optionsDataCache', () => ({
    fetchOptionsSnapshot: vi.fn(),
    hasOptionsMarket: vi.fn().mockResolvedValue(false),
}));
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn().mockResolvedValue(false),
}));
vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/widgets/options/OptionsPageClient', () => ({
    OptionsPageClient: () => null,
}));
vi.mock('@/widgets/options/OptionsEmptyState', () => ({
    OptionsEmptyState: () => null,
}));
vi.mock('@/views/symbol', () => ({
    SymbolPageHeading: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@y0ngha/siglens-core', () => ({
    mapExpirationsToSlots: vi.fn().mockReturnValue([]),
}));
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildWebPageJsonLd: () => ({}),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({ url: '' }),
    buildSymbolOptionsSeoContent: vi.fn().mockReturnValue({
        title: '',
        fullTitle: '',
        description: '',
        url: '',
        keywords: [],
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));

import {
    describe,
    expect,
    it,
    beforeEach,
    vi,
    type MockedFunction,
} from 'vitest';
import { NOINDEX_SYMBOL_METADATA } from '@/shared/lib/seo';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { notFound } from 'next/navigation';
import OptionsPage, {
    generateMetadata,
    revalidate,
} from '@/app/[locale]/[symbol]/options/page';

const mockIsTabAllowed = isTabAllowedForSymbol as MockedFunction<
    typeof isTabAllowedForSymbol
>;
const mockNotFound = notFound as MockedFunction<typeof notFound>;

describe('Options page ISR route config', () => {
    it('exports revalidate = 43200 (literal — required for Next.js static analysis)', () => {
        // app/CLAUDE.md ISR 4축 규약 §4: route segment config must stay a literal for Next.js static analysis (the magic-number-extraction rule does not apply here)
        expect(revalidate).toBe(43200);
    });
});

describe('Options page tab guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls notFound() for a crypto symbol (isTabAllowedForSymbol → false)', async () => {
        // Guard returns false = crypto symbol that does not support the options tab.
        mockIsTabAllowed.mockResolvedValue(false);

        await expect(
            OptionsPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'BTCUSD' }),
            })
        ).rejects.toThrow('NEXT_NOT_FOUND');

        expect(mockIsTabAllowed).toHaveBeenCalledWith('BTCUSD', 'options');
        expect(mockNotFound).toHaveBeenCalledTimes(1);
    });

    it('does not call notFound() from the guard for an equity symbol (isTabAllowedForSymbol → true)', async () => {
        // Guard returns true = equity symbol, proceed past the guard.
        // Downstream calls may still notFound() (e.g. assetInfo null), but that
        // is NOT the guard. We only assert the guard itself does not trigger it.
        mockIsTabAllowed.mockResolvedValue(true);

        // getAssetInfoResilient and staticSymbolCache are already mocked to return
        // safe defaults that prevent a downstream notFound. We just need to confirm
        // the guard path itself didn't call it.
        const { getAssetInfoResilient } = await import('@/entities/ticker');
        (
            getAssetInfoResilient as MockedFunction<
                typeof getAssetInfoResilient
            >
        ).mockResolvedValue({
            assetInfo: {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            },
            degraded: false,
        } as Awaited<ReturnType<typeof getAssetInfoResilient>>);

        // hasOptionsMarket returns false → OptionsEmptyState branch (early return, no
        // further async that could throw). This is the simplest path past the guard.
        await OptionsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'AAPL' }),
        });

        expect(mockIsTabAllowed).toHaveBeenCalledWith('AAPL', 'options');
        // notFound must NOT have been called (guard did not trigger).
        expect(mockNotFound).not.toHaveBeenCalled();
    });

    it('guard runs BEFORE hasOptionsMarket (guard short-circuits first)', async () => {
        mockIsTabAllowed.mockResolvedValue(false);
        const { staticSymbolCache } =
            await import('@/shared/cache/staticSymbolCache');
        const mockCache = staticSymbolCache as MockedFunction<
            typeof staticSymbolCache
        >;

        await expect(
            OptionsPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'BTCUSD' }),
            })
        ).rejects.toThrow('NEXT_NOT_FOUND');

        // The cache (which wraps hasOptionsMarket) must NOT have been called —
        // the guard ran first and threw notFound, preventing further execution.
        expect(mockCache).not.toHaveBeenCalled();
    });
});

/**
 * generateMetadata must mirror the page body's isTabAllowedForSymbol guard.
 * Without it, a crypto symbol would have canonical + index:true metadata while
 * the page body returns notFound() (noindex) — creating a soft-404 mismatch.
 */
describe('Options generateMetadata crypto NOINDEX guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('crypto symbol (isTabAllowedForSymbol → false) → returns NOINDEX_SYMBOL_METADATA', async () => {
        mockIsTabAllowed.mockResolvedValue(false);

        const result = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'BTCUSD' }),
        });

        expect(mockIsTabAllowed).toHaveBeenCalledWith('BTCUSD', 'options');
        // noindex 계약: robots index:false + canonical null. 상수와의 동등성이
        // 아니라 계약을 단언한다 — 2026-08-24부터 이 분기는 심볼 고유
        // title/description/og:url을 함께 낸다(`noindexSymbolMetadata`). 상수
        // 동등성으로 두면 "루트 레이아웃 메타 상속" 회귀를 영영 못 잡는다.
        expect(result.robots).toEqual(NOINDEX_SYMBOL_METADATA.robots);
        expect(result.alternates).toEqual(NOINDEX_SYMBOL_METADATA.alternates);
        expect(result.title).toEqual({
            absolute: expect.stringContaining('BTCUSD'),
        });
    });

    it('equity symbol (isTabAllowedForSymbol → true) → returns indexable metadata (not NOINDEX)', async () => {
        mockIsTabAllowed.mockResolvedValue(true);

        // Provide assetInfo so generateMetadata can build real metadata content.
        const { getAssetInfoResilient } = await import('@/entities/ticker');
        (
            getAssetInfoResilient as MockedFunction<
                typeof getAssetInfoResilient
            >
        ).mockResolvedValue({
            assetInfo: {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            },
            degraded: false,
        } as Awaited<ReturnType<typeof getAssetInfoResilient>>);

        const result = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'AAPL' }),
        });

        expect(mockIsTabAllowed).toHaveBeenCalledWith('AAPL', 'options');
        // Must NOT be the hard NOINDEX sentinel object.
        // NOINDEX_SYMBOL_METADATA has { robots: { index: false, follow: true },
        //   alternates: { canonical: null } } — the sentinel returned for crypto/invalid.
        //   `canonical: null` (not follow) is what separates it from an indexable
        //   page: every noindex branch now keeps follow:true so crawl paths to the
        //   sibling tabs survive.
        expect(result).not.toEqual(NOINDEX_SYMBOL_METADATA);
        // The equity path with hasOptionsMarket:false (our mock) sets
        // robots: { index: false, follow: true } — links are still crawlable.
        //
        // ⚠️ `follow:true`는 더 이상 판별 신호가 아니다 — NOINDEX_SYMBOL_METADATA도
        // follow:true를 쓴다(noindex 페이지에 nofollow를 얹으면 형제 탭으로 가는
        // 크롤 경로가 끊기기 때문). 남은 falsifiable 신호는 **self-canonical**이다:
        // sentinel은 canonical:null인데 이 equity 경로는 자기 URL을 canonical로 낸다.
        const robots = result.robots as
            | { index?: boolean; follow?: boolean }
            | undefined;
        expect(robots?.follow).toBe(true);
        expect(result.alternates?.canonical).not.toBeNull();
    });
});

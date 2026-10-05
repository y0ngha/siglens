/**
 * Page-level tab guard tests for the congress page.
 *
 * Verifies that the equity-only guard (`isTabAllowedForSymbol`) runs before any
 * FMP/congress data fetch, calls `notFound()` for crypto symbols, and does NOT
 * call it for equity symbols. The full page body is not exercised — this is a
 * guard-ordering test, not a render test.
 */

// vi.mock calls are hoisted above imports by vitest.
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: vi.fn(),
}));
vi.mock('@/entities/ticker/lib/assetClassification', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
}));
vi.mock('@/entities/ticker/lib/ticker', () => ({
    pickAssetName: (info: { name: string; koreanName?: string }) =>
        info.koreanName ?? info.name,
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
}));
vi.mock('@/entities/ticker/lib/getAssetInfoResilient', () => ({
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));
vi.mock('@/entities/ticker/lib/getProfileResilient', () => ({
    getProfileResilient: vi.fn(),
}));
vi.mock('@/app/[locale]/[symbol]/congress/congressData', () => ({
    getCongressPageData: vi.fn(),
}));
vi.mock('@/app/[locale]/[symbol]/congress/CongressDegraded', () => ({
    CongressDegraded: () => null,
}));
vi.mock('@/entities/congress-trades/lib/getCongressTradesResilient', () => ({
    getCongressTradesResilient: vi.fn(),
}));
vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/widgets/congress/CongressTrendSummary', () => ({
    CongressTrendSummary: () => null,
}));
vi.mock('@/widgets/congress/CongressTradesTable', () => ({
    CongressTradesTable: () => null,
}));
vi.mock('@/views/symbol/ui/SymbolPageHeading', () => ({
    SymbolPageHeading: () => null,
}));
vi.mock('@/shared/ui/CrossLinkCards', () => ({
    CrossLinkCards: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildWebPageJsonLd: () => ({}),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({ url: '' }),
    buildSymbolCongressSeoContent: vi.fn().mockReturnValue({
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
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { getProfileResilient } from '@/entities/ticker/lib/getProfileResilient';
import { notFound } from 'next/navigation';
import CongressPage, {
    generateMetadata,
    revalidate,
} from '@/app/[locale]/[symbol]/congress/page';

const mockIsTabAllowed = isTabAllowedForSymbol as MockedFunction<
    typeof isTabAllowedForSymbol
>;
const mockNotFound = notFound as MockedFunction<typeof notFound>;
const mockGetAssetInfoResilient = getAssetInfoResilient as MockedFunction<
    typeof getAssetInfoResilient
>;
const mockGetProfileResilient = getProfileResilient as MockedFunction<
    typeof getProfileResilient
>;

describe('Congress page ISR route config', () => {
    it('exports revalidate = 86400 (literal — required for Next.js static analysis)', () => {
        // app/CLAUDE.md ISR 4축 규약 §4: route segment config must stay a literal for Next.js static analysis (the magic-number-extraction rule does not apply here)
        expect(revalidate).toBe(86400);
    });
});

describe('Congress page tab guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls notFound() for a crypto symbol (isTabAllowedForSymbol → false)', async () => {
        mockIsTabAllowed.mockResolvedValue(false);

        await expect(
            CongressPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'BTCUSD' }),
            })
        ).rejects.toThrow('NEXT_NOT_FOUND');

        expect(mockIsTabAllowed).toHaveBeenCalledWith('BTCUSD', 'congress');
        expect(mockNotFound).toHaveBeenCalledTimes(1);
    });

    it('does not call notFound() from the guard for an equity symbol (isTabAllowedForSymbol → true)', async () => {
        mockIsTabAllowed.mockResolvedValue(true);
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            },
            degraded: false,
        } as Awaited<ReturnType<typeof getAssetInfoResilient>>);
        // profile degraded = degrade branch (returns JSX, no notFound).
        mockGetProfileResilient.mockResolvedValue({
            profile: null,
            degraded: true,
        } as Awaited<ReturnType<typeof getProfileResilient>>);

        await CongressPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'AAPL' }),
        });

        expect(mockIsTabAllowed).toHaveBeenCalledWith('AAPL', 'congress');
        // notFound must NOT have been called (guard did not trigger).
        expect(mockNotFound).not.toHaveBeenCalled();
    });

    it('guard runs BEFORE getProfileResilient (guard short-circuits first)', async () => {
        mockIsTabAllowed.mockResolvedValue(false);

        await expect(
            CongressPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'BTCUSD' }),
            })
        ).rejects.toThrow('NEXT_NOT_FOUND');

        // getProfileResilient must NOT have been called — the guard prevented it.
        expect(mockGetProfileResilient).not.toHaveBeenCalled();
    });
});

/**
 * generateMetadata must mirror the page body's isTabAllowedForSymbol guard.
 * Without it, a crypto symbol would have canonical + index:true metadata while
 * the page body returns notFound() (noindex) — creating a soft-404 mismatch.
 */
describe('Congress generateMetadata crypto NOINDEX guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('crypto symbol (isTabAllowedForSymbol → false) → returns NOINDEX_SYMBOL_METADATA', async () => {
        mockIsTabAllowed.mockResolvedValue(false);

        const result = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'BTCUSD' }),
        });

        expect(mockIsTabAllowed).toHaveBeenCalledWith('BTCUSD', 'congress');
        // noindex 계약: robots index:false + self-canonical. 상수와의 동등성이
        // 아니라 계약을 단언한다 — 2026-08-24부터 이 분기는 심볼 고유
        // title/description/og:url을 함께 낸다(`noindexSymbolMetadata`). 상수
        // 동등성으로 두면 "루트 레이아웃 메타 상속" 회귀를 영영 못 잡는다.
        expect(result.robots).toEqual(NOINDEX_SYMBOL_METADATA.robots);
        // self-canonical(2026-10-05) — `canonical: null`이 아니다.
        expect(result.alternates).toEqual({
            canonical: 'https://siglens.io/BTCUSD/congress',
        });
        expect(result.title).toEqual({
            absolute: expect.stringContaining('BTCUSD'),
        });
    });

    it('equity symbol (isTabAllowedForSymbol → true) → noindex(follow 유지)이되 canonical은 null이 아니다', async () => {
        mockIsTabAllowed.mockResolvedValue(true);

        mockGetAssetInfoResilient.mockResolvedValue({
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

        expect(mockIsTabAllowed).toHaveBeenCalledWith('AAPL', 'congress');
        // 2026-10-01 SEO 감사: 이 탭은 항상 noindex다. 하드 sentinel
        // (NOINDEX_SYMBOL_METADATA)과 갈리는 신호는 `canonical`이다 — sentinel은
        // null이지만 이 경로는 self-canonical을 유지한다.
        expect(result).not.toEqual(NOINDEX_SYMBOL_METADATA);
        expect(result.robots).toEqual({ index: false, follow: true });
        // SEO content 목은 url이 빈 문자열이라 값 대신 "null이 아님"만 고정한다
        // (정확한 self URL은 page.metadata.test.ts가 검증한다).
        expect(result.alternates?.canonical).not.toBeNull();
        expect(result.alternates?.canonical).toBeDefined();
    });
});

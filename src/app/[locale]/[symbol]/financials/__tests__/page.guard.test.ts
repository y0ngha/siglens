/**
 * Page-level tab guard tests for the financials page.
 *
 * Verifies that the equity-only guard (`isTabAllowedForSymbol`) runs before any
 * FMP/financials data fetch, calls `notFound()` for crypto symbols, and does NOT
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
vi.mock('@/app/[locale]/[symbol]/financials/financialData', () => ({
    getFinancialsPageData: vi.fn().mockResolvedValue({
        snapshot: {
            income: [{}],
            balance: [],
            cashFlow: [],
            incomeGrowth: [],
            financialGrowth: [],
            cashFlowGrowth: [],
        },
        scorecard: null,
    }),
}));
vi.mock('@/app/[locale]/[symbol]/financials/FinancialsDegraded', () => ({
    FinancialsDegraded: () => null,
}));
vi.mock('@/entities/financials-statements/lib/getFinancialsSnapshot', () => ({
    getFinancialsSnapshot: vi.fn(),
    isEmptyFinancialsSnapshot: vi.fn().mockReturnValue(false),
}));
vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/widgets/financials/FinancialsAiSummary', () => ({
    FinancialsAiSummary: () => null,
}));
vi.mock('@/widgets/financials/FinancialsScorecard', () => ({
    FinancialsScorecard: () => null,
}));
vi.mock('@/widgets/financials/FinancialsStatements', () => ({
    FinancialsStatements: () => null,
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
    buildSymbolFinancialsSeoContent: vi.fn().mockReturnValue({
        title: '',
        fullTitle: '',
        description: '',
        url: '',
        keywords: [],
    }),
    SITE_NAME: 'SIGLENS',
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
import { getFinancialsPageData } from '@/app/[locale]/[symbol]/financials/financialData';
import { notFound } from 'next/navigation';
import FinancialsPage, {
    generateMetadata,
    revalidate,
} from '@/app/[locale]/[symbol]/financials/page';

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

describe('Financials page ISR route config', () => {
    it('exports revalidate = 86400 (literal — required for Next.js static analysis)', () => {
        // app/CLAUDE.md ISR 4축 규약 §4: route segment config must stay a literal for Next.js static analysis (the magic-number-extraction rule does not apply here)
        expect(revalidate).toBe(86400);
    });
});

describe('Financials page tab guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls notFound() for a crypto symbol (isTabAllowedForSymbol → false)', async () => {
        mockIsTabAllowed.mockResolvedValue(false);

        await expect(
            FinancialsPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'BTCUSD' }),
            })
        ).rejects.toThrow('NEXT_NOT_FOUND');

        expect(mockIsTabAllowed).toHaveBeenCalledWith('BTCUSD', 'financials');
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
        mockGetProfileResilient.mockResolvedValue({
            profile: { sector: 'Technology', description: '' },
            degraded: false,
        } as Awaited<ReturnType<typeof getProfileResilient>>);

        await FinancialsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'AAPL' }),
        });

        expect(mockIsTabAllowed).toHaveBeenCalledWith('AAPL', 'financials');
        // Guard must not have triggered notFound.
        expect(mockNotFound).not.toHaveBeenCalled();
    });

    it('guard runs BEFORE getProfileResilient (guard short-circuits first)', async () => {
        mockIsTabAllowed.mockResolvedValue(false);

        await expect(
            FinancialsPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'BTCUSD' }),
            })
        ).rejects.toThrow('NEXT_NOT_FOUND');

        // getProfileResilient must NOT have been called — the guard prevented it.
        expect(mockGetProfileResilient).not.toHaveBeenCalled();
        // 재무 fetch도 가드 뒤에 있다 — 크립토에는 FMP를 부르지 않는다.
        expect(getFinancialsPageData).not.toHaveBeenCalled();
    });

    it('게이트가 notFound()로 끝나는 동안 병렬로 시작한 재무 fetch가 reject해도 unhandledRejection이 없다', async () => {
        const onUnhandled = vi.fn();
        process.on('unhandledRejection', onUnhandled);
        try {
            mockIsTabAllowed.mockResolvedValue(true);
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: { symbol: 'AAPL', name: 'Apple Inc.' },
                degraded: false,
            } as Awaited<ReturnType<typeof getAssetInfoResilient>>);
            vi.mocked(getFinancialsPageData).mockRejectedValueOnce(
                new Error('fmp down')
            );
            // profile === null → 게이트가 notFound()로 끝난다.
            mockGetProfileResilient.mockResolvedValue({
                profile: null,
                degraded: false,
            } as Awaited<ReturnType<typeof getProfileResilient>>);

            await expect(
                FinancialsPage({
                    params: Promise.resolve({ locale: 'ko', symbol: 'AAPL' }),
                })
            ).rejects.toThrow('NEXT_NOT_FOUND');
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(getFinancialsPageData).toHaveBeenCalledWith('AAPL');
            expect(onUnhandled).not.toHaveBeenCalled();
        } finally {
            process.off('unhandledRejection', onUnhandled);
        }
    });

    it('재무 fetch를 profile 게이트와 병렬로 시작한다 — profile을 기다리지 않는다', async () => {
        mockIsTabAllowed.mockResolvedValue(true);
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: { symbol: 'AAPL', name: 'Apple Inc.' },
            degraded: false,
        } as Awaited<ReturnType<typeof getAssetInfoResilient>>);
        let resolveProfile!: (
            v: Awaited<ReturnType<typeof getProfileResilient>>
        ) => void;
        mockGetProfileResilient.mockReturnValue(
            new Promise(resolve => {
                resolveProfile = resolve;
            })
        );

        const pending = FinancialsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'AAPL' }),
        });
        await vi.waitFor(() =>
            expect(mockGetProfileResilient).toHaveBeenCalled()
        );
        // profile이 아직 끝나지 않았는데 재무 fetch는 이미 시작됐다.
        expect(getFinancialsPageData).toHaveBeenCalledWith('AAPL');

        resolveProfile({
            profile: { sector: 'Technology', description: '' },
            degraded: false,
        } as Awaited<ReturnType<typeof getProfileResilient>>);
        await pending;
        expect(getFinancialsPageData).toHaveBeenCalledTimes(1);
    });
});

/**
 * generateMetadata must mirror the page body's isTabAllowedForSymbol guard.
 * Without it, a crypto symbol would have canonical + index:true metadata while
 * the page body returns notFound() (noindex) — creating a soft-404 mismatch.
 */
describe('Financials generateMetadata crypto NOINDEX guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('crypto symbol (isTabAllowedForSymbol → false) → notFound()를 던진다 — 404에 탭 카피·self-canonical이 얹히지 않는다', async () => {
        mockIsTabAllowed.mockResolvedValue(false);

        await expect(
            generateMetadata({
                params: Promise.resolve({ locale: 'ko', symbol: 'BTCUSD' }),
            })
        ).rejects.toThrow('NEXT_NOT_FOUND');

        expect(mockIsTabAllowed).toHaveBeenCalledWith('BTCUSD', 'financials');
        expect(mockNotFound).toHaveBeenCalled();
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

        expect(mockIsTabAllowed).toHaveBeenCalledWith('AAPL', 'financials');
        // 2026-10-01 SEO 감사: 이 탭은 항상 noindex다. 하드 sentinel
        // (NOINDEX_SYMBOL_METADATA)과 갈리는 신호는 `canonical`이다 — sentinel은
        // null이지만 이 경로는 self-canonical을 유지한다.
        expect(result).not.toEqual(NOINDEX_SYMBOL_METADATA);
        expect(result.robots).toEqual({ index: false, follow: true });
        expect(result.alternates?.canonical).not.toBeNull();
        expect(result.alternates?.canonical).toBeDefined();
    });
});

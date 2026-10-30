/**
 * `FinancialsPage`가 `FinancialsScorecard`에 넘기는 `currency`를 고정한다. 위젯을 `() => null`로
 * mock하므로 렌더 결과가 아니라 element props를 검사한다 — `.KS` 종목은 원화, 재무제표 행이 보고
 * 통화를 알려 주면 그 통화여야 히어로(scorecard)의 금액이 맞는 통화로 나간다.
 *
 * `page.body.test.tsx`(overall 페이지)가 쓰는 findElementByType 패턴을 따른다.
 */

// vi.mock calls are hoisted above imports by vitest.
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/entities/ticker/lib/assetClassification', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
}));
vi.mock('@/entities/ticker/lib/ticker', () => ({
    pickAssetName: (info: { name: string; koreanName?: string }) =>
        info.koreanName ?? info.name,
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
}));
vi.mock('@/entities/ticker/server/getAssetInfoResilient', () => ({
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));
vi.mock('@/entities/ticker/server/getProfileResilient', () => ({
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
vi.mock(
    '@/entities/financials-statements/server/getFinancialsSnapshot',
    () => ({
        getFinancialsSnapshot: vi.fn(),
    })
);
vi.mock('@/entities/financials-statements/lib/financialsSnapshot', () => ({
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
    SITE_URL: 'https://siglens.io',
}));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import FinancialsPage from '@/app/[locale]/[symbol]/financials/page';
import { FinancialsScorecard } from '@/widgets/financials/FinancialsScorecard';
import { getAssetInfoResilient } from '@/entities/ticker/server/getAssetInfoResilient';
import { getProfileResilient } from '@/entities/ticker/server/getProfileResilient';
import { getFinancialsPageData } from '@/app/[locale]/[symbol]/financials/financialData';
import { findElementByType } from '@/__tests__/utils/findElementByType';

const mockGetAssetInfoResilient = vi.mocked(getAssetInfoResilient);
const mockGetProfileResilient = vi.mocked(getProfileResilient);

const EQUITY_ASSET_INFO = {
    assetInfo: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        koreanName: '애플',
        fmpSymbol: 'AAPL',
    },
    degraded: false,
} as Awaited<ReturnType<typeof getAssetInfoResilient>>;

const KR_ASSET_INFO = {
    assetInfo: {
        symbol: '005930.KS',
        name: 'Samsung Electronics',
        koreanName: '삼성전자',
        fmpSymbol: undefined,
        marketProfile: 'kr-equity' as const,
    },
    degraded: false,
} as Awaited<ReturnType<typeof getAssetInfoResilient>>;

const PROFILE_OK = {
    profile: { sector: 'Technology', description: 'A tech company.' },
    degraded: false,
} as Awaited<ReturnType<typeof getProfileResilient>>;

describe('FinancialsPage — FinancialsScorecard currency 전달', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetProfileResilient.mockResolvedValue(PROFILE_OK);
    });

    it('한국 종목(.KS)은 FinancialsScorecard에 currency="KRW"를 전달한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(KR_ASSET_INFO);

        const tree = await FinancialsPage({
            params: Promise.resolve({ locale: 'ko', symbol: '005930.ks' }),
        });

        const scorecard = findElementByType(tree, FinancialsScorecard);
        expect(scorecard).not.toBeNull();
        expect((scorecard?.props as { currency?: string }).currency).toBe(
            'KRW'
        );
    });

    it('미국 종목은 FinancialsScorecard에 currency="USD"를 전달한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);

        const tree = await FinancialsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        const scorecard = findElementByType(tree, FinancialsScorecard);
        expect(scorecard).not.toBeNull();
        expect((scorecard?.props as { currency?: string }).currency).toBe(
            'USD'
        );
    });

    it('재무제표 행이 보고 통화(TWD)를 알려 주면 상장 통화 대신 그 통화를 전달한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
        vi.mocked(getFinancialsPageData).mockResolvedValueOnce({
            snapshot: {
                income: [{ reportedCurrency: 'TWD' }],
                balance: [],
                cashFlow: [],
                incomeGrowth: [],
                financialGrowth: [],
                cashFlowGrowth: [],
            },
            scorecard: null,
        } as unknown as Awaited<ReturnType<typeof getFinancialsPageData>>);

        const tree = await FinancialsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'tsm' }),
        });

        const scorecard = findElementByType(tree, FinancialsScorecard);
        expect((scorecard?.props as { currency?: string }).currency).toBe(
            'TWD'
        );
    });
});

/**
 * 뮤테이션 감사 생존자 회귀 가드: `FinancialsPage`의
 * `currency={statementCurrencyOf(upper)}` → `'USD'` 하드코딩 뮤테이션이
 * 41/41 그린으로 살아남았다 — 기존 테스트는 `FinancialsScorecard`를
 * `() => null`로 mock하고 렌더 결과를 검사하지 않아, currency prop이 실제로
 * 심볼에서 유도돼 전달되는지는 아무도 확인하지 않았다. `.KS` 종목이면
 * 재무제표 히어로(scorecard)가 통째로 달러로 렌더될 수 있었다는 뜻이다.
 *
 * `page.body.test.tsx`(overall 페이지)가 hasOptions/marketProfile에 쓴
 * findElementByType 패턴을 그대로 따른다.
 */

// vi.mock calls are hoisted above imports by vitest.
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));
vi.mock('@/app/[symbol]/fundamental/getProfileResilient', () => ({
    getProfileResilient: vi.fn(),
}));
vi.mock('@/app/[symbol]/financials/financialData', () => ({
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
vi.mock('@/app/[symbol]/financials/FinancialsDegraded', () => ({
    FinancialsDegraded: () => null,
}));
vi.mock('@/entities/financials-statements', () => ({
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
vi.mock('@/views/symbol', () => ({
    SymbolPageHeading: () => null,
}));
vi.mock('@/shared/ui/CrossLinkCards', () => ({
    CrossLinkCards: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({ url: '' }),
    buildSymbolFinancialsSeoContent: vi.fn().mockReturnValue({
        title: '',
        fullTitle: '',
        description: '',
        url: '',
        keywords: [],
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import FinancialsPage from '@/app/[symbol]/financials/page';
import { FinancialsScorecard } from '@/widgets/financials/FinancialsScorecard';
import { getAssetInfoResilient } from '@/entities/ticker';
import { getProfileResilient } from '@/app/[symbol]/fundamental/getProfileResilient';
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

describe('FinancialsPage — FinancialsScorecard currency 전달 (뮤테이션 감사)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetProfileResilient.mockResolvedValue(PROFILE_OK);
    });

    it('한국 종목(.KS)은 FinancialsScorecard에 currency="KRW"를 전달한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(KR_ASSET_INFO);

        const tree = await FinancialsPage({
            params: Promise.resolve({ symbol: '005930.ks' }),
        });

        const scorecard = findElementByType(tree, FinancialsScorecard);
        expect(scorecard).not.toBeNull();
        expect((scorecard?.props as { currency?: string }).currency).toBe(
            'KRW'
        );
    });

    it('미국 종목은 FinancialsScorecard에 currency="USD"를 전달한다 (회귀 아님 확인)', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);

        const tree = await FinancialsPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const scorecard = findElementByType(tree, FinancialsScorecard);
        expect(scorecard).not.toBeNull();
        expect((scorecard?.props as { currency?: string }).currency).toBe(
            'USD'
        );
    });
});

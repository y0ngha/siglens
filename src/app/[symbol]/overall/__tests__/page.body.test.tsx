/**
 * Overall page body branching tests — verifies crypto-vs-equity copy in:
 *   1. SymbolPageHeading (visible h1 region)
 *   2. The visible FAQ section (`FaqSection`)
 *   3. FAQ JSON-LD `mainEntity[*].acceptedAnswer.text` answers
 *
 * 2·3은 이제 같은 배열(`copy.faq`)에서 나온다 — 예전에는 안내 문단과 FAQ 답변이
 * 두 벌이었고 문단만 화면에 보였다.
 *
 * Strategy: invoke the RSC directly (no DOM render) and JSON.stringify the tree
 * to assert presence/absence of branch-specific strings, mirroring the pattern
 * in `src/app/[symbol]/news/__tests__/page.body.test.tsx`.
 */

// MISTAKES §17: all vi.mock + vi.hoisted above imports.
const { mockGetSeoSnapshotsStatic } = vi.hoisted(() => ({
    mockGetSeoSnapshotsStatic: vi.fn(),
}));

vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: mockGetSeoSnapshotsStatic,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));

vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    buildDisplayName: vi.fn((assetInfo: { name: string }) => assetInfo.name),
    getAssetInfoResilient: vi.fn(),
}));

vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(
        (
            _key: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>
        ) => fetcher()
    ),
}));

vi.mock('@/entities/news-article', () => ({
    NEWS_LIST_CACHE_KEY: 'news-list',
}));
vi.mock('@/entities/news-article/api', () => ({
    getNewsList: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/widgets/overall/OverallContent', () => ({
    OverallContent: () => null,
}));
vi.mock('@/widgets/overall', () => ({
    OverallFactualFallback: () => null,
    OverallFactsSummary: () => null,
}));
vi.mock('@/views/symbol', () => ({
    SymbolPageHeading: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/shared/ui/CrossLinkCards', () => ({
    CrossLinkCards: () => null,
}));

vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({
        url: 'https://siglens.io/AAPL',
    }),
    resolveSymbolOverallSeoContent: vi.fn().mockReturnValue({
        title: 'T',
        fullTitle: 'T | Siglens',
        description: 'd',
        url: 'https://siglens.io/AAPL/overall',
        keywords: [],
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));

vi.mock('@y0ngha/siglens-core', () => ({
    DEEPSEEK_V4_FLASH_MODEL: 'deepseek-v4-flash',
    peekOverallAnalysisCache: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/shared/config/market', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/config/market')>()),
    DEFAULT_TIMEFRAME: '1Day',
}));

import { Suspense, isValidElement, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OverallPage from '@/app/[symbol]/overall/page';
import { getAssetInfoResilient } from '@/entities/ticker';
import { OverallContent } from '@/widgets/overall/OverallContent';
import { OverallFactualFallback } from '@/widgets/overall';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import { expectFaqSingleSource } from '@/__tests__/utils/expectFaqSingleSource';
import { expectSymbolBreadcrumbName } from '@/__tests__/utils/expectSymbolBreadcrumbName';

const mockGetAssetInfoResilient = vi.mocked(getAssetInfoResilient);

/**
 * OverallFactualFallback은 Suspense의 `fallback` prop 안에 있어 children-only
 * 순회(findElementByType)로는 닿지 않는다 — page.factlayer.test.tsx / page.test.ts와
 * 동일한 로컬 헬퍼.
 */
function findSuspenseFallback(node: ReactNode): ReactNode {
    if (Array.isArray(node)) {
        for (const child of node) {
            const result = findSuspenseFallback(child);
            if (result !== undefined) return result;
        }
        return undefined;
    }
    if (!isValidElement(node)) return undefined;
    if (node.type === Suspense) {
        return (node.props as { fallback?: ReactNode }).fallback;
    }
    const childProps = node.props as { children?: ReactNode };
    return findSuspenseFallback(childProps.children);
}

const EQUITY_ASSET_INFO = {
    assetInfo: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        koreanName: '애플',
        fmpSymbol: 'AAPL',
        marketProfile: 'us-equity' as const,
    },
    degraded: false,
} as Awaited<ReturnType<typeof getAssetInfoResilient>>;

const CRYPTO_ASSET_INFO = {
    assetInfo: {
        symbol: 'BTCUSD',
        name: 'Bitcoin',
        koreanName: '비트코인',
        // fmpSymbol is null for crypto — the type requires string|undefined, so we
        // cast through unknown to represent the real runtime shape that the DB returns.
        fmpSymbol: null as unknown as string | undefined,
        marketProfile: 'crypto' as const,
    },
    degraded: false,
} as Awaited<ReturnType<typeof getAssetInfoResilient>>;

const KR_EQUITY_ASSET_INFO = {
    assetInfo: {
        symbol: '005930.KS',
        name: 'Samsung Electronics',
        koreanName: '삼성전자',
        fmpSymbol: undefined as unknown as string | undefined,
        marketProfile: 'kr-equity' as const,
    },
    degraded: false,
} as Awaited<ReturnType<typeof getAssetInfoResilient>>;

describe('OverallPage — isEquity body branching', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: no SEO snapshot row — this suite covers isEquity copy
        // branching, which is orthogonal to the snapshot section.
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
    });

    describe('SymbolPageHeading (h1 region)', () => {
        it('crypto → heading uses 차트와 뉴스, 매수 분위기 종합 분석', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'BTCUSD' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain('차트와 뉴스, 매수 분위기 종합 분석');
            // equity-only heading must be absent
            expect(treeStr).not.toContain(
                '차트와 옵션 시장, 실적, 뉴스 종합 분석'
            );
        });

        it('equity → heading uses 차트와 옵션 시장, 실적, 뉴스 종합 분석', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain('차트와 옵션 시장, 실적, 뉴스 종합 분석');
            expect(treeStr).not.toContain('차트와 뉴스, 매수 분위기 종합 분석');
        });
    });

    describe('visible FAQ section body', () => {
        it('crypto → body contains 매수 분위기(공포 탐욕 지수)', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'BTCUSD' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain('매수 분위기(공포 탐욕 지수)');
        });

        it('crypto → body does NOT contain 옵션 시장이 평가하는 단기 방향성', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'BTCUSD' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).not.toContain('옵션 시장이 평가하는 단기 방향성');
        });

        it('equity → body contains 옵션 시장이 평가하는 단기 방향성', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain('옵션 시장이 평가하는 단기 방향성');
        });

        it('equity → body contains 분기 실적 흐름', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain('분기 실적 흐름');
        });
    });

    /**
     * 회귀 가드: FAQPage 마크업과 화면 Q&A는 `copy.faq` 하나에서 나와야 한다.
     * 예전에는 답변이 JSON-LD 리터럴 안에만 있어 화면 어디에도 없었다 — 구글은
     * 대응하는 내용이 페이지에 보일 것을 요구한다.
     */
    it('FAQPage 구조화데이터가 화면 FaqSection과 같은 질문·답변을 쓴다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
        const tree = await OverallPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expectFaqSingleSource(tree);
    });

    /**
     * 회귀 가드: BreadcrumbList position 2는 화면 브레드크럼과 같은 이름이어야 한다.
     * 근거는 `expectSymbolBreadcrumbName` JSDoc 참고.
     */
    it('BreadcrumbList가 티커가 아니라 displayName을 쓴다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
        await OverallPage({ params: Promise.resolve({ symbol: 'aapl' }) });

        expectSymbolBreadcrumbName('Apple Inc.');
    });

    describe('FAQ JSON-LD answer branching', () => {
        it('crypto → FAQ answer contains 매수 분위기(공포 탐욕 지수)까지 세 축을 묶어', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'BTCUSD' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain(
                '매수 분위기(공포 탐욕 지수)까지 세 축을 묶어'
            );
            // equity-only FAQ text must be absent
            expect(treeStr).not.toContain('옵션 시장이 평가하는 단기 방향성');
        });

        it('equity → FAQ answer contains 옵션 시장의 콜·풋 베팅 분위기', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain('옵션 시장의 콜·풋 베팅 분위기');
            expect(treeStr).not.toContain(
                '매수 분위기(공포 탐욕 지수)까지 세 축을 묶어'
            );
        });

        it('crypto → FAQ risk answer contains 규제 이슈, 대형 뉴스', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'BTCUSD' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain('규제 이슈, 대형 뉴스');
            // equity-only risk text
            expect(treeStr).not.toContain('실적 발표 결과나 가이던스 변화');
        });

        it('equity → FAQ risk answer contains 실적 발표 결과나 가이던스 변화', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain('실적 발표 결과나 가이던스 변화');
            expect(treeStr).not.toContain('규제 이슈, 대형 뉴스');
        });
    });
});

/**
 * 회귀 가드(SEO 감사 finding 1, 2026-08-18): 한국 개별주식은 옵션 시장이 없다
 * (`KR_EQUITY_DESCRIPTOR.tabs`에 `options`가 없음). `isEquity`(assetClass 이진
 * 분류)만으로 문구를 고르면 한국 종목도 미국 종목과 동일한 "옵션 시장" 문구를
 * 노출하게 된다 — `/005930.KS/overall`이 실재하지 않는 옵션 분석을 약속했다.
 * `hasOptions`(descriptor.tabs.includes('options')) 분기가 H1, FAQ 두 답변,
 * 본문 3문단에서 모두 걸려 있는지 각각 pin한다.
 */
describe('OverallPage — kr-equity hasOptions branching (SEO 감사 finding 1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
    });

    it('한국 종목 H1은 옵션 시장 문구 없이 차트·실적·뉴스만 언급한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(KR_EQUITY_ASSET_INFO);
        const tree = await OverallPage({
            params: Promise.resolve({ symbol: '005930.ks' }),
        });
        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain('차트와 실적, 뉴스 종합 분석');
        expect(treeStr).not.toContain('차트와 옵션 시장, 실적, 뉴스 종합 분석');
    });

    it('한국 종목 FAQ 첫 답변은 옵션 시장 문구 없이 세 가지 분석 축을 언급한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(KR_EQUITY_ASSET_INFO);
        const tree = await OverallPage({
            params: Promise.resolve({ symbol: '005930.ks' }),
        });
        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain(
            '세 가지 분석 축에 시장 분위기(공포 탐욕 지수)'
        );
        expect(treeStr).not.toContain('옵션 시장이 평가하는 단기 방향성');
    });

    it('한국 종목 FAQ 두 번째 답변은 옵션 시장의 콜·풋 베팅 문구를 포함하지 않는다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(KR_EQUITY_ASSET_INFO);
        const tree = await OverallPage({
            params: Promise.resolve({ symbol: '005930.ks' }),
        });
        const treeStr = JSON.stringify(tree);
        expect(treeStr).not.toContain('옵션 시장의 콜·풋 베팅 분위기');
        // 미국 주식과 동일하게 실적/가이던스는 여전히 언급한다.
        expect(treeStr).toContain('실적과 가이던스 흐름');
    });

    it('한국 종목 FAQ 첫 답변은 옵션 시장 문장 대신 실적/가이던스 문장을 붙인다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(KR_EQUITY_ASSET_INFO);
        const tree = await OverallPage({
            params: Promise.resolve({ symbol: '005930.ks' }),
        });
        const treeStr = JSON.stringify(tree);
        expect(treeStr).not.toContain(
            '옵션 시장이 가까운 만기에서 콜과 풋 어느'
        );
        expect(treeStr).toContain('분기 실적이 시장 기대치를 웃돌았는지');
    });

    it('.KS 종목: OverallContent에 hasOptions=false, OverallFactualFallback에 marketProfile="kr-equity"를 전달한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(KR_EQUITY_ASSET_INFO);
        const tree = await OverallPage({
            params: Promise.resolve({ symbol: '005930.ks' }),
        });

        const content = findElementByType(tree, OverallContent);
        expect(content).not.toBeNull();
        expect((content?.props as { hasOptions: boolean }).hasOptions).toBe(
            false
        );

        const fallback = findSuspenseFallback(tree);
        const factualFallback = findElementByType(
            fallback,
            OverallFactualFallback
        );
        expect(factualFallback).not.toBeNull();
        expect(
            (factualFallback?.props as { marketProfile: string }).marketProfile
        ).toBe('kr-equity');
    });

    it('미국 종목: OverallContent에 hasOptions=true, OverallFactualFallback에 marketProfile="us-equity"를 전달한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
        const tree = await OverallPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const content = findElementByType(tree, OverallContent);
        expect(content).not.toBeNull();
        expect((content?.props as { hasOptions: boolean }).hasOptions).toBe(
            true
        );

        const fallback = findSuspenseFallback(tree);
        const factualFallback = findElementByType(
            fallback,
            OverallFactualFallback
        );
        expect(factualFallback).not.toBeNull();
        expect(
            (factualFallback?.props as { marketProfile: string }).marketProfile
        ).toBe('us-equity');
    });
});

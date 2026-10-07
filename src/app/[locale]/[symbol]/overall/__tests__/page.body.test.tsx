/**
 * Overall page body branching tests — verifies crypto-vs-equity copy in
 * SymbolPageHeading (visible h1 region).
 *
 * 2026-10-01에 종목 탭 FAQ를 걷어내(`SEO_RECOVERY_2026_09.md` §10) 분기 대상은
 * h1 하나뿐이다. FAQ 화면·JSON-LD가 다시 생기지 않는지는 `expectNoFaq`로 고정한다.
 *
 * Strategy: invoke the RSC directly (no DOM render) and JSON.stringify the tree
 * to assert presence/absence of branch-specific strings, mirroring the pattern
 * in `src/app/[symbol]/news/__tests__/page.body.test.tsx`.
 */

// TESTING.md#TE-1: all vi.mock + vi.hoisted above imports.
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

vi.mock('@/entities/ticker/lib/assetClassification', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
}));
vi.mock('@/entities/ticker/lib/ticker', () => ({
    pickAssetName: (info: { name: string; koreanName?: string }) =>
        info.koreanName ?? info.name,
    buildDisplayName: vi.fn((assetInfo: { name: string }) => assetInfo.name),
}));
vi.mock('@/entities/ticker/lib/getAssetInfoResilient', () => ({
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

vi.mock('@/entities/news-article/lib/cacheKeys', () => ({
    NEWS_LIST_CACHE_KEY: 'news-list',
}));
vi.mock('@/entities/news-article/api', () => ({
    getNewsList: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/widgets/overall/OverallContent', () => ({
    OverallContent: () => null,
}));
vi.mock('@/widgets/overall/OverallFactualFallback', () => ({
    OverallFactualFallback: () => null,
}));
vi.mock('@/widgets/overall/OverallFactsSummary', () => ({
    OverallFactsSummary: () => null,
}));
vi.mock('@/views/symbol/ui/SymbolPageHeading', () => ({
    SymbolPageHeading: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/shared/ui/CrossLinkCards', () => ({
    CrossLinkCards: () => null,
}));

vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildWebPageJsonLd: () => ({}),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({
        url: 'https://siglens.io/AAPL',
    }),
    resolveSymbolOverallSeoContent: vi.fn().mockReturnValue({
        title: 'T',
        fullTitle: 'T | SIGLENS',
        description: 'd',
        url: 'https://siglens.io/AAPL/overall',
        keywords: [],
    }),
    SITE_NAME: 'SIGLENS',
    SITE_URL: 'https://siglens.io',
}));

vi.mock('@y0ngha/siglens-core', () => ({
    isClaudeAdaptiveModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'adaptive',
    isClaudeBudgetModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'budget',
    isReasoningToggleable: () => true,
    getModelAccess: (m: string) =>
        m === 'claude-opus-5' || m === 'gpt-5.6-sol' ? 'byok' : 'free',
    supportsHardOff: () => true,
    resolveReasoningConfig: (
        modes: { off: unknown; on: unknown; default: string },
        r?: boolean
    ) => ((r ?? modes.default === 'on') ? modes.on : modes.off),
    DEEPSEEK_V4_1_FLASH_MODEL: 'deepseek-v4.1-flash',
    peekOverallAnalysisCache: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/shared/config/market', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/config/market')>()),
    DEFAULT_TIMEFRAME: '1Day',
}));

import { Suspense, isValidElement, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OverallPage from '@/app/[locale]/[symbol]/overall/page';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { OverallContent } from '@/widgets/overall/OverallContent';
import { OverallFactualFallback } from '@/widgets/overall/OverallFactualFallback';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import { expectNoFaq } from '@/__tests__/utils/expectFaqSingleSource';
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
                params: Promise.resolve({ locale: 'ko', symbol: 'BTCUSD' }),
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
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain('차트와 옵션 시장, 실적, 뉴스 종합 분석');
            expect(treeStr).not.toContain('차트와 뉴스, 매수 분위기 종합 분석');
        });
    });

    /**
     * 회귀 가드: FAQ는 화면에도 구조화데이터에도 싣지 않는다 — 종목명만 바뀌는
     * 템플릿이라 2026-10-01에 걷어냈다. 예전 FAQ 답변 문구도 트리에 남으면 안 된다.
     */
    it.each([
        ['equity', EQUITY_ASSET_INFO, 'aapl'],
        ['crypto', CRYPTO_ASSET_INFO, 'BTCUSD'],
    ] as const)(
        '%s → FAQ를 렌더하지 않고 FAQPage 구조화데이터도 싣지 않는다',
        async (_label, info, symbol) => {
            mockGetAssetInfoResilient.mockResolvedValue(info);
            const tree = await OverallPage({
                params: Promise.resolve({ locale: 'ko', symbol }),
            });

            expectNoFaq(tree);
            const treeStr = JSON.stringify(tree);
            expect(treeStr).not.toContain('옵션 시장이 평가하는 단기 방향성');
            expect(treeStr).not.toContain('실적 발표 결과나 가이던스 변화');
            expect(treeStr).not.toContain('규제 이슈, 대형 뉴스');
        }
    );

    /**
     * 회귀 가드: BreadcrumbList position 2는 화면 브레드크럼과 같은 이름이어야 한다.
     * 근거는 `expectSymbolBreadcrumbName` JSDoc 참고.
     */
    it('BreadcrumbList가 티커가 아니라 displayName을 쓴다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
        await OverallPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expectSymbolBreadcrumbName('Apple Inc.');
    });
});

/**
 * 회귀 가드(SEO 감사 finding 1, 2026-08-18): 한국 개별주식은 옵션 시장이 없다
 * (`KR_EQUITY_DESCRIPTOR.tabs`에 `options`가 없음). `isEquity`(assetClass 이진
 * 분류)만으로 문구를 고르면 한국 종목도 미국 종목과 동일한 "옵션 시장" 문구를
 * 노출하게 된다 — `/005930.KS/overall`이 실재하지 않는 옵션 분석을 약속했다.
 * `hasOptions`(descriptor.tabs.includes('options')) 분기가 H1에 걸려 있는지 pin한다.
 * (FAQ 답변은 2026-10-01에 사라졌다.)
 */
describe('OverallPage — kr-equity hasOptions branching (SEO 감사 finding 1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
    });

    it('한국 종목 H1은 옵션 시장 문구 없이 차트·실적·뉴스만 언급한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(KR_EQUITY_ASSET_INFO);
        const tree = await OverallPage({
            params: Promise.resolve({ locale: 'ko', symbol: '005930.ks' }),
        });
        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain('차트와 실적, 뉴스 종합 분석');
        expect(treeStr).not.toContain('차트와 옵션 시장, 실적, 뉴스 종합 분석');
    });

    it('.KS 종목: OverallContent에 hasOptions=false, OverallFactualFallback에 marketProfile="kr-equity"를 전달한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(KR_EQUITY_ASSET_INFO);
        const tree = await OverallPage({
            params: Promise.resolve({ locale: 'ko', symbol: '005930.ks' }),
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
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
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

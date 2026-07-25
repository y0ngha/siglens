/**
 * Overall page (narrative seed) 테스트. async 서버 컴포넌트는 RTL로 직접 렌더할
 * 수 없으므로(Promise<JSX.Element> 반환), 반환된 element 트리를 순회해
 * OverallContent에 전달된 initialAnalysis prop을 검증한다.
 */

// spy → vi.mock → imports order (MISTAKES.md Tests §17).
const { mockGetSeoSnapshotsStatic } = vi.hoisted(() => ({
    mockGetSeoSnapshotsStatic: vi.fn(),
}));

// vi.mock은 hoist되지만 import/first와 가독성을 위해 모든 import 위에 둔다.
vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: mockGetSeoSnapshotsStatic,
}));
vi.mock('@/widgets/overall/OverallContent', () => ({
    OverallContent: () => null,
}));
vi.mock('@/views/symbol', () => ({
    SymbolPageHeading: ({ children }: { children: React.ReactNode }) =>
        children,
}));
vi.mock('@/shared/ui/CrossLinkCards', () => ({
    CrossLinkCards: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/shared/config/market', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/config/market')>()),
    DEFAULT_TIMEFRAME: '1Day',
    isValidTimeframe: vi.fn().mockReturnValue(false),
}));
vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('@/shared/lib/seo', async importOriginal => ({
    // 실제 seo를 스프레드해 NOINDEX_SYMBOL_METADATA 등 정적 export를 가져온다(drift 방지).
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi
        .fn()
        .mockReturnValue({ url: 'https://siglens.io/AAPL' }),
    buildSymbolOverallSeoContent: vi.fn().mockReturnValue({
        title: 'AAPL 종합 분석',
        fullTitle: 'AAPL 종합 분석 | Siglens',
        description: 'desc',
        url: 'https://siglens.io/AAPL/overall',
        keywords: ['AAPL'],
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('@y0ngha/siglens-core', () => ({
    DEEPSEEK_V4_FLASH_MODEL: 'deepseek-v4-flash',
    peekOverallAnalysisCache: vi.fn(),
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));
// /news와 동일 게이트(useWaitForNewsCards) 적용을 위해 newsItems를 SSR에서 조회한다.
// getNewsList는 barrel 제외 대상이므로 @/entities/news-article/api에서 직접 import한다.
vi.mock('@/entities/news-article/api', () => ({
    getNewsList: vi.fn().mockResolvedValue([]),
}));

import {
    generateMetadata,
    default as OverallPage,
    revalidate,
} from '@/app/[symbol]/overall/page';
import { getAssetInfoResilient } from '@/entities/ticker';
import {
    DEEPSEEK_V4_FLASH_MODEL,
    peekOverallAnalysisCache,
} from '@y0ngha/siglens-core';
import { OverallContent } from '@/widgets/overall/OverallContent';
import { OverallFactsSummary, OverallFactualFallback } from '@/widgets/overall';
import { OverallSnapshotProse } from '@/views/symbol/snapshot/renderers/OverallSnapshotProse';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import { Suspense, isValidElement, type ReactNode } from 'react';
import type { MockedFunction } from 'vitest';

const mockGetAssetInfoResilient = getAssetInfoResilient as MockedFunction<
    typeof getAssetInfoResilient
>;
const mockPeekOverall = peekOverallAnalysisCache as MockedFunction<
    typeof peekOverallAnalysisCache
>;

describe('Overall page ISR route config', () => {
    it('exports revalidate = 43200 (literal — required for Next.js static analysis)', () => {
        // MISTAKES §15: route segment config must be a literal, not an imported constant
        expect(revalidate).toBe(43200);
    });
});

describe('generateMetadata', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // getBlockedSymbolMetadata reads snapshots only on the degraded path
        // (symbolIndexabilityMetadata.ts) — default to no-snapshot here.
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            },
            degraded: false,
        } as never);
    });

    it('returns noindex when degraded on infra failure', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: { symbol: 'AAPL', name: 'AAPL' },
            degraded: true,
        } as never);

        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: false });
    });

    it('returns normal metadata when not degraded', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(metadata.robots).toBeUndefined();
    });

    it('returns noindex for invalid ticker', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: '!!!invalid' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: false });
    });
});

describe('Overall page (narrative seed)', () => {
    interface OverallSeedProps {
        initialAnalysis: unknown;
        hasEnrichedNews: boolean;
    }

    // describe 내부에 두어 beforeEach가 설정하는 mock 의존성과 co-locate한다
    // (모듈 최상위에 두면 setup 의존이 암묵적이라는 리뷰 제안 반영).
    async function getOverallProps(): Promise<OverallSeedProps> {
        const tree = await OverallPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });
        const content = findElementByType(tree, OverallContent);
        if (content === null) {
            throw new Error('OverallContent not found in tree');
        }
        return content.props as OverallSeedProps;
    }

    beforeEach(() => {
        mockGetAssetInfoResilient.mockReset();
        mockPeekOverall.mockReset();
        mockGetSeoSnapshotsStatic.mockReset();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            },
            degraded: false,
        } as never);
        // Default: no SEO snapshot row — this describe covers peek/initialAnalysis
        // seeding, which is orthogonal to the snapshot section.
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
    });

    it('peek HIT 시 캐시된 종합 분석을 initialAnalysis로 전달한다', async () => {
        const cached = { headlineKo: 'cached overall' };
        mockPeekOverall.mockResolvedValue(cached as never);

        const props = await getOverallProps();

        expect(mockPeekOverall).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            '1Day',
            DEEPSEEK_V4_FLASH_MODEL,
            false
        );
        expect(props.initialAnalysis).toEqual(cached);
    });

    it('peek MISS(null) 시 initialAnalysis로 undefined를 전달한다', async () => {
        mockPeekOverall.mockResolvedValue(null);

        const props = await getOverallProps();

        expect(props.initialAnalysis).toBeUndefined();
    });

    it('peek가 throw해도 크래시 없이 undefined로 degrade한다', async () => {
        mockPeekOverall.mockRejectedValue(new Error('redis down'));

        const props = await getOverallProps();

        expect(props.initialAnalysis).toBeUndefined();
    });

    it('peek 모델 상수(DEEPSEEK_V4_FLASH_MODEL)가 SEO pre-warm 스냅샷 저장 모델과 동일 참조다 (spec §7 5축 캐시 키 정합)', async () => {
        // harvest.ts는 이 상수를 PREWARM_MODEL_ID = DEEPSEEK_V4_FLASH_MODEL로 스냅샷
        // content.model에 저장한다. 이 페이지가 peek을 호출할 때 쓰는 modelId 인자가
        // core에서 import한 그 상수(mock 모듈에서도 동일 참조)임을 고정해 캐시 키 5축
        // 정합을 지킨다.
        mockPeekOverall.mockResolvedValue(null);

        await getOverallProps();

        expect(mockPeekOverall).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            '1Day',
            DEEPSEEK_V4_FLASH_MODEL,
            false
        );
    });

    // hasEnrichedNews 분기 (MISTAKES.md §Tests 18): true/false 두 경로 모두 검증.
    // /news와 동일 게이트로 client(useWaitForNewsCards)가 SSR snapshot의 enrichment
    // 여부를 보고 즉시 ready 결정하거나 폴링을 시작해야 한다.
    it('hasEnrichedNews=false: getNewsList가 빈 배열이면 false 전달 (게이트 폴링 시작)', async () => {
        mockPeekOverall.mockResolvedValue(null);
        // 모듈 상단 vi.mock 기본값(빈 배열)을 그대로 사용해 false 경로를 검증.
        const props = await getOverallProps();
        expect(props.hasEnrichedNews).toBe(false);
    });

    it('모든 row가 미분석(sentiment=null)이면 hasEnrichedNews=false 전달', async () => {
        mockPeekOverall.mockResolvedValue(null);
        const { getNewsList } = await import('@/entities/news-article/api');
        (
            getNewsList as MockedFunction<typeof getNewsList>
        ).mockResolvedValueOnce([
            { id: 'r1', sentiment: null } as never,
            { id: 'r2', sentiment: null } as never,
        ]);
        const props = await getOverallProps();
        expect(props.hasEnrichedNews).toBe(false);
    });

    it('hasEnrichedNews=true: enriched row(sentiment!==null)가 1개라도 있으면 true 전달 (게이트 즉시 통과)', async () => {
        mockPeekOverall.mockResolvedValue(null);
        const { getNewsList } = await import('@/entities/news-article/api');
        (
            getNewsList as MockedFunction<typeof getNewsList>
        ).mockResolvedValueOnce([
            { id: 'r1', sentiment: null } as never,
            { id: 'r2', sentiment: 'bullish' } as never,
            { id: 'r3', sentiment: null } as never,
        ]);
        const props = await getOverallProps();
        expect(props.hasEnrichedNews).toBe(true);
    });

    it('getNewsList가 throw해도 ISR-safe하게 hasEnrichedNews=false로 degrade한다', async () => {
        mockPeekOverall.mockResolvedValue(null);
        const { getNewsList } = await import('@/entities/news-article/api');
        (
            getNewsList as MockedFunction<typeof getNewsList>
        ).mockRejectedValueOnce(new Error('db down'));
        const props = await getOverallProps();
        // 페이지가 throw 안 함 + hasEnrichedNews=false로 client가 폴링 시작
        expect(props.hasEnrichedNews).toBe(false);
    });
});

// audit fix FIX 1 / FIX 1b: OverallSnapshotProse must be a PERSISTENT server
// sibling OUTSIDE the Suspense fallback — React destroys the fallback subtree
// on hydration, so JS-executing crawlers (Googlebot renderer included) never
// see prose that only lives inside `fallback`. findElementByType only follows
// `.props.children` (never `.props.fallback`), so it is a reliable proxy for
// "is this element a plain sibling, not buried in the fallback prop" — it
// would have returned null against the pre-fix tree.
describe('Overall page snapshot prose placement (FIX 1 / FIX 1b)', () => {
    // Local helper (test-only): descends through `.props.children` until it
    // hits the page's <Suspense>, then returns that Suspense's `fallback`
    // prop node so we can assert what's INSIDE the fallback subtree —
    // findElementByType intentionally never does this (see file-header note).
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

    beforeEach(() => {
        mockGetAssetInfoResilient.mockReset();
        mockPeekOverall.mockReset();
        mockGetSeoSnapshotsStatic.mockReset();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            },
            degraded: false,
        } as never);
    });

    it('(a) valid snapshot: OverallSnapshotProse renders as a sibling OUTSIDE Suspense; FactsSummary/FactualFallback suppressed', async () => {
        mockPeekOverall.mockResolvedValue(null);
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'overall',
                content: { headlineKo: 'valid headline' },
                model: 'deepseek-v4-flash',
                generatedAt: new Date(),
                updatedAt: new Date(),
            },
        ]);

        const tree = await OverallPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(findElementByType(tree, OverallSnapshotProse)).not.toBeNull();
        expect(findSuspenseFallback(tree)).toBeNull();
    });

    it('(b) row present but content malformed: prose does NOT render, peek/fallback chain renders instead (regression guard — this must fail against row-existence gating)', async () => {
        const cached = { headlineKo: 'cached overall' };
        mockPeekOverall.mockResolvedValue(cached as never);
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'overall',
                // Malformed: none of the fields narrowOverallContent recognizes
                // are present, so hasOverallProse(content) === false.
                content: { unrelatedField: 'nope' },
                model: 'deepseek-v4-flash',
                generatedAt: new Date(),
                updatedAt: new Date(),
            },
        ]);

        const tree = await OverallPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(findElementByType(tree, OverallSnapshotProse)).toBeNull();
        const fallback = findSuspenseFallback(tree);
        expect(findElementByType(fallback, OverallFactsSummary)).not.toBeNull();
    });

    it('(c) no snapshot row: peek/fallback chain renders as today (OverallFactualFallback when no peek either)', async () => {
        mockPeekOverall.mockResolvedValue(null);
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        const tree = await OverallPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(findElementByType(tree, OverallSnapshotProse)).toBeNull();
        const fallback = findSuspenseFallback(tree);
        expect(
            findElementByType(fallback, OverallFactualFallback)
        ).not.toBeNull();
    });
});

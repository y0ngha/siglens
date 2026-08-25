/**
 * SEO snapshot prose integration tests for the options page — Task 7b.
 *
 * OptionsAiAnalysis (inside OptionsPageClient) is a client component that
 * fetches its analysis via a client-side hook, so during ISR generation it
 * bakes its loading skeleton into the static HTML (no crawlable AI text).
 * This suite verifies that `OptionsSnapshotProse` is mounted as a plain SSR
 * sibling, reads the snapshot with the page's exact revalidate literal
 * (43200), and stays wired through the no-options-market /
 * snapshot-fetch-failed OptionsEmptyState branches (spec 2026-07-24 §7).
 *
 * Strategy: invoke the RSC directly (no render) and traverse the returned
 * element tree with findElementByType.
 */

// MISTAKES §17: all vi.mock + vi.hoisted above imports.
const { mockGetSeoSnapshotsStatic } = vi.hoisted(() => ({
    mockGetSeoSnapshotsStatic: vi.fn(),
}));

vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: mockGetSeoSnapshotsStatic,
}));
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
vi.mock('@/entities/options-chain/lib/optionsDataCache', () => ({
    fetchOptionsSnapshot: vi.fn(),
    hasOptionsMarket: vi.fn(),
}));
// staticSymbolCache: call fetcher() directly so tests stay pure (no I/O).
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(
        (
            _key: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>
        ) => fetcher()
    ),
}));
vi.mock('@/widgets/options/OptionsPageClient', () => ({
    OptionsPageClient: () => null,
}));
vi.mock('@/views/symbol', () => ({
    SymbolPageHeading: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@y0ngha/siglens-core', () => ({
    mapExpirationsToSlots: vi.fn().mockReturnValue([]),
}));
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
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
vi.mock('@tanstack/react-query', () => ({
    dehydrate: vi.fn().mockReturnValue({}),
    HydrationBoundary: ({ children }: { children: unknown }) => children,
    QueryClient: class {
        setQueryData = vi.fn();
    },
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import OptionsPage from '@/app/[symbol]/options/page';
import { OptionsSnapshotProse } from '@/views/symbol/snapshot/renderers/OptionsSnapshotProse';
import { OptionsPageClient } from '@/widgets/options/OptionsPageClient';
import { getAssetInfoResilient } from '@/entities/ticker';
import {
    fetchOptionsSnapshot,
    hasOptionsMarket,
} from '@/entities/options-chain/lib/optionsDataCache';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import { expectFaqSingleSource } from '@/__tests__/utils/expectFaqSingleSource';
import { expectSymbolBreadcrumbName } from '@/__tests__/utils/expectSymbolBreadcrumbName';

const mockGetAssetInfoResilient = vi.mocked(getAssetInfoResilient);
const mockHasOptionsMarket = vi.mocked(hasOptionsMarket);
const mockFetchOptionsSnapshot = vi.mocked(fetchOptionsSnapshot);

const EQUITY_ASSET_INFO = {
    assetInfo: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        koreanName: '애플',
        fmpSymbol: 'AAPL',
    },
    degraded: false,
} as Awaited<ReturnType<typeof getAssetInfoResilient>>;

const SNAPSHOT_CONTENT = {
    summary: '단기 콜 우세 흐름이 관찰됩니다.',
    perExpiration: [],
    signals: [],
};

const OPTIONS_SNAPSHOT = {
    capturedAt: '2026-07-24T00:00:00.000Z',
    underlyingPrice: 200,
    chains: [
        {
            expirationDate: '2026-08-01',
            calls: [],
            puts: [],
        },
    ],
} as unknown as Awaited<ReturnType<typeof fetchOptionsSnapshot>>;

describe('OptionsPage — SEO snapshot prose (Task 7b)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
    });

    it('옵션 시장 있고 스냅샷 있으면 OptionsSnapshotProse를 렌더하고, OptionsPageClient에 hasSnapshotProse=true를 전달해 중복 AI 위젯을 숨긴다 (audit fix FIX 2)', async () => {
        mockHasOptionsMarket.mockResolvedValue(true);
        mockFetchOptionsSnapshot.mockResolvedValue(OPTIONS_SNAPSHOT);
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'options',
                content: SNAPSHOT_CONTENT,
                model: 'deepseek-v4-flash',
                generatedAt: new Date('2026-07-24'),
            },
        ]);

        const tree = await OptionsPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const prose = findElementByType(tree, OptionsSnapshotProse);
        expect(prose).not.toBeNull();
        expect((prose?.props as { content: unknown }).content).toEqual(
            SNAPSHOT_CONTENT
        );
        // C3(감사): content만 확인하고 generatedAt은 확인하지 않았다 —
        // 페이지에서 `generatedAt={…}` prop을 통째로 지워도 이 테스트는
        // 여전히 그린이었다.
        expect((prose?.props as { generatedAt?: Date }).generatedAt).toEqual(
            new Date('2026-07-24')
        );
        const client = findElementByType(tree, OptionsPageClient);
        expect(
            (client?.props as { hasSnapshotProse: unknown }).hasSnapshotProse
        ).toBe(true);
    });

    /**
     * 회귀 가드: FAQPage 마크업과 화면 Q&A는 배열 하나에서 나와야 한다. 이 탭은
     * 오랫동안 마크업만 내보내고 화면에는 Q&A가 없었다 — 구글은 대응하는 내용이
     * 페이지에 보일 것을 요구하며, 없으면 리치 결과 자격을 잃는다. JSON-LD가
     * 유효한지만 보는 테스트로는 이 결함이 잡히지 않는다.
     */
    it('FAQPage 구조화데이터가 화면 FaqSection과 같은 질문·답변을 쓴다', async () => {
        mockHasOptionsMarket.mockResolvedValue(true);
        mockFetchOptionsSnapshot.mockResolvedValue(OPTIONS_SNAPSHOT);
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
        const tree = await OptionsPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expectFaqSingleSource(tree);
    });

    /**
     * 회귀 가드: BreadcrumbList position 2는 화면 브레드크럼과 같은 이름이어야 한다.
     * 근거는 `expectSymbolBreadcrumbName` JSDoc 참고.
     */
    it('BreadcrumbList가 티커가 아니라 displayName을 쓴다', async () => {
        mockHasOptionsMarket.mockResolvedValue(true);
        mockFetchOptionsSnapshot.mockResolvedValue(OPTIONS_SNAPSHOT);
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
        await OptionsPage({ params: Promise.resolve({ symbol: 'aapl' }) });

        expectSymbolBreadcrumbName('Apple Inc.');
    });

    it('스냅샷 없으면(빈 배열) content가 undefined로 전달되고(렌더러가 자체 null 반환), OptionsPageClient에는 hasSnapshotProse=false가 전달된다', async () => {
        mockHasOptionsMarket.mockResolvedValue(true);
        mockFetchOptionsSnapshot.mockResolvedValue(OPTIONS_SNAPSHOT);
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        const tree = await OptionsPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const prose = findElementByType(tree, OptionsSnapshotProse);
        expect(prose).not.toBeNull();
        expect((prose?.props as { content: unknown }).content).toBeUndefined();
        const client = findElementByType(tree, OptionsPageClient);
        expect(
            (client?.props as { hasSnapshotProse: unknown }).hasSnapshotProse
        ).toBe(false);
    });

    it('getSeoSnapshotsStatic은 페이지의 revalidate 리터럴(43200)로 호출된다', async () => {
        mockHasOptionsMarket.mockResolvedValue(true);
        mockFetchOptionsSnapshot.mockResolvedValue(OPTIONS_SNAPSHOT);
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        await OptionsPage({ params: Promise.resolve({ symbol: 'aapl' }) });

        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith('AAPL', 43200);
    });

    it('옵션 시장 없음(hasOptions:false) 분기에서도 스냅샷 프로즈가 OptionsEmptyState의 snapshotSlot으로 전달된다(spec §7)', async () => {
        mockHasOptionsMarket.mockResolvedValue(false);
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'options',
                content: SNAPSHOT_CONTENT,
                model: 'deepseek-v4-flash',
                generatedAt: new Date('2026-07-24'),
            },
        ]);

        const tree = await OptionsPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        // OptionsEmptyState is NOT mocked in this suite — its snapshotSlot prop
        // carries the real <OptionsSnapshotProse> element.
        const emptyStateEl = tree as unknown as {
            props: { snapshotSlot: ReactNode };
        };
        const prose = findElementByType(
            emptyStateEl.props.snapshotSlot,
            OptionsSnapshotProse
        );
        expect(prose).not.toBeNull();
        expect((prose?.props as { content: unknown }).content).toEqual(
            SNAPSHOT_CONTENT
        );
    });

    // audit fix FIX 9: OptionsEmptyState.tsx did `{snapshotSlot && ...}` where
    // snapshotSlot was always a truthy <OptionsSnapshotProse> element even
    // when its internal content was empty — producing an empty `div.mt-6`
    // (24px dead gap). The fix makes the CALLER gate with `hasOptionsProse`
    // and pass `undefined` (not an element) when there's nothing to show.
    it('옵션 시장 없음(hasOptions:false) + 스냅샷 없음 분기에서는 snapshotSlot이 undefined로 전달된다 — 빈 div.mt-6 방지(audit fix FIX 9)', async () => {
        mockHasOptionsMarket.mockResolvedValue(false);
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        const tree = await OptionsPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const emptyStateEl = tree as unknown as {
            props: { snapshotSlot: ReactNode };
        };
        expect(emptyStateEl.props.snapshotSlot).toBeUndefined();
    });

    it('fetchOptionsSnapshot 실패(null degrade) 분기에서도 스냅샷 프로즈가 OptionsEmptyState의 snapshotSlot으로 전달된다(spec §7)', async () => {
        mockHasOptionsMarket.mockResolvedValue(true);
        mockFetchOptionsSnapshot.mockRejectedValue(new Error('yahoo down'));
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'options',
                content: SNAPSHOT_CONTENT,
                model: 'deepseek-v4-flash',
                generatedAt: new Date('2026-07-24'),
            },
        ]);

        const tree = await OptionsPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const emptyStateEl = tree as unknown as {
            props: { snapshotSlot: ReactNode };
        };
        const prose = findElementByType(
            emptyStateEl.props.snapshotSlot,
            OptionsSnapshotProse
        );
        expect(prose).not.toBeNull();
        expect((prose?.props as { content: unknown }).content).toEqual(
            SNAPSHOT_CONTENT
        );
        consoleSpy.mockRestore();
    });
});

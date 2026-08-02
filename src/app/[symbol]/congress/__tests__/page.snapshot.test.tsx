/**
 * SEO snapshot prose integration tests for the congress page — Task 7b.
 *
 * CongressTrendSummary is a client component that fetches its analysis via a
 * client-side hook, so during ISR generation it bakes its loading skeleton
 * into the static HTML (no crawlable AI text). This suite verifies that
 * `CongressSnapshotProse` is mounted as a plain SSR sibling, reads the
 * snapshot with the page's exact revalidate literal (86400), and stays wired
 * through both FMP-profile-degraded and trades-degraded branches
 * (spec 2026-07-24 §7).
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
vi.mock('@/app/[symbol]/fundamental/getProfileResilient', () => ({
    getProfileResilient: vi.fn(),
}));
vi.mock('@/app/[symbol]/congress/congressData', () => ({
    getCongressPageData: vi
        .fn()
        .mockResolvedValue({ trades: [], degraded: false }),
}));
vi.mock('@/entities/congress-trades', () => ({
    getCongressTradesResilient: vi.fn(),
}));
vi.mock('@/widgets/congress', () => ({
    CongressTrendSummary: () => null,
    CongressTradesTable: () => null,
}));
vi.mock('@/views/symbol', () => ({
    SymbolPageHeading: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/shared/ui/CrossLinkCards', () => ({
    CrossLinkCards: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import CongressPage from '@/app/[symbol]/congress/page';
import { CongressSnapshotProse } from '@/views/symbol/snapshot/renderers/CongressSnapshotProse';
import { CongressTrendSummary } from '@/widgets/congress';
import { getAssetInfoResilient } from '@/entities/ticker';
import { getProfileResilient } from '@/app/[symbol]/fundamental/getProfileResilient';
import { getCongressPageData } from '@/app/[symbol]/congress/congressData';
import { findElementByType } from '@/__tests__/utils/findElementByType';

const mockGetAssetInfoResilient = vi.mocked(getAssetInfoResilient);
const mockGetProfileResilient = vi.mocked(getProfileResilient);
const mockGetCongressPageData = vi.mocked(getCongressPageData);

const EQUITY_ASSET_INFO = {
    assetInfo: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        koreanName: '애플',
        fmpSymbol: 'AAPL',
    },
    degraded: false,
} as Awaited<ReturnType<typeof getAssetInfoResilient>>;

const PROFILE_OK = {
    profile: { sector: 'Technology', description: 'A tech company.' },
    degraded: false,
} as Awaited<ReturnType<typeof getProfileResilient>>;

const PROFILE_DEGRADED = {
    profile: null,
    degraded: true,
} as Awaited<ReturnType<typeof getProfileResilient>>;

const SNAPSHOT_CONTENT = {
    summaryKo: '최근 30일간 매수 우위 동향이 관찰됩니다.',
    overallSentiment: 'bullish',
    notableMembersKo: [],
    riskNoteKo: '',
};

describe('CongressPage — SEO snapshot prose (Task 7b)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
        mockGetProfileResilient.mockResolvedValue(PROFILE_OK);
        mockGetCongressPageData.mockResolvedValue({
            trades: [],
            degraded: false,
        } as Awaited<ReturnType<typeof getCongressPageData>>);
    });

    it('스냅샷 있으면 CongressSnapshotProse를 렌더하고, 중복되는 AI 위젯(CongressTrendSummary)은 렌더하지 않는다 (audit fix FIX 2)', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'congress',
                content: SNAPSHOT_CONTENT,
                model: 'deepseek-v4-flash',
                generatedAt: new Date('2026-07-24'),
            },
        ]);

        const tree = await CongressPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const prose = findElementByType(tree, CongressSnapshotProse);
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
        expect(findElementByType(tree, CongressTrendSummary)).toBeNull();
    });

    it('스냅샷 없으면(빈 배열) 렌더러가 자체 null을 반환하는 CongressSnapshotProse 대신 CongressTrendSummary(AI 위젯)를 렌더한다 (audit fix FIX 2)', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        const tree = await CongressPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(findElementByType(tree, CongressSnapshotProse)).toBeNull();
        expect(findElementByType(tree, CongressTrendSummary)).not.toBeNull();
    });

    it('getSeoSnapshotsStatic은 페이지의 revalidate 리터럴(86400)로 호출된다', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        await CongressPage({ params: Promise.resolve({ symbol: 'aapl' }) });

        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith('AAPL', 86400);
    });

    it('profile degraded 분기에서도 스냅샷 콘텐츠가 CongressDegraded에 전달된다(spec §7)', async () => {
        mockGetProfileResilient.mockResolvedValue(PROFILE_DEGRADED);
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'congress',
                content: SNAPSHOT_CONTENT,
                model: 'deepseek-v4-flash',
                generatedAt: new Date('2026-07-24'),
            },
        ]);

        const tree = await CongressPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const degradedEl = tree as unknown as {
            props: { snapshotContent: unknown };
        };
        expect(degradedEl.props.snapshotContent).toEqual(SNAPSHOT_CONTENT);
    });

    it('trades degraded 분기에서도 스냅샷 콘텐츠가 CongressDegraded에 전달된다(spec §7)', async () => {
        mockGetCongressPageData.mockResolvedValue({
            trades: [],
            degraded: true,
        } as Awaited<ReturnType<typeof getCongressPageData>>);
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'congress',
                content: SNAPSHOT_CONTENT,
                model: 'deepseek-v4-flash',
                generatedAt: new Date('2026-07-24'),
            },
        ]);

        const tree = await CongressPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const degradedEl = tree as unknown as {
            props: { snapshotContent: unknown };
        };
        expect(degradedEl.props.snapshotContent).toEqual(SNAPSHOT_CONTENT);
    });
});

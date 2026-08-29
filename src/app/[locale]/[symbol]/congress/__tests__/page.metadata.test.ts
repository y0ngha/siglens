// vi.mock hoists, but for clarity all mocks are declared above imports.
// Default: equity symbol (allowed) — individual tests that need crypto behavior
// can override mockIsTabAllowedForSymbol per-call.
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/widgets/congress', () => ({
    CongressTrendSummary: () => null,
    CongressTradesTable: () => null,
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
}));
vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    pickAssetName: (info: { name: string; koreanName?: string }) =>
        info.koreanName ?? info.name,
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('@/app/[locale]/[symbol]/fundamental/getProfileResilient', () => ({
    getProfileResilient: vi.fn(),
}));
vi.mock('@/app/[locale]/[symbol]/congress/congressData', () => ({
    getCongressPageData: vi.fn(),
}));
vi.mock('@/app/[locale]/[symbol]/congress/CongressDegraded', () => ({
    CongressDegraded: () => null,
}));
// `getCongressTradesResilient`는 generateMetadata가 page body와 동일한 envelope를
// 한 번 더 호출(React.cache로 메모이즈됨)하므로 mock으로 케이스별 degrade를 제어한다.
vi.mock('@/entities/congress-trades', () => ({
    getCongressTradesResilient: vi.fn(),
}));
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [],
    }),
    buildSymbolSeoContent: vi
        .fn()
        .mockReturnValue({ url: 'https://siglens.io/AAPL' }),
    buildSymbolCongressSeoContent: vi.fn().mockReturnValue({
        title: 'AAPL 의회 거래 — 상원·하원 의원 매매 공시',
        fullTitle: 'AAPL 의회 거래 — 상원·하원 의원 매매 공시 | Siglens',
        description:
            '미국 상원·하원 의원의 AAPL 매매 공시 내역을 공시지연 약 45일을 감안해 AI가 동향으로 요약합니다.',
        url: 'https://siglens.io/AAPL/congress',
        keywords: ['AAPL', 'AAPL 의회 거래'],
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));
// thin 게이트가 `hasCongressProse(snap?.content)`를 보므로 스냅샷 소스를 제어해야
// "행은 있는데 내용이 비었다"는 경우를 재현할 수 있다.
vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: vi.fn().mockResolvedValue([]),
}));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
    generateMetadata,
    revalidate,
} from '@/app/[locale]/[symbol]/congress/page';
import { getAssetInfoResilient } from '@/entities/ticker';
import { getProfileResilient } from '@/app/[locale]/[symbol]/fundamental/getProfileResilient';
import { getCongressTradesResilient } from '@/entities/congress-trades';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import type { MockedFunction } from 'vitest';

// resolved 반환 타입 별칭 — mock fixture를 as never(bottom type) 대신 명시 타입으로
// 캐스팅하기 위함(MISTAKES §7). 부분 객체는 as unknown as <Result>로 통과시킨다.
type AssetInfoResult = Awaited<ReturnType<typeof getAssetInfoResilient>>;
type ProfileResult = Awaited<ReturnType<typeof getProfileResilient>>;
type TradesResult = Awaited<ReturnType<typeof getCongressTradesResilient>>;

const mockGetAssetInfoResilient = getAssetInfoResilient as MockedFunction<
    typeof getAssetInfoResilient
>;
const mockGetProfileResilient = getProfileResilient as MockedFunction<
    typeof getProfileResilient
>;
const mockGetCongressTradesResilient =
    getCongressTradesResilient as MockedFunction<
        typeof getCongressTradesResilient
    >;

describe('Congress page ISR route config', () => {
    it('exports revalidate = 86400 (literal — required for Next.js static analysis)', () => {
        // MISTAKES §15: route segment config must be a literal, not an imported constant.
        expect(revalidate).toBe(86400);
    });
});

describe('generateMetadata', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            },
            degraded: false,
        } as unknown as AssetInfoResult);
        mockGetProfileResilient.mockResolvedValue({
            profile: { sector: 'Technology', description: '' },
            degraded: false,
        } as unknown as ProfileResult);
        // Default fixture: one trade, NOT degraded — the ordinary indexable page.
        // (Zero trades is a separate case now: thin-content gate, see below.)
        mockGetCongressTradesResilient.mockResolvedValue({
            trades: [{ id: 't1' }],
            degraded: false,
        } as unknown as TradesResult);
        vi.mocked(getSeoSnapshotsStatic).mockResolvedValue([]);
    });

    it('returns noindex for invalid ticker format', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: '!!!invalid' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.alternates?.canonical).toBeNull();
    });

    it('returns noindex when assetInfo is degraded', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: null,
            degraded: true,
        } as unknown as AssetInfoResult);

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'AAPL' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.alternates?.canonical).toBeNull();
    });

    it('returns noindex when profile is degraded (FMP infra failure)', async () => {
        mockGetProfileResilient.mockResolvedValue({
            profile: null,
            degraded: true,
        } as unknown as ProfileResult);

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'AAPL' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.alternates?.canonical).toBeNull();
    });

    it('returns noindex when profile is null (symbol does not exist)', async () => {
        mockGetProfileResilient.mockResolvedValue({
            profile: null,
            degraded: false,
        } as unknown as ProfileResult);

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'FAKESYM' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.alternates?.canonical).toBeNull();
    });

    it('returns noindex when congress trades are degraded (FMP infra failure)', async () => {
        mockGetCongressTradesResilient.mockResolvedValue({
            trades: [],
            degraded: true,
        } as unknown as TradesResult);

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.alternates?.canonical).toBeNull();
    });

    // financials와의 차이: 0건 **자체**는 여전히 degrade가 아니다(200 렌더). 다만 0건이면서
    // AI 스냅샷도 없으면 크롤 텍스트가 크롬만 남아 thin이 된다 — 2026-08 실측 B 1,059자 /
    // KEEL 1,079자 대 AAPL 6,605자. 그 교집합만 noindex로 떨어뜨린다.
    it('거래 0건 + 스냅샷 없음 = thin이라 noindex(단 follow는 유지)', async () => {
        mockGetCongressTradesResilient.mockResolvedValue({
            trades: [],
            degraded: false,
        } as unknown as TradesResult);

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        // follow:true — 이 페이지는 CrossLinkCards로 형제 탭에 내부 링크를 뿌린다.
        expect(metadata.robots).toEqual({ index: false, follow: true });
        // 제목·canonical은 그대로 남는다(사용자용). NOINDEX_SYMBOL_METADATA와 다른 점.
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/AAPL/congress'
        );
        expect(metadata.title).toBeDefined();
    });

    it('스냅샷 행은 있지만 내용이 비면 여전히 thin이다 (존재 여부로 판정하면 새는 케이스)', async () => {
        mockGetCongressTradesResilient.mockResolvedValue({
            trades: [],
            degraded: false,
        } as unknown as TradesResult);
        // 본문의 `hasCongressProse`는 이 content를 렌더 불가로 판정한다 —
        // 메타가 `snap !== undefined`만 봤다면 여기서 색인 가능이 되어 갈라진다.
        vi.mocked(getSeoSnapshotsStatic).mockResolvedValue([
            {
                tab: 'congress',
                content: {},
                generatedAt: new Date('2026-08-01'),
            },
        ] as unknown as Awaited<ReturnType<typeof getSeoSnapshotsStatic>>);

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
    });

    it('거래 0건이어도 렌더 가능한 프로즈가 있으면 색인한다', async () => {
        // 이 케이스가 없으면 `&& !hasCongressProse(...)` 조건을 통째로 지워도 모든
        // 테스트가 통과한다(2026-08 감사가 뮤테이션으로 증명). 즉 "0건이지만 서술이
        // 있는 페이지는 색인한다"는 문서화된 예외가 아무 데도 고정돼 있지 않았다.
        mockGetCongressTradesResilient.mockResolvedValue({
            trades: [],
            degraded: false,
        } as unknown as TradesResult);
        vi.mocked(getSeoSnapshotsStatic).mockResolvedValue([
            {
                tab: 'congress',
                content: {
                    summaryKo:
                        '의원 매매 공시가 없지만 섹터 흐름은 이렇습니다.',
                },
                generatedAt: new Date('2026-08-01'),
            },
        ] as unknown as Awaited<ReturnType<typeof getSeoSnapshotsStatic>>);

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toBeUndefined();
    });

    it('거래가 1건이라도 있으면 색인 대상이다', async () => {
        mockGetCongressTradesResilient.mockResolvedValue({
            trades: [{ id: 't1' }],
            degraded: false,
        } as unknown as TradesResult);

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toBeUndefined();
    });

    it('returns canonical /{symbol}/congress for a valid existing symbol with trades', async () => {
        mockGetCongressTradesResilient.mockResolvedValue({
            trades: [{ id: 't1' }],
            degraded: false,
        } as unknown as TradesResult);

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/AAPL/congress'
        );
    });

    it('does not set noindex robots for a valid symbol', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toBeUndefined();
    });

    it('sets openGraph with ko_KR locale and OG label for 의회 거래', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.openGraph?.locale).toBe('ko_KR');
        expect(metadata.openGraph?.title).toContain('의회 거래');
    });

    it('sets twitter card to summary_large_image', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.twitter).toEqual(
            expect.objectContaining({ card: 'summary_large_image' })
        );
    });

    it('sets siteName in openGraph', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.openGraph?.siteName).toBe('Siglens');
    });
});

describe('Congress page JSON-LD schema types', () => {
    // 소스 그렙 단언(readFileSync + toContain('buildWebPageJsonLd('))은
    // 동작이 아니라 구현 세부를 검사하므로 제거됐다.
    // WebPage/FAQPage 런타임 JSON-LD 출력은 e2e/specs/symbol-seo.spec.ts가
    // /AAPL/congress 페이지를 크롤러처럼 HTTP로 fetch해 검증한다.

    it('buildBreadcrumbJsonLd produces a BreadcrumbList schema', async () => {
        const { buildBreadcrumbJsonLd } = await import('@/shared/lib/seo');
        const result = buildBreadcrumbJsonLd(
            [
                { name: 'AAPL', url: '/AAPL' },
                { name: '의회 거래', url: '/AAPL/congress' },
            ],
            'ko'
        );
        expect(result['@type']).toBe('BreadcrumbList');
    });
});

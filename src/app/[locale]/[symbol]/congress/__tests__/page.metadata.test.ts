// vi.mock hoists, but for clarity all mocks are declared above imports.
// Default: equity symbol (allowed) — individual tests that need crypto behavior
// can override mockIsTabAllowedForSymbol per-call.
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/widgets/congress/CongressTrendSummary', () => ({
    CongressTrendSummary: () => null,
}));
vi.mock('@/widgets/congress/CongressTradesTable', () => ({
    CongressTradesTable: () => null,
}));
vi.mock('@/views/symbol/ui/SymbolPageHeading', () => ({
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
vi.mock('@/entities/ticker/lib/getProfileResilient', () => ({
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
vi.mock('@/entities/congress-trades/lib/getCongressTradesResilient', () => ({
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
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { getProfileResilient } from '@/entities/ticker/lib/getProfileResilient';
import { getCongressTradesResilient } from '@/entities/congress-trades/lib/getCongressTradesResilient';
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

    // 2026-10-01 SEO 감사: 의회 거래 탭은 **항상 noindex**다. 프로필·거래·스냅샷
    // 상태로 갈리던 분기(thin 게이트 등)는 사라졌고, generateMetadata는 이제 그
    // 데이터를 읽지 않는다. 사용자용 title·self-canonical은 남는다.
    it('유효한 종목은 항상 noindex(follow 유지) + self-canonical + SEO title을 유지한다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/AAPL/congress'
        );
        expect(JSON.stringify(metadata.title)).toContain('의회 거래');
    });

    it('거래·프로필·스냅샷 상태와 무관하다 — 메타데이터가 해당 데이터를 조회하지 않는다', async () => {
        await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(mockGetProfileResilient).not.toHaveBeenCalled();
        expect(mockGetCongressTradesResilient).not.toHaveBeenCalled();
        expect(getSeoSnapshotsStatic).not.toHaveBeenCalled();
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

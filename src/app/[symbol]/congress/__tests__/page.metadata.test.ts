// vi.mock hoists, but for clarity all mocks are declared above imports.
vi.mock('@/widgets/congress', () => ({
    CongressTrendSummary: () => null,
    CongressTradesTable: () => null,
}));
vi.mock('@/widgets/symbol-page', () => ({
    CrossLinkCards: () => null,
    SymbolPageHeading: ({ children }: { children: React.ReactNode }) =>
        children,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/shared/config/market', () => ({
    isAdmissibleSymbolShape: (s: string) =>
        /^[A-Z0-9][A-Z0-9.-]{0,15}$/.test(s),
    SymbolRouteParams: undefined,
}));
vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('@/app/[symbol]/fundamental/getProfileResilient', () => ({
    getProfileResilient: vi.fn(),
}));
vi.mock('@/app/[symbol]/congress/congressData', () => ({
    getCongressPageData: vi.fn(),
}));
vi.mock('@/app/[symbol]/congress/CongressDegraded', () => ({
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

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { generateMetadata, revalidate } from '@/app/[symbol]/congress/page';
import { getAssetInfoResilient } from '@/entities/ticker';
import { getProfileResilient } from '@/app/[symbol]/fundamental/getProfileResilient';
import { getCongressTradesResilient } from '@/entities/congress-trades';
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
        // Default fixture: zero trades, NOT degraded — this is the indexable
        // sparse-symbol case and the route's intentional difference vs financials.
        mockGetCongressTradesResilient.mockResolvedValue({
            trades: [],
            degraded: false,
        } as unknown as TradesResult);
    });

    it('returns noindex for invalid ticker format', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: '!!!invalid' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: false });
        expect(metadata.alternates?.canonical).toBeNull();
    });

    it('returns noindex when assetInfo is degraded', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: null,
            degraded: true,
        } as unknown as AssetInfoResult);

        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: false });
        expect(metadata.alternates?.canonical).toBeNull();
    });

    it('returns noindex when profile is degraded (FMP infra failure)', async () => {
        mockGetProfileResilient.mockResolvedValue({
            profile: null,
            degraded: true,
        } as unknown as ProfileResult);

        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: false });
        expect(metadata.alternates?.canonical).toBeNull();
    });

    it('returns noindex when profile is null (symbol does not exist)', async () => {
        mockGetProfileResilient.mockResolvedValue({
            profile: null,
            degraded: false,
        } as unknown as ProfileResult);

        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'FAKESYM' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: false });
        expect(metadata.alternates?.canonical).toBeNull();
    });

    it('returns noindex when congress trades are degraded (FMP infra failure)', async () => {
        mockGetCongressTradesResilient.mockResolvedValue({
            trades: [],
            degraded: true,
        } as unknown as TradesResult);

        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: false });
        expect(metadata.alternates?.canonical).toBeNull();
    });

    // 의도된 financials와의 차이점: 0건은 정상 indexable, infra 실패만 noindex.

    it('returns indexable metadata when trades.length === 0 (sparse symbol, NOT noindex)', async () => {
        mockGetCongressTradesResilient.mockResolvedValue({
            trades: [],
            degraded: false,
        } as unknown as TradesResult);

        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        // robots 미설정 = layout default(indexable)을 상속.
        expect(metadata.robots).toBeUndefined();
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/AAPL/congress'
        );
    });

    it('returns canonical /{symbol}/congress for a valid existing symbol with trades', async () => {
        mockGetCongressTradesResilient.mockResolvedValue({
            trades: [{ id: 't1' }],
            degraded: false,
        } as unknown as TradesResult);

        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/AAPL/congress'
        );
    });

    it('does not set noindex robots for a valid symbol', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(metadata.robots).toBeUndefined();
    });

    it('sets openGraph with ko_KR locale and OG label for 의회 거래', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(metadata.openGraph?.locale).toBe('ko_KR');
        expect(metadata.openGraph?.title).toContain('의회 거래');
    });

    it('sets twitter card to summary_large_image', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(metadata.twitter).toEqual(
            expect.objectContaining({ card: 'summary_large_image' })
        );
    });

    it('sets siteName in openGraph', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(metadata.openGraph?.siteName).toBe('Siglens');
    });
});

describe('Congress page JSON-LD schema types', () => {
    // The JSON-LD objects are constructed inside the page component body (not
    // exported), so we assert against the actual page.tsx source on disk rather
    // than a locally-redeclared string (which would be tautological — §13.5).
    const pageSource = readFileSync(
        fileURLToPath(new URL('../page.tsx', import.meta.url)),
        'utf8'
    );

    it('page.tsx emits a WebPage schema type', () => {
        expect(pageSource).toContain("'@type': 'WebPage'");
    });

    it('page.tsx emits a FAQPage schema type', () => {
        expect(pageSource).toMatch(/['"]@type['"]:\s*['"]FAQPage['"]/);
    });

    it('page.tsx FAQPage mainEntity has 3 Question entries', () => {
        const matches = pageSource.match(/['"]@type['"]:\s*['"]Question['"]/g);
        expect(matches?.length ?? 0).toBe(3);
    });

    it('page.tsx FAQPage Question names interpolate displayName', () => {
        expect(pageSource).toContain('${displayName}의 의회 거래');
    });

    it('buildBreadcrumbJsonLd produces a BreadcrumbList schema', async () => {
        const { buildBreadcrumbJsonLd } = await import('@/shared/lib/seo');
        const result = buildBreadcrumbJsonLd([
            { name: 'AAPL', url: '/AAPL' },
            { name: '의회 거래', url: '/AAPL/congress' },
        ]);
        expect(result['@type']).toBe('BreadcrumbList');
    });
});

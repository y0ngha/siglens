// vi.mock はhoist されるが import/first と可読性のため全 import の上に置く
// Default: equity symbol (allowed) — individual tests that need crypto behavior
// can override mockIsTabAllowedForSymbol per-call.
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: vi.fn().mockResolvedValue(true),
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
vi.mock('@/app/[locale]/[symbol]/financials/financialData', () => ({
    getFinancialsPageData: vi.fn().mockResolvedValue({
        snapshot: { incomeStatement: [], balanceSheet: [], cashFlow: [] },
        scorecard: null,
    }),
}));
vi.mock('@/app/[locale]/[symbol]/financials/FinancialsDegraded', () => ({
    FinancialsDegraded: () => null,
}));
// isEmptyFinancialsSnapshot는 별도 단위 테스트(isEmptyFinancialsSnapshot.test.ts)에서
// 실제 로직을 검증한다. 여기서는 vi.fn()으로 두고 케이스별 boolean을 직접 제어해
// 인라인 재구현(동어반복)을 피한다.
vi.mock('@/entities/financials-statements/lib/getFinancialsSnapshot', () => ({
    getFinancialsSnapshot: vi.fn(),
    isEmptyFinancialsSnapshot: vi.fn(),
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
    buildSymbolFinancialsSeoContent: vi.fn().mockReturnValue({
        title: 'AAPL 재무제표 — 매출·이익·현금흐름 5년 추이',
        fullTitle: 'AAPL 재무제표 — 매출·이익·현금흐름 5년 추이 | SIGLENS',
        description:
            'AAPL의 손익·재무상태·현금흐름과 성장성·수익성·안정성·현금창출력 점수를 한눈에 확인합니다.',
        url: 'https://siglens.io/AAPL/financials',
        keywords: ['AAPL', 'AAPL 재무제표'],
    }),
    SITE_NAME: 'SIGLENS',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { notFound } from 'next/navigation';
import {
    generateMetadata,
    revalidate,
} from '@/app/[locale]/[symbol]/financials/page';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { getProfileResilient } from '@/entities/ticker/lib/getProfileResilient';
import { getFinancialsSnapshot } from '@/entities/financials-statements/lib/getFinancialsSnapshot';
import type { MockedFunction } from 'vitest';

// resolved 반환 타입 별칭 — mock fixture를 as never(bottom type) 대신 명시 타입으로
// 캐스팅하기 위함(CONVENTIONS.md#TS-1). 부분 객체는 as unknown as <Result>로 통과시킨다.
type AssetInfoResult = Awaited<ReturnType<typeof getAssetInfoResilient>>;

const mockGetAssetInfoResilient = getAssetInfoResilient as MockedFunction<
    typeof getAssetInfoResilient
>;
describe('Financials page ISR route config', () => {
    it('exports revalidate = 86400 (literal — required for Next.js static analysis)', () => {
        // src/app/CLAUDE.md#AP-1: route segment config must be a literal, not an imported constant
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
    });

    it('형식이 잘못된 ticker는 notFound()를 부른다 — 404에 홈 상속 메타가 얹히지 않는다', async () => {
        // `notFound`가 이 파일에선 던지지 않는 목이라 이후 흐름은 의미가 없다 — 호출만 본다.
        await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: '!!!invalid' }),
        }).catch(() => undefined);

        expect(vi.mocked(notFound)).toHaveBeenCalled();
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
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/AAPL/financials'
        );
    });

    it('returns canonical /{symbol}/financials for a valid existing symbol', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/AAPL/financials'
        );
    });

    // 2026-10-01 SEO 감사: 재무제표 탭은 **항상 noindex**다. 프로필·재무 스냅샷
    // 상태로 갈리던 분기는 사라졌고 generateMetadata는 그 데이터를 읽지 않는다.
    it('유효한 종목도 항상 noindex(follow 유지)이고 self-canonical·SEO title은 남는다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/AAPL/financials'
        );
        expect(JSON.stringify(metadata.title)).toContain('재무제표');
    });

    it('프로필·재무 스냅샷을 조회하지 않는다', async () => {
        await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(getProfileResilient).not.toHaveBeenCalled();
        expect(getFinancialsSnapshot).not.toHaveBeenCalled();
    });

    it('sets openGraph with ko_KR locale and OG label for 재무제표', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.openGraph?.locale).toBe('ko_KR');
        expect(metadata.openGraph?.title).toContain('재무제표');
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

        expect(metadata.openGraph?.siteName).toBe('시그렌즈');
    });
});

describe('Financials page JSON-LD schema types', () => {
    // 소스 그렙 단언(readFileSync + toContain('buildWebPageJsonLd('))은
    // 동작이 아니라 구현 세부를 검사하므로 제거됐다.
    // WebPage/FAQPage 런타임 JSON-LD 출력은 e2e/specs/symbol-seo.spec.ts가
    // /AAPL/financials 페이지를 크롤러처럼 HTTP로 fetch해 검증한다.

    it('buildBreadcrumbJsonLd produces a BreadcrumbList schema', async () => {
        const { buildBreadcrumbJsonLd } = await import('@/shared/lib/seo');
        const result = buildBreadcrumbJsonLd(
            [
                { name: 'AAPL', url: '/AAPL' },
                { name: '재무제표', url: '/AAPL/financials' },
            ],
            'ko'
        );
        expect(result['@type']).toBe('BreadcrumbList');
    });
});

/**
 * `[symbol]/position` page tests — mirrors overall/fear-greed sibling patterns:
 * revalidate literal, generateMetadata branches (always noindex), body guards
 * (invalid ticker / unresolvable-degraded / missing asset → notFound), the
 * static-path server data composition (getBarsStatic → quantize →
 * buildTechnicalFacts, never getBarsAction/cookies), and an SSR crawl-safety
 * check that no personalized marker (★/평단/수익률) ever appears in the
 * server-rendered shell.
 */

vi.mock('@/entities/ticker', () => ({
    buildDisplayName: vi.fn((assetInfo: { name: string }) => assetInfo.name),
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/entities/bars', () => ({
    getBarsStatic: vi.fn(),
    quantizeBarsDataToLastClosed: vi.fn((data: unknown) => data),
}));
vi.mock('@/views/symbol', () => ({
    SymbolPageHeading: ({ children }: { children: React.ReactNode }) =>
        children,
}));
// PositionTabContent is stubbed (client component, not under test here). But
// computeVolumeByBand is a real pure function the page's server data path
// calls directly — pull the actual implementation from its own lean lib
// module (not the full barrel, which would also drag in PositionTabContent's
// 'use client' dependency graph) so the "server data path" tests below
// exercise the real aggregation, not a stub.
vi.mock('@/widgets/portfolio-position', async () => {
    const { computeVolumeByBand } =
        await import('@/widgets/portfolio-position/lib/volumeByBand');
    const { BAND_COUNT } =
        await import('@/widgets/portfolio-position/lib/positionGeometry');
    return {
        PositionTabContent: () => null,
        computeVolumeByBand,
        BAND_COUNT,
    };
});
vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    generateMetadata,
    default as PositionPage,
    revalidate,
} from '@/app/[symbol]/position/page';
import { getAssetInfoResilient } from '@/entities/ticker';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { getBarsStatic, quantizeBarsDataToLastClosed } from '@/entities/bars';
import { PositionTabContent } from '@/widgets/portfolio-position';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import type { MockedFunction } from 'vitest';

const mockGetAssetInfoResilient = getAssetInfoResilient as MockedFunction<
    typeof getAssetInfoResilient
>;
const mockIsTabAllowedForSymbol = isTabAllowedForSymbol as MockedFunction<
    typeof isTabAllowedForSymbol
>;
const mockGetBarsStatic = getBarsStatic as MockedFunction<typeof getBarsStatic>;
const mockQuantize = quantizeBarsDataToLastClosed as MockedFunction<
    typeof quantizeBarsDataToLastClosed
>;

const AAPL_ASSET_INFO = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    koreanName: '애플',
    fmpSymbol: 'AAPL',
};

// bars 2개 이상 + prev.close != 0 이어야 buildTechnicalFacts가 null을 반환하지 않는다.
const RAW_BARS = {
    bars: [
        { time: 1, open: 90, high: 95, low: 85, close: 90, volume: 1 },
        { time: 2, open: 100, high: 110, low: 95, close: 100, volume: 1 },
    ],
    indicators: { rsi: [null, null], macd: [{ histogram: null }] },
};

describe('Position page ISR route config', () => {
    it('exports revalidate = 43200 (literal — required for Next.js static analysis)', () => {
        // MISTAKES §15: route segment config must be a literal, not an imported constant
        expect(revalidate).toBe(43200);
    });
});

describe('generateMetadata', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: AAPL_ASSET_INFO,
            degraded: false,
        } as never);
        mockIsTabAllowedForSymbol.mockResolvedValue(true);
    });

    it('returns noindex for an invalid ticker shape', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: '!!!invalid' }),
        });
        expect(metadata.robots).toEqual({ index: false, follow: false });
    });

    it('returns noindex when infra-degraded (unresolvable)', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: null,
            degraded: true,
        } as never);
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });
        expect(metadata.robots).toEqual({ index: false, follow: false });
    });

    it('returns noindex when the tab is not allowed for this market profile', async () => {
        mockIsTabAllowedForSymbol.mockResolvedValue(false);
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });
        expect(metadata.robots).toEqual({ index: false, follow: false });
    });

    it('is ALWAYS noindex for a valid, resolvable symbol — this tab is a personalized surface (design §배치 1)', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });
        // 색인 방침은 불변: noindex + self-canonical 유지(후킹 카피 추가와 무관).
        expect(metadata.robots).toEqual({ index: false, follow: false });
        expect(metadata.alternates).toEqual({
            canonical: 'https://siglens.io/AAPL/position',
        });
    });

    it('노출용 카피는 "평단 = 몇 층" 아파트 메타포로 후킹 강화 — title/description/OG/Twitter에 반영(색인은 여전히 noindex)', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });
        // 후킹 title: 종목 표시명 + 메타포 훅.
        expect(metadata.title).toBe('Apple Inc. 내 위치 — 내 평단은 몇 층?');
        // 후킹 description: 아파트/층 메타포 키워드를 담고, SEO_DESCRIPTION_MAX_LENGTH(120) 이내.
        const description = metadata.description ?? '';
        expect(description).toContain('아파트');
        expect(description).toContain('옥상');
        expect(description).toContain('지하');
        expect([...description].length).toBeLessThanOrEqual(120);
        // OG/Twitter 카드에도 동일 후킹 카피가 실려 소셜 공유·링크 프리뷰에서 노출된다.
        expect(metadata.openGraph?.title).toBe(metadata.title);
        expect(metadata.openGraph?.description).toBe(metadata.description);
        expect(metadata.twitter?.title).toBe(metadata.title);
        expect(metadata.twitter?.description).toBe(metadata.description);
        // OG url은 self-canonical과 일치해야 공유 카드가 올바른 페이지를 가리킨다.
        const og = metadata.openGraph as
            | {
                  url?: unknown;
                  siteName?: unknown;
                  type?: unknown;
                  locale?: unknown;
              }
            | undefined;
        expect(og?.url).toBe('https://siglens.io/AAPL/position');
        // 페이지 openGraph가 root layout을 replace하므로 브랜딩 필드가 유실되면 안 된다.
        expect(og?.siteName).toBe('Siglens');
        expect(og?.type).toBe('website');
        expect(og?.locale).toBe('ko_KR');
    });
});

describe('PositionPage body guards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsTabAllowedForSymbol.mockResolvedValue(true);
        mockGetBarsStatic.mockResolvedValue(RAW_BARS as never);
        mockQuantize.mockImplementation((data: unknown) => data as never);
    });

    it('notFound() for an invalid ticker shape', async () => {
        await expect(
            PositionPage({ params: Promise.resolve({ symbol: '!!!' }) })
        ).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('notFound() when unresolvable-degraded (digit-first symbol, both sources down)', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: null,
            degraded: true,
        } as never);
        await expect(
            PositionPage({ params: Promise.resolve({ symbol: '1inchusd' }) })
        ).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('notFound() when assetInfo resolves to null (non-degraded, real 404)', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: null,
            degraded: false,
        } as never);
        await expect(
            PositionPage({ params: Promise.resolve({ symbol: 'aapl' }) })
        ).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('notFound() when the tab is not allowed for this market profile', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: AAPL_ASSET_INFO,
            degraded: false,
        } as never);
        mockIsTabAllowedForSymbol.mockResolvedValue(false);
        await expect(
            PositionPage({ params: Promise.resolve({ symbol: 'aapl' }) })
        ).rejects.toThrow('NEXT_NOT_FOUND');
    });
});

describe('PositionPage server data path (static, cookies-free)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: AAPL_ASSET_INFO,
            degraded: false,
        } as never);
        mockIsTabAllowedForSymbol.mockResolvedValue(true);
    });

    it('uses getBarsStatic (never getBarsAction) → quantizeBarsDataToLastClosed → buildTechnicalFacts, and threads low/high/lastClose/volumeByBand into PositionTabContent', async () => {
        mockGetBarsStatic.mockResolvedValue(RAW_BARS as never);
        mockQuantize.mockReturnValue(RAW_BARS as never);

        const tree = await PositionPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(mockGetBarsStatic).toHaveBeenCalledWith('AAPL', '1Day', 'AAPL');
        expect(mockQuantize).toHaveBeenCalled();

        const island = findElementByType(tree, PositionTabContent);
        expect(island).not.toBeNull();
        const props = island?.props as {
            symbol: string;
            low52w: number | null;
            high52w: number | null;
            lastClose: number | null;
            volumeByBand: number[] | null;
        };
        expect(props.symbol).toBe('AAPL');
        expect(props.low52w).toBe(85);
        expect(props.high52w).toBe(110);
        expect(props.lastClose).toBe(100);
        // low=85,high=110,bandCount=5 → width=5 → bands [85,90)[90,95)[95,100)
        // [100,105)[105,110]. RAW_BARS: close=90(vol 1)→band1, close=100(vol 1)
        // →band3, evenly split → 50/50.
        expect(props.volumeByBand).toEqual([0, 50, 0, 50, 0]);
    });

    it('degrades to null low/high/lastClose/volumeByBand (never throws) when getBarsStatic fails', async () => {
        mockGetBarsStatic.mockRejectedValue(new Error('FMP down'));

        const tree = await PositionPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const island = findElementByType(tree, PositionTabContent);
        const props = island?.props as {
            low52w: number | null;
            high52w: number | null;
            lastClose: number | null;
            volumeByBand: number[] | null;
        };
        expect(props.low52w).toBeNull();
        expect(props.high52w).toBeNull();
        expect(props.lastClose).toBeNull();
        expect(props.volumeByBand).toBeNull();
    });

    it('degrades to null when buildTechnicalFacts cannot compute (e.g. <2 bars)', async () => {
        mockGetBarsStatic.mockResolvedValue({
            bars: [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 }],
            indicators: {},
        } as never);
        mockQuantize.mockImplementation((data: unknown) => data as never);

        const tree = await PositionPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const island = findElementByType(tree, PositionTabContent);
        const props = island?.props as { low52w: number | null };
        expect(props.low52w).toBeNull();
    });

    it('degrades volumeByBand to null (while low/high/lastClose still resolve) when the recent bars carry zero total volume', async () => {
        mockGetBarsStatic.mockResolvedValue({
            bars: [
                { time: 1, open: 90, high: 95, low: 85, close: 90, volume: 0 },
                {
                    time: 2,
                    open: 100,
                    high: 110,
                    low: 95,
                    close: 100,
                    volume: 0,
                },
            ],
            indicators: { rsi: [null, null], macd: [{ histogram: null }] },
        } as never);
        mockQuantize.mockImplementation((data: unknown) => data as never);

        const tree = await PositionPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const island = findElementByType(tree, PositionTabContent);
        const props = island?.props as {
            low52w: number | null;
            volumeByBand: number[] | null;
        };
        expect(props.low52w).toBe(85); // range still resolves — only volume is degraded
        expect(props.volumeByBand).toBeNull();
    });
});

describe('PositionPage — SSR crawl safety (no personalized data in the server shell)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: AAPL_ASSET_INFO,
            degraded: false,
        } as never);
        mockIsTabAllowedForSymbol.mockResolvedValue(true);
        mockGetBarsStatic.mockResolvedValue(RAW_BARS as never);
        mockQuantize.mockReturnValue(RAW_BARS as never);
    });

    it('the server-rendered element tree never contains ★/평단/수익률 — those only ever render inside the client-only PositionTabContent', async () => {
        const tree = await PositionPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });
        // Functions (component refs) are dropped by JSON.stringify — this only
        // inspects the static string content the RSC itself produced.
        const serialized = JSON.stringify(tree);
        expect(serialized).not.toContain('★');
        expect(serialized).not.toContain('평단');
        expect(serialized).not.toContain('수익률');
    });

    // ISR cold-gen-500 규약(§Task): getBarsAction은 cookies()를 읽어 request-scope
    // 밖(unstable_cache 내부/이 vitest 노드 환경)에서 호출되면 즉시 throw한다.
    // 위 "server data path" describe 블록의 모든 케이스가 getBarsStatic만 mock한
    // 채로(getBarsAction은 손대지 않은 채) 정상적으로 resolve/degrade하는 것 자체가
    // 이 셸이 cookies()/connection()을 요구하는 경로를 타지 않는다는 행동 증거다 —
    // 소스 grep 단언은 구현 세부 검사라 이 레포 컨벤션상 지양한다(financials 선례).
});

describe('PositionPage — <main> is a flex-item-safe full width (regression guard)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: AAPL_ASSET_INFO,
            degraded: false,
        } as never);
        mockIsTabAllowedForSymbol.mockResolvedValue(true);
        mockGetBarsStatic.mockResolvedValue(RAW_BARS as never);
        mockQuantize.mockReturnValue(RAW_BARS as never);
    });

    // <main> is a direct flex item of SymbolLayoutJail's `flex flex-col` container.
    // `mx-auto` alone (both cross-axis margins auto) disables flex stretch (CSS
    // Flexbox stretch requires neither margin be auto), so without an explicit
    // `w-full` the browser falls back to shrink-to-fit sizing based on the
    // page's own (possibly narrow, e.g. the guest CTA card) content instead of
    // filling to `max-w-5xl` — visually centering the whole block, heading
    // included, on desktop. `w-full` makes the width a definite value so this
    // flex quirk can't collapse it (empirically verified against a running
    // dev server — the guest CTA shrank to ~614px without it, matching
    // fundamental's 1024px only after adding `w-full`). news/options already
    // carry this same class for the identical reason.
    it('the <main> className includes w-full (not just mx-auto max-w-5xl)', async () => {
        const tree = await PositionPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });
        const main = findElementByType(tree, 'main');
        expect(main).not.toBeNull();
        const className = (main?.props as { className: string }).className;
        expect(className).toContain('w-full');
        expect(className).toContain('mx-auto');
        expect(className).toContain('max-w-5xl');
    });
});

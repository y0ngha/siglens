/**
 * `[symbol]/position` page tests — mirrors overall/fear-greed sibling patterns:
 * revalidate literal, generateMetadata branches (index,follow for a valid
 * resolvable symbol since 2026-08-19; noindex still applies to invalid
 * ticker/degraded/tab-not-allowed early-returns), body guards (invalid ticker /
 * unresolvable-degraded / missing asset → notFound), the static-path server
 * data composition (getQuantizedBarsStatic → buildTechnicalFacts, never
 * getBarsAction/cookies), the per-symbol current-price-position content block
 * (Task 1 — the indexing justification), and an SSR crawl-safety check that no
 * personalized marker (★/평단/수익률) ever appears in the server-rendered shell
 * (that invariant is unchanged by the indexing flip — only PositionCta, which
 * is mocked out here, carries those words).
 */

vi.mock('@/entities/ticker', () => ({
    pickAssetName: (info: { name: string; koreanName?: string }) =>
        info.koreanName ?? info.name,
    buildDisplayName: vi.fn((assetInfo: { name: string }) => assetInfo.name),
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/entities/bars', () => ({
    getQuantizedBarsStatic: vi.fn(),
}));
vi.mock('@/views/symbol', () => ({
    SymbolPageHeading: ({ children }: { children: React.ReactNode }) =>
        children,
}));
// PositionTabContent is stubbed (client component, not under test here). But
// computeVolumeByBand/computePosition/describeAvgFloor/formatAmount are real
// pure functions the page's server data path and the Task 1 per-symbol
// content block call directly — pull the actual implementations from their
// own lean lib modules (not the full barrel, which would also drag in
// PositionTabContent's 'use client' dependency graph) so those tests exercise
// the real aggregation/geometry, not a stub.
vi.mock('@/widgets/portfolio-position', async () => {
    const { computeVolumeByBand } =
        await import('@/widgets/portfolio-position/lib/volumeByBand');
    const { BAND_COUNT, computePosition } =
        await import('@/widgets/portfolio-position/lib/positionGeometry');
    const { formatAmount, describeAvgFloor } =
        await import('@/widgets/portfolio-position/lib/positionBuildingNotes');
    return {
        PositionTabContent: () => null,
        computeVolumeByBand,
        computePosition,
        describeAvgFloor,
        formatAmount,
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
} from '@/app/[locale]/[symbol]/position/page';
import { getAssetInfoResilient } from '@/entities/ticker';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { getQuantizedBarsStatic } from '@/entities/bars';
import { PositionTabContent } from '@/widgets/portfolio-position';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import { SEO_DESCRIPTION_MAX_LENGTH } from '@/shared/lib/seo';
import type { MockedFunction } from 'vitest';

const mockGetAssetInfoResilient = getAssetInfoResilient as MockedFunction<
    typeof getAssetInfoResilient
>;
const mockIsTabAllowedForSymbol = isTabAllowedForSymbol as MockedFunction<
    typeof isTabAllowedForSymbol
>;
const mockGetQuantizedBarsStatic = getQuantizedBarsStatic as MockedFunction<
    typeof getQuantizedBarsStatic
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
            params: Promise.resolve({ locale: 'ko', symbol: '!!!invalid' }),
        });
        expect(metadata.robots).toEqual({ index: false, follow: false });
    });

    it('returns noindex when infra-degraded (unresolvable)', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: null,
            degraded: true,
        } as never);
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });
        expect(metadata.robots).toEqual({ index: false, follow: false });
    });

    it('returns noindex when the tab is not allowed for this market profile', async () => {
        mockIsTabAllowedForSymbol.mockResolvedValue(false);
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });
        expect(metadata.robots).toEqual({ index: false, follow: false });
    });

    it('is index,follow for a valid, resolvable symbol — per-symbol content (Task 1) now justifies indexing (design decision 2026-08-19)', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });
        // symbolMetadataFromSeo는 robots를 아예 설정하지 않는다 — root layout의
        // 기본값(index:true, follow:true)을 그대로 상속해 색인된다. sibling
        // 인덱서블 탭(overall/fear-greed)과 동일 계약.
        expect(metadata.robots).toBeUndefined();
        // hreflang은 **분석 본문이 준비된 로케일만** 광고한다. 지금은 ko뿐이라
        // `languages` 키 자체가 나가지 않는다 — 자기 자신만 가리키는 hreflang은
        // 정보가 0이면서 색인된 전 페이지의 HTML만 바꾼다. 번역 레이어가 붙으면
        // (설계 Phase 3) `SYMBOL_INDEXABLE_LOCALES`에 로케일을 더하면서 나타난다.
        expect(metadata.alternates).toEqual({
            canonical: 'https://siglens.io/AAPL/position',
        });
    });

    it('노출용 카피는 "평단 = 몇 층" 아파트 메타포로 후킹 강화 — title/description/OG/Twitter에 반영', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });
        // 후킹 title: 메타포 훅이 displayName **앞**에 front-load — title/OG
        // truncation(브라우저 탭·메신저 프리뷰)에서도 훅이 먼저 살아남는다.
        // symbolMetadataFromSeo는 title을 `{ absolute }`로 감싸 root layout의
        // title.template("%s | Siglens")을 무시한다(sibling 인덱서블 탭과 동일).
        expect(metadata.title).toEqual({
            absolute: '내 평단은 몇 층? — Apple Inc. 내 위치',
        });
        // 후킹 description: 아파트/층 메타포 키워드를 담고, SEO_DESCRIPTION_MAX_LENGTH 이내.
        const description = metadata.description ?? '';
        expect(description).toContain('아파트');
        expect(description).toContain('옥상');
        expect(description).toContain('지하');
        // 용어는 "평단"으로 통일 — "매수가"는 쓰지 않는다.
        expect(description).toContain('평단');
        expect(description).not.toContain('매수가');
        expect([...description].length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
        // keywords: position 탭 전용 buildPositionKeywords가 ticker 기반 키워드를 낸다.
        expect(metadata.keywords).toContain('AAPL 평단');
        // OG/Twitter 카드는 root layout의 title.template("| Siglens" suffix)이
        // 페이지 레벨 openGraph/twitter를 replace(merge 아님)하며 무력화되므로,
        // sibling 심볼 페이지(symbolMetadataFromSeo의 fullTitle 패턴)와 동일하게
        // 브랜드 suffix가 직접 실려야 한다 — metadata.title과 달라야 정상이다.
        expect(metadata.openGraph?.title).toBe(
            '내 평단은 몇 층? — Apple Inc. 내 위치 | Siglens'
        );
        expect(metadata.openGraph?.description).toBe(metadata.description);
        expect(metadata.twitter?.title).toBe(
            '내 평단은 몇 층? — Apple Inc. 내 위치 | Siglens'
        );
        expect(metadata.twitter?.description).toBe(metadata.description);
        // OG url은 self-canonical과 일치해야 공유 카드가 올바른 페이지를 가리킨다.
        // as 캐스트 근거(CONVENTIONS.md §TypeScript 7): generateMetadata의 openGraph 리턴은
        // 항상 object 리터럴(url/siteName/type/locale 포함)이지 함수형이 아니므로 이
        // 테스트가 읽는 4개 필드에 한해 `Metadata['openGraph']` 유니온을 좁히는 것은
        // 런타임과 어긋나지 않는다 — 소스(page.tsx generateMetadata)가 그 형태를
        // 무조건 반환함을 위 expect들이 이미 실행 경로로 증명한다.
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

    it('긴 displayName(코리안네임+영문명+티커 조합, 70자+)에서도 아파트/옥상/지하 메타포가 120자 clamp에서 살아남는다 — front-load 회귀 가드', async () => {
        // buildDisplayName 목은 assetInfo.name을 그대로 반환하므로(위 vi.mock 참고),
        // name에 직접 buildDisplayName의 실제 출력 형태(koreanName, name (TICKER))를
        // 흉내 낸 긴 문자열을 넣어 "긴 displayName" 케이스를 재현한다.
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: {
                symbol: 'IBM',
                name: '인터내셔널 비즈니스 머신즈, International Business Machines Corp (IBM)',
                koreanName: '인터내셔널 비즈니스 머신즈',
                fmpSymbol: 'IBM',
            },
            degraded: false,
        } as never);

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'ibm' }),
        });

        const description = metadata.description ?? '';
        expect([...description].length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
        expect(description).toContain('아파트');
        expect(description).toContain('옥상');
        expect(description).toContain('지하');
    });
});

describe('PositionPage body guards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsTabAllowedForSymbol.mockResolvedValue(true);
        mockGetQuantizedBarsStatic.mockResolvedValue(RAW_BARS as never);
    });

    it('notFound() for an invalid ticker shape', async () => {
        await expect(
            PositionPage({
                params: Promise.resolve({ locale: 'ko', symbol: '!!!' }),
            })
        ).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('notFound() when unresolvable-degraded (digit-first symbol, both sources down)', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: null,
            degraded: true,
        } as never);
        await expect(
            PositionPage({
                params: Promise.resolve({ locale: 'ko', symbol: '1inchusd' }),
            })
        ).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('notFound() when assetInfo resolves to null (non-degraded, real 404)', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: null,
            degraded: false,
        } as never);
        await expect(
            PositionPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            })
        ).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('notFound() when the tab is not allowed for this market profile', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: AAPL_ASSET_INFO,
            degraded: false,
        } as never);
        mockIsTabAllowedForSymbol.mockResolvedValue(false);
        await expect(
            PositionPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            })
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

    it('uses getQuantizedBarsStatic (never getBarsAction) → buildTechnicalFacts, and threads low/high/lastClose/volumeByBand into PositionTabContent', async () => {
        mockGetQuantizedBarsStatic.mockResolvedValue(RAW_BARS as never);

        const tree = await PositionPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        // quantize는 이제 헬퍼 내부에서 수행된다 — 여기서는 위임 인자만 고정한다
        // (marketProfile까지 넘겨야 헬퍼가 세션 spec을 유도할 수 있다).
        expect(mockGetQuantizedBarsStatic).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            'us-equity',
            'AAPL'
        );

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

    it('degrades to null low/high/lastClose/volumeByBand (never throws) when getQuantizedBarsStatic fails', async () => {
        mockGetQuantizedBarsStatic.mockRejectedValue(new Error('FMP down'));

        const tree = await PositionPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
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
        mockGetQuantizedBarsStatic.mockResolvedValue({
            bars: [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 }],
            indicators: {},
        } as never);

        const tree = await PositionPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        const island = findElementByType(tree, PositionTabContent);
        const props = island?.props as { low52w: number | null };
        expect(props.low52w).toBeNull();
    });

    it('degrades volumeByBand to null (while low/high/lastClose still resolve) when the recent bars carry zero total volume', async () => {
        mockGetQuantizedBarsStatic.mockResolvedValue({
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

        const tree = await PositionPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
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
        mockGetQuantizedBarsStatic.mockResolvedValue(RAW_BARS as never);
    });

    it('the server-rendered element tree never contains ★/평단/수익률 — those only ever render inside the client-only PositionTabContent', async () => {
        const tree = await PositionPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
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
    // 위 "server data path" describe 블록의 모든 케이스가 getQuantizedBarsStatic만 mock한
    // 채로(getBarsAction은 손대지 않은 채) 정상적으로 resolve/degrade하는 것 자체가
    // 이 셸이 cookies()/connection()을 요구하는 경로를 타지 않는다는 행동 증거다 —
    // 소스 grep 단언은 구현 세부 검사라 이 레포 컨벤션상 지양한다(financials 선례).
});

describe('PositionPage — per-symbol current-price-position content (Task 1, the indexing justification)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: AAPL_ASSET_INFO,
            degraded: false,
        } as never);
        mockIsTabAllowedForSymbol.mockResolvedValue(true);
    });

    it('renders a visible (non sr-only) section with the real low/high/lastClose numbers and the computed percentile/floor', async () => {
        mockGetQuantizedBarsStatic.mockResolvedValue(RAW_BARS as never);

        const tree = await PositionPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        const section = findElementByType(tree, 'section');
        expect(section).not.toBeNull();
        // 이 섹션은 sr-only가 아니라 실제로 보이는 콘텐츠여야 한다(Task 1) —
        // sr-only였던 이전 버전과 달리 className에 'sr-only'가 없다.
        const className = (section?.props as { className: string }).className;
        expect(className).not.toContain('sr-only');

        // low=85, high=110, lastClose=100 → (100-85)/(110-85) = 0.6 → 60%,
        // floorIndex=floor(0.6*5)=3 → "4층 · 고층"(describeAvgFloor의 BAND_COUNT=5
        // 표와 동일한 매핑 — PositionBuilding.test.tsx의 avgPos=0.6 케이스 참고).
        // percentile(60)은 JSX 안에서 인접 텍스트('% 지점')와 별개 자식 노드로
        // 렌더되므로(숫자 보간), JSON.stringify 결과에서 "60%"로 붙어있지 않다 —
        // 숫자와 접미사를 각각 확인한다.
        const serialized = JSON.stringify(tree);
        expect(serialized).toContain('$85');
        expect(serialized).toContain('$110');
        expect(serialized).toContain('$100');
        expect(serialized).toContain('60');
        expect(serialized).toContain('% 지점');
        expect(serialized).toContain('4층 · 고층');
    });

    it('omits the section entirely (no crash, no empty shell) when getQuantizedBarsStatic fails and range degrades to null', async () => {
        mockGetQuantizedBarsStatic.mockRejectedValue(new Error('FMP down'));

        const tree = await PositionPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(findElementByType(tree, 'section')).toBeNull();
    });

    it('omits the section when the range resolves but the 52-week span is degenerate (high52w <= low52w, division-by-zero guard)', async () => {
        // buildTechnicalFacts를 통과하려면 bars가 2개 이상 + prev.close != 0 이어야 하므로,
        // 두 봉 모두 high/low가 동일한(고저 폭이 0인) 값으로 만들어 high52w===low52w를 재현한다.
        mockGetQuantizedBarsStatic.mockResolvedValue({
            bars: [
                {
                    time: 1,
                    open: 100,
                    high: 100,
                    low: 100,
                    close: 100,
                    volume: 1,
                },
                {
                    time: 2,
                    open: 100,
                    high: 100,
                    low: 100,
                    close: 100,
                    volume: 1,
                },
            ],
            indicators: { rsi: [null, null], macd: [{ histogram: null }] },
        } as never);

        const tree = await PositionPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(findElementByType(tree, 'section')).toBeNull();
    });
});

describe('PositionPage — <main> is a flex-item-safe full width (regression guard)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: AAPL_ASSET_INFO,
            degraded: false,
        } as never);
        mockIsTabAllowedForSymbol.mockResolvedValue(true);
        mockGetQuantizedBarsStatic.mockResolvedValue(RAW_BARS as never);
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
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });
        const main = findElementByType(tree, 'main');
        expect(main).not.toBeNull();
        const className = (main?.props as { className: string }).className;
        expect(className).toContain('w-full');
        expect(className).toContain('mx-auto');
        expect(className).toContain('max-w-5xl');
    });
});

import Link from 'next/link';
import {
    getDescriptor,
    type MarketProfileId,
    type AssetClass,
} from '@/shared/config/marketProfile';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';

/** All cross-linked page types in the symbol sub-navigation. */
const ALL_PAGES = [
    'chart',
    'news',
    'fundamental',
    'financials',
    'options',
    'fear-greed',
    'congress',
    'overall',
] as const;

/** Union of all page keys. */
type PageKey = (typeof ALL_PAGES)[number];

const LABEL: Record<PageKey, string> = {
    chart: '차트 분석',
    news: '뉴스 분석',
    fundamental: '펀더멘털 분석',
    financials: '재무제표',
    options: '옵션 분석',
    'fear-greed': '공포 탐욕 지수',
    congress: '의회 거래',
    overall: 'AI 종합 분석',
};

const EQUITY_DESCRIPTIONS: Record<PageKey, string> = {
    chart: '기술적 지표 + AI 종합 리포트',
    news: '실시간 뉴스 + 애널리스트 의견 분석',
    fundamental: '재무·밸류에이션·애널리스트 전망',
    financials: '손익계산서·재무상태표·현금흐름표',
    options: '옵션 시장이 보는 가격대와 기대 변동성',
    'fear-greed': '단기 매매 심리 0~100 점수',
    congress: '상원·하원 의원 매매 공시와 AI 동향 해석',
    overall: '4축 통합 AI 결론 + 시나리오',
};

/**
 * Returns the per-page description string, branching on assetClass for pages
 * whose copy is equity-specific (currently "overall").
 */
function getDescription(page: PageKey, assetClass: AssetClass): string {
    if (page === 'overall' && assetClass === 'crypto') {
        return '차트·뉴스·시장 분위기 통합 AI 결론 + 시나리오';
    }
    return EQUITY_DESCRIPTIONS[page];
}

const HREF: Record<PageKey, (symbol: string) => string> = {
    chart: symbol => `/${symbol}`,
    news: symbol => `/${symbol}/news`,
    fundamental: symbol => `/${symbol}/fundamental`,
    financials: symbol => `/${symbol}/financials`,
    options: symbol => `/${symbol}/options`,
    'fear-greed': symbol => `/${symbol}/fear-greed`,
    congress: symbol => `/${symbol}/congress`,
    overall: symbol => `/${symbol}/overall`,
};

interface CrossLinkCardsProps {
    /** Ticker symbol (already uppercased). */
    symbol: string;
    /** The current page — rendered as a non-link "current page" marker (aria-current). */
    current: PageKey;
    /**
     * Market profile of the symbol. Used to filter ALL_PAGES to only the tabs
     * allowed for this asset class (e.g. crypto: chart/news/fear-greed/overall).
     *
     * The default is kept deliberately, not because it's safe in general, but
     * because it's *provably* safe for its only remaining implicit callers:
     * `congress/page.tsx`, `congress/CongressDegraded.tsx`, and
     * `options/OptionsPageClient.tsx` render this component only after their
     * page already 404s any symbol whose tab set doesn't include
     * `congress`/`options` (`isTabAllowedForSymbol`) — and only `us-equity`
     * carries those tabs (`US_EQUITY_DESCRIPTOR.tabs`). So `marketProfile`
     * is provably `'us-equity'` there, and the default is accurate rather than
     * assumed.
     *
     * An audit (2026-08-18) found the opposite case: `fundamental`/`financials`
     * render for BOTH us-equity and kr-equity, so their call sites omitting
     * this prop silently fell back to `'us-equity'` and rendered live links to
     * `/options` and `/congress` for Korean symbols — pages that
     * `isTabAllowedForSymbol` then 404s (soft-404: `notFound()` inside a
     * Suspense boundary still returns HTTP 200, see
     * `e2e/specs/kr-equity-seo.spec.ts`). That fix passes `marketProfile`
     * explicitly at those two call sites; it does not remove this default,
     * to avoid an unrelated diff across the three still-provably-safe callers
     * above. If a *new* call site ever needs to render both congress/options
     * copy for a non-us-equity symbol, that's exactly the moment this default
     * stops being safe — pass `marketProfile` explicitly there too.
     */
    marketProfile?: MarketProfileId;
}

// 현재 페이지 카드는 self-link로 두지 않고 비활성 div + aria-current="page"로 표시한다.
// (a) self-link는 SEO 신호가 약하고 접근성에서 혼란을 주며, (b) 6장 그리드에서 한 칸이
// 빠지면 lg:grid-cols-3 레이아웃이 비대칭이 되어 UX가 어색하다.
export function CrossLinkCards({
    symbol,
    current,
    marketProfile = 'us-equity',
}: CrossLinkCardsProps) {
    const descriptor = getDescriptor(marketProfile);
    const allowedTabKeys = new Set(descriptor.tabs);
    const assetClass = descriptor.assetClass;
    const visiblePages = ALL_PAGES.filter(p => allowedTabKeys.has(p));

    return (
        <section
            className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-labelledby="cross-link-heading"
        >
            {/*
             * 카드 제목이 h3인데 이 구역에 h2가 없어서, 문서 개요상 h3 여덟
             * 개가 바로 앞 FAQ의 h2 밑으로 들어가 있었다(감사 실측: 심볼 탭
             * 전역). 보이는 제목을 새로 만들 자리는 아니므로 sr-only h2를 두고
             * `aria-labelledby`로 랜드마크 이름까지 그쪽에 맡긴다 — `aria-label`을
             * 그대로 두면 이름은 있지만 개요는 여전히 비어 있다.
             *
             * `sr-only`는 `position: absolute`라 그리드 트랙을 차지하지 않는다.
             */}
            <h2 id="cross-link-heading" className="sr-only">
                다른 분석 탭
            </h2>
            {visiblePages.map(p => {
                const isCurrent = p === current;
                const description = getDescription(p, assetClass);
                if (isCurrent) {
                    return (
                        <div
                            key={p}
                            aria-current="page"
                            className="cursor-default rounded-lg border border-primary-500 bg-secondary-800/40 p-6 ring-1 ring-primary-500/30"
                        >
                            <h3 className={HEADING_SUBSECTION}>{LABEL[p]}</h3>
                            <p className="mt-2 text-sm text-secondary-400">
                                {description}
                            </p>
                            <p className="mt-3 text-xs font-medium text-primary-400">
                                지금 보는 페이지예요
                            </p>
                        </div>
                    );
                }
                return (
                    <Link
                        key={p}
                        href={HREF[p](symbol)}
                        // SymbolTabs와 같은 형제 탭 집합을 카드로 한 번 더 노출하는
                        // 섹션이다. prefetch를 켜두면 같은 페이로드를 탭에 이어 두 번째로
                        // 예약하게 되므로 끈다 (docs/architecture/CDN_CACHING.md §1).
                        prefetch={false}
                        // 이 카드는 형제들과 달리 **채움이 없다** — 보더가 배경과
                        // 구분되는 유일한 단서다. 장식 토큰(`secondary-700`)일 때
                        // 다크 1.40:1 / 라이트 1.15:1로 사실상 안 보였고, 이는
                        // master(1.72:1)보다도 낮았다. 경계 토큰으로 올려
                        // 다크 3.74 / 라이트 3.58을 확보한다. 현재 탭 카드와의
                        // 구분은 그쪽의 채움(`bg-secondary-800/40`)과 액센트가 맡는다.
                        className="rounded-lg border border-border-control p-6 transition-colors hover:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                        <h3 className={HEADING_SUBSECTION}>{LABEL[p]}</h3>
                        <p className="mt-2 text-sm text-secondary-400">
                            {description}
                        </p>
                    </Link>
                );
            })}
        </section>
    );
}

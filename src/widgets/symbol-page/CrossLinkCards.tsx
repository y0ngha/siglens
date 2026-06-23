import Link from 'next/link';
import type {
    MarketProfileId,
    AssetClass,
} from '@/shared/config/marketProfile';
import { getDescriptor } from '@/shared/config/marketProfile';

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
     * Defaults to 'us-equity' so existing call-sites that don't yet pass this
     * param continue to show all 8 cards.
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
            aria-label="다른 분석 탭"
        >
            {visiblePages.map(p => {
                const isCurrent = p === current;
                const description = getDescription(p, assetClass);
                if (isCurrent) {
                    return (
                        <div
                            key={p}
                            aria-current="page"
                            className="border-primary-500 bg-secondary-800/40 ring-primary-500/30 cursor-default rounded-xl border p-6 ring-1"
                        >
                            <h3 className="text-secondary-100 font-semibold">
                                {LABEL[p]}
                            </h3>
                            <p className="text-secondary-400 mt-2 text-sm">
                                {description}
                            </p>
                            <p className="text-primary-400 mt-3 text-xs font-medium">
                                지금 보는 페이지예요
                            </p>
                        </div>
                    );
                }
                return (
                    <Link
                        key={p}
                        href={HREF[p](symbol)}
                        className="border-secondary-700 hover:border-primary-500 focus-visible:ring-primary-500 rounded-xl border p-6 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                        <h3 className="font-semibold">{LABEL[p]}</h3>
                        <p className="text-secondary-400 mt-2 text-sm">
                            {description}
                        </p>
                    </Link>
                );
            })}
        </section>
    );
}

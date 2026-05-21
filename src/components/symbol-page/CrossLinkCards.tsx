import Link from 'next/link';

/** All cross-linked page types in the symbol sub-navigation. */
const ALL_PAGES = [
    'chart',
    'news',
    'fundamental',
    'options',
    'fear-greed',
    'overall',
] as const;

/** Union of all page keys. */
type PageKey = (typeof ALL_PAGES)[number];

const LABEL: Record<PageKey, string> = {
    chart: '차트 분석',
    news: '뉴스 분석',
    fundamental: '펀더멘털 분석',
    options: '옵션 분석',
    'fear-greed': '공포 탐욕 지수',
    overall: 'AI 종합 분석',
};

const DESCRIPTION: Record<PageKey, string> = {
    chart: '기술적 지표 + AI 종합 리포트',
    news: '실시간 뉴스 + 애널리스트 의견 분석',
    fundamental: '재무·밸류에이션·미래 방향',
    options: '옵션 시장이 보는 가격대와 기대 변동성',
    'fear-greed': '단기 매매 심리 0~100 점수',
    overall: '4축 통합 AI 결론 + 시나리오',
};

const HREF: Record<PageKey, (symbol: string) => string> = {
    chart: symbol => `/${symbol}`,
    news: symbol => `/${symbol}/news`,
    fundamental: symbol => `/${symbol}/fundamental`,
    options: symbol => `/${symbol}/options`,
    'fear-greed': symbol => `/${symbol}/fear-greed`,
    overall: symbol => `/${symbol}/overall`,
};

interface CrossLinkCardsProps {
    /** Ticker symbol (already uppercased). */
    symbol: string;
    /** The current page — omitted from the rendered links. */
    current: PageKey;
}

/** Cross-link cards shown below each analysis page — links to every sibling page. */
export function CrossLinkCards({ symbol, current }: CrossLinkCardsProps) {
    const others = ALL_PAGES.filter(p => p !== current);

    return (
        <section
            className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="다른 분석 종류 보기"
        >
            {others.map(p => (
                <Link
                    key={p}
                    href={HREF[p](symbol)}
                    className="border-secondary-700 hover:border-primary-500 focus-visible:ring-primary-500 rounded-xl border p-6 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    <h3 className="font-semibold">{LABEL[p]}</h3>
                    <p className="text-secondary-400 mt-2 text-sm">
                        {DESCRIPTION[p]}
                    </p>
                </Link>
            ))}
        </section>
    );
}

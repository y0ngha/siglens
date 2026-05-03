import Link from 'next/link';

/** All cross-linked page types in the symbol sub-navigation. */
const ALL_PAGES = ['chart', 'news', 'fundamental', 'overall'] as const;

/** Union of all page keys. */
type PageKey = (typeof ALL_PAGES)[number];

const LABEL: Record<PageKey, string> = {
    chart: '차트 분석',
    news: '뉴스 분석',
    fundamental: '펀더 분석',
    overall: 'AI 종합 분석',
};

const DESCRIPTION: Record<PageKey, string> = {
    chart: '기술적 지표 + AI 종합 리포트',
    news: '실시간 뉴스 + sentiment 분석',
    fundamental: '재무·밸류에이션·미래 방향',
    overall: '3축 통합 AI 결론 + 시나리오',
};

const HREF: Record<PageKey, (symbol: string) => string> = {
    chart: symbol => `/${symbol}`,
    news: symbol => `/${symbol}/news`,
    fundamental: symbol => `/${symbol}/fundamental`,
    overall: symbol => `/${symbol}/overall`,
};

interface CrossLinkCardsProps {
    /** Ticker symbol (already uppercased). */
    symbol: string;
    /** The current page — omitted from the rendered links. */
    current: PageKey;
}

/**
 * Cross-link cards displayed at the bottom of each analysis page.
 *
 * Renders the 3 sibling pages (excluding the current one), with a label
 * and a short description for each. Uses semantic `<section>` + `<h3>` markup.
 * Focus states are visible via `focus-visible:ring-2` on each card link.
 */
export function CrossLinkCards({ symbol, current }: CrossLinkCardsProps) {
    const others = ALL_PAGES.filter(p => p !== current);

    return (
        <section
            className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3"
            aria-label="다른 분석 종류 보기"
        >
            {others.map(p => (
                <Link
                    key={p}
                    href={HREF[p](symbol)}
                    className="rounded-xl border border-border p-6 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                    <h3 className="font-semibold">
                        <span aria-hidden="true">→ </span>
                        {LABEL[p]}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {DESCRIPTION[p]}
                    </p>
                </Link>
            ))}
        </section>
    );
}

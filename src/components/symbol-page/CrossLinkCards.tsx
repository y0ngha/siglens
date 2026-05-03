import Link from 'next/link';

/** All cross-linked page types in the symbol sub-navigation. */
const ALL_PAGES = ['chart', 'news', 'fundamental', 'overall'] as const;

/** Union of all page keys. */
type PageKey = (typeof ALL_PAGES)[number];

const LABEL: Record<PageKey, string> = {
    chart: '차트 분석',
    news: '뉴스 분석',
    fundamental: '펀더멘털 분석',
    overall: 'AI 종합 분석',
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
 * Navigation card strip linking to the sibling analysis pages for a symbol.
 *
 * Renders all pages except the current one. Stub implementation (Task 2.13
 * will add icons, descriptions, and richer design).
 */
export function CrossLinkCards({ symbol, current }: CrossLinkCardsProps) {
    const others = ALL_PAGES.filter(p => p !== current);

    return (
        <nav aria-label="관련 분석 페이지" className="mt-12">
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {others.map(page => (
                    <li key={page}>
                        <Link
                            href={HREF[page](symbol)}
                            className="focus-visible:ring-primary block rounded-xl border border-border p-6 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2"
                        >
                            <h3 className="font-semibold">
                                <span aria-hidden="true">→ </span>
                                {LABEL[page]}
                            </h3>
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
}

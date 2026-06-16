import type { NewsFeedCategory } from '@y0ngha/siglens-core';

/**
 * Maximum number of headline previews to render on the hub card.
 * Three headlines fit cleanly in the card without requiring scroll.
 */
const MAX_PREVIEW_HEADLINES = 3;

export interface CategoryCardProps {
    category: NewsFeedCategory;
    koLabel: string;
    slug: string;
    /**
     * Pre-fetched headline strings for the preview list. The caller is
     * responsible for fetching and passing these — this component does no
     * data fetching, keeping it a pure RSC that renders deterministically.
     * At most `MAX_PREVIEW_HEADLINES` entries are rendered.
     */
    previewHeadlines: string[];
}

/**
 * Server component: category hub card linking to `/news/[slug]`.
 *
 * Renders a heading, up to 3 truncated headline previews (or a fallback
 * placeholder when none are available), and a "더보기 →" deep link.
 *
 * No `'use client'` — this is an RSC-safe pure presentation component with
 * no client-side state or browser-only APIs.
 */
export function CategoryCard({
    koLabel,
    slug,
    previewHeadlines,
}: CategoryCardProps) {
    const previews = previewHeadlines.slice(0, MAX_PREVIEW_HEADLINES);

    return (
        <article className="border-secondary-700 bg-secondary-800 hover:border-primary-500/50 flex w-full min-w-0 flex-col overflow-hidden rounded-xl border p-5 transition-colors">
            <h2 className="mb-3 text-base font-semibold tracking-tight text-balance">
                {koLabel}
            </h2>

            {previews.length > 0 ? (
                <ul
                    className="mb-4 min-w-0 space-y-2"
                    aria-label={`${koLabel} 최신 뉴스 미리보기`}
                >
                    {previews.map((headline, i) => (
                        <li
                            key={i}
                            className="text-secondary-400 min-w-0 text-sm"
                        >
                            <span className="line-clamp-1 wrap-break-word">
                                {headline}
                            </span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-secondary-500 mb-4 text-sm">
                    최신 뉴스를 불러오고 있어요.
                </p>
            )}

            <a
                href={`/news/${slug}`}
                className="text-primary-400 hover:text-primary-300 focus-visible:ring-primary-500 mt-auto text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                aria-label={`${koLabel} 뉴스 더보기`}
            >
                더보기 →
            </a>
        </article>
    );
}

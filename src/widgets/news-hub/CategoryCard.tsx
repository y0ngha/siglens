import Link from 'next/link';

/**
 * Maximum number of headline previews to render on the hub card.
 * Three headlines fit cleanly in the card without requiring scroll.
 * Exported so the data producer (`app/news/page.tsx`) can slice to this
 * count before passing the array — single source of truth, no drift.
 */
export const PREVIEW_HEADLINE_LIMIT = 3;

export interface CategoryCardProps {
    koLabel: string;
    slug: string;
    /** One-sentence category intro shown below the heading. Differentiates each card from thin-duplicate content. */
    koDescription: string;
    /**
     * Pre-fetched headline strings for the preview list. The caller is
     * responsible for fetching and passing these — this component does no
     * data fetching, keeping it a pure RSC that renders deterministically.
     * Caller must pass ≤ `PREVIEW_HEADLINE_LIMIT` entries.
     */
    previewHeadlines: string[];
}

/**
 * Server component: category hub card linking to `/news/[slug]`.
 *
 * Renders a heading, up to 3 truncated headline previews (or a fallback
 * placeholder when none are available), and a "더보기" deep link with a decorative arrow.
 *
 * No `'use client'` — this is an RSC-safe pure presentation component with
 * no client-side state or browser-only APIs.
 */
export function CategoryCard({
    koLabel,
    slug,
    koDescription,
    previewHeadlines,
}: CategoryCardProps) {
    return (
        <article className="flex w-full min-w-0 flex-col overflow-hidden rounded-xl border border-secondary-700 bg-secondary-800 p-5 transition-colors hover:border-primary-500/50">
            <h2 className="mb-1 text-base font-semibold tracking-tight text-balance">
                {koLabel}
            </h2>
            <p className="mb-3 text-xs leading-relaxed text-secondary-400">
                {koDescription}
            </p>

            {previewHeadlines.length > 0 ? (
                <ul
                    className="mb-4 min-w-0 space-y-2"
                    aria-label={`${koLabel} 최신 뉴스 미리보기`}
                >
                    {previewHeadlines.map((headline, i) => (
                        <li
                            key={i}
                            className="min-w-0 text-sm text-secondary-400"
                        >
                            <span className="line-clamp-1 wrap-break-word">
                                {headline}
                            </span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mb-4 text-sm text-secondary-400">
                    최신 뉴스를 불러오고 있어요.
                </p>
            )}

            <Link
                href={`/news/${slug}`}
                // 카드 그리드로 다수 렌더 — docs/architecture/CDN_CACHING.md §1
                prefetch={false}
                className="mt-auto text-sm text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                aria-label={`${koLabel} 뉴스 더보기`}
            >
                더보기 <span aria-hidden="true">→</span>
            </Link>
        </article>
    );
}

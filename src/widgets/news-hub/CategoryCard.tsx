import Link from 'next/link';

/**
 * Maximum number of headline previews to render on the hub card.
 * Three headlines fit cleanly in the card without requiring scroll.
 * Exported so the data producer (`app/news/_lib/categoryPreviews.ts`) can slice
 * to this count before passing the array — single source of truth, no drift.
 */
export const PREVIEW_HEADLINE_LIMIT = 3;

export interface CategoryCardProps {
    koLabel: string;
    /**
     * 카드가 가리키는 목적지.
     *
     * 예전에는 `slug`를 받아 `/news/${slug}`를 조립했는데, `/news` 허브가 3지역
     * 카드(`/news/us` 등)를 렌더하게 되면서 카테고리 slug로 표현되지 않는 목적지가
     * 생겼다. 호출부가 완성된 경로를 넘긴다.
     */
    href: string;
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
 * Server component: hub card linking to `href`.
 *
 * Renders a heading, up to 3 truncated headline previews (or a fallback
 * placeholder when none are available), and a "더보기" deep link with a decorative arrow.
 *
 * No `'use client'` — this is an RSC-safe pure presentation component with
 * no client-side state or browser-only APIs.
 */
export function CategoryCard({
    koLabel,
    href,
    koDescription,
    previewHeadlines,
}: CategoryCardProps) {
    return (
        <article className="flex w-full min-w-0 flex-col overflow-hidden rounded-lg border border-secondary-700 bg-secondary-800 p-5 transition-colors hover:border-primary-500/50">
            {/*
                **제목이 링크다.** 예전에는 아래 `더보기 →`만 링크라, 이 카드가 거는
                내부 링크의 앵커 텍스트가 전부 "더보기"였다 — 목적지가 무엇에 관한
                페이지인지 알려 주는 신호가 0이다. 키워드를 가진 것은 제목이므로
                제목을 링크로 만든다.
            */}
            <h2 className="mb-1 text-base font-semibold tracking-tight text-balance text-secondary-100">
                <Link
                    href={href}
                    // 카드 그리드로 다수 렌더 — docs/architecture/CDN_CACHING.md §1
                    prefetch={false}
                    className="transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {koLabel}
                </Link>
            </h2>
            <p className="mb-3 text-xs leading-relaxed text-secondary-400">
                {koDescription}
            </p>

            {previewHeadlines.length > 0 ? (
                <ul
                    className="mb-4 min-w-0 space-y-2"
                    // `koLabel`이 이미 `…뉴스`로 끝나는 경우가 있어(`미국 시장 뉴스`)
                    // 꼬리표에 `뉴스`를 또 붙이면 `뉴스 최신 뉴스`가 된다.
                    aria-label={`${koLabel} 미리보기`}
                >
                    {previewHeadlines.map(headline => (
                        <li
                            key={headline}
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

            {/*
                같은 목적지로 가는 두 번째 앵커 — 클릭 영역을 넓히는 시각 장치다.
                보조기술에는 숨긴다(`aria-hidden` + `tabIndex={-1}`): 위 제목 링크와
                목적지가 같아서, 그대로 두면 카드마다 같은 링크가 두 번 읽힌다.
            */}
            <Link
                href={href}
                prefetch={false}
                aria-hidden="true"
                tabIndex={-1}
                className="mt-auto text-sm text-primary-400 transition-colors hover:text-primary-300"
            >
                더보기 <span aria-hidden="true">→</span>
            </Link>
        </article>
    );
}

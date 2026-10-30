/**
 * @file `/news`·`/news/us` 허브의 카드 하나 — 제목 링크, 소개, 다이제스트 한 줄,
 * 헤드라인 미리보기, `더보기` 링크.
 */
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { cn } from '@/shared/lib/cn';
import { CardTitleLink } from './ui/card/CardTitleLink';
import { CardMoreLink } from './ui/card/CardMoreLink';
import { PreviewHeadlineList } from './ui/card/PreviewHeadlineList';

/** Props for {@link CategoryCard}. */
export interface CategoryCardProps {
    label: string;
    /**
     * 카드가 가리키는 목적지. 호출부가 완성된 경로를 넘긴다 — `/news` 허브의 지역
     * 카드(`/news/us` 등)처럼 카테고리 slug로 표현되지 않는 목적지가 있다.
     */
    href: string;
    /** One-sentence category intro shown below the heading. Differentiates each card from thin-duplicate content. */
    description: string;
    /**
     * Pre-fetched headline strings for the preview list. The caller is
     * responsible for fetching and passing these — this component does no
     * data fetching, keeping it a pure RSC that renders deterministically.
     * Caller must pass ≤ `PREVIEW_HEADLINE_LIMIT` entries
     * (`utils/previewHeadlines.ts`).
     */
    previewHeadlines: readonly string[];
    /**
     * 그 카테고리 다이제스트의 첫 문장 — **우리가 쓴 문장**이다. 없으면 생략한다.
     *
     * 카드가 제3자 헤드라인만 나열하면 허브가 남의 제목 모음이 된다. 자체 서술을
     * 한 줄 얹어 이 페이지가 스스로 말하는 몫을 갖게 한다.
     */
    digestLine?: string | null;
}

/**
 * Server component: hub card linking to `href`.
 *
 * Renders a linked heading, the description, an optional digest line, up to
 * `PREVIEW_HEADLINE_LIMIT` truncated headline previews (or a fallback line when
 * none remain), and a decorative "더보기" link to the same destination.
 *
 * No `'use client'` — this is an RSC-safe pure presentation component with
 * no client-side state or browser-only APIs.
 */
export function CategoryCard({
    label,
    href,
    description,
    previewHeadlines,
    digestLine = null,
}: CategoryCardProps) {
    return (
        <article
            className={cn(
                SURFACE_CARD,
                'flex w-full min-w-0 flex-col overflow-hidden p-5 transition-colors hover:border-primary-500/50'
            )}
        >
            <CardTitleLink label={label} href={href} />
            <p className="mb-3 text-xs leading-relaxed text-secondary-400">
                {description}
            </p>
            {digestLine !== null && (
                <p className="mb-3 text-sm leading-relaxed text-secondary-300">
                    {digestLine}
                </p>
            )}
            <PreviewHeadlineList label={label} headlines={previewHeadlines} />
            <CardMoreLink href={href} />
        </article>
    );
}

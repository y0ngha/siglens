/** 가이드 목록을 한 줄 그리드로 — 필터가 걸렸거나 분류가 고정된 목록. */
import type { GuideCategory, GuideEntrySummary } from '@/entities/guide/types';
import { GuideCard } from '@/views/guide/ui/GuideCard';
import { GUIDE_GRID } from '@/views/guide/ui/browser/guideGrid';

interface GuideResultGridProps {
    /** 절 제목 id(`aria-labelledby`). */
    readonly headingId: string;
    /** 화면에는 숨기는 절 제목(h2) — 카드 제목 h3가 h2 없이 떠 있지 않게 한다. */
    readonly heading: string;
    readonly entries: readonly GuideEntrySummary[];
    /** 카드마다 분류 라벨을 붙일 때만 넘긴다(분류가 섞인 결과). */
    readonly categoryLabels?: Readonly<Record<GuideCategory, string>>;
}

/** 숨긴 h2 아래 카드 그리드. */
export function GuideResultGrid({
    headingId,
    heading,
    entries,
    categoryLabels,
}: GuideResultGridProps) {
    return (
        <section aria-labelledby={headingId} className="mt-4">
            <h2 id={headingId} className="sr-only">
                {heading}
            </h2>
            <ul className={GUIDE_GRID}>
                {entries.map(entry => (
                    <GuideCard
                        key={entry.slug}
                        entry={entry}
                        categoryLabel={categoryLabels?.[entry.category]}
                    />
                ))}
            </ul>
        </section>
    );
}

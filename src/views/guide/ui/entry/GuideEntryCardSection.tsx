/** 항목 페이지의 카드 목록 절 — "이 항목으로 답하는 질문"과 "같이 보면 좋은 항목"이 같은 모양이다. */
import type { GuideCategory, GuideEntry } from '@/entities/guide/types';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { toGuideSummary } from '@/views/guide/lib/guideBrowse';
import { GuideCard } from '@/views/guide/ui/GuideCard';

interface GuideEntryCardSectionProps {
    /** 페이지 안에서 유일한 제목 id(`aria-labelledby`). */
    readonly headingId: string;
    readonly heading: string;
    readonly entries: readonly GuideEntry[];
    readonly categoryLabels: Readonly<Record<GuideCategory, string>>;
}

/** 제목(h2) + 카드(h3) 그리드. 항목이 없으면 절을 그리지 않는다. */
export function GuideEntryCardSection({
    headingId,
    heading,
    entries,
    categoryLabels,
}: GuideEntryCardSectionProps) {
    if (entries.length === 0) return null;
    return (
        <section aria-labelledby={headingId} className="mt-14">
            <h2 id={headingId} className={HEADING_SECTION}>
                {heading}
            </h2>
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {entries.map(item => (
                    <GuideCard
                        key={item.slug}
                        entry={toGuideSummary(item)}
                        categoryLabel={categoryLabels[item.category]}
                    />
                ))}
            </ul>
        </section>
    );
}

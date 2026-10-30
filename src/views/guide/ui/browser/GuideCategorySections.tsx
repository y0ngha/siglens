/** 필터 없는 가이드 전체 목록 — 분류마다 제목(h2)·전체 보기 링크·카드 그리드. */
import { useTranslations } from 'next-intl';
import type { GuideCategory, GuideEntrySummary } from '@/entities/guide/types';
import { cn } from '@/shared/lib/cn';
import { guideCategoryPath } from '@/shared/lib/guidePaths';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import { groupGuideByCategory } from '@/views/guide/lib/guideBrowse';
import { GuideCard } from '@/views/guide/ui/GuideCard';
import { GUIDE_GRID } from '@/views/guide/ui/browser/guideGrid';

interface GuideCategorySectionsProps {
    /** 절 제목 id의 접두사 — 페이지 안에서 유일해야 한다. */
    readonly idPrefix: string;
    readonly entries: readonly GuideEntrySummary[];
    readonly categoryLabels: Readonly<Record<GuideCategory, string>>;
}

/** `GUIDE_CATEGORIES` 순서로, 항목이 있는 분류만 절을 만든다. 절 안의 카드는 분류가 맥락이라 분류 라벨을 싣지 않는다. */
export function GuideCategorySections({
    idPrefix,
    entries,
    categoryLabels,
}: GuideCategorySectionsProps) {
    const t = useTranslations('views.guide');
    return (
        <div className="mt-6">
            {groupGuideByCategory(entries).map(group => {
                const headingId = `${idPrefix}-${group.category}`;
                const name = categoryLabels[group.category];
                return (
                    <section
                        key={group.category}
                        aria-labelledby={headingId}
                        className="mt-14 first:mt-0"
                    >
                        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-secondary-700 pb-3">
                            <h2 id={headingId} className={HEADING_SECTION}>
                                {name}{' '}
                                <span className="ml-2 text-sm font-normal text-secondary-400 tabular-nums">
                                    {t('entryCount', {
                                        count: group.entries.length,
                                    })}
                                </span>
                            </h2>
                            <LocaleLink
                                href={guideCategoryPath(group.category)}
                                prefetch={false}
                                className="tap-target rounded-sm text-sm text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none motion-reduce:transition-none"
                            >
                                {t('viewAllInCategory', { name })}
                            </LocaleLink>
                        </div>
                        <ul className={cn(GUIDE_GRID, 'mt-5')}>
                            {group.entries.map(entry => (
                                <GuideCard key={entry.slug} entry={entry} />
                            ))}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
}

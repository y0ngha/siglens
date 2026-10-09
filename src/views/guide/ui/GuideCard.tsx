import type { GuideEntrySummary } from '@/entities/guide/types';
import { guideEntryPath } from '@/shared/lib/guidePaths';
import { CARD_LINK_CLASSES } from '@/shared/lib/cardStyles';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION, LABEL_KO } from '@/shared/lib/typographyStyles';
import { ArrowUpRightIcon } from '@/shared/ui/StrokeIcons';
import { LocaleLink } from '@/shared/ui/LocaleLink';

interface GuideCardProps {
    readonly entry: GuideEntrySummary;
    /** 카드 위쪽 분류 라벨. 분류가 이미 맥락인 목록에서는 넘기지 않는다. */
    readonly categoryLabel?: string;
}

/**
 * 가이드 항목 카드 — 카드 전체가 항목 링크다. 제목은 `h3`이고, 둘러싼 목록이 `h2`를 가진다.
 *
 * 90개가 한 화면에 깔리므로 prefetch를 끈다(뷰포트 진입마다 RSC를 90번 예약하지 않는다).
 * 다른 이름은 한 줄로 자르고 요약은 세 줄에서 자른다 — 카드 높이가 그리드 안에서 고르게 유지된다.
 */
export function GuideCard({ entry, categoryLabel }: GuideCardProps) {
    return (
        <li className="flex">
            <LocaleLink
                href={guideEntryPath(entry.category, entry.slug)}
                prefetch={false}
                className={cn(
                    SURFACE_CARD,
                    CARD_LINK_CLASSES,
                    'group w-full p-5'
                )}
            >
                {categoryLabel === undefined ? null : (
                    <span className={cn(LABEL_KO, 'block')}>
                        {categoryLabel}
                    </span>
                )}
                <div
                    className={cn(
                        'flex items-start justify-between gap-3',
                        categoryLabel !== undefined && 'mt-2'
                    )}
                >
                    <h3 className={HEADING_SUBSECTION}>{entry.title}</h3>
                    <ArrowUpRightIcon className="mt-1 size-4 shrink-0 text-secondary-500 transition-colors group-hover:text-primary-400 motion-reduce:transition-none" />
                </div>
                {entry.aliases.length > 0 ? (
                    <p className="mt-1 line-clamp-1 text-xs text-secondary-400">
                        {entry.aliases.join(' · ')}
                    </p>
                ) : null}
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-secondary-300">
                    {entry.summary}
                </p>
            </LocaleLink>
        </li>
    );
}

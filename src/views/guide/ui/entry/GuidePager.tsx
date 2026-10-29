/** 같은 분류 안의 이전·다음 항목 링크 줄. */
import type { GuideEntrySummary } from '@/entities/guide/types';
import { CARD_LINK_CLASSES } from '@/shared/lib/cardStyles';
import { cn } from '@/shared/lib/cn';
import { guideEntryPath } from '@/shared/lib/guidePaths';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import { ArrowRightIcon } from '@/shared/ui/StrokeIcons';

const PAGER_LINK = cn(CARD_LINK_CLASSES, 'group h-full p-4');

interface PagerLinkProps {
    readonly direction: 'previous' | 'next';
    readonly label: string;
    readonly target: GuideEntrySummary;
}

function PagerLink({ direction, label, target }: PagerLinkProps) {
    const isNext = direction === 'next';
    return (
        <LocaleLink
            href={guideEntryPath(target.category, target.slug)}
            prefetch={false}
            className={cn(PAGER_LINK, isNext && 'sm:text-right')}
        >
            <span
                className={cn(
                    'flex items-center gap-1.5 text-xs text-secondary-400',
                    isNext && 'sm:justify-end'
                )}
            >
                {isNext ? null : (
                    <ArrowRightIcon className="size-3.5 rotate-180" />
                )}
                {label}
                {isNext ? <ArrowRightIcon className="size-3.5" /> : null}
            </span>
            <span className="mt-1 block text-sm font-medium text-secondary-100 transition-colors group-hover:text-primary-400 motion-reduce:transition-none">
                {target.title}
            </span>
        </LocaleLink>
    );
}

interface GuidePagerProps {
    /** 내비게이션 랜드마크 이름. */
    readonly label: string;
    readonly previousLabel: string;
    readonly nextLabel: string;
    readonly previous: GuideEntrySummary | null;
    readonly next: GuideEntrySummary | null;
}

/**
 * 이전·다음이 둘 다 없으면 그리지 않는다. 이전만 없으면 빈 칸을 두어 "다음"이 넓은 화면에서
 * 오른쪽 열에 남는다.
 */
export function GuidePager({
    label,
    previousLabel,
    nextLabel,
    previous,
    next,
}: GuidePagerProps) {
    if (previous === null && next === null) return null;
    return (
        <nav
            aria-label={label}
            className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
            {previous === null ? (
                <span aria-hidden className="hidden sm:block" />
            ) : (
                <PagerLink
                    direction="previous"
                    label={previousLabel}
                    target={previous}
                />
            )}
            {next === null ? null : (
                <PagerLink direction="next" label={nextLabel} target={next} />
            )}
        </nav>
    );
}

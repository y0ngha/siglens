/** 항목 페이지 머리 — 분류 링크, 제목(h1), 다른 이름, 요약, 마지막 업데이트. */
import type { GuideEntry } from '@/entities/guide/types';
import { cn } from '@/shared/lib/cn';
import { guideCategoryPath } from '@/shared/lib/guidePaths';
import { LABEL_KO } from '@/shared/lib/typographyStyles';
import { LocaleLink } from '@/shared/ui/LocaleLink';

interface GuideEntryHeaderProps {
    readonly entry: GuideEntry;
    readonly categoryLabel: string;
    /** 다른 이름 목록의 이름표(`dt`). */
    readonly aliasesLabel: string;
    /** "마지막 업데이트 {date}" — 로케일 날짜가 이미 들어간 문구. */
    readonly updatedAtLabel: string;
}

/** 페이지의 유일한 h1을 그린다. */
export function GuideEntryHeader({
    entry,
    categoryLabel,
    aliasesLabel,
    updatedAtLabel,
}: GuideEntryHeaderProps) {
    // howto의 별칭은 검색 전용이다 — 노출하면 용어 항목과 같은 검색어를 화면에 또 적게 된다.
    const showAliases = entry.category !== 'howto' && entry.aliases.length > 0;
    return (
        <header>
            <LocaleLink
                href={guideCategoryPath(entry.category)}
                prefetch={false}
                className={cn(
                    LABEL_KO,
                    'tap-target rounded-sm transition-colors hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none motion-reduce:transition-none'
                )}
            >
                {categoryLabel}
            </LocaleLink>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-secondary-50 sm:text-4xl">
                {entry.title}
            </h1>
            {showAliases ? (
                <dl className="mt-4 flex flex-wrap items-center gap-2">
                    <dt className={LABEL_KO}>{aliasesLabel}</dt>
                    {entry.aliases.map(alias => (
                        <dd
                            key={alias}
                            className="rounded border border-secondary-700 px-2 py-0.5 text-xs text-secondary-300"
                        >
                            {alias}
                        </dd>
                    ))}
                </dl>
            ) : null}
            <p className="mt-5 text-base leading-relaxed text-secondary-300 sm:text-lg">
                {entry.summary}
            </p>
            <p className="mt-4 text-xs text-secondary-500">
                <time dateTime={entry.updatedAt}>{updatedAtLabel}</time>
            </p>
        </header>
    );
}

'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import {
    GUIDE_CATEGORIES,
    type GuideCategory,
    type GuideEntrySummary,
} from '@/entities/guide/types';
import { aiAskUrl } from '@/shared/config/aiHost';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { localePath } from '@/shared/i18n/locales';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { guideCategoryPath } from '@/shared/lib/guidePaths';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import { SearchIcon } from '@/shared/ui/StrokeIcons';
import { useGuideBrowserState } from '../hooks/useGuideBrowserState';
import {
    countByCategory,
    filterGuideEntries,
    GUIDE_FILTER_ALL,
    GUIDE_QUERY_MAX_LENGTH,
    groupGuideByCategory,
    type GuideFilterCategory,
} from '../lib/guideBrowse';
import { GuideCard } from './GuideCard';

interface GuideBrowserProps {
    readonly entries: readonly GuideEntrySummary[];
    readonly categoryLabels: Readonly<Record<GuideCategory, string>>;
    /** 분류 허브에서 분류를 고정한다. 칩은 감추고 목록만 그 분류로 좁힌다. */
    readonly fixedCategory?: GuideCategory;
}

const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

const CHIP_BASE =
    'inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none motion-reduce:transition-none';
const CHIP_IDLE =
    'border-border-control text-secondary-300 hover:bg-secondary-800 hover:text-secondary-100';
const CHIP_ACTIVE = 'border-primary-400 bg-secondary-800 text-primary-400';

interface FilterChip {
    readonly value: GuideFilterCategory;
    readonly label: string;
    readonly count: number;
}

/**
 * 가이드 목록 + 검색 + 분류 칩.
 *
 * **서버가 전체 목록을 이미 그린다** — 이 컴포넌트의 첫 렌더(서버·하이드레이션)는 필터가 없는
 * 전체 목록이라 크롤러가 90개 링크를 HTML에서 본다. 하이드레이션 뒤 URL의 `?q=`·`?c=`가 적용된다
 * (`useGuideBrowserState`). 필터는 메모리의 요약 배열에 `searchGuide`를 돌릴 뿐 네트워크가 없다.
 *
 * 필터가 없으면 분류별 섹션(h2)으로, 있으면 한 줄 그리드로 보여 준다. 어느 쪽이든 카드 제목은 h3다.
 */
export function GuideBrowser({
    entries,
    categoryLabels,
    fixedCategory,
}: GuideBrowserProps) {
    const t = useTranslations('views.guide');
    const locale = useCurrentLocale();
    const searchId = useId();
    const { state, setQuery, setCategory, reset } =
        useGuideBrowserState(fixedCategory);

    const scoped =
        fixedCategory === undefined
            ? entries
            : entries.filter(entry => entry.category === fixedCategory);
    const results = filterGuideEntries(scoped, state);
    const isFiltered =
        state.query.trim() !== '' ||
        (fixedCategory === undefined && state.category !== GUIDE_FILTER_ALL);
    const counts = countByCategory(entries);
    const chips: FilterChip[] = [
        {
            value: GUIDE_FILTER_ALL,
            label: t('filterAll'),
            count: entries.length,
        },
        ...GUIDE_CATEGORIES.map(category => ({
            value: category,
            label: categoryLabels[category],
            count: counts[category],
        })),
    ];

    return (
        <div>
            <div role="search" className="space-y-4">
                <div className="relative">
                    <label htmlFor={searchId} className="sr-only">
                        {t('searchLabel')}
                    </label>
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-secondary-400" />
                    <input
                        id={searchId}
                        type="search"
                        name="q"
                        value={state.query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder={t('searchPlaceholder')}
                        maxLength={GUIDE_QUERY_MAX_LENGTH}
                        autoComplete="off"
                        spellCheck={false}
                        enterKeyHint="search"
                        className="h-12 w-full rounded-lg border border-border-control bg-secondary-950 pr-4 pl-11 text-base text-secondary-50 placeholder:text-secondary-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none sm:text-sm"
                    />
                </div>

                {fixedCategory === undefined ? (
                    <div
                        role="group"
                        aria-label={t('filterLabel')}
                        className="flex flex-wrap gap-2"
                    >
                        {chips.map(chip => {
                            const active = state.category === chip.value;
                            return (
                                <button
                                    key={chip.value}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => setCategory(chip.value)}
                                    className={cn(
                                        CHIP_BASE,
                                        active ? CHIP_ACTIVE : CHIP_IDLE
                                    )}
                                >
                                    {chip.label}
                                    <span
                                        className={cn(
                                            'text-xs tabular-nums',
                                            active
                                                ? 'text-primary-400'
                                                : 'text-secondary-400'
                                        )}
                                    >
                                        {chip.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : null}
            </div>

            {/* 항상 마운트된 상태 영역 — 필터를 바꿔도 결과 개수가 읽힌다. */}
            <p
                role="status"
                aria-live="polite"
                className="mt-5 text-sm text-secondary-400 tabular-nums"
            >
                {t('entryCount', { count: results.length })}
            </p>

            {results.length === 0 ? (
                <div
                    className={cn(
                        SURFACE_CARD,
                        'mt-4 px-6 py-10 text-center sm:py-12'
                    )}
                >
                    <h2 className={HEADING_SECTION}>{t('emptyTitle')}</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-secondary-400">
                        {t('emptyBody')}
                    </p>
                    <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                        <a
                            href={aiAskUrl(
                                localePath(locale, '/'),
                                t('emptyAiQuestion', {
                                    query: state.query.trim(),
                                })
                            )}
                            target="_blank"
                            // 질의마다 다른 `?q=` URL이라 크롤러가 따라가면 색인 가치 없는 URL에 예산을 쓴다.
                            rel="nofollow noopener noreferrer"
                            className={cn(
                                BUTTON_PRIMARY,
                                'min-h-11 px-5 text-sm'
                            )}
                        >
                            {t('emptyAskAi')}
                        </a>
                        <button
                            type="button"
                            onClick={reset}
                            className={cn(
                                BUTTON_OUTLINE,
                                'min-h-11 px-5 text-sm'
                            )}
                        >
                            {t('emptyReset')}
                        </button>
                    </div>
                </div>
            ) : isFiltered || fixedCategory !== undefined ? (
                <section
                    aria-labelledby={`${searchId}-results`}
                    className="mt-4"
                >
                    <h2 id={`${searchId}-results`} className="sr-only">
                        {fixedCategory === undefined
                            ? t('resultsHeading')
                            : categoryLabels[fixedCategory]}
                    </h2>
                    <ul className={GRID}>
                        {results.map(entry => (
                            <GuideCard
                                key={entry.slug}
                                entry={entry}
                                categoryLabel={
                                    fixedCategory === undefined
                                        ? categoryLabels[entry.category]
                                        : undefined
                                }
                            />
                        ))}
                    </ul>
                </section>
            ) : (
                <div className="mt-6">
                    {groupGuideByCategory(results).map(group => {
                        const headingId = `${searchId}-${group.category}`;
                        return (
                            <section
                                key={group.category}
                                aria-labelledby={headingId}
                                className="mt-14 first:mt-0"
                            >
                                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-secondary-700 pb-3">
                                    <h2
                                        id={headingId}
                                        className={HEADING_SECTION}
                                    >
                                        {categoryLabels[group.category]}
                                        <span className="ml-2 text-sm font-normal text-secondary-400 tabular-nums">
                                            {group.entries.length}
                                        </span>
                                    </h2>
                                    <LocaleLink
                                        href={guideCategoryPath(group.category)}
                                        prefetch={false}
                                        className="tap-target rounded-sm text-sm text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none motion-reduce:transition-none"
                                    >
                                        {t('viewAllInCategory', {
                                            name: categoryLabels[
                                                group.category
                                            ],
                                        })}
                                    </LocaleLink>
                                </div>
                                <ul className={cn(GRID, 'mt-5')}>
                                    {group.entries.map(entry => (
                                        <GuideCard
                                            key={entry.slug}
                                            entry={entry}
                                        />
                                    ))}
                                </ul>
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

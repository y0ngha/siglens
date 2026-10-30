'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { GuideCategory, GuideEntrySummary } from '@/entities/guide/types';
import { SearchIcon } from '@/shared/ui/StrokeIcons';
import { useGuideBrowserState } from '../hooks/useGuideBrowserState';
import {
    buildGuideFilterChips,
    filterGuideEntries,
    GUIDE_QUERY_MAX_LENGTH,
    guideListLayout,
    isGuideFilterActive,
} from '../lib/guideBrowse';
import { GuideCategorySections } from './browser/GuideCategorySections';
import { GuideEmptyResults } from './browser/GuideEmptyResults';
import { GuideFilterChips } from './browser/GuideFilterChips';
import { GuideResultGrid } from './browser/GuideResultGrid';

interface GuideBrowserProps {
    readonly entries: readonly GuideEntrySummary[];
    readonly categoryLabels: Readonly<Record<GuideCategory, string>>;
    /** 분류 허브에서 분류를 고정한다. 칩은 감추고 목록만 그 분류로 좁힌다. */
    readonly fixedCategory?: GuideCategory;
}

/**
 * 허브와 분류 허브가 함께 쓰는 가이드 목록 + 검색 + 분류 칩.
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
    const searchId = useId();
    const { state, setQuery, setCategory, reset } =
        useGuideBrowserState(fixedCategory);

    const scoped =
        fixedCategory === undefined
            ? entries
            : entries.filter(entry => entry.category === fixedCategory);
    const results = filterGuideEntries(scoped, state);
    const layout = guideListLayout(
        results.length,
        isGuideFilterActive(state, fixedCategory),
        fixedCategory
    );
    const resultsHeading =
        fixedCategory === undefined
            ? t('resultsHeading')
            : t('categoryListHeading', { name: categoryLabels[fixedCategory] });

    return (
        <div>
            {/* <search> 요소는 지원 하한(Chrome 109, iOS 15)에서 미지원이라 알 수 없는 요소로 취급되어 role 의미와 블록 표시를 잃는다. */}
            {/* react-doctor-disable-next-line react-doctor/prefer-tag-over-role */}
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
                    <GuideFilterChips
                        chips={buildGuideFilterChips(
                            entries,
                            categoryLabels,
                            t('filterAll')
                        )}
                        selected={state.category}
                        onSelect={setCategory}
                    />
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

            {layout === 'empty' ? (
                <GuideEmptyResults query={state.query} onReset={reset} />
            ) : null}
            {layout === 'flat' ? (
                <GuideResultGrid
                    headingId={`${searchId}-results`}
                    heading={resultsHeading}
                    entries={results}
                    categoryLabels={
                        fixedCategory === undefined ? categoryLabels : undefined
                    }
                />
            ) : null}
            {layout === 'grouped' ? (
                <GuideCategorySections
                    idPrefix={searchId}
                    entries={results}
                    categoryLabels={categoryLabels}
                />
            ) : null}
        </div>
    );
}

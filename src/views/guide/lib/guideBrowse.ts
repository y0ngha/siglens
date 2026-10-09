import {
    GUIDE_CATEGORIES,
    type GuideCategory,
    type GuideEntry,
    type GuideEntrySummary,
} from '@/entities/guide/types';
import { searchGuide } from '@/shared/lib/guideSearch';

/** 분류 칩의 "전체". 카테고리 값이 아니라 필터 해제를 뜻한다. */
export const GUIDE_FILTER_ALL = 'all';

export type GuideFilterCategory = GuideCategory | typeof GUIDE_FILTER_ALL;

export interface GuideBrowseState {
    readonly query: string;
    readonly category: GuideFilterCategory;
}

export const GUIDE_QUERY_PARAM = 'q';
export const GUIDE_CATEGORY_PARAM = 'c';

/** 검색창에 넣을 수 있는 최대 길이. URL에 그대로 실리므로 상한을 둔다. */
export const GUIDE_QUERY_MAX_LENGTH = 60;

export function parseGuideCategory(
    value: string | null | undefined
): GuideCategory | null {
    return GUIDE_CATEGORIES.find(category => category === value) ?? null;
}

/** URL 값 → 필터 상태. 알 수 없는 분류는 "전체"로, 질의는 상한에서 자른다. */
export function parseGuideBrowseState(
    query: string | null,
    category: string | null
): GuideBrowseState {
    return {
        query: (query ?? '').slice(0, GUIDE_QUERY_MAX_LENGTH),
        category: parseGuideCategory(category) ?? GUIDE_FILTER_ALL,
    };
}

/**
 * 필터 상태 → 쿼리스트링(`?`는 붙이지 않는다). 기본값(빈 질의·전체)은 싣지 않아
 * 필터를 풀면 URL이 원래 모양으로 돌아온다.
 */
export function toGuideSearchString({
    query,
    category,
}: GuideBrowseState): string {
    const params = new URLSearchParams();
    if (query.trim() !== '') params.set(GUIDE_QUERY_PARAM, query);
    if (category !== GUIDE_FILTER_ALL)
        params.set(GUIDE_CATEGORY_PARAM, category);
    return params.toString();
}

/** 화면과 클라이언트 경계에 필요한 필드만 남긴다(본문·FAQ는 직렬화하지 않는다). */
export function toGuideSummary(entry: GuideEntrySummary): GuideEntrySummary {
    return {
        slug: entry.slug,
        category: entry.category,
        order: entry.order,
        title: entry.title,
        aliases: entry.aliases,
        summary: entry.summary,
        updatedAt: entry.updatedAt,
    };
}

/**
 * 분류 → 질의 순으로 거른다. 질의가 비어 있으면 카탈로그 순서를 지키고, 있으면
 * `searchGuide`의 순위(이름 일치 > 요약 일치)로 정렬한다.
 */
export function filterGuideEntries<T extends GuideEntrySummary>(
    entries: readonly T[],
    { query, category }: GuideBrowseState
): T[] {
    const inCategory =
        category === GUIDE_FILTER_ALL
            ? [...entries]
            : entries.filter(entry => entry.category === category);
    return query.trim() === ''
        ? inCategory
        : searchGuide(inCategory, query, inCategory.length);
}

export interface GuideCategoryGroup<T extends GuideEntrySummary> {
    readonly category: GuideCategory;
    readonly entries: readonly T[];
}

/** `GUIDE_CATEGORIES` 순서로 묶는다. 항목이 없는 분류는 빼 빈 제목이 남지 않게 한다. */
export function groupGuideByCategory<T extends GuideEntrySummary>(
    entries: readonly T[]
): GuideCategoryGroup<T>[] {
    return GUIDE_CATEGORIES.map(category => ({
        category,
        entries: entries.filter(entry => entry.category === category),
    })).filter(group => group.entries.length > 0);
}

export function countByCategory(
    entries: readonly GuideEntrySummary[]
): Record<GuideCategory, number> {
    return {
        candlesticks: entries.filter(e => e.category === 'candlesticks').length,
        'chart-patterns': entries.filter(e => e.category === 'chart-patterns')
            .length,
        indicators: entries.filter(e => e.category === 'indicators').length,
        strategies: entries.filter(e => e.category === 'strategies').length,
    };
}

export interface GuideNeighbors {
    readonly previous: GuideEntrySummary | null;
    readonly next: GuideEntrySummary | null;
}

/** 같은 분류 안에서 카탈로그 순서상 앞·뒤 항목. 분류의 처음/끝은 `null`이다. */
export function guideNeighbors(
    entries: readonly GuideEntrySummary[],
    entry: GuideEntrySummary
): GuideNeighbors {
    const siblings = entries.filter(e => e.category === entry.category);
    const index = siblings.findIndex(e => e.slug === entry.slug);
    if (index === -1) return { previous: null, next: null };
    return {
        previous: siblings[index - 1] ?? null,
        next: siblings[index + 1] ?? null,
    };
}

/** `related` slug 목록 → 존재하는 항목만, 적힌 순서대로. 자기 자신은 뺀다. */
export function resolveRelated(
    entries: readonly GuideEntry[],
    entry: GuideEntry
): GuideEntry[] {
    const bySlug = new Map(entries.map(e => [e.slug, e]));
    return entry.related.flatMap(slug => {
        const related = bySlug.get(slug);
        return related !== undefined && related.slug !== entry.slug
            ? [related]
            : [];
    });
}

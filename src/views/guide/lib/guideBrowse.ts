/** 가이드 목록의 검색·분류 필터와 항목 간 관계(이전·다음·관련·역참조) — 순수 함수. */
import {
    GUIDE_CATEGORIES,
    isGuideCategory,
    type GuideCategory,
    type GuideEntry,
    type GuideEntrySummary,
} from '@/entities/guide/types';
import { termsFirst } from '@/entities/guide/lib/termsFirst';
import { searchGuide } from '@/shared/lib/guideSearch';

/** 분류 칩의 "전체". 카테고리 값이 아니라 필터 해제를 뜻한다. */
export const GUIDE_FILTER_ALL = 'all';

/** 분류 칩 값 — 분류 하나 또는 "전체". */
export type GuideFilterCategory = GuideCategory | typeof GUIDE_FILTER_ALL;

/** 검색창 질의와 고른 분류. URL `?q=`·`?c=`와 맞물린다. */
export interface GuideBrowseState {
    readonly query: string;
    readonly category: GuideFilterCategory;
}

/**
 * 검색 질의의 URL 파라미터 이름. 읽기(`useGuideBrowserState`)와 쓰기(`toGuideSearchString`)가 한 상수를 봐야
 * 공유한 링크·뒤로 가기에서 필터가 되살아난다. 이름을 바꾸면 이미 퍼진 `?q=` 링크는 필터 없이 열린다.
 */
export const GUIDE_QUERY_PARAM = 'q';
/** 고른 분류의 URL 파라미터 이름. 분류 허브는 분류가 경로에 있어 이 파라미터를 읽지도 쓰지도 않는다. */
export const GUIDE_CATEGORY_PARAM = 'c';

/** 검색창에 넣을 수 있는 최대 길이. URL에 그대로 실리므로 상한을 둔다. */
export const GUIDE_QUERY_MAX_LENGTH = 60;

/** URL 값 → 필터 상태. 알 수 없는 분류는 "전체"로, 질의는 상한에서 자른다. */
export function parseGuideBrowseState(
    query: string | null,
    category: string | null
): GuideBrowseState {
    return {
        query: (query ?? '').slice(0, GUIDE_QUERY_MAX_LENGTH),
        category: isGuideCategory(category) ? category : GUIDE_FILTER_ALL,
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
        about: entry.about,
        signals: entry.signals,
        demoFrom: entry.demoFrom,
    };
}

/**
 * 분류 → 질의 순으로 거른다. 질의가 비어 있으면 카탈로그 순서를 지키고, 있으면
 * `searchGuide`의 순위(이름 일치 > 요약 일치)로 정렬한다. 같은 순위에서는 용어 항목이
 * 질문형 글보다 앞이다(`termsFirst`).
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
        : searchGuide(termsFirst(inCategory), query, inCategory.length);
}

/**
 * 필터가 걸려 있는지. 질의가 공백뿐이면 걸리지 않은 것이고, 분류가 고정된 목록(분류 허브)에서는
 * 분류 값이 필터가 아니다.
 */
export function isGuideFilterActive(
    { query, category }: GuideBrowseState,
    fixedCategory: GuideCategory | undefined
): boolean {
    return (
        query.trim() !== '' ||
        (fixedCategory === undefined && category !== GUIDE_FILTER_ALL)
    );
}

/** 목록을 어떤 모양으로 그릴지: 결과 없음 안내, 한 줄 그리드, 분류별 절. */
export type GuideListLayout = 'empty' | 'flat' | 'grouped';

/**
 * 결과가 없으면 `empty`. 필터가 걸렸거나 분류가 고정된 목록은 분류로 다시 나눌 이유가 없어 `flat`,
 * 필터 없는 전체 목록만 분류별 절(`grouped`)이다.
 */
export function guideListLayout(
    resultCount: number,
    filterActive: boolean,
    fixedCategory: GuideCategory | undefined
): GuideListLayout {
    if (resultCount === 0) return 'empty';
    if (filterActive || fixedCategory !== undefined) return 'flat';
    return 'grouped';
}

/** 분류 칩 하나. 표시명·개수를 여기서 정해 `GuideFilterChips`는 계산 없이 버튼으로 그린다. */
export interface GuideFilterChip {
    readonly value: GuideFilterCategory;
    readonly label: string;
    readonly count: number;
}

/** "전체" 칩 + 항목이 있는 분류마다 칩 하나(`GUIDE_CATEGORIES` 순서). 항목이 없는 분류는 "0" 칩을 만들지 않는다(그 분류 허브는 404다). */
export function buildGuideFilterChips(
    entries: readonly GuideEntrySummary[],
    categoryLabels: Readonly<Record<GuideCategory, string>>,
    allLabel: string
): GuideFilterChip[] {
    const counts = countByCategory(entries);
    return [
        { value: GUIDE_FILTER_ALL, label: allLabel, count: entries.length },
        ...GUIDE_CATEGORIES.filter(category => counts[category] > 0).map(
            category => ({
                value: category,
                label: categoryLabels[category],
                count: counts[category],
            })
        ),
    ];
}

/** 분류별 절 하나의 데이터. 요약·전체 항목 어느 쪽이든 묶을 수 있게 항목 타입을 열어 둔다. */
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

/** 분류별 항목 수. 항목이 없는 분류도 0으로 채운다. */
export function countByCategory(
    entries: readonly GuideEntrySummary[]
): Record<GuideCategory, number> {
    return Object.fromEntries(
        GUIDE_CATEGORIES.map(category => [
            category,
            entries.filter(entry => entry.category === category).length,
        ])
    ) as Record<GuideCategory, number>;
}

/** 항목 페이지 페이저(`GuidePager`)의 앞·뒤 칸. 분류의 처음/끝이면 그 칸이 `null`이다. */
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

/**
 * "같이 보면 좋은 항목" — `about`(howto가 다루는 용어 항목)을 먼저, 그다음 `related`.
 * 존재하는 항목만, 적힌 순서대로, 중복·자기 자신은 뺀다.
 */
export function resolveRelated(
    entries: readonly GuideEntry[],
    entry: GuideEntry
): GuideEntry[] {
    const bySlug = new Map(entries.map(e => [e.slug, e]));
    const seen = new Set<string>([entry.slug]);
    return [...entry.about, ...entry.related].flatMap(slug => {
        const related = bySlug.get(slug);
        if (related === undefined || seen.has(slug)) return [];
        seen.add(slug);
        return [related];
    });
}

/**
 * 용어 항목 → 그 항목을 `about`으로 가리키는 howto 글(카탈로그 순서). howto 자신에게는 빈 배열.
 * 역참조라 DB 조회가 없다 — 카탈로그는 이미 메모리에 있다.
 */
export function resolveAnsweredBy(
    entries: readonly GuideEntry[],
    entry: GuideEntry
): GuideEntry[] {
    if (entry.category === 'howto') return [];
    return entries.filter(
        e => e.category === 'howto' && e.about.includes(entry.slug)
    );
}

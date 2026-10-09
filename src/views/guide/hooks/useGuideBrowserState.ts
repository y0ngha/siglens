'use client';

import {
    usePickUntilPopstate,
    useUrlSearchParam,
} from '@/shared/hooks/useUrlSearchParam';
import type { GuideCategory } from '@/entities/guide/types';
import {
    GUIDE_CATEGORY_PARAM,
    GUIDE_QUERY_MAX_LENGTH,
    GUIDE_QUERY_PARAM,
    parseGuideBrowseState,
    toGuideSearchString,
    type GuideBrowseState,
    type GuideFilterCategory,
} from '../lib/guideBrowse';

interface UseGuideBrowserStateReturn {
    readonly state: GuideBrowseState;
    readonly setQuery: (query: string) => void;
    readonly setCategory: (category: GuideFilterCategory) => void;
    readonly reset: () => void;
}

/**
 * 가이드 검색·분류 필터 상태 — `?q=`·`?c=`와 동기화한다.
 *
 * 서버·하이드레이션 렌더는 URL을 읽지 않는다(`useUrlSearchParam`의 서버 스냅샷은 `null`).
 * 그래서 ISR이 굽는 HTML은 모든 방문자에게 같은 전체 목록이고, 하이드레이션 직후 URL 값이
 * 적용된다. 사용자가 고른 값은 로컬 상태가 URL보다 앞서고(`history.replaceState`는 구독자에게
 * 알려지지 않는다), 뒤로/앞으로 가기(`popstate`)가 오면 화면이 URL을 다시 따른다
 * (REACT.md "URL State Rules").
 *
 * `fixedCategory`가 있으면(분류 허브) 분류는 그 값으로 고정하고 `?c=`는 읽지도 쓰지도 않는다.
 */
export function useGuideBrowserState(
    fixedCategory?: GuideCategory
): UseGuideBrowserStateReturn {
    const queryParam = useUrlSearchParam(GUIDE_QUERY_PARAM);
    const categoryParam = useUrlSearchParam(GUIDE_CATEGORY_PARAM);
    const [picked, pick] = usePickUntilPopstate<GuideBrowseState>();

    const fromUrl = parseGuideBrowseState(queryParam, categoryParam);
    const current = picked ?? fromUrl;
    const state: GuideBrowseState =
        fixedCategory === undefined
            ? current
            : { query: current.query, category: fixedCategory };

    const commit = (next: GuideBrowseState): void => {
        pick(next);
        const search = toGuideSearchString(
            fixedCategory === undefined
                ? next
                : { query: next.query, category: 'all' }
        );
        window.history.replaceState(
            null,
            '',
            `${window.location.pathname}${search === '' ? '' : `?${search}`}${window.location.hash}`
        );
    };

    const setQuery = (query: string): void =>
        commit({ ...state, query: query.slice(0, GUIDE_QUERY_MAX_LENGTH) });
    const setCategory = (category: GuideFilterCategory): void =>
        commit({ ...state, category });
    const reset = (): void => commit({ query: '', category: 'all' });

    return { state, setQuery, setCategory, reset };
}

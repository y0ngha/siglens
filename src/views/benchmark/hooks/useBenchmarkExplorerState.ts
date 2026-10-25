'use client';

import {
    usePickUntilPopstate,
    useUrlSearchParam,
} from '@/shared/hooks/useUrlSearchParam';
import type { BenchmarkItem } from '@/entities/benchmark/types';
import {
    BENCHMARK_FILTER_INITIAL,
    BENCHMARK_PARAMS,
    parseBenchmarkFilter,
    parseBenchmarkOpen,
    toBenchmarkSearchString,
    type BenchmarkFilterOptions,
    type BenchmarkFilterState,
} from '../lib/benchmarkFilter';

interface ExplorerUrlState {
    readonly filter: BenchmarkFilterState;
    readonly open: string | null;
}

interface UseBenchmarkExplorerStateReturn extends ExplorerUrlState {
    readonly setFilter: <K extends keyof BenchmarkFilterState>(
        key: K,
        value: BenchmarkFilterState[K]
    ) => void;
    readonly resetFilter: () => void;
    readonly toggleOpen: (qid: string) => void;
}

/**
 * 문항 탐색기의 필터와 펼친 문항 — 쿼리 파라미터와 동기화한다.
 *
 * 서버·하이드레이션 렌더는 URL을 읽지 않는다(`useUrlSearchParam`의 서버 스냅샷은 `null`).
 * 그래서 서버 HTML은 모든 방문자에게 같은 전체 목록이고(크롤러가 보는 것), 하이드레이션
 * 직후 URL 값이 적용된다. 사용자가 고른 값은 로컬 상태가 URL보다 앞서고, 뒤로/앞으로
 * 가기가 오면 화면이 URL을 다시 따른다(`useGuideBrowserState`와 같은 패턴, REACT.md
 * "URL State Rules").
 */
export function useBenchmarkExplorerState(
    items: readonly BenchmarkItem[],
    options: BenchmarkFilterOptions
): UseBenchmarkExplorerStateReturn {
    const level = useUrlSearchParam(BENCHMARK_PARAMS.level);
    const market = useUrlSearchParam(BENCHMARK_PARAMS.market);
    const template = useUrlSearchParam(BENCHMARK_PARAMS.template);
    const pool = useUrlSearchParam(BENCHMARK_PARAMS.pool);
    const target = useUrlSearchParam(BENCHMARK_PARAMS.target);
    const verdict = useUrlSearchParam(BENCHMARK_PARAMS.verdict);
    const openParam = useUrlSearchParam(BENCHMARK_PARAMS.open);
    const [picked, pick] = usePickUntilPopstate<ExplorerUrlState>();

    const params: Readonly<Record<string, string | null>> = {
        [BENCHMARK_PARAMS.level]: level,
        [BENCHMARK_PARAMS.market]: market,
        [BENCHMARK_PARAMS.template]: template,
        [BENCHMARK_PARAMS.pool]: pool,
        [BENCHMARK_PARAMS.target]: target,
        [BENCHMARK_PARAMS.verdict]: verdict,
    };
    const fromUrl: ExplorerUrlState = {
        filter: parseBenchmarkFilter(name => params[name] ?? null, options),
        open: parseBenchmarkOpen(openParam, items),
    };
    const current = picked ?? fromUrl;

    const commit = (next: ExplorerUrlState): void => {
        pick(next);
        const search = toBenchmarkSearchString(next.filter, next.open);
        window.history.replaceState(
            null,
            '',
            `${window.location.pathname}${search === '' ? '' : `?${search}`}${window.location.hash}`
        );
    };

    return {
        ...current,
        setFilter: (key, value) =>
            commit({
                ...current,
                filter: { ...current.filter, [key]: value },
            }),
        resetFilter: () =>
            commit({ filter: BENCHMARK_FILTER_INITIAL, open: current.open }),
        toggleOpen: qid =>
            commit({ ...current, open: current.open === qid ? null : qid }),
    };
}

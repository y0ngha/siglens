/**
 * 문항 탐색기 필터의 순수 로직 — URL 읽기·쓰기, 고를 수 있는 값 모으기, 목록 거르기.
 * 판정 자체는 데이터(`release`)에 이미 있고 여기서는 걸러 보기만 한다.
 */
import {
    BENCHMARK_FILTER_ALL,
    BENCHMARK_LABELS,
    BENCHMARK_LEVELS,
    BENCHMARK_MARKETS,
    type BenchmarkItem,
    type BenchmarkLabel,
    type BenchmarkLevel,
    type BenchmarkMarket,
} from '@/entities/benchmark/types';

type All = typeof BENCHMARK_FILTER_ALL;

/** 쿼리 파라미터 이름. 짧게 둔다 — 공유 링크가 길어지지 않게. */
export const BENCHMARK_PARAMS = {
    level: 'lv',
    market: 'mk',
    template: 'tp',
    pool: 'pl',
    target: 'who',
    verdict: 'res',
    open: 'open',
} as const;

/** 탐색기 필터 값. 각 칸은 고른 값이거나 `all`(필터 없음)이다. */
export interface BenchmarkFilterState {
    readonly level: BenchmarkLevel | All;
    readonly market: BenchmarkMarket | All;
    readonly template: string | All;
    readonly pool: string | All;
    /**
     * 볼 대상. 고르면 그 대상이 답한(제외가 아닌) 문항만 남고, 결과 필터도 그 대상의 판정만 본다.
     * `all`이면 결과 필터는 어느 대상이든 본다.
     */
    readonly target: string | All;
    readonly verdict: BenchmarkLabel | All;
}

/** 아무 필터도 걸리지 않은 상태. 초기화 버튼이 이 값으로 되돌린다. */
export const BENCHMARK_FILTER_INITIAL: BenchmarkFilterState = {
    level: BENCHMARK_FILTER_ALL,
    market: BENCHMARK_FILTER_ALL,
    template: BENCHMARK_FILTER_ALL,
    pool: BENCHMARK_FILTER_ALL,
    target: BENCHMARK_FILTER_ALL,
    verdict: BENCHMARK_FILTER_ALL,
};

/** 필터마다 고를 수 있는 값(목록에 실제로 있는 값만). */
export interface BenchmarkFilterOptions {
    readonly levels: readonly BenchmarkLevel[];
    readonly markets: readonly BenchmarkMarket[];
    readonly templates: readonly string[];
    readonly pools: readonly string[];
    readonly targets: readonly string[];
}

/** 목록에 실제로 있는 값만 고를 수 있게 한다(없는 값으로 빈 표가 나오는 링크를 막는다). */
export function collectBenchmarkFilterOptions(
    items: readonly BenchmarkItem[],
    targetIds: readonly string[]
): BenchmarkFilterOptions {
    const sorted = (values: Iterable<string>): string[] =>
        [...new Set(values)].sort();
    return {
        levels: BENCHMARK_LEVELS.filter(l => items.some(i => i.level === l)),
        markets: BENCHMARK_MARKETS.filter(m => items.some(i => i.market === m)),
        templates: sorted(items.map(i => i.template)),
        pools: sorted(items.map(i => i.pool)),
        targets: targetIds,
    };
}

/**
 * 밖에서 온 문자열(URL·셀렉트 값)을 허용 값으로 좁힌다. 모르는 값은 `all`이다 — 캐스트 없이
 * 필터 타입을 지킨다.
 */
export function pickBenchmarkFilterValue<T extends string>(
    raw: string | null,
    allowed: readonly T[]
): T | All {
    return allowed.find(value => value === raw) ?? BENCHMARK_FILTER_ALL;
}

type ReadParam = (name: string) => string | null;

/** URL에서 필터를 읽는다. 모르는 값은 `all`로 떨어진다. */
export function parseBenchmarkFilter(
    read: ReadParam,
    options: BenchmarkFilterOptions
): BenchmarkFilterState {
    const pick = pickBenchmarkFilterValue;
    return {
        level: pick(read(BENCHMARK_PARAMS.level), options.levels),
        market: pick(read(BENCHMARK_PARAMS.market), options.markets),
        template: pick(read(BENCHMARK_PARAMS.template), options.templates),
        pool: pick(read(BENCHMARK_PARAMS.pool), options.pools),
        target: pick(read(BENCHMARK_PARAMS.target), options.targets),
        verdict: pick(read(BENCHMARK_PARAMS.verdict), BENCHMARK_LABELS),
    };
}

/** 펼친 문항 qid. 목록에 없는 값은 무시한다. */
export function parseBenchmarkOpen(
    raw: string | null,
    items: readonly BenchmarkItem[]
): string | null {
    return raw !== null && items.some(i => i.qid === raw) ? raw : null;
}

/** 필터와 펼친 문항을 쿼리 문자열로(앞의 `?` 없이). 기본값은 싣지 않는다. */
export function toBenchmarkSearchString(
    state: BenchmarkFilterState,
    open: string | null
): string {
    const filters: readonly [string, string][] = [
        [BENCHMARK_PARAMS.level, state.level],
        [BENCHMARK_PARAMS.market, state.market],
        [BENCHMARK_PARAMS.template, state.template],
        [BENCHMARK_PARAMS.pool, state.pool],
        [BENCHMARK_PARAMS.target, state.target],
        [BENCHMARK_PARAMS.verdict, state.verdict],
    ];
    const openEntry: readonly [string, string][] =
        open === null ? [] : [[BENCHMARK_PARAMS.open, open]];
    return new URLSearchParams([
        ...filters.filter(([, value]) => value !== BENCHMARK_FILTER_ALL),
        ...openEntry,
    ]).toString();
}

/** 필터가 하나라도 걸렸는가. */
export function isBenchmarkFilterActive(state: BenchmarkFilterState): boolean {
    return Object.values(state).some(value => value !== BENCHMARK_FILTER_ALL);
}

/**
 * 대상·결과 필터. 대상을 골랐으면 그 대상의 기록만 본다 — 결과가 `all`이면 기록이 있는(제외가
 * 아닌) 문항, 결과를 골랐으면 그 대상의 판정이 같은 문항. 대상이 `all`이면 어느 한 대상이라도
 * 그 판정이면 통과.
 */
function matchesTargetAndVerdict(
    item: BenchmarkItem,
    state: BenchmarkFilterState
): boolean {
    if (state.target !== BENCHMARK_FILTER_ALL) {
        const label = item.results[state.target]?.label;
        return state.verdict === BENCHMARK_FILTER_ALL
            ? label !== undefined && label !== 'excluded'
            : label === state.verdict;
    }
    if (state.verdict === BENCHMARK_FILTER_ALL) return true;
    return Object.values(item.results).some(r => r.label === state.verdict);
}

/** 필터 한 칸이 `all`이거나 문항 값과 같은가. */
function matchesOrAll(filter: string, value: string): boolean {
    return filter === BENCHMARK_FILTER_ALL || filter === value;
}

/** 모든 필터를 통과한 문항(원래 순서). */
export function filterBenchmarkItems(
    items: readonly BenchmarkItem[],
    state: BenchmarkFilterState
): readonly BenchmarkItem[] {
    return items.filter(
        item =>
            matchesOrAll(state.level, item.level) &&
            matchesOrAll(state.market, item.market) &&
            matchesOrAll(state.template, item.template) &&
            matchesOrAll(state.pool, item.pool) &&
            matchesTargetAndVerdict(item, state)
    );
}

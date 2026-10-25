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

export const BENCHMARK_FILTER_INITIAL: BenchmarkFilterState = {
    level: BENCHMARK_FILTER_ALL,
    market: BENCHMARK_FILTER_ALL,
    template: BENCHMARK_FILTER_ALL,
    pool: BENCHMARK_FILTER_ALL,
    target: BENCHMARK_FILTER_ALL,
    verdict: BENCHMARK_FILTER_ALL,
};

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

function pick<T extends string>(
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
    const verdict = pick(read(BENCHMARK_PARAMS.verdict), BENCHMARK_LABELS);
    return {
        level: pick(read(BENCHMARK_PARAMS.level), options.levels),
        market: pick(read(BENCHMARK_PARAMS.market), options.markets),
        template: pick(read(BENCHMARK_PARAMS.template), options.templates),
        pool: pick(read(BENCHMARK_PARAMS.pool), options.pools),
        target: pick(read(BENCHMARK_PARAMS.target), options.targets),
        verdict,
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
    const params = new URLSearchParams();
    const entries: readonly [string, string][] = [
        [BENCHMARK_PARAMS.level, state.level],
        [BENCHMARK_PARAMS.market, state.market],
        [BENCHMARK_PARAMS.template, state.template],
        [BENCHMARK_PARAMS.pool, state.pool],
        [BENCHMARK_PARAMS.target, state.target],
        [BENCHMARK_PARAMS.verdict, state.verdict],
    ];
    for (const [name, value] of entries) {
        if (value !== BENCHMARK_FILTER_ALL) params.set(name, value);
    }
    if (open !== null) params.set(BENCHMARK_PARAMS.open, open);
    return params.toString();
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

export function filterBenchmarkItems(
    items: readonly BenchmarkItem[],
    state: BenchmarkFilterState
): readonly BenchmarkItem[] {
    return items.filter(
        item =>
            (state.level === BENCHMARK_FILTER_ALL ||
                item.level === state.level) &&
            (state.market === BENCHMARK_FILTER_ALL ||
                item.market === state.market) &&
            (state.template === BENCHMARK_FILTER_ALL ||
                item.template === state.template) &&
            (state.pool === BENCHMARK_FILTER_ALL || item.pool === state.pool) &&
            matchesTargetAndVerdict(item, state)
    );
}

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
    /** 결과 필터가 볼 대상. `all`이면 어느 대상이든. */
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
        // 대상은 결과 필터의 범위일 뿐이다 — 결과 없이 대상만 있는 링크는 아무것도 거르지 않으므로 버린다.
        target:
            verdict === BENCHMARK_FILTER_ALL
                ? BENCHMARK_FILTER_ALL
                : pick(read(BENCHMARK_PARAMS.target), options.targets),
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

/**
 * 필터가 하나라도 걸렸는가. `target`은 `verdict`의 범위를 좁힐 뿐 혼자서는 목록을 거르지
 * 않으므로 세지 않는다(대상만 고른 상태에서 "초기화"가 뜨면 눌러도 달라지는 게 없다).
 */
export function isBenchmarkFilterActive(state: BenchmarkFilterState): boolean {
    const { target: _target, ...rest } = state;
    return Object.values(rest).some(value => value !== BENCHMARK_FILTER_ALL);
}

/**
 * 필터 하나를 바꾼 다음 상태. 결과(`verdict`)를 지우면 그 범위인 대상(`target`)도 함께
 * 지운다 — 남겨 두면 보이지 않는 대상 값이 URL에 실려 다음 결과 선택에 끼어든다.
 */
export function applyBenchmarkFilterChange<
    K extends keyof BenchmarkFilterState,
>(
    state: BenchmarkFilterState,
    key: K,
    value: BenchmarkFilterState[K]
): BenchmarkFilterState {
    const next = { ...state, [key]: value };
    return key === 'verdict' && value === BENCHMARK_FILTER_ALL
        ? { ...next, target: BENCHMARK_FILTER_ALL }
        : next;
}

/**
 * 결과 필터: 대상을 골랐으면 그 대상의 판정이, 아니면 어느 한 대상이라도 그 판정이면 통과.
 */
function matchesVerdict(
    item: BenchmarkItem,
    state: BenchmarkFilterState
): boolean {
    if (state.verdict === BENCHMARK_FILTER_ALL) return true;
    if (state.target !== BENCHMARK_FILTER_ALL) {
        return item.results[state.target]?.label === state.verdict;
    }
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
            matchesVerdict(item, state)
    );
}

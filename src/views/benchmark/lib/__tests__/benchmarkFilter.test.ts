import { describe, expect, it } from 'vitest';
import { BENCHMARK_FIXTURE } from '@/entities/benchmark/__tests__/fixtures/benchmarkFixture';
import { BENCHMARK_FILTER_ALL } from '@/entities/benchmark/types';
import {
    BENCHMARK_FILTER_INITIAL,
    collectBenchmarkFilterOptions,
    filterBenchmarkItems,
    isBenchmarkFilterActive,
    parseBenchmarkFilter,
    parseBenchmarkOpen,
    pickBenchmarkFilterValue,
    toBenchmarkSearchString,
    type BenchmarkFilterState,
} from '../benchmarkFilter';

const ITEMS = BENCHMARK_FIXTURE.items;
const TARGET_IDS = BENCHMARK_FIXTURE.targets.map(t => t.id);
const OPTIONS = collectBenchmarkFilterOptions(ITEMS, TARGET_IDS);

function readFrom(query: string) {
    const params = new URLSearchParams(query);
    return (name: string) => params.get(name);
}

function qids(state: Partial<BenchmarkFilterState>): string[] {
    return filterBenchmarkItems(ITEMS, {
        ...BENCHMARK_FILTER_INITIAL,
        ...state,
    }).map(i => i.qid);
}

describe('collectBenchmarkFilterOptions', () => {
    it('lists only values present in the items, levels in difficulty order', () => {
        expect(OPTIONS.levels).toEqual(['L1', 'L2', 'L3', 'L5']);
    });

    it('lists markets, pools and templates that occur, sorted', () => {
        expect(OPTIONS.markets).toEqual(['us', 'kr']);
        expect(OPTIONS.pools).toEqual(['A', 'B']);
        expect(OPTIONS.templates).toEqual([
            'close_price',
            'honesty_probe',
            'spread_calc',
            'volume_rank',
        ]);
    });

    it('passes the target ids through', () => {
        expect(OPTIONS.targets).toEqual(TARGET_IDS);
    });
});

describe('filterBenchmarkItems', () => {
    it('returns everything for the initial state', () => {
        expect(qids({})).toEqual(['q-001', 'q-002', 'q-003', 'q-004']);
    });

    it('filters by level', () => {
        expect(qids({ level: 'L2' })).toEqual(['q-002']);
    });

    it('filters by market', () => {
        expect(qids({ market: 'kr' })).toEqual(['q-002', 'q-004']);
    });

    it('filters by template', () => {
        expect(qids({ template: 'spread_calc' })).toEqual(['q-003']);
    });

    it('filters by pool', () => {
        expect(qids({ pool: 'B' })).toEqual(['q-003']);
    });

    it('combines filters with AND', () => {
        expect(qids({ market: 'kr', pool: 'A', level: 'L5' })).toEqual([
            'q-004',
        ]);
    });

    it('matches a verdict on any target when no target is chosen', () => {
        expect(qids({ verdict: 'excluded' })).toEqual(['q-003']);
    });

    it('matches a verdict on the chosen target only', () => {
        expect(qids({ target: 'gpt', verdict: 'incorrect' })).toEqual([
            'q-001',
            'q-003',
        ]);
    });

    it('keeps only the items the chosen target has a record for', () => {
        expect(qids({ target: 'gemini' })).toEqual(['q-001', 'q-002', 'q-004']);
        expect(qids({ target: 'gpt' })).toHaveLength(4);
    });

    it('returns an empty list when nothing matches', () => {
        expect(qids({ level: 'L1', market: 'kr' })).toEqual([]);
    });
});

describe('parseBenchmarkFilter', () => {
    it('reads known values', () => {
        expect(
            parseBenchmarkFilter(
                readFrom('lv=L2&mk=kr&tp=volume_rank&pl=A&who=gpt&res=correct'),
                OPTIONS
            )
        ).toEqual({
            level: 'L2',
            market: 'kr',
            template: 'volume_rank',
            pool: 'A',
            target: 'gpt',
            verdict: 'correct',
        });
    });

    it('falls back to all for unknown values', () => {
        expect(
            parseBenchmarkFilter(
                readFrom('lv=L4&mk=jp&tp=nope&pl=Z&who=x&res=maybe'),
                OPTIONS
            )
        ).toEqual(BENCHMARK_FILTER_INITIAL);
    });

    it('treats a level absent from the items as unknown', () => {
        expect(parseBenchmarkFilter(readFrom('lv=L4'), OPTIONS).level).toBe(
            BENCHMARK_FILTER_ALL
        );
    });
});

describe('parseBenchmarkOpen', () => {
    it('accepts a qid that exists', () => {
        expect(parseBenchmarkOpen('q-002', ITEMS)).toBe('q-002');
    });

    it('drops a qid that does not exist and null', () => {
        expect(parseBenchmarkOpen('q-999', ITEMS)).toBeNull();
        expect(parseBenchmarkOpen(null, ITEMS)).toBeNull();
    });
});

describe('toBenchmarkSearchString', () => {
    it('is empty for the initial state', () => {
        expect(toBenchmarkSearchString(BENCHMARK_FILTER_INITIAL, null)).toBe(
            ''
        );
    });

    it('writes only non-default values', () => {
        expect(
            toBenchmarkSearchString(
                {
                    ...BENCHMARK_FILTER_INITIAL,
                    level: 'L2',
                    verdict: 'correct',
                },
                'q-002'
            )
        ).toBe('lv=L2&res=correct&open=q-002');
    });

    it('round-trips through parse', () => {
        const state: BenchmarkFilterState = {
            level: 'L5',
            market: 'kr',
            template: 'honesty_probe',
            pool: 'A',
            target: 'siglens',
            verdict: 'correct',
        };
        expect(
            parseBenchmarkFilter(
                readFrom(toBenchmarkSearchString(state, null)),
                OPTIONS
            )
        ).toEqual(state);
    });
});

describe('target without a verdict', () => {
    it('is kept when parsed from the URL', () => {
        expect(parseBenchmarkFilter(readFrom('who=gpt'), OPTIONS).target).toBe(
            'gpt'
        );
    });
});

describe('isBenchmarkFilterActive', () => {
    it('counts a target-only state as active', () => {
        expect(
            isBenchmarkFilterActive({
                ...BENCHMARK_FILTER_INITIAL,
                target: 'gpt',
            })
        ).toBe(true);
    });

    it('is false for the initial state and true once anything is set', () => {
        expect(isBenchmarkFilterActive(BENCHMARK_FILTER_INITIAL)).toBe(false);
        expect(
            isBenchmarkFilterActive({
                ...BENCHMARK_FILTER_INITIAL,
                pool: 'A',
            })
        ).toBe(true);
    });
});

describe('pickBenchmarkFilterValue', () => {
    it('returns an allowed value as is', () => {
        expect(pickBenchmarkFilterValue('kr', OPTIONS.markets)).toBe('kr');
    });

    it('falls back to all for an unknown value or null', () => {
        expect(pickBenchmarkFilterValue('jp', OPTIONS.markets)).toBe(
            BENCHMARK_FILTER_ALL
        );
        expect(pickBenchmarkFilterValue(null, OPTIONS.markets)).toBe(
            BENCHMARK_FILTER_ALL
        );
    });
});

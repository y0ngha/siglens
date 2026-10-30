'use client';

/**
 * 문항 탐색기의 필터 카드 — 항목별 셀렉트, 표시 개수, 초기화 버튼.
 */
import { useId, useRef, type Ref } from 'react';
import { useTranslations } from 'next-intl';
import {
    BENCHMARK_FILTER_ALL,
    BENCHMARK_LABELS,
    type BenchmarkLevel,
    type BenchmarkTarget,
} from '@/entities/benchmark/types';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { NativeSelect } from '@/shared/ui/NativeSelect';
import { useBenchmarkEnumText } from '../../hooks/useBenchmarkEnumText';
import {
    isBenchmarkFilterActive,
    pickBenchmarkFilterValue,
    type BenchmarkFilterOptions,
    type BenchmarkFilterState,
} from '../../lib/benchmarkFilter';

const RESET_BUTTON =
    'inline-flex min-h-10 items-center rounded-lg border border-border-control px-3 text-sm text-secondary-100 hover:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface FilterOption {
    readonly value: string;
    readonly text: string;
}

interface FilterFieldProps {
    readonly label: string;
    readonly value: string;
    readonly onChange: (raw: string) => void;
    readonly options: readonly FilterOption[];
    readonly allText: string;
    readonly selectRef?: Ref<HTMLSelectElement>;
}

/** 라벨이 붙은 셀렉트 하나. 첫 옵션은 항상 "전체"(`all`)다. */
function FilterField({
    label,
    value,
    onChange,
    options,
    allText,
    selectRef,
}: FilterFieldProps) {
    const id = useId();
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <label
                htmlFor={id}
                className="text-xs font-semibold text-secondary-400"
            >
                {label}
            </label>
            <NativeSelect
                id={id}
                ref={selectRef}
                value={value}
                onChange={event => onChange(event.target.value)}
                wrapperClassName="w-full"
            >
                <option value={BENCHMARK_FILTER_ALL}>{allText}</option>
                {options.map(option => (
                    <option key={option.value} value={option.value}>
                        {option.text}
                    </option>
                ))}
            </NativeSelect>
        </div>
    );
}

interface Props {
    readonly filter: BenchmarkFilterState;
    readonly options: BenchmarkFilterOptions;
    readonly targets: readonly BenchmarkTarget[];
    readonly levelNames: Readonly<Record<BenchmarkLevel, string>>;
    readonly shownCount: number;
    readonly totalCount: number;
    readonly onFilterChange: <K extends keyof BenchmarkFilterState>(
        key: K,
        value: BenchmarkFilterState[K]
    ) => void;
    readonly onReset: () => void;
}

/**
 * 필터 카드. 셀렉트 값은 허용 값으로 다시 좁혀서 넘긴다(모르는 값은 `all`).
 * 초기화하면 버튼이 사라지므로 포커스를 첫 셀렉트로 옮긴다 — 그대로 두면 포커스가 `body`로
 * 떨어져 키보드 사용자가 제자리를 잃는다.
 */
export function ExplorerFilters({
    filter,
    options,
    targets,
    levelNames,
    shownCount,
    totalCount,
    onFilterChange,
    onReset,
}: Props) {
    const t = useTranslations('views.benchmark.explorer');
    const enumText = useBenchmarkEnumText();
    const firstSelectRef = useRef<HTMLSelectElement>(null);
    const fields: readonly (Omit<FilterFieldProps, 'allText'> & {
        readonly key: keyof BenchmarkFilterState;
    })[] = [
        {
            key: 'level',
            label: t('filter.level'),
            value: filter.level,
            onChange: raw =>
                onFilterChange(
                    'level',
                    pickBenchmarkFilterValue(raw, options.levels)
                ),
            options: options.levels.map(level => ({
                value: level,
                text: levelNames[level],
            })),
            selectRef: firstSelectRef,
        },
        {
            key: 'market',
            label: t('filter.market'),
            value: filter.market,
            onChange: raw =>
                onFilterChange(
                    'market',
                    pickBenchmarkFilterValue(raw, options.markets)
                ),
            options: options.markets.map(market => ({
                value: market,
                text: enumText.market[market],
            })),
        },
        {
            key: 'template',
            label: t('filter.template'),
            value: filter.template,
            onChange: raw =>
                onFilterChange(
                    'template',
                    pickBenchmarkFilterValue(raw, options.templates)
                ),
            options: options.templates.map(template => ({
                value: template,
                text: template,
            })),
        },
        {
            key: 'pool',
            label: t('filter.pool'),
            value: filter.pool,
            onChange: raw =>
                onFilterChange(
                    'pool',
                    pickBenchmarkFilterValue(raw, options.pools)
                ),
            options: options.pools.map(pool => ({ value: pool, text: pool })),
        },
        {
            key: 'target',
            label: t('filter.target'),
            value: filter.target,
            onChange: raw =>
                onFilterChange(
                    'target',
                    pickBenchmarkFilterValue(raw, options.targets)
                ),
            options: targets.map(target => ({
                value: target.id,
                text: target.label,
            })),
        },
        {
            key: 'verdict',
            label: t('filter.verdict'),
            value: filter.verdict,
            onChange: raw =>
                onFilterChange(
                    'verdict',
                    pickBenchmarkFilterValue(raw, BENCHMARK_LABELS)
                ),
            options: BENCHMARK_LABELS.map(label => ({
                value: label,
                text: enumText.label[label],
            })),
        },
    ];
    const reset = (): void => {
        onReset();
        firstSelectRef.current?.focus();
    };

    return (
        <div className={cn(SURFACE_CARD, 'p-4')}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {fields.map(({ key, ...field }) => (
                    <FilterField
                        key={key}
                        {...field}
                        allText={t('filter.all')}
                    />
                ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div
                    role="status"
                    className="text-sm text-secondary-300 tabular-nums"
                >
                    {t('count', { shown: shownCount, total: totalCount })}
                </div>
                {isBenchmarkFilterActive(filter) ? (
                    <button
                        type="button"
                        className={RESET_BUTTON}
                        onClick={reset}
                    >
                        {t('filter.reset')}
                    </button>
                ) : null}
            </div>
        </div>
    );
}

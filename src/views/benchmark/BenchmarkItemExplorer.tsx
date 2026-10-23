'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import {
    BENCHMARK_FILTER_ALL,
    BENCHMARK_LABELS,
    type BenchmarkItem,
    type BenchmarkLevel,
    type BenchmarkTarget,
} from '@/entities/benchmark/types';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { NativeSelect } from '@/shared/ui/NativeSelect';
import { ChevronDownIcon } from '@/shared/ui/StrokeIcons';
import { useBenchmarkEnumText } from './hooks/useBenchmarkEnumText';
import { useBenchmarkExplorerState } from './hooks/useBenchmarkExplorerState';
import {
    collectBenchmarkFilterOptions,
    filterBenchmarkItems,
    isBenchmarkFilterActive,
    type BenchmarkFilterState,
} from './lib/benchmarkFilter';
import { BenchmarkItemDetailPanel } from './ui/BenchmarkItemDetailPanel';
import { BenchmarkVerdictChip } from './ui/BenchmarkVerdictChip';

interface Props {
    /** 측정 회차 id. 상세 파일 경로에 쓴다. */
    readonly round: string;
    readonly targets: readonly BenchmarkTarget[];
    /** 서버가 release에서 꺼내 넘긴 목록 메타. 이 컴포넌트는 release 모듈을 읽지 않는다. */
    readonly items: readonly BenchmarkItem[];
    /** 표와 같은 수준 이름(예: `L4 해석`). 서버가 번역해 넘긴다. */
    readonly levelNames: Readonly<Record<BenchmarkLevel, string>>;
}

const RESET_BUTTON =
    'inline-flex min-h-10 items-center rounded-lg border border-border-control px-3 text-sm text-secondary-100 hover:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface FilterFieldProps {
    readonly label: string;
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly options: readonly {
        readonly value: string;
        readonly text: string;
    }[];
    readonly allText: string;
    readonly disabled?: boolean;
}

function FilterField({
    label,
    value,
    onChange,
    options,
    allText,
    disabled = false,
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
                value={value}
                disabled={disabled}
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

/**
 * 문항별 탐색기. 목록 메타(질문·정답 요약·대상별 판정)는 props로 받아 서버에서도 그려진다.
 * 행을 펼칠 때만 답변 원문을 정적 JSON으로 받는다. 필터와 펼친 문항은 URL에 반영된다.
 */
export function BenchmarkItemExplorer({
    round,
    targets,
    items,
    levelNames,
}: Props) {
    const t = useTranslations('views.benchmark.explorer');
    const enumText = useBenchmarkEnumText();
    const options = collectBenchmarkFilterOptions(
        items,
        targets.map(target => target.id)
    );
    const { filter, open, setFilter, resetFilter, toggleOpen } =
        useBenchmarkExplorerState(items, options);
    const visible = filterBenchmarkItems(items, filter);
    const targetLabel = (id: string): string =>
        targets.find(target => target.id === id)?.label ?? id;
    const allText = t('filter.all');
    const set =
        <K extends keyof BenchmarkFilterState>(key: K) =>
        (value: string) =>
            setFilter(key, value as BenchmarkFilterState[K]);

    return (
        <div>
            <div className={cn(SURFACE_CARD, 'p-4')}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <FilterField
                        label={t('filter.level')}
                        value={filter.level}
                        onChange={set('level')}
                        allText={allText}
                        options={options.levels.map(level => ({
                            value: level,
                            text: levelNames[level],
                        }))}
                    />
                    <FilterField
                        label={t('filter.market')}
                        value={filter.market}
                        onChange={set('market')}
                        allText={allText}
                        options={options.markets.map(market => ({
                            value: market,
                            text: enumText.market[market],
                        }))}
                    />
                    <FilterField
                        label={t('filter.template')}
                        value={filter.template}
                        onChange={set('template')}
                        allText={allText}
                        options={options.templates.map(template => ({
                            value: template,
                            text: template,
                        }))}
                    />
                    <FilterField
                        label={t('filter.pool')}
                        value={filter.pool}
                        onChange={set('pool')}
                        allText={allText}
                        options={options.pools.map(pool => ({
                            value: pool,
                            text: pool,
                        }))}
                    />
                    <FilterField
                        label={t('filter.target')}
                        value={filter.target}
                        onChange={set('target')}
                        // 대상은 결과 필터의 범위라, 결과를 고르기 전에는 아무것도 거르지 않는다.
                        disabled={filter.verdict === BENCHMARK_FILTER_ALL}
                        allText={allText}
                        options={targets.map(target => ({
                            value: target.id,
                            text: target.label,
                        }))}
                    />
                    <FilterField
                        label={t('filter.verdict')}
                        value={filter.verdict}
                        onChange={set('verdict')}
                        allText={allText}
                        options={BENCHMARK_LABELS.map(label => ({
                            value: label,
                            text: enumText.label[label],
                        }))}
                    />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p
                        role="status"
                        className="text-sm text-secondary-300 tabular-nums"
                    >
                        {t('count', {
                            shown: visible.length,
                            total: items.length,
                        })}
                    </p>
                    {isBenchmarkFilterActive(filter) ? (
                        <button
                            type="button"
                            className={RESET_BUTTON}
                            onClick={resetFilter}
                        >
                            {t('filter.reset')}
                        </button>
                    ) : null}
                </div>
            </div>

            {visible.length === 0 ? (
                <p className="mt-4 text-sm text-secondary-400">{t('empty')}</p>
            ) : (
                <ul className="mt-4 flex flex-col gap-2">
                    {visible.map(item => {
                        const isOpen = open === item.qid;
                        const panelId = `benchmark-item-${item.qid}`;
                        return (
                            <li key={item.qid} className={SURFACE_CARD}>
                                <button
                                    type="button"
                                    aria-expanded={isOpen}
                                    aria-controls={isOpen ? panelId : undefined}
                                    onClick={() => toggleOpen(item.qid)}
                                    className="flex min-h-11 w-full items-start gap-3 rounded-lg p-4 text-left focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap gap-x-2 text-xs text-secondary-400 tabular-nums">
                                            <span>{item.qid}</span>
                                            <span>
                                                {levelNames[item.level]}
                                            </span>
                                            <span>
                                                {enumText.market[item.market]}
                                            </span>
                                            <span>{item.template}</span>
                                            <span>{item.pool}</span>
                                        </span>
                                        <span
                                            lang="ko"
                                            className="mt-1 block text-[15px] leading-6 text-secondary-100"
                                        >
                                            {item.question}
                                        </span>
                                    </span>
                                    <ChevronDownIcon
                                        className={cn(
                                            'mt-1 size-4 shrink-0 text-secondary-400 transition-transform',
                                            isOpen && 'rotate-180'
                                        )}
                                    />
                                </button>
                                <div className="px-4 pb-4">
                                    <p className="text-sm leading-6 text-secondary-300">
                                        <span className="font-semibold text-secondary-200">
                                            {t('truth')}
                                        </span>{' '}
                                        <span lang="ko">
                                            {item.truthSummary}
                                        </span>
                                    </p>
                                    <ul
                                        aria-label={t('results')}
                                        className="mt-2 flex flex-wrap gap-1.5"
                                    >
                                        {targets.map(target => {
                                            const result =
                                                item.results[target.id];
                                            return result ? (
                                                <li key={target.id}>
                                                    <BenchmarkVerdictChip
                                                        label={result.label}
                                                        text={
                                                            enumText.label[
                                                                result.label
                                                            ]
                                                        }
                                                        target={targetLabel(
                                                            target.id
                                                        )}
                                                    />
                                                </li>
                                            ) : null;
                                        })}
                                    </ul>
                                    {isOpen ? (
                                        <div
                                            id={panelId}
                                            className="mt-4 border-t border-secondary-700 pt-4"
                                        >
                                            <BenchmarkItemDetailPanel
                                                round={round}
                                                qid={item.qid}
                                                targets={targets}
                                            />
                                        </div>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

'use client';

/**
 * 문항별 탐색기(클라이언트). 필터 카드와 문항 목록을 묶는다.
 */
import { useTranslations } from 'next-intl';
import {
    BENCHMARK_FILTER_ALL,
    type BenchmarkItem,
    type BenchmarkLevel,
    type BenchmarkTarget,
} from '@/entities/benchmark/types';
import { useBenchmarkExplorerState } from './hooks/useBenchmarkExplorerState';
import {
    collectBenchmarkFilterOptions,
    filterBenchmarkItems,
} from './lib/benchmarkFilter';
import { ExplorerFilters } from './ui/explorer/ExplorerFilters';
import { ExplorerItemRow } from './ui/explorer/ExplorerItemRow';

interface Props {
    /** 측정 회차 id. 상세 파일 경로에 쓴다. */
    readonly round: string;
    readonly targets: readonly BenchmarkTarget[];
    /** 서버가 release에서 꺼내 넘긴 목록 메타. 이 컴포넌트는 release 모듈을 읽지 않는다. */
    readonly items: readonly BenchmarkItem[];
    /** 표와 같은 수준 이름(예: `L4 해석`). 서버가 번역해 넘긴다. */
    readonly levelNames: Readonly<Record<BenchmarkLevel, string>>;
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
    const options = collectBenchmarkFilterOptions(
        items,
        targets.map(target => target.id)
    );
    const { filter, open, setFilter, resetFilter, toggleOpen } =
        useBenchmarkExplorerState(items, options);
    const visible = filterBenchmarkItems(items, filter);
    // 대상을 고르면 목록의 판정 칩도 그 대상 것만 보인다.
    const shownTargets =
        filter.target === BENCHMARK_FILTER_ALL
            ? targets
            : targets.filter(target => target.id === filter.target);

    return (
        <div>
            <ExplorerFilters
                filter={filter}
                options={options}
                targets={targets}
                levelNames={levelNames}
                shownCount={visible.length}
                totalCount={items.length}
                onFilterChange={setFilter}
                onReset={resetFilter}
            />
            {visible.length === 0 ? (
                <p className="mt-4 text-sm text-secondary-400">{t('empty')}</p>
            ) : (
                <ul className="mt-4 flex flex-col gap-2">
                    {visible.map(item => (
                        <ExplorerItemRow
                            key={item.qid}
                            round={round}
                            item={item}
                            targets={targets}
                            shownTargets={shownTargets}
                            levelNames={levelNames}
                            isOpen={open === item.qid}
                            onToggle={toggleOpen}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

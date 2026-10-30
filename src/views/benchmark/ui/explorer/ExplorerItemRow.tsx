'use client';

/**
 * 문항 탐색기 목록의 한 줄 — 펼침 버튼(메타·질문), 정답 요약, 대상별 판정 칩, 펼친 상세.
 */
import { Fragment } from 'react';
import { useTranslations } from 'next-intl';
import type {
    BenchmarkItem,
    BenchmarkLevel,
    BenchmarkTarget,
} from '@/entities/benchmark/types';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { ChevronDownIcon } from '@/shared/ui/StrokeIcons';
import { useBenchmarkEnumText } from '../../hooks/useBenchmarkEnumText';
import { BenchmarkItemDetailPanel } from './BenchmarkItemDetailPanel';
import { BenchmarkVerdictChip } from './BenchmarkVerdictChip';

interface Props {
    readonly round: string;
    readonly item: BenchmarkItem;
    /** 상세 패널이 보여 줄 대상 전체. */
    readonly targets: readonly BenchmarkTarget[];
    /** 판정 칩을 그릴 대상(대상 필터가 걸리면 그 대상만). */
    readonly shownTargets: readonly BenchmarkTarget[];
    readonly levelNames: Readonly<Record<BenchmarkLevel, string>>;
    readonly isOpen: boolean;
    readonly onToggle: (qid: string) => void;
}

/** 펼친 상세 영역의 id. 펼침 버튼의 `aria-controls`가 가리킨다. */
function benchmarkItemPanelId(qid: string): string {
    return `benchmark-item-${qid}`;
}

/**
 * 문항 한 줄. 메타 칸 사이 간격은 CSS(`gap`)뿐이라 텍스트 노드로 공백을 둔다 — 없으면
 * `textContent`(크롤러 스니펫·버튼 이름)가 `q-001L1미국…`처럼 붙는다. flex 컨테이너라
 * 공백 노드는 화면에 그려지지 않는다.
 */
export function ExplorerItemRow({
    round,
    item,
    targets,
    shownTargets,
    levelNames,
    isOpen,
    onToggle,
}: Props) {
    const t = useTranslations('views.benchmark.explorer');
    const enumText = useBenchmarkEnumText();
    const panelId = benchmarkItemPanelId(item.qid);
    const meta = [
        { key: 'qid', text: item.qid },
        { key: 'level', text: levelNames[item.level] },
        { key: 'market', text: enumText.market[item.market] },
        { key: 'template', text: item.template },
        { key: 'pool', text: item.pool },
    ];
    const results = shownTargets.flatMap(target => {
        const result = item.results[target.id];
        return result ? [{ target, label: result.label }] : [];
    });

    return (
        <li className={SURFACE_CARD}>
            <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={isOpen ? panelId : undefined}
                onClick={() => onToggle(item.qid)}
                className="flex min-h-11 w-full items-start gap-3 rounded-lg p-4 text-left focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap gap-x-2 text-xs text-secondary-400 tabular-nums">
                        {meta.map(({ key, text }, index) => (
                            <Fragment key={key}>
                                {index > 0 ? ' ' : null}
                                <span>{text}</span>
                            </Fragment>
                        ))}
                    </span>{' '}
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
                    <span lang="ko">{item.truthSummary}</span>
                </p>
                <ul
                    aria-label={t('results')}
                    className="mt-2 flex flex-wrap gap-1.5"
                >
                    {results.map(({ target, label }) => (
                        <li key={target.id}>
                            <BenchmarkVerdictChip
                                label={label}
                                text={enumText.label[label]}
                                target={target.label}
                            />
                        </li>
                    ))}
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
}

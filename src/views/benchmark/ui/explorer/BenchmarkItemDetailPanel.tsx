'use client';

/**
 * 펼친 문항의 상세 패널 — 정적 JSON을 받아 오는 동안의 로딩·오류 상태와 대상별 기록.
 */
import { useTranslations } from 'next-intl';
import type { BenchmarkTarget } from '@/entities/benchmark/types';
import { useBenchmarkItemDetail } from '../../hooks/useBenchmarkItemDetail';
import { ItemTargetDetail } from './ItemTargetDetail';

interface Props {
    readonly round: string;
    readonly qid: string;
    readonly targets: readonly BenchmarkTarget[];
}

const RETRY_BUTTON =
    'inline-flex min-h-9 items-center rounded-lg border border-border-control px-3 text-sm text-secondary-100 hover:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/** 펼친 문항의 답변 원문·추출값·심사 결과. 마운트될 때 정적 JSON을 한 번 받는다. */
export function BenchmarkItemDetailPanel({ round, qid, targets }: Props) {
    const t = useTranslations('views.benchmark.explorer.detail');
    const query = useBenchmarkItemDetail(round, qid);

    if (query.isPending) {
        return (
            <div role="status" className="text-sm text-secondary-400">
                {t('loading')}
            </div>
        );
    }
    if (query.isError) {
        return (
            <div role="alert" className="flex flex-col items-start gap-2">
                <p className="text-sm text-ui-danger-text">{t('error')}</p>
                <button
                    type="button"
                    className={RETRY_BUTTON}
                    onClick={() => void query.refetch()}
                >
                    {t('retry')}
                </button>
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-5">
            {targets.map(target => (
                <ItemTargetDetail
                    key={target.id}
                    detail={query.data}
                    target={target}
                />
            ))}
        </div>
    );
}

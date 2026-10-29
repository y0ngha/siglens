'use client';

/**
 * 한 대상에 대한 중립 심사 목록(레벨·심사위원·회차·점수 + 근거).
 */
import { useTranslations } from 'next-intl';
import type { BenchmarkJudgement } from '@/entities/benchmark/types';
import { cn } from '@/shared/lib/cn';
import { formatBenchmarkScore } from '@/shared/lib/benchmarkFormat';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';

interface Props {
    readonly judgements: readonly BenchmarkJudgement[];
}

/** 심사 한 건마다 한 줄. 머리 줄의 `|` 구분자는 읽지 않게 숨기고 공백 텍스트로 끊는다. */
export function JudgementList({ judgements }: Props) {
    const t = useTranslations('views.benchmark.explorer.detail');
    return (
        <ul aria-label={t('judges')} className="flex flex-col gap-2">
            {judgements.map(judgement => (
                <li
                    key={`${judgement.target}-${judgement.level}-${judgement.judge}-${judgement.round}`}
                    className={cn(SURFACE_NESTED, 'p-3 text-sm')}
                >
                    <p className="text-xs font-semibold text-secondary-400">
                        {judgement.level} <span aria-hidden="true">|</span>{' '}
                        <span translate="no">{judgement.judge}</span>{' '}
                        <span aria-hidden="true">|</span>{' '}
                        {t('round', { round: judgement.round })}{' '}
                        <span aria-hidden="true">|</span>{' '}
                        <span className="tabular-nums">
                            {formatBenchmarkScore(judgement.score)}
                        </span>
                    </p>
                    <p lang="ko" className="mt-1 leading-6 text-secondary-200">
                        {judgement.why}
                    </p>
                </li>
            ))}
        </ul>
    );
}

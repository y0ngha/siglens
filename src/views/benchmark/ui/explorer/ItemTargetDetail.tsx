'use client';

/**
 * 펼친 문항에서 대상 하나의 기록 — 회차별 답변 원문, 추출값, 중립 심사.
 */
import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type {
    BenchmarkItemDetail,
    BenchmarkTarget,
} from '@/entities/benchmark/types';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { ExtractedValuesTable } from './ExtractedValuesTable';
import { JudgementList } from './JudgementList';

interface Props {
    readonly detail: BenchmarkItemDetail;
    readonly target: BenchmarkTarget;
}

/**
 * 대상 하나의 구역. 제목은 h3다 — 이 패널은 "문항별 탐색" h2 바로 아래에 놓이고 사이에 다른
 * 제목이 없다.
 */
export function ItemTargetDetail({ detail, target }: Props) {
    const t = useTranslations('views.benchmark.explorer.detail');
    const rounds = detail.targets[target.id] ?? [];
    const judgements = detail.judgements.filter(j => j.target === target.id);
    const headingId = useId();
    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-3">
            <h3
                id={headingId}
                className={cn(HEADING_SUBSECTION, 'text-sm')}
                translate="no"
            >
                {target.label}
            </h3>
            {rounds.length === 0 ? (
                <p className="text-sm text-secondary-400">{t('noRecord')}</p>
            ) : (
                rounds.map(round => (
                    <div
                        key={round.round}
                        className="rounded-lg bg-secondary-900 p-3"
                    >
                        <p className="text-xs font-semibold text-secondary-400">
                            {t('round', { round: round.round })}
                        </p>
                        <p className="mt-2 text-xs text-secondary-400">
                            {t('answer')}
                        </p>
                        <pre
                            lang="ko"
                            className="mt-1 font-sans text-sm leading-6 whitespace-pre-wrap text-secondary-200"
                        >
                            {round.answerText}
                        </pre>
                        {round.extracted.length > 0 ? (
                            <ExtractedValuesTable
                                values={round.extracted}
                                context={`${target.label} ${t('round', { round: round.round })}`}
                            />
                        ) : null}
                    </div>
                ))
            )}
            {judgements.length > 0 ? (
                <JudgementList judgements={judgements} />
            ) : null}
        </section>
    );
}

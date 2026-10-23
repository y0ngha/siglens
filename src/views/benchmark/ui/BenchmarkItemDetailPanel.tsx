'use client';

import { useTranslations } from 'next-intl';
import type {
    BenchmarkItemDetail,
    BenchmarkTarget,
} from '@/entities/benchmark/types';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { useBenchmarkEnumText } from '../hooks/useBenchmarkEnumText';
import { useBenchmarkItemDetail } from '../hooks/useBenchmarkItemDetail';
import { formatBenchmarkScore } from '@/shared/lib/benchmarkFormat';
import { BenchmarkVerdictChip } from './BenchmarkVerdictChip';

interface Props {
    readonly round: string;
    readonly qid: string;
    readonly targets: readonly BenchmarkTarget[];
}

const RETRY_BUTTON =
    'inline-flex min-h-9 items-center rounded-lg border border-border-control px-3 text-sm text-secondary-100 hover:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface BodyProps {
    readonly detail: BenchmarkItemDetail;
    readonly targets: readonly BenchmarkTarget[];
}

function DetailBody({ detail, targets }: BodyProps) {
    const t = useTranslations('views.benchmark.explorer.detail');
    const { label: labelText } = useBenchmarkEnumText();
    return (
        <div className="flex flex-col gap-5">
            {targets.map(target => {
                const rounds = detail.targets[target.id] ?? [];
                const judgements = detail.judgements.filter(
                    j => j.target === target.id
                );
                return (
                    <section
                        key={target.id}
                        aria-label={target.label}
                        className="flex flex-col gap-3"
                    >
                        <h4
                            className={cn(HEADING_SUBSECTION, 'text-sm')}
                            translate="no"
                        >
                            {target.label}
                        </h4>
                        {rounds.length === 0 ? (
                            <p className="text-sm text-secondary-400">
                                {t('noRecord')}
                            </p>
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
                                        <div className="mt-3 overflow-x-auto">
                                            <table className="w-full min-w-[28rem] text-left text-xs">
                                                <caption className="pb-1 text-left text-secondary-400">
                                                    {t('extracted')}
                                                </caption>
                                                <thead>
                                                    <tr className="text-secondary-400">
                                                        <th
                                                            scope="col"
                                                            className="py-1 pr-3 font-semibold"
                                                        >
                                                            {t('part')}
                                                        </th>
                                                        <th
                                                            scope="col"
                                                            className="py-1 pr-3 font-semibold"
                                                        >
                                                            {t('value')}
                                                        </th>
                                                        <th
                                                            scope="col"
                                                            className="py-1 pr-3 font-semibold"
                                                        >
                                                            {t('verdict')}
                                                        </th>
                                                        <th
                                                            scope="col"
                                                            className="py-1 font-semibold"
                                                        >
                                                            {t('reason')}
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-secondary-200">
                                                    {round.extracted.map(
                                                        extracted => (
                                                            <tr
                                                                key={
                                                                    extracted.part
                                                                }
                                                                className="border-t border-secondary-700 align-top"
                                                            >
                                                                <th
                                                                    scope="row"
                                                                    className="py-1.5 pr-3 font-normal"
                                                                    lang="ko"
                                                                >
                                                                    {
                                                                        extracted.part
                                                                    }
                                                                </th>
                                                                <td className="py-1.5 pr-3 tabular-nums">
                                                                    {extracted.value ??
                                                                        '—'}
                                                                </td>
                                                                <td className="py-1.5 pr-3">
                                                                    <BenchmarkVerdictChip
                                                                        label={
                                                                            extracted.verdict
                                                                        }
                                                                        text={
                                                                            labelText[
                                                                                extracted
                                                                                    .verdict
                                                                            ]
                                                                        }
                                                                    />
                                                                </td>
                                                                <td
                                                                    className="py-1.5"
                                                                    lang="ko"
                                                                >
                                                                    {extracted.reason ??
                                                                        '—'}
                                                                </td>
                                                            </tr>
                                                        )
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : null}
                                </div>
                            ))
                        )}
                        {judgements.length > 0 ? (
                            <ul
                                aria-label={t('judges')}
                                className="flex flex-col gap-2"
                            >
                                {judgements.map(judgement => (
                                    <li
                                        key={`${judgement.target}-${judgement.level}-${judgement.judge}-${judgement.round}`}
                                        className="rounded-lg border border-secondary-700 p-3 text-sm"
                                    >
                                        <p className="text-xs font-semibold text-secondary-400">
                                            {judgement.level} ·{' '}
                                            <span translate="no">
                                                {judgement.judge}
                                            </span>{' '}
                                            ·{' '}
                                            {t('round', {
                                                round: judgement.round,
                                            })}{' '}
                                            ·{' '}
                                            <span className="tabular-nums">
                                                {formatBenchmarkScore(
                                                    judgement.score
                                                )}
                                            </span>
                                        </p>
                                        <p
                                            lang="ko"
                                            className="mt-1 leading-6 text-secondary-200"
                                        >
                                            {judgement.why}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </section>
                );
            })}
        </div>
    );
}

/** 펼친 문항의 답변 원문·추출값·심사 결과. 마운트될 때 정적 JSON을 한 번 받는다. */
export function BenchmarkItemDetailPanel({ round, qid, targets }: Props) {
    const t = useTranslations('views.benchmark.explorer.detail');
    const query = useBenchmarkItemDetail(round, qid);

    if (query.isPending) {
        return (
            <p role="status" className="text-sm text-secondary-400">
                {t('loading')}
            </p>
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
    return <DetailBody detail={query.data} targets={targets} />;
}

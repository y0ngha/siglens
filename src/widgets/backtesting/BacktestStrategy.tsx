import { useTranslations } from 'next-intl';
import type { BacktestRunInfo } from '@y0ngha/siglens-core';
import type { BacktestStats } from '@/entities/backtest-case/model';
import { cn } from '@/shared/lib/cn';
import { formatSignedPercent, signColorClass } from '@/shared/lib/priceFormat';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
    LABEL_GROUP,
} from '@/shared/lib/typographyStyles';
import { BACKTEST_RULES, MODEL_DISPLAY_NAME } from './utils/backtestRules';
import { EXIT_PATH_KEY } from './utils/tradeLabels';

interface BacktestStrategyProps {
    run: BacktestRunInfo;
    stats: BacktestStats;
}

const LINK_CLASS =
    'text-primary-400 underline-offset-2 hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * 사용한 전략 설명(기존 방법론 대체). 7단계 설명 → 청산 경로별 결과 → 공개 데이터 링크 순서다.
 * 단계 문구는 단계마다 한 문장 키다(I18-14). 숫자 규칙은 ICU 인자로 넣는다(I18-6).
 */
export function BacktestStrategy({ run, stats }: BacktestStrategyProps) {
    const t = useTranslations('widgets.backtesting.strategy');
    const tPath = useTranslations('widgets.backtesting.exitPath');
    const model = MODEL_DISPLAY_NAME[run.model] ?? run.model;
    const steps = [
        { title: t('step1Title'), body: t('step1', { v0: model }) },
        {
            title: t('step2Title'),
            body: t('step2', {
                v0: BACKTEST_RULES.priorWindowBars,
                v1: BACKTEST_RULES.priorLimit,
            }),
        },
        { title: t('step3Title'), body: t('step3') },
        { title: t('step4Title'), body: t('step4') },
        { title: t('step5Title'), body: t('step5') },
        {
            title: t('step6Title'),
            body: t('step6', { v0: BACKTEST_RULES.sellOffMaxDays }),
        },
        {
            title: t('step7Title'),
            body: t('step7', { v0: BACKTEST_RULES.maxHoldDays }),
        },
    ];

    return (
        <section
            aria-labelledby="backtest-strategy-heading"
            className="page-container py-6"
        >
            <div className={cn(SURFACE_CARD, 'px-4 py-5 sm:px-6')}>
                <h2
                    id="backtest-strategy-heading"
                    className={cn(HEADING_SECTION, 'mb-4')}
                >
                    {t('heading')}
                </h2>
                <ol className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                    {steps.map((step, i) => (
                        <li key={step.title} className="flex gap-3">
                            <span
                                aria-hidden="true"
                                className="mt-0.5 font-mono text-xs text-secondary-500 tabular-nums"
                            >
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            <div>
                                {/* 단계 이름은 목록 항목의 이름표라 제목 태그를 쓰지 않는다 —
                                    소제목(h3)은 아래 표·데이터 묶음에만 둔다. */}
                                <p className={LABEL_GROUP}>{step.title}</p>
                                <p className="mt-1 text-sm leading-relaxed text-pretty text-secondary-400">
                                    {step.body}
                                </p>
                            </div>
                        </li>
                    ))}
                </ol>

                <h3
                    id="backtest-exit-paths-heading"
                    className={cn(HEADING_SUBSECTION, 'mt-6 mb-2')}
                >
                    {t('exitPathsHeading')}
                </h3>
                {/* 좁은 화면에서 표만 가로로 스크롤한다. 키보드로도 스크롤할 수 있게 초점을 받는다. */}
                <div
                    role="region"
                    tabIndex={0}
                    aria-labelledby="backtest-exit-paths-heading"
                    className="-mx-4 overflow-x-auto px-4 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none sm:mx-0 sm:px-0"
                >
                    <table className="w-full min-w-[24rem] text-sm text-secondary-300">
                        <thead className="text-xs text-secondary-400">
                            <tr>
                                <th
                                    scope="col"
                                    className="px-3 py-2 text-left font-medium"
                                >
                                    {t('colPath')}
                                </th>
                                <th
                                    scope="col"
                                    className="px-3 py-2 text-right font-medium"
                                >
                                    {t('colTrades')}
                                </th>
                                <th
                                    scope="col"
                                    className="px-3 py-2 text-right font-medium"
                                >
                                    {t('colMean')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.exitPaths.map(row => (
                                <tr
                                    key={row.path}
                                    className="border-t border-secondary-700/60"
                                >
                                    <th
                                        scope="row"
                                        className="px-3 py-2 text-left font-normal"
                                    >
                                        {tPath(EXIT_PATH_KEY[row.path])}
                                    </th>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                        {row.trades}
                                    </td>
                                    <td
                                        className={cn(
                                            'px-3 py-2 text-right tabular-nums',
                                            signColorClass(row.meanReturnPct)
                                        )}
                                    >
                                        {formatSignedPercent(
                                            row.meanReturnPct,
                                            2
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h3 className={cn(HEADING_SUBSECTION, 'mt-6 mb-2')}>
                    {t('dataHeading')}
                </h3>
                <ul className="space-y-1 text-sm">
                    <li>
                        <a
                            href={run.resultsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={LINK_CLASS}
                        >
                            {t('dataResults')}
                        </a>
                    </li>
                    <li>
                        <a
                            href={run.releaseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={LINK_CLASS}
                        >
                            {t('dataRelease')}
                        </a>
                    </li>
                </ul>
            </div>
        </section>
    );
}

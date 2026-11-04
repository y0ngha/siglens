import { useTranslations } from 'next-intl';
import type { Trend } from '@y0ngha/siglens-core';
import type { BacktestStats } from '@/entities/backtest-case/model';
import { cn } from '@/shared/lib/cn';
import { formatSignedPercent, signColorClass } from '@/shared/lib/priceFormat';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface BacktestTrendRecognitionProps {
    stats: BacktestStats;
}

const TREND_ORDER: readonly Trend[] = ['bullish', 'bearish', 'neutral'];
const TREND_ROW_KEY = {
    bullish: 'row.bullish',
    bearish: 'row.bearish',
    neutral: 'row.neutral',
} as const satisfies Record<Trend, `row.${Trend}`>;

/**
 * AI가 말한 추세가 지금까지의 실제 흐름과 맞았는지(추세 파악 일치율). 앞으로의 방향을 맞혔는지가
 * 아니다 — 분석의 `trend`는 분석 시점까지의 흐름을 설명하는 값이라, 화면에서도 "현재 추세"로
 * 표기한다(`TrendBadge`의 `asCurrentTrend`).
 */
export function BacktestTrendRecognition({
    stats,
}: BacktestTrendRecognitionProps) {
    const t = useTranslations('widgets.backtesting.trendRecognition');
    const r = stats.trendRecognition;

    return (
        <section
            aria-labelledby="backtest-trend-recognition-heading"
            className="page-container py-6"
        >
            <div className={cn(SURFACE_CARD, 'px-4 py-5 sm:px-6')}>
                <h2
                    id="backtest-trend-recognition-heading"
                    className={cn(HEADING_SECTION, 'mb-2')}
                >
                    {t('heading')}
                </h2>
                <p className="mb-4 text-sm leading-relaxed text-pretty text-secondary-400">
                    {t('note', { v0: r.windowDays })}
                </p>
                <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-3xl font-bold text-primary-400 tabular-nums">
                        {`${r.matchRatePct.toFixed(1)}%`}
                    </span>
                    <span className="text-sm text-secondary-300">
                        {t('matchLabel', { v0: r.directionalCalls })}
                    </span>
                </div>
                <table className="w-full text-sm text-secondary-300">
                    <thead className="text-xs text-secondary-400">
                        <tr>
                            <th
                                scope="col"
                                className="px-3 py-2 text-left font-medium"
                            >
                                {t('colTrend')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-right font-medium"
                            >
                                {t('colCalls')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-right font-medium"
                            >
                                {t('colPriorMean', { v0: r.windowDays })}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-right font-medium"
                            >
                                {t('colPriorUp', { v0: r.windowDays })}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {TREND_ORDER.map(trend => {
                            const row = r.byTrend[trend];
                            return (
                                <tr
                                    key={trend}
                                    className="border-t border-secondary-700/60"
                                >
                                    <th
                                        scope="row"
                                        className="px-3 py-2 text-left font-normal"
                                    >
                                        {t(TREND_ROW_KEY[trend])}
                                    </th>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                        {row.calls}
                                    </td>
                                    <td
                                        className={cn(
                                            'px-3 py-2 text-right tabular-nums',
                                            signColorClass(row.priorMeanPct)
                                        )}
                                    >
                                        {formatSignedPercent(
                                            row.priorMeanPct,
                                            2
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                        {`${row.priorUpRatePct.toFixed(1)}%`}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

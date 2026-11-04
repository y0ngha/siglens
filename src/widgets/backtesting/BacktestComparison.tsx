import { useTranslations } from 'next-intl';
import type { BacktestStats } from '@/entities/backtest-case/model';
import { cn } from '@/shared/lib/cn';
import { formatSignedPercent, signColorClass } from '@/shared/lib/priceFormat';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface BacktestComparisonProps {
    stats: BacktestStats;
}

const CELL = 'px-3 py-2 text-right tabular-nums whitespace-nowrap';
const HEAD_CELL = 'px-3 py-2 text-right font-medium whitespace-nowrap';

const percent = (value: number) => `${value.toFixed(1)}%`;

interface RowProps {
    label: string;
    trades?: number;
    winRate?: number;
    strategyPct?: number;
    strategyMaxDrawdownPct?: number;
    exposurePct?: number;
    buyHoldPct: number;
    buyHoldMaxDrawdownPct?: number;
    emphasis?: boolean;
}

function Row({
    label,
    trades,
    winRate,
    strategyPct,
    strategyMaxDrawdownPct,
    exposurePct,
    buyHoldPct,
    buyHoldMaxDrawdownPct,
    emphasis = false,
}: RowProps) {
    const t = useTranslations('widgets.backtesting.comparison');
    // 값이 없는 칸. 대시만 두면 스크린리더가 기호로 읽으므로 뜻을 함께 싣는다.
    const empty = (
        <>
            <span aria-hidden="true" className="text-secondary-500">
                –
            </span>
            <span className="sr-only">{t('notApplicable')}</span>
        </>
    );
    return (
        <tr
            className={cn(
                'border-t border-secondary-700/60',
                emphasis && 'bg-secondary-700/30 font-semibold'
            )}
        >
            <th
                scope="row"
                translate="no"
                className="px-3 py-2 text-left font-medium whitespace-nowrap text-secondary-200"
            >
                {label}
            </th>
            <td className={CELL}>{trades ?? empty}</td>
            <td className={CELL}>
                {winRate === undefined ? empty : percent(winRate)}
            </td>
            <td
                className={cn(
                    CELL,
                    strategyPct !== undefined && signColorClass(strategyPct)
                )}
            >
                {strategyPct === undefined
                    ? empty
                    : formatSignedPercent(strategyPct)}
            </td>
            <td className={CELL}>
                {strategyMaxDrawdownPct === undefined
                    ? empty
                    : percent(strategyMaxDrawdownPct)}
            </td>
            <td className={CELL}>
                {exposurePct === undefined ? empty : percent(exposurePct)}
            </td>
            <td className={cn(CELL, signColorClass(buyHoldPct))}>
                {formatSignedPercent(buyHoldPct)}
            </td>
            <td className={CELL}>
                {buyHoldMaxDrawdownPct === undefined
                    ? empty
                    : percent(buyHoldMaxDrawdownPct)}
            </td>
        </tr>
    );
}

/**
 * 보유 전략 대비 표. 첫 행은 포트폴리오, 그 아래는 종목별(SPY 포함)이다. 포트폴리오의 보유
 * 수익률은 리밸런싱 없는 균등 분할이라 종목 보유 수익률의 평균과 같다. 보유 포트폴리오의
 * 최대 낙폭은 일별 시세가 있어야 계산되므로 비운다(종목 낙폭의 최악값은 그 값이 아니다).
 * 좁은 화면에서는 표만 가로로 스크롤한다 — 페이지 전체가 가로로 밀리지 않게 래퍼가 막는다.
 */
export function BacktestComparison({ stats }: BacktestComparisonProps) {
    const t = useTranslations('widgets.backtesting.comparison');

    return (
        <section
            aria-labelledby="backtest-comparison-heading"
            className="page-container py-6"
        >
            <div className={cn(SURFACE_CARD, 'px-4 py-5 sm:px-6')}>
                <h2
                    id="backtest-comparison-heading"
                    className={cn(HEADING_SECTION, 'mb-2')}
                >
                    {t('heading')}
                </h2>
                <p className="mb-4 text-sm leading-relaxed text-pretty text-secondary-400">
                    {t('note')}
                </p>
                {/* 좁은 화면에서 표만 가로로 스크롤한다. 키보드로도 스크롤할 수 있게 초점을 받는다. */}
                <div
                    role="region"
                    tabIndex={0}
                    aria-label={t('tableRegion')}
                    className="-mx-4 overflow-x-auto px-4 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none sm:mx-0 sm:px-0"
                >
                    <table className="w-full min-w-[40rem] text-sm text-secondary-300">
                        <thead className="text-xs text-secondary-400">
                            <tr>
                                <th
                                    scope="col"
                                    className="px-3 py-2 text-left font-medium"
                                >
                                    {t('colTicker')}
                                </th>
                                <th scope="col" className={HEAD_CELL}>
                                    {t('colTrades')}
                                </th>
                                <th scope="col" className={HEAD_CELL}>
                                    {t('colWinRate')}
                                </th>
                                <th scope="col" className={HEAD_CELL}>
                                    {t('colStrategy')}
                                </th>
                                <th scope="col" className={HEAD_CELL}>
                                    {t('colStrategyMdd')}
                                </th>
                                <th scope="col" className={HEAD_CELL}>
                                    {t('colExposure')}
                                </th>
                                <th scope="col" className={HEAD_CELL}>
                                    {t('colBuyHold')}
                                </th>
                                <th scope="col" className={HEAD_CELL}>
                                    {t('colBuyHoldMdd')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <Row
                                emphasis
                                label={t('rowPortfolio', {
                                    v0: stats.perTicker.length,
                                })}
                                trades={stats.totalTrades}
                                winRate={stats.winRate}
                                strategyPct={stats.portfolioReturnPct}
                                strategyMaxDrawdownPct={
                                    stats.portfolioMaxDrawdownPct
                                }
                                exposurePct={stats.meanExposurePct}
                                buyHoldPct={stats.buyHoldMeanPct}
                            />
                            {stats.perTicker.map(p => (
                                <Row
                                    key={p.ticker}
                                    label={p.ticker}
                                    trades={p.trades}
                                    winRate={p.winRate}
                                    strategyPct={p.strategyPct}
                                    strategyMaxDrawdownPct={
                                        p.strategyMaxDrawdownPct
                                    }
                                    exposurePct={p.exposurePct}
                                    buyHoldPct={p.buyHoldPct}
                                    buyHoldMaxDrawdownPct={
                                        p.buyHoldMaxDrawdownPct
                                    }
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

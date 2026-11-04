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
    trades: number;
    winRate: number;
    strategyPct: number;
    strategyMaxDrawdownPct: number;
    exposurePct: number;
    emphasis?: boolean;
}

function Row({
    label,
    trades,
    winRate,
    strategyPct,
    strategyMaxDrawdownPct,
    exposurePct,
    emphasis = false,
}: RowProps) {
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
            <td className={CELL}>{trades}</td>
            <td className={CELL}>{percent(winRate)}</td>
            <td className={cn(CELL, signColorClass(strategyPct))}>
                {formatSignedPercent(strategyPct)}
            </td>
            <td className={CELL}>{percent(strategyMaxDrawdownPct)}</td>
            <td className={CELL}>{percent(exposurePct)}</td>
        </tr>
    );
}

/**
 * 종목별 결과 표. 첫 행은 포트폴리오, 그 아래는 종목별(SPY 포함)이다. AI 전략의 결과만 싣고
 * 단순 보유와의 비교는 싣지 않는다. 좁은 화면에서는 표만 가로로 스크롤한다 — 페이지 전체가
 * 가로로 밀리지 않게 래퍼가 막는다.
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
                    <table className="w-full min-w-[32rem] text-sm text-secondary-300">
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
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

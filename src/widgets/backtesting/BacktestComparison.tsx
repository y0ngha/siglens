import { useTranslations } from 'next-intl';
import type { BacktestStats } from '@/entities/backtest-case/model';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { percentText, returnColorClass, returnText } from './utils/percentText';

interface BacktestComparisonProps {
    stats: BacktestStats;
}

const CELL = 'px-3 py-2 text-right tabular-nums whitespace-nowrap';
const HEAD_CELL = 'px-3 py-2 text-right font-medium whitespace-nowrap';

interface RowProps {
    label: string;
    trades: number;
    winRate: number;
    strategyPct: number;
    /** 매일 종가로 평가한 AI 전략의 최대 낙폭. */
    strategyMaxDrawdownPct: number;
    exposurePct: number;
    buyHoldPct: number;
    exposureMatchedHoldPct: number;
    buyHoldMaxDrawdownPct: number;
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
    exposureMatchedHoldPct,
    buyHoldMaxDrawdownPct,
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
            <td className={CELL}>{percentText(winRate)}</td>
            <td className={cn(CELL, returnColorClass(strategyPct))}>
                {returnText(strategyPct)}
            </td>
            <td className={CELL}>{percentText(strategyMaxDrawdownPct)}</td>
            <td className={CELL}>{percentText(exposurePct)}</td>
            <td className={cn(CELL, returnColorClass(buyHoldPct))}>
                {returnText(buyHoldPct)}
            </td>
            <td className={cn(CELL, returnColorClass(exposureMatchedHoldPct))}>
                {returnText(exposureMatchedHoldPct)}
            </td>
            <td className={CELL}>{percentText(buyHoldMaxDrawdownPct)}</td>
        </tr>
    );
}

/**
 * 보유 전략과 비교하는 표. 첫 행은 포트폴리오, 그 아래는 종목을 실행 순서대로(수익률로 정렬하지
 * 않는다) 적는다. 모든 행에서 AI 전략의 수익률 옆에 계속 보유한 수익률과 AI 투자 비중만큼만 보유한
 * 수익률이 같은 행에 있다. 낙폭은 모두 매일 종가로 평가한 값이다. 포트폴리오 행의 값은 생성기가
 * 계산한 `stats.benchmarks`를 그대로 쓴다(여기서 다시 계산하지 않는다).
 *
 * 좁은 화면에서는 표만 가로로 스크롤한다 — 페이지 전체가 가로로 밀리지 않게 래퍼가 막는다.
 */
export function BacktestComparison({ stats }: BacktestComparisonProps) {
    const t = useTranslations('widgets.backtesting.comparison');
    const { benchmarks } = stats;

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
                    <table
                        aria-labelledby="backtest-comparison-heading"
                        className="w-full min-w-[56rem] text-sm text-secondary-300"
                    >
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
                                    {t('colMatchedHold')}
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
                                    benchmarks.strategyMarkToMarketMaxDrawdownPct
                                }
                                exposurePct={
                                    benchmarks.exposureMatchedHold.exposurePct
                                }
                                buyHoldPct={benchmarks.holdPortfolio.returnPct}
                                exposureMatchedHoldPct={
                                    benchmarks.exposureMatchedHold.returnPct
                                }
                                buyHoldMaxDrawdownPct={
                                    benchmarks.holdPortfolio.maxDrawdownPct
                                }
                            />
                            {stats.perTicker.map(p => (
                                <Row
                                    key={p.ticker}
                                    label={p.ticker}
                                    trades={p.trades}
                                    winRate={p.winRate}
                                    strategyPct={p.strategyPct}
                                    strategyMaxDrawdownPct={
                                        p.markToMarketMaxDrawdownPct
                                    }
                                    exposurePct={p.exposurePct}
                                    buyHoldPct={p.buyHoldPct}
                                    exposureMatchedHoldPct={
                                        p.exposureMatchedHoldPct
                                    }
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

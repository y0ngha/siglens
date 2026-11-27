import { useTranslations } from 'next-intl';
import type { BacktestStats } from '@/entities/backtest-case/model';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import {
    percentText,
    returnColorClass,
    returnText,
    shareText,
} from '../../utils/percentText';
import { StatCard } from './StatCard';

interface StatGridProps {
    stats: BacktestStats;
}

const MEAN_RETURN_DIGITS = 2;

/**
 * 히어로 통계 6개. 수익률·낙폭·승률 카드는 같은 카드 안에 기준선을 함께 적는다(수익률 옆에 기준선이
 * 없는 표면을 만들지 않는다).
 *
 * - 수익률: 같은 종목을 계속 들고 있었을 때, AI 전략의 투자 비중만큼만 들고 있었을 때.
 * - 낙폭: 매일 종가로 평가한 값이 머리 수치이고, 청산된 매매만으로 그린 값과 계속 보유한 값을
 *   서브라벨에 적는다.
 * - 승률: 승률 자체는 매매 전체 수익률이 0보다 큰 비율이라, 비교 대상이 있는 값은 "처음 세운 1차
 *   목표가가 손절가보다 먼저 닿은 비율"이다. 그 값과 같은 폭을 임의의 날에 둔 값을 함께 적는다.
 *   저장된 첫 번째 절반의 익절 비율(`storedTargetFirstShare`)은 보유 중 재분석으로 가격이 바뀐
 *   값이라 임의의 날과 견줄 수 없어 이 카드에 싣지 않는다. 두 비율의 분모(끝까지 결판난 경기 수)가
 *   서로 달라서(임의의 날은 매매당 최대 3번) 각각 적는다.
 * - 거래당 평균 수익률: 같은 종목을 기간 중 아무 날에나 사서 같은 날수만큼 들고 있었을 때의 평균
 *   (`perTradeExcess.baselineMeanPct`, `same_length_drift`의 평균)과 그와의 차이(`perTradeExcess.meanPct`),
 *   그 95% 범위. 차이만 적으면 무엇과 비교했는지 숫자가 없어, 기준선 값 자체를 같은 문장에 둔다(CS-18).
 *   화면은 통계를 다시 계산하지 않는다 — 기준선도 생성기가 낸 값을 그대로 쓴다.
 */
export function StatGrid({ stats }: StatGridProps) {
    const t = useTranslations('widgets.backtesting.hero');
    const { benchmarks } = stats;

    return (
        <div
            className={cn(
                SURFACE_CARD,
                'grid grid-cols-1 gap-x-8 gap-y-6 px-8 py-6 text-left sm:grid-cols-2 lg:grid-cols-3'
            )}
        >
            <StatCard
                value={returnText(stats.portfolioReturnPct)}
                label={t('portfolioLabel', { v0: stats.perTicker.length })}
                valueClassName={returnColorClass(stats.portfolioReturnPct)}
                subLabel={t('portfolioSub', {
                    v0: stats.perTicker.length,
                    v1: returnText(benchmarks.holdPortfolio.returnPct),
                    v2: percentText(benchmarks.exposureMatchedHold.exposurePct),
                    v3: returnText(benchmarks.exposureMatchedHold.returnPct),
                })}
            />
            <StatCard
                value={percentText(
                    benchmarks.strategyMarkToMarketMaxDrawdownPct
                )}
                label={t('maxDrawdownLabel')}
                valueClassName="text-ui-warning-text"
                subLabel={t('maxDrawdownSub', {
                    v0: percentText(stats.portfolioMaxDrawdownPct),
                    v1: percentText(benchmarks.holdPortfolio.maxDrawdownPct),
                })}
            />
            <StatCard
                value={`${stats.winRate.toFixed(1)}%`}
                label={t('winRateLabel')}
                valueClassName="text-primary-400"
                subLabel={t('winRateSub', {
                    v0: stats.winningTrades,
                    v1: stats.closedTrades,
                    v2: shareText(
                        benchmarks.bracket.initialPlan.targetFirstShare
                    ),
                    v3: benchmarks.bracket.initialPlan.resolvedRaces,
                    v4: shareText(benchmarks.bracket.placebo.targetFirstShare),
                    v5: benchmarks.bracket.placebo.resolvedRaces,
                })}
            />
            <StatCard
                value={t('tradesValue', { v0: stats.totalTrades })}
                label={t('tradesLabel')}
                valueClassName="text-secondary-200"
            />
            <StatCard
                value={returnText(stats.meanReturnPct, MEAN_RETURN_DIGITS)}
                label={t('meanReturnLabel')}
                valueClassName={returnColorClass(
                    stats.meanReturnPct,
                    MEAN_RETURN_DIGITS
                )}
                subLabel={t('meanReturnSub', {
                    v0: returnText(
                        benchmarks.perTradeExcess.meanPct,
                        MEAN_RETURN_DIGITS
                    ),
                    v1: returnText(
                        benchmarks.perTradeExcess.ci95.low,
                        MEAN_RETURN_DIGITS
                    ),
                    v2: returnText(
                        benchmarks.perTradeExcess.ci95.high,
                        MEAN_RETURN_DIGITS
                    ),
                    v3: returnText(
                        benchmarks.perTradeExcess.baselineMeanPct,
                        MEAN_RETURN_DIGITS
                    ),
                })}
            />
            <StatCard
                value={t('tradingDays', {
                    v0: stats.meanHoldingDays.toFixed(1),
                })}
                label={t('meanHoldingLabel')}
                valueClassName="text-secondary-300"
            />
        </div>
    );
}

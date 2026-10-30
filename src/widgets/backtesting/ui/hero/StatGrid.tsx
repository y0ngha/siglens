import { useTranslations } from 'next-intl';
import type { BacktestStats } from '@/entities/backtest-case/model';
import { cn } from '@/shared/lib/cn';
import { formatSignedPercent, signColorClass } from '@/shared/lib/priceFormat';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { StatCard } from './StatCard';

interface StatGridProps {
    stats: BacktestStats;
}

/** 평균 수익률 표시 소수 자릿수. 1자리면 0.36이 0.4로 뭉개진다. */
const MEAN_RETURN_DIGITS = 2;

/**
 * 여섯 지표 그리드.
 *
 * wrap flex가 아니라 **그리드**다. flex는 카드를 내용 폭대로 흘려보내 열이 줄마다 어긋난다.
 * 그리드는 열 폭과 각 셀의 시작선을 고정해 여섯 지표가 표처럼 읽힌다. 구분선(`w-px`)은
 * 두지 않는다 — 대비가 3:1에 한참 못 미쳐 사실상 보이지 않는 장식이다.
 */
export function StatGrid({ stats }: StatGridProps) {
    const t = useTranslations('widgets.backtesting');
    const tHero = useTranslations('widgets.backtesting.hero');

    return (
        <div
            className={cn(
                SURFACE_CARD,
                'grid grid-cols-2 gap-x-8 gap-y-6 px-8 py-6 text-left sm:grid-cols-3 lg:grid-cols-6'
            )}
        >
            <StatCard
                value={`${stats.indicatorWinRate}%`}
                label={t('BacktestHero.394fff')}
                valueClassName="text-ui-success-text"
                subLabel={`${stats.indicatorWins}/${stats.totalCases}`}
            />
            <StatCard
                value={`${stats.aiWinRateDecisive}%`}
                label={t('BacktestHero.5a254c')}
                valueClassName="text-primary-400"
                subLabel={tHero('aiSubLabel', {
                    v0: stats.aiWins,
                    v1: stats.aiDecisiveCount,
                    v2: stats.aiNeutralCount,
                })}
            />
            <StatCard
                value={`${stats.aiTrendHitRate}%`}
                label={t('BacktestHero.aiTrendHitRateLabel')}
                valueClassName="text-secondary-300"
            />
            <StatCard
                value={formatSignedPercent(
                    stats.meanReturnPct,
                    MEAN_RETURN_DIGITS
                )}
                label={t('BacktestHero.meanReturnLabel')}
                valueClassName={signColorClass(stats.meanReturnPct)}
            />
            <StatCard
                value={tHero('caseCount', { v0: stats.totalCases })}
                label={t('BacktestHero.f92294')}
                valueClassName="text-ui-warning-text"
            />
            <StatCard
                value={tHero('medianHoldingDays', {
                    v0: stats.medianHoldingDays,
                })}
                label={t('BacktestHero.medianHoldingDaysLabel')}
                valueClassName="text-secondary-300"
            />
        </div>
    );
}

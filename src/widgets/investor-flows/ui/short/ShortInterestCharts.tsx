/**
 * 공매도 잔고 추이 그래프 — 잔고(또는 유통주식 대비 %)와 상환일수, 두 그래프의 양끝 날짜는 같은 형식이다.
 */
import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import {
    formatCompact,
    formatDecimal,
    formatPercent,
} from '../../utils/flowFormat';
import type {
    ShortInterestBasis,
    ShortInterestChartModel,
} from '../../utils/shortInterestChart';
import { TrendLineChart } from '../charts/TrendLineChart';

/** 잔고 눈금 %의 소수 자리. */
const PCT_LABEL_DIGITS = 1;
/** 상환일수 눈금의 소수 자리. */
const DAYS_LABEL_DIGITS = 1;

interface ShortInterestChartsProps {
    readonly model: ShortInterestChartModel;
    /** 결제일 수 — 스크린리더 요약에 쓴다. */
    readonly pointCount: number;
}

/** 잔고 그래프는 단위(%·주식 수)에 맞는 눈금 포맷을 쓰고, 상환일수 값이 있을 때만 두 번째 그래프를 그린다. */
export function ShortInterestCharts({
    model,
    pointCount,
}: ShortInterestChartsProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const formatInterest: Record<
        ShortInterestBasis,
        (value: number) => string
    > = {
        pctFloat: value => formatPercent(value, locale, PCT_LABEL_DIGITS),
        qty: value => formatCompact(value, locale),
    };
    const interestTitles: Record<ShortInterestBasis, string> = {
        pctFloat: t('short.chartPctFloat'),
        qty: t('short.chartQty'),
    };
    const format = formatInterest[model.basis];
    const { interest, daysToCover } = model;
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <div>
                <p className="mb-1 text-xs font-medium text-secondary-300">
                    {interestTitles[model.basis]}
                </p>
                <TrendLineChart
                    values={interest.values}
                    ariaLabel={t('short.chartAria', { count: pointCount })}
                    maxLabel={format(interest.max)}
                    minLabel={format(interest.min)}
                    startLabel={model.startLabel}
                    endLabel={model.endLabel}
                />
            </div>
            {daysToCover !== null && (
                <div>
                    <p className="mb-1 text-xs font-medium text-secondary-300">
                        {t('short.chartDaysToCover')}
                    </p>
                    <TrendLineChart
                        values={daysToCover.values}
                        ariaLabel={t('short.chartDtcAria', {
                            count: pointCount,
                        })}
                        maxLabel={formatDecimal(
                            daysToCover.max,
                            locale,
                            DAYS_LABEL_DIGITS
                        )}
                        minLabel={formatDecimal(
                            daysToCover.min,
                            locale,
                            DAYS_LABEL_DIGITS
                        )}
                        startLabel={model.startLabel}
                        endLabel={model.endLabel}
                    />
                </div>
            )}
        </div>
    );
}

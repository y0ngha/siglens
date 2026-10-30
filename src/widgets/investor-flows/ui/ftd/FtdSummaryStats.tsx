/**
 * 결제 불이행 요약 카드 묶음 — 최근 수량, 최근 창 최대 수량·날짜, 발행주식 대비 %, 기준선 대비 배수.
 */
import { useTranslations } from 'next-intl';
import type { FailsToDeliverPoint, ShortMetrics } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { ftdPctDigits } from '../../utils/failsToDeliver';
import {
    formatCompact,
    formatDecimal,
    formatSmallPercent,
} from '../../utils/flowFormat';
import { FtdStat } from './FtdStat';

/** 기준선 대비 배수의 소수 자리. */
const MULTIPLE_DIGITS = 1;

interface FtdSummaryStatsProps {
    readonly latest: FailsToDeliverPoint;
    /** 점수표(core) 지표 — 최근 창 최대값의 발행주식 대비 %·기준선 대비 배수는 여기서만 읽는다. */
    readonly metrics: ShortMetrics;
}

/** 결제 불이행 요약 카드 묶음. */
export function FtdSummaryStats({ latest, metrics }: FtdSummaryStatsProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const {
        failsToDeliverPeakQty: peakQty,
        failsToDeliverPeakDate: peakDate,
        failsToDeliverPctOutstanding: pctOutstanding,
        failsToDeliverMultiple: multiple,
    } = metrics;
    return (
        <ul className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <FtdStat
                label={t('ftd.latestQty')}
                value={t('ftd.shares', {
                    shares: formatCompact(latest.failsQty, locale),
                })}
            />
            {peakQty !== null && (
                <FtdStat
                    label={t('ftd.peakQty')}
                    value={t('ftd.shares', {
                        shares: formatCompact(peakQty, locale),
                    })}
                    caption={
                        peakDate === null
                            ? undefined
                            : t('ftd.peakDate', { date: peakDate })
                    }
                />
            )}
            <FtdStat
                label={t('ftd.peakPct')}
                value={
                    pctOutstanding === null
                        ? t('short.unknown')
                        : formatSmallPercent(
                              pctOutstanding,
                              locale,
                              ftdPctDigits(pctOutstanding)
                          )
                }
            />
            <FtdStat
                label={t('ftd.multiple')}
                value={
                    multiple === null
                        ? t('short.unknown')
                        : t('ftd.times', {
                              times: formatDecimal(
                                  multiple,
                                  locale,
                                  MULTIPLE_DIGITS
                              ),
                          })
                }
            />
        </ul>
    );
}

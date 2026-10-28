/**
 * 기준 시점의 SEC 줄 — 결제 불이행, Form 144·증자 공시 창, (Reg SHO 플래그가 켜져 있을 때만) 과열 목록.
 */
import { useTranslations } from 'next-intl';
import type { InvestorFlowsFreshness } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import type { CollectingArms } from '../../utils/collecting';
import { formatInteger } from '../../utils/flowFormat';
import { AsOfRow } from './AsOfRow';

interface SecAsOfRowsProps {
    readonly freshness: InvestorFlowsFreshness;
    /** `REG_SHO_THRESHOLD_DATA_ENABLED` — 켜져 있을 때만 과열 목록 줄을 그린다. */
    readonly regShoEnabled: boolean;
    /** 과열 목록 상태가 반영한 목록 날짜. 아직 받은 목록이 없으면 `null`. */
    readonly thresholdAsOf: string | null;
    readonly collecting: CollectingArms;
}

/** 값이 없을 때는 그 구간이 수집 중이면 "수집 중", 아니면 "데이터 없음" 계열 문구를 쓴다. */
export function SecAsOfRows({
    freshness,
    regShoEnabled,
    thresholdAsOf,
    collecting,
}: SecAsOfRowsProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const collectingLabel = t('asOf.collecting');
    const ftdEmpty = collecting.failsToDeliver
        ? collectingLabel
        : t('asOf.ftdNone');
    const { from, to, days } = freshness.dilutionWindow;
    const filingsWindowText =
        from !== null && to !== null
            ? t('asOf.filingsWindow', {
                  days: formatInteger(days, locale),
                  from,
                  to,
              })
            : t('asOf.filingsNone');
    // 상태가 없을 때: 첫 목록을 모으는 중이면 "수집 중", 아니면(조회 실패·낡은 상태) "데이터 없음" — 공매도 섹션 배지와 같은 판정이다.
    const thresholdEmpty = collecting.thresholdList
        ? collectingLabel
        : t('asOf.thresholdNone');
    const filingsText =
        collecting.offerings || collecting.proposedSales
            ? collectingLabel
            : filingsWindowText;
    return (
        <>
            <AsOfRow term={t('asOf.termFtd')}>
                {freshness.failsToDeliverLatestDate === null
                    ? ftdEmpty
                    : t('asOf.ftdDate', {
                          date: freshness.failsToDeliverLatestDate,
                      })}
            </AsOfRow>
            <AsOfRow term={t('asOf.termFilings')}>{filingsText}</AsOfRow>
            {regShoEnabled && (
                <AsOfRow term={t('asOf.termThreshold')}>
                    {thresholdAsOf === null
                        ? thresholdEmpty
                        : t('asOf.thresholdDate', { date: thresholdAsOf })}
                </AsOfRow>
            )}
        </>
    );
}

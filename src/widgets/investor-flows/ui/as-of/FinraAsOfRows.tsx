/**
 * 기준 시점의 FINRA 줄 — 공매도 잔고 결제일과 일별 비중의 마지막 거래일.
 */
import { useTranslations } from 'next-intl';
import type { InvestorFlowsFreshness } from '@y0ngha/siglens-core';
import type { CollectingArms } from '../../utils/collecting';
import { AsOfRow } from './AsOfRow';

interface FinraAsOfRowsProps {
    readonly freshness: InvestorFlowsFreshness;
    readonly collecting: CollectingArms;
}

/** 부모가 FINRA 블록을 그릴 때만 부른다. 값이 없을 때 수집 중이면 "수집 중"이다. */
export function FinraAsOfRows({ freshness, collecting }: FinraAsOfRowsProps) {
    const t = useTranslations('widgets.investor-flows');
    const collectingLabel = t('asOf.collecting');
    const shortInterestEmpty = collecting.short
        ? collectingLabel
        : t('asOf.shortInterestNone');
    const shortVolumeEmpty = collecting.short
        ? collectingLabel
        : t('asOf.shortVolumeNone');
    return (
        <>
            <AsOfRow term={t('asOf.termShortInterest')}>
                {freshness.shortInterestSettlementDate === null
                    ? shortInterestEmpty
                    : t('asOf.shortInterestDate', {
                          date: freshness.shortInterestSettlementDate,
                      })}
            </AsOfRow>
            <AsOfRow term={t('asOf.termShortVolume')}>
                {freshness.shortVolumeLatestDate === null
                    ? shortVolumeEmpty
                    : t('asOf.shortVolumeDate', {
                          date: freshness.shortVolumeLatestDate,
                      })}
            </AsOfRow>
        </>
    );
}

/**
 * 기준 시점의 기관(13F) 줄 — 가장 최근 완결 분기와, 있다면 그보다 새로 시작된 부분 집계 분기.
 */
import { useTranslations } from 'next-intl';
import type { InvestorFlowsFreshness } from '@y0ngha/siglens-core';
import { FlowTooltip } from '../../investorFlowsTooltips';
import { AsOfRow } from './AsOfRow';

interface InstitutionalAsOfRowProps {
    readonly freshness: InvestorFlowsFreshness;
    /** 13F 초기 수집이 끝나지 않았다 — 점수표에 분기가 남아 있어도(낡은 캐시) 부분 집계 분기를 기준 시점으로 적지 않는다. */
    readonly collecting: boolean;
}

/** 수집 중이거나 기준 분기가 없으면 "수집 중"/"데이터 없음"이다 — 기관 섹션과 같은 판정. */
export function InstitutionalAsOfRow({
    freshness,
    collecting,
}: InstitutionalAsOfRowProps) {
    const t = useTranslations('widgets.investor-flows');
    const scored = freshness.institutionalPeriod;
    const latest = freshness.latestInstitutionalPeriod;
    const partialNewer =
        latest !== null &&
        freshness.latestInstitutionalPeriodComplete === false &&
        latest !== scored;
    const empty = collecting
        ? t('asOf.collecting')
        : t('asOf.institutionalNone');
    return (
        <AsOfRow term={t('asOf.termInstitutional')}>
            {scored === null || collecting ? (
                empty
            ) : (
                <>
                    {t('asOf.institutionalComplete', { period: scored })}
                    {partialNewer && (
                        <span className="block text-secondary-300">
                            {t('asOf.institutionalPartial', { period: latest })}
                            <FlowTooltip term="partialAggregation" />
                        </span>
                    )}
                </>
            )}
        </AsOfRow>
    );
}

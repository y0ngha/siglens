import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { InvestorFlowsScorecard } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { ISO_DATE_LENGTH } from '@/shared/config/time';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { FlowTooltip } from '../investorFlowsTooltips';
import { formatInteger } from '../utils/flowFormat';

const HEADING_ID = 'flows-asof-heading';

interface AsOfNoticeProps {
    readonly freshness: InvestorFlowsScorecard['freshness'];
    /** 스냅샷을 조립한 시각(ISO). 날짜 부분만 쓴다. */
    readonly snapshotAsOf: string;
    /** 공매도(FINRA) 구간을 화면에 그리는지 — 그릴 때만 FINRA 기준일·출처를 적는다. */
    readonly showShort: boolean;
    /** 13F 초기 수집 중 — 기관 행이 "데이터 없음" 대신 "수집 중"이다(데이터가 없을 때만 의미가 있다). */
    readonly institutionalCollecting?: boolean;
    /** FINRA 첫 수집 중 — 공매도 행이 "데이터 없음" 대신 "수집 중"이다. */
    readonly shortCollecting?: boolean;
}

function Row({
    term,
    children,
}: {
    readonly term: string;
    readonly children: ReactNode;
}) {
    return (
        <div className="grid gap-0.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
            <dt className="text-xs text-secondary-400">{term}</dt>
            <dd className="text-sm text-secondary-200">{children}</dd>
        </div>
    );
}

/**
 * 기준 시점·출처 — 이 화면의 모든 숫자가 **언제 기준인지**를 한곳에 모은다(필수 요건).
 *
 * 13F는 분기말 보유를 분기 종료 후 최대 45일 안에 제출하므로 늘 한참 지난 시점의 자료다. 가장 최근 완결 분기와
 * (있다면) 그보다 새로 시작된 "부분 집계" 분기를 나란히 적고, 지연 이유를 한 문단으로 설명한다. 공매도는 결제일과
 * 마지막 거래일을 따로 적는다. FINRA 구간을 그리지 않는 경우(플래그 꺼짐·데이터 없음)에는 FINRA 줄과 출처를 뺀다.
 */
export function AsOfNotice({
    freshness,
    snapshotAsOf,
    showShort,
    institutionalCollecting = false,
    shortCollecting = false,
}: AsOfNoticeProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const scored = freshness.institutionalPeriod;
    const latest = freshness.latestInstitutionalPeriod;
    // "데이터 없음" 자리에 들어갈 문구 — 수집 중이면 세 행 모두 "수집 중"이다.
    const collectingLabel = t('asOf.collecting');
    const institutionalEmpty = institutionalCollecting
        ? collectingLabel
        : t('asOf.institutionalNone');
    const shortInterestEmpty = shortCollecting
        ? collectingLabel
        : t('asOf.shortInterestNone');
    const shortVolumeEmpty = shortCollecting
        ? collectingLabel
        : t('asOf.shortVolumeNone');
    const partialNewer =
        latest !== null &&
        freshness.latestInstitutionalPeriodComplete === false &&
        latest !== scored;
    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'space-y-3 p-6')}
        >
            <h2 id={HEADING_ID} className={HEADING_SECTION}>
                {t('asOf.title')}
            </h2>
            <dl className="space-y-2">
                <Row term={t('asOf.termInstitutional')}>
                    {scored === null ? (
                        institutionalEmpty
                    ) : (
                        <>
                            {t('asOf.institutionalComplete', {
                                period: scored,
                            })}
                            {partialNewer && (
                                <span className="block text-secondary-300">
                                    {t('asOf.institutionalPartial', {
                                        period: latest,
                                    })}
                                    <FlowTooltip term="partialAggregation" />
                                </span>
                            )}
                        </>
                    )}
                </Row>
                <Row term={t('asOf.termInsider')}>
                    {freshness.insiderWindow.from !== null &&
                    freshness.insiderWindow.to !== null
                        ? t('asOf.insiderWindow', {
                              days: formatInteger(
                                  freshness.insiderWindow.days,
                                  locale
                              ),
                              from: freshness.insiderWindow.from,
                              to: freshness.insiderWindow.to,
                          })
                        : t('asOf.insiderNone')}
                </Row>
                {showShort && (
                    <>
                        <Row term={t('asOf.termShortInterest')}>
                            {freshness.shortInterestSettlementDate === null
                                ? shortInterestEmpty
                                : t('asOf.shortInterestDate', {
                                      date: freshness.shortInterestSettlementDate,
                                  })}
                        </Row>
                        <Row term={t('asOf.termShortVolume')}>
                            {freshness.shortVolumeLatestDate === null
                                ? shortVolumeEmpty
                                : t('asOf.shortVolumeDate', {
                                      date: freshness.shortVolumeLatestDate,
                                  })}
                        </Row>
                    </>
                )}
                <Row term={t('asOf.termSnapshot')}>
                    {snapshotAsOf.slice(0, ISO_DATE_LENGTH)}
                </Row>
            </dl>
            <p className="text-xs leading-relaxed text-secondary-300">
                {t('asOf.delay')}
            </p>
            <p className="text-xs leading-relaxed text-secondary-400">
                {showShort ? t('asOf.sourcesWithFinra') : t('asOf.sources')}
            </p>
        </section>
    );
}

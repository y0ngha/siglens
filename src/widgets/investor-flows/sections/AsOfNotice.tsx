import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { InvestorFlowsScorecard } from '@y0ngha/siglens-core';
import type { CollectingArms } from '@/entities/investor-flows/lib/investorFlowsReadiness';
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
    /** FINRA 블록을 화면에 그리는지(데이터가 있거나 첫 수집 중) — 그릴 때만 FINRA 기준일·출처를 적는다. */
    readonly showFinra: boolean;
    /** `REG_SHO_THRESHOLD_DATA_ENABLED` — 켜져 있을 때만 과열 목록 날짜·거래소 출처를 적는다. */
    readonly regShoEnabled: boolean;
    /** 과열 목록 상태가 반영한 목록 날짜. 아직 받은 목록이 없으면 `null`. */
    readonly thresholdAsOf: string | null;
    /** 구간별 "수집 중" — 그 행이 "데이터 없음" 대신 "수집 중"이다(데이터가 없을 때만 참이다). */
    readonly collecting: CollectingArms;
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

type SecRowsProps = Pick<
    AsOfNoticeProps,
    'freshness' | 'regShoEnabled' | 'thresholdAsOf' | 'collecting'
>;

/** SEC 결제 불이행·Form 144·증자 공시 행과(Reg SHO 플래그가 켜져 있을 때만) 과열 목록 행. */
function SecRows({
    freshness,
    regShoEnabled,
    thresholdAsOf,
    collecting,
}: SecRowsProps) {
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
            <Row term={t('asOf.termFtd')}>
                {freshness.failsToDeliverLatestDate === null
                    ? ftdEmpty
                    : t('asOf.ftdDate', {
                          date: freshness.failsToDeliverLatestDate,
                      })}
            </Row>
            <Row term={t('asOf.termFilings')}>{filingsText}</Row>
            {regShoEnabled && (
                <Row term={t('asOf.termThreshold')}>
                    {thresholdAsOf === null
                        ? thresholdEmpty
                        : t('asOf.thresholdDate', { date: thresholdAsOf })}
                </Row>
            )}
        </>
    );
}

/** FINRA 공매도 잔고·일별 비중 행. 부모가 FINRA 블록을 그릴 때만 부른다. */
function FinraRows({
    freshness,
    collecting,
}: Pick<AsOfNoticeProps, 'freshness' | 'collecting'>) {
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
    );
}

/**
 * 기준 시점·출처 — 이 화면의 모든 숫자가 **언제 기준인지**를 한곳에 모은다(필수 요건).
 *
 * 13F는 분기말 보유를 분기 종료 후 최대 45일 안에 제출하므로 늘 한참 지난 시점의 자료다. 가장 최근 완결 분기와
 * (있다면) 그보다 새로 시작된 "부분 집계" 분기를 나란히 적고, 지연 이유를 한 문단으로 설명한다. 공매도는 결제일과
 * 마지막 거래일을 따로 적는다. FINRA 구간을 그리지 않는 경우(플래그 꺼짐·데이터 없음)에는 FINRA 줄과 출처를 뺀다.
 * SEC 결제 불이행(FTD)은 최신 결제일과 약 2주 공개 지연을, Form 144·증자 공시는 점수를 매긴 창을 적는다. 과열 목록 날짜와 거래소
 * 출처(Nasdaq·NYSE·Cboe)는 Reg SHO 플래그가 켜져 있을 때만 적는다.
 */
export function AsOfNotice({
    freshness,
    snapshotAsOf,
    showFinra,
    regShoEnabled,
    thresholdAsOf,
    collecting,
}: AsOfNoticeProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const scored = freshness.institutionalPeriod;
    const latest = freshness.latestInstitutionalPeriod;
    // "데이터 없음" 자리에 들어갈 문구 — 그 구간이 수집 중이면 "수집 중"이다.
    const institutionalEmpty = collecting.institutional
        ? t('asOf.collecting')
        : t('asOf.institutionalNone');
    const sources = showFinra ? t('asOf.sourcesWithFinra') : t('asOf.sources');
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
                    {/* 수집 중이면 점수표에 분기가 남아 있어도(낡은 캐시) 부분 집계 분기를 기준 시점으로 적지 않는다 — 기관 섹션과 같은 판정. */}
                    {scored === null || collecting.institutional ? (
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
                <SecRows
                    freshness={freshness}
                    regShoEnabled={regShoEnabled}
                    thresholdAsOf={thresholdAsOf}
                    collecting={collecting}
                />
                {showFinra && (
                    <FinraRows freshness={freshness} collecting={collecting} />
                )}
                <Row term={t('asOf.termSnapshot')}>
                    {snapshotAsOf.slice(0, ISO_DATE_LENGTH)}
                </Row>
            </dl>
            <p className="text-xs leading-relaxed text-secondary-300">
                {t('asOf.delay')}
            </p>
            <p className="text-xs leading-relaxed text-secondary-300">
                {t('asOf.ftdDelay')}
            </p>
            <p className="text-xs leading-relaxed text-secondary-400">
                {regShoEnabled
                    ? t('asOf.sourcesWithExchange', { sources })
                    : sources}
            </p>
        </section>
    );
}

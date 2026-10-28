/**
 * 미국 수급 탭의 기준 시점·출처 섹션.
 */
import { useTranslations } from 'next-intl';
import type { InvestorFlowsScorecard } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import type { CollectingArms } from '../utils/collecting';
import { formatSnapshotDate } from '../utils/snapshotDate';
import { AsOfRow } from '../ui/as-of/AsOfRow';
import { FinraAsOfRows } from '../ui/as-of/FinraAsOfRows';
import { InstitutionalAsOfRow } from '../ui/as-of/InstitutionalAsOfRow';
import { SecAsOfRows } from '../ui/as-of/SecAsOfRows';
import { WindowRangeText } from '../ui/as-of/WindowRangeText';

const HEADING_ID = 'flows-asof-heading';

interface AsOfNoticeProps {
    readonly freshness: InvestorFlowsScorecard['freshness'];
    /** 스냅샷을 조립한 시각(UTC ISO). 미국 장 현지(America/New_York) 날짜로 바꿔 보인다. */
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

/**
 * 기준 시점·출처 — 이 화면의 모든 숫자가 **언제 기준인지**를 한곳에 모은다(필수 요건).
 *
 * 13F는 분기말 보유를 분기 종료 후 최대 45일 안에 제출하므로 늘 한참 지난 시점의 자료다. 가장 최근 완결 분기와
 * (있다면) 그보다 새로 시작된 "부분 집계" 분기를 나란히 적고, 지연 이유를 한 문단으로 설명한다. 공매도는 결제일과
 * 마지막 거래일을 따로 적는다. FINRA 구간을 그리지 않는 경우(플래그 꺼짐·데이터 없음)에는 FINRA 줄과 출처를 뺀다.
 * SEC 결제 불이행(FTD)은 최신 결제일과 약 2주 공개 지연을, Form 144·증자 공시는 점수를 매긴 창을 적는다. 과열 목록 날짜와 거래소
 * 출처(Nasdaq·NYSE·Cboe)는 Reg SHO 플래그가 켜져 있을 때만 적는다. 조회 시각은 UTC 날짜가 아니라 미국 장 현지 날짜다.
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
    const sources = showFinra ? t('asOf.sourcesWithFinra') : t('asOf.sources');
    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'space-y-3 p-6')}
        >
            <h2 id={HEADING_ID} className={HEADING_SECTION}>
                {t('asOf.title')}
            </h2>
            <dl className="space-y-2">
                <InstitutionalAsOfRow
                    freshness={freshness}
                    collecting={collecting.institutional}
                />
                <AsOfRow term={t('asOf.termInsider')}>
                    <WindowRangeText
                        window={freshness.insiderWindow}
                        noneText={t('asOf.insiderNone')}
                    />
                </AsOfRow>
                <SecAsOfRows
                    freshness={freshness}
                    regShoEnabled={regShoEnabled}
                    thresholdAsOf={thresholdAsOf}
                    collecting={collecting}
                />
                {showFinra && (
                    <FinraAsOfRows
                        freshness={freshness}
                        collecting={collecting}
                    />
                )}
                <AsOfRow term={t('asOf.termSnapshot')}>
                    {formatSnapshotDate(snapshotAsOf, 'us-equity')}
                </AsOfRow>
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

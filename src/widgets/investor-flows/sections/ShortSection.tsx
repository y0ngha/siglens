/**
 * 공매도 섹션.
 */
import { useTranslations } from 'next-intl';
import type {
    InvestorFlowsScorecard,
    InvestorFlowsSnapshot,
} from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import type { CollectingArms } from '../utils/collecting';
import {
    buildShortInterestView,
    buildShortVolumeSeries,
    hasShortData,
    shortVolumeMarker,
} from '../utils/short';
import { PriceFreeSqueezeNote } from '../ui/short/PriceFreeSqueezeNote';
import { CollectingNotice } from './CollectingNotice';
import { FailsToDeliverBlock } from './FailsToDeliverBlock';
import { ShortInterestBlock } from './ShortInterestBlock';
import { ShortVolumeBlock } from './ShortVolumeBlock';
import { SqueezeScoreCard } from './SqueezeScoreCard';
import { ThresholdListBadge } from './ThresholdListBadge';

const HEADING_ID = 'flows-short-heading';

interface ShortSectionProps {
    readonly snapshot: InvestorFlowsSnapshot;
    readonly scorecard: InvestorFlowsScorecard;
    /** `FINRA_SHORT_DATA_ENABLED`. 꺼져 있으면 FINRA 블록(잔고·일별 비중)을 그리지 않는다. */
    readonly finraEnabled: boolean;
    /** `REG_SHO_THRESHOLD_DATA_ENABLED`. 꺼져 있으면 과열 목록 배지를 그리지 않는다(흔적도 남기지 않는다). */
    readonly regShoEnabled: boolean;
    readonly collecting: CollectingArms;
}

/** FINRA 공매도 잔고·일별 비중 블록. 데이터가 있을 때만 부른다. */
function FinraBlocks({
    snapshot,
    scorecard,
}: Pick<ShortSectionProps, 'snapshot' | 'scorecard'>) {
    const { rows, previousChange } = buildShortInterestView(
        snapshot.shortInterest ?? [],
        snapshot.floatShares
    );
    const series = buildShortVolumeSeries(snapshot.shortVolume ?? []);
    return (
        <>
            {rows.length > 0 && (
                <ShortInterestBlock
                    rows={rows}
                    metrics={scorecard.short.metrics}
                    previousChange={previousChange}
                />
            )}
            <ShortVolumeBlock
                series={series}
                marker={shortVolumeMarker(scorecard)}
            />
        </>
    );
}

/** 점수가 있으면 점수 카드, 없으면 core의 가격 없는 판정이 참일 때만 가격 없는 경고를 그린다. */
function SqueezeSummary({ scorecard }: Pick<ShortSectionProps, 'scorecard'>) {
    const { squeezeRisk } = scorecard;
    if (squeezeRisk !== null) return <SqueezeScoreCard risk={squeezeRisk} />;
    if (!scorecard.short.metrics.squeezeRisk) return null;
    return <PriceFreeSqueezeNote metrics={scorecard.short.metrics} />;
}

/**
 * 공매도 섹션 — 숏스퀴즈 점수 카드 → FINRA(잔고·상환일수·장외 공매도 비중) → SEC 결제 불이행(FTD) → Reg SHO 과열 목록 순서다.
 * 섹션 자체는 미국 종목이면 **항상** 그린다 — SEC 결제 불이행(FTD)은 플래그 없는 공공 정보라 언제나 한 블록(데이터·기록 없음·
 * 불러오지 못함·수집 중 중 하나)이 들어간다. 나머지 블록은 각자 거른다: 숏스퀴즈 카드는 core가 점수를 냈을 때만(없으면 가격 없는
 * 경고가 참일 때만), FINRA 블록은 FINRA 플래그가 켜져 있고 데이터가 있을 때만(첫 수집 중이면 안내), 과열 목록은 Reg SHO
 * 플래그가 켜져 있고 상태가 있거나 첫 목록을 모으는 중일 때만 그린다.
 * 최신 값 숫자와 숏스퀴즈 점수는 점수표(core)에서 읽고, 결제일별 추이 점만 여기서 계산한다.
 */
export function ShortSection({
    snapshot,
    scorecard,
    finraEnabled,
    regShoEnabled,
    collecting,
}: ShortSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    const showFinra = hasShortData(
        finraEnabled,
        snapshot.shortInterest,
        snapshot.shortVolume
    );
    const thresholdList = snapshot.thresholdList ?? null;
    const showThreshold =
        regShoEnabled && (thresholdList !== null || collecting.thresholdList);

    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'space-y-6 p-6')}
        >
            <div>
                <h2 id={HEADING_ID} className={HEADING_SECTION}>
                    {t('short.title')}
                    <FlowTooltip term="shortInterest" />
                </h2>
                <p className="mt-1 text-xs text-secondary-400">
                    {t('short.subtitle')}
                </p>
            </div>

            <SqueezeSummary scorecard={scorecard} />

            {showFinra && (
                <FinraBlocks snapshot={snapshot} scorecard={scorecard} />
            )}
            {!showFinra && collecting.short && (
                <CollectingNotice variant="short" />
            )}

            <FailsToDeliverBlock
                points={snapshot.failsToDeliver ?? null}
                metrics={scorecard.short.metrics}
                collecting={collecting.failsToDeliver}
            />

            {showThreshold && <ThresholdListBadge status={thresholdList} />}
        </section>
    );
}

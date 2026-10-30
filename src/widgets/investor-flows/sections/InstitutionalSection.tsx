/**
 * 기관 매수·매도(13F) 섹션.
 */
import { useTranslations } from 'next-intl';
import type {
    InstitutionalMetrics,
    InstitutionalSnapshot,
} from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import {
    buildHoldersTrend,
    buildQuarterBars,
    buildSplitComparison,
    findPartialQuarter,
} from '../utils/institutional';
import { QuarterFlowChart } from '../ui/charts/QuarterFlowChart';
import { HoldersTrendChart } from '../ui/institutional/HoldersTrendChart';
import { PartialQuarterNote } from '../ui/institutional/PartialQuarterNote';
import { ChangeSplitCard } from './ChangeSplitCard';
import { CollectingNotice } from './CollectingNotice';
import { OptionsPositionsBlock } from './OptionsPositionsBlock';
import { TopHoldersList } from './TopHoldersList';

const HEADING_ID = 'flows-institutional-heading';

interface InstitutionalSectionProps {
    readonly institutional: InstitutionalSnapshot;
    /** 점수표(core) 기관 지표 — 옵션 풋/콜 명목 비율. */
    readonly metrics: InstitutionalMetrics;
    /**
     * 13F 초기 수집이 아직 안 끝났다(`resolveCollectingArms`). 행이 있어도 백필 중의 부분 집계라(보유 기관 수·순매수가 실제보다
     * 작다) 본문 대신 "모으는 중" 안내를 낸다 — 점수·AI 해석도 같은 판정으로 이 구간을 뺀다(`maskUncollectedSections`).
     */
    readonly collecting?: boolean;
}

/** 데이터가 있을 때의 본문: 분기 막대 → 보유 기관 수 추이 → 4분할 → 부분 집계 안내 → 상위 보유 기관 → 옵션. */
function InstitutionalBody({
    institutional,
    metrics,
}: Pick<InstitutionalSectionProps, 'institutional' | 'metrics'>) {
    const t = useTranslations('widgets.investor-flows');
    const { quarters, topHolders, topHoldersPeriod } = institutional;
    const bars = buildQuarterBars(quarters);
    const split = buildSplitComparison(quarters);
    const partial = findPartialQuarter(
        quarters,
        split?.complete === true ? split.period : null
    );
    const holdersTrend = buildHoldersTrend(bars);
    return (
        <>
            {bars.length > 0 && (
                <div>
                    <h3 className={cn('mb-1', HEADING_SUBSECTION)}>
                        {t('flowChart.title')}
                        <FlowTooltip term="netBuySell" />
                    </h3>
                    <p className="mb-3 text-xs text-secondary-400">
                        {t('flowChart.caption')}
                    </p>
                    <QuarterFlowChart bars={bars} />
                </div>
            )}
            {holdersTrend !== null && (
                <HoldersTrendChart trend={holdersTrend} />
            )}
            {split !== null && <ChangeSplitCard comparison={split} />}
            {partial !== null && <PartialQuarterNote quarter={partial} />}
            {topHolders.length > 0 ? (
                <TopHoldersList
                    holders={topHolders}
                    period={topHoldersPeriod}
                />
            ) : (
                <p className="text-sm text-secondary-300">
                    {t('holders.noData')}
                </p>
            )}
            <OptionsPositionsBlock
                quarters={institutional.options ?? []}
                metrics={metrics}
            />
        </>
    );
}

/** 수집 중이면(행이 있어도) 안내, 데이터가 없으면 "데이터 없음", 아니면 본문을 그린다. */
function InstitutionalContent({
    institutional,
    metrics,
    collecting,
}: InstitutionalSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    if (collecting) return <CollectingNotice variant="institutional" />;
    const hasData =
        institutional.quarters.length > 0 ||
        institutional.topHolders.length > 0;
    if (!hasData) {
        return (
            <p className="text-sm text-secondary-300">
                {t('institutional.noData')}
            </p>
        );
    }
    return (
        <InstitutionalBody institutional={institutional} metrics={metrics} />
    );
}

/**
 * 기관 매수·매도(13F) 섹션 — "들어왔나(IN), 나갔나(OUT)"를 한눈에.
 *
 * 분기별 순매수/순매도 막대 → 보유 기관 수 추이 → 4분할 카드(신규·증가·감소·청산) → 상위 보유 기관 표 → 옵션 포지션(풋·콜
 * 명목) 순서다.
 * 4분할 카드와 기준 분기 문구는 **가장 최근 완결 분기**를 기준으로 하고, 그보다 새로 시작된 진행 중 분기는
 * 별도 안내 한 줄로 "부분 집계"임을 밝힌다. 데이터가 하나도 없으면 "데이터 없음"을 명시한다. 13F 초기 수집이 아직 끝나지
 * 않았으면(`collecting`) 데이터 유무와 관계없이 "모으는 중" 안내만 낸다 — 그 시점의 빈 구간은 이 종목에 데이터가 없다는 뜻이
 * 아니고, 있는 행은 제출이 덜 모인 부분 집계라 상위 보유 기관 표·추이가 "기관 이탈"처럼 읽힌다.
 */
export function InstitutionalSection({
    institutional,
    metrics,
    collecting = false,
}: InstitutionalSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'space-y-6 p-6')}
        >
            <div>
                <h2 id={HEADING_ID} className={HEADING_SECTION}>
                    {t('institutional.title')}
                    <FlowTooltip term="thirteenF" />
                </h2>
                <p className="mt-1 text-xs text-secondary-400">
                    {t('institutional.subtitle')}
                </p>
            </div>
            <InstitutionalContent
                institutional={institutional}
                metrics={metrics}
                collecting={collecting}
            />
        </section>
    );
}

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type {
    InstitutionalMetrics,
    InstitutionalSnapshot,
} from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { QuarterFlowChart } from '../charts/QuarterFlowChart';
import { TrendLineChart } from '../charts/TrendLineChart';
import { FlowTooltip } from '../investorFlowsTooltips';
import {
    formatCompact,
    formatInteger,
    formatPeriodShort,
    formatSignedCompact,
} from '../utils/flowFormat';
import {
    buildQuarterBars,
    buildSplitComparison,
    findPartialQuarter,
    flowDirection,
    type FlowDirection,
} from '../utils/institutional';
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
    const locale = useResolvedLocale();
    const { quarters, topHolders, topHoldersPeriod } = institutional;
    const bars = buildQuarterBars(quarters);
    const split = buildSplitComparison(quarters);
    const partial = findPartialQuarter(
        quarters,
        split?.complete === true ? split.period : null
    );
    // 진행 중 분기는 제출이 덜 모여 기관 수가 작다 — 추이 선에 넣으면 "급감"처럼 읽히므로 뺀다.
    const holdersTrend = bars.filter(bar => bar.complete);
    const hasData = quarters.length > 0 || topHolders.length > 0;
    const partialFlow =
        partial === null ? null : flowDirection(partial.netShareChange);
    const directionLabels: Record<FlowDirection, string> = {
        in: t('flowChart.in'),
        out: t('flowChart.out'),
        flat: t('flowChart.flat'),
    };
    const partialDirection =
        partialFlow === null ? '' : directionLabels[partialFlow];

    // 본문 대신 그리는 자리 — 수집 중이면(행이 있어도) 안내, 데이터가 없으면 "데이터 없음". 둘 다 아니면 `null`이라 본문을 그린다.
    let emptyState: ReactNode = null;
    if (collecting) {
        emptyState = <CollectingNotice variant="institutional" />;
    } else if (!hasData) {
        emptyState = (
            <p className="text-sm text-secondary-300">
                {t('institutional.noData')}
            </p>
        );
    }

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

            {emptyState ?? (
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

                    {holdersTrend.length > 1 && (
                        <div>
                            <h3 className={cn('mb-1', HEADING_SUBSECTION)}>
                                {t('holdersTrend.title')}
                            </h3>
                            <p className="mb-3 text-xs text-secondary-400">
                                {t('holdersTrend.caption')}
                            </p>
                            <TrendLineChart
                                values={holdersTrend.map(bar => bar.holders)}
                                ariaLabel={t('holdersTrend.aria', {
                                    from: formatInteger(
                                        holdersTrend[0].holders,
                                        locale
                                    ),
                                    to: formatInteger(
                                        holdersTrend[holdersTrend.length - 1]
                                            .holders,
                                        locale
                                    ),
                                })}
                                maxLabel={formatCompact(
                                    Math.max(
                                        ...holdersTrend.map(b => b.holders)
                                    ),
                                    locale
                                )}
                                minLabel={formatCompact(
                                    Math.min(
                                        ...holdersTrend.map(b => b.holders)
                                    ),
                                    locale
                                )}
                                startLabel={formatPeriodShort(
                                    holdersTrend[0].period
                                )}
                                endLabel={formatPeriodShort(
                                    holdersTrend[holdersTrend.length - 1].period
                                )}
                            />
                        </div>
                    )}

                    {split !== null && <ChangeSplitCard comparison={split} />}

                    {partial !== null && (
                        <p
                            className="rounded-lg bg-secondary-700/40 p-3 text-xs text-secondary-300"
                            data-testid="flows-partial-quarter"
                        >
                            {t('institutional.partialNote', {
                                period: partial.period,
                                holders: formatInteger(partial.holders, locale),
                                net: formatSignedCompact(
                                    partial.netShareChange,
                                    locale
                                ),
                                direction: partialDirection,
                            })}
                            <FlowTooltip term="partialAggregation" />
                        </p>
                    )}

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
            )}
        </section>
    );
}

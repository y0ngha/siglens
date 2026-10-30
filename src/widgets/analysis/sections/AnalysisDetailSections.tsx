'use client';

/**
 * '원본' 보기의 상세 섹션 묶음 — 미터 띠, 매매 전략, 주요 레벨, 추세선, 시나리오,
 * 보조지표, 패턴, 전략, 잠금 업셀 카드를 순서대로 배치한다. 각 섹션은 데이터가
 * 없으면 스스로 숨는다.
 */
import type { Ref } from 'react';
import type {
    AnalysisResponse,
    ClusteredKeyLevels,
    KrxTickTable,
} from '@y0ngha/siglens-core';
import type { MeterState } from '@/shared/lib/funnel/funnelEvents';
import type { OverlayCardControls } from '../model/types';
import type { LockedSections } from '../utils/lockedSections';
import type { PanelSkillResults } from '../utils/panelSkillResults';
import { ActionRecommendationSection } from './ActionRecommendationSection';
import { IndicatorSignalsSection } from './IndicatorSignalsSection';
import { KeyLevelsSection } from './KeyLevelsSection';
import { LockedDetailCard } from './LockedDetailCard';
import { MeterRevealedNotice } from './MeterRevealedNotice';
import { PatternsSection } from './PatternsSection';
import { PriceScenariosSection } from './PriceScenariosSection';
import { StrategiesSection } from './StrategiesSection';
import { TrendlinesSection } from './TrendlinesSection';

interface AnalysisDetailSectionsProps {
    analysis: AnalysisResponse;
    keyLevels: ClusteredKeyLevels;
    symbol: string;
    krxTickTable: KrxTickTable;
    locked: LockedSections;
    skillResults: PanelSkillResults;
    meter: MeterState | null;
    /** 미터 노출 측정 ref — 띠(revealed)와 소진 카드(exhausted) 중 보이는 쪽에 붙는다. */
    meterRef: Ref<HTMLDivElement>;
    skillCount: number;
    actionPricesVisible: boolean;
    onActionPricesVisibilityChange?: (isVisible: boolean) => void;
    overlaySourceRefs: ReadonlySet<string>;
    overlayControls: OverlayCardControls | undefined;
}

export function AnalysisDetailSections({
    analysis,
    keyLevels,
    symbol,
    krxTickTable,
    locked,
    skillResults,
    meter,
    meterRef,
    skillCount,
    actionPricesVisible,
    onActionPricesVisibilityChange,
    overlaySourceRefs,
    overlayControls,
}: AnalysisDetailSectionsProps) {
    return (
        <>
            <div className="border-t border-secondary-700" />

            {meter === 'revealed' && !locked.hasLockedActionDetail && (
                <MeterRevealedNotice meterRef={meterRef} />
            )}

            {!locked.hasLockedActionDetail && analysis.actionRecommendation && (
                <ActionRecommendationSection
                    rec={analysis.actionRecommendation}
                    isChartVisible={actionPricesVisible}
                    // 화살표 함수를 무조건 넘기면 섹션의 "핸들러가 없으면 버튼을
                    // 숨긴다" 게이트가 영원히 발동하지 않는다 — 소비자가 핸들러를
                    // 안 준 것을 여기서 지워버리기 때문이다.
                    onToggleChart={
                        onActionPricesVisibilityChange === undefined
                            ? undefined
                            : () =>
                                  onActionPricesVisibilityChange(
                                      !actionPricesVisible
                                  )
                    }
                />
            )}

            <KeyLevelsSection
                keyLevels={keyLevels}
                symbol={symbol}
                krxTickTable={krxTickTable}
            />

            <TrendlinesSection
                trendlines={analysis.trendlines ?? []}
                symbol={symbol}
                krxTickTable={krxTickTable}
            />

            <PriceScenariosSection
                priceTargets={analysis.priceTargets}
                symbol={symbol}
                krxTickTable={krxTickTable}
            />

            <IndicatorSignalsSection
                indicatorResults={skillResults.indicatorResults}
            />

            <PatternsSection
                detectedPatterns={skillResults.detectedPatterns}
                showConfidence={!locked.hasLockedConfidence}
                overlaySourceRefs={overlaySourceRefs}
                overlayControls={overlayControls}
                symbol={symbol}
                krxTickTable={krxTickTable}
            />

            <StrategiesSection
                strategies={skillResults.strategies}
                showConfidence={!locked.hasLockedConfidence}
                overlaySourceRefs={overlaySourceRefs}
                overlayControls={overlayControls}
            />

            {locked.hasLockedDetails && (
                <LockedDetailCard
                    meter={meter}
                    skillCount={skillCount}
                    meterRef={meterRef}
                />
            )}
        </>
    );
}

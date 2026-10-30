'use client';

/**
 * 전략 섹션 — 패턴과 중복되지 않는 전략 카드 목록. 없으면 그리지 않는다.
 */
import { useTranslations } from 'next-intl';
import type { StrategyResult } from '@y0ngha/siglens-core';
import { LABEL_KO } from '@/shared/lib/typographyStyles';
import type { OverlayCardControls } from '../model/types';
import { StrategyAccordionItem } from '../ui/StrategyAccordionItem';

interface StrategiesSectionProps {
    strategies: StrategyResult[];
    showConfidence: boolean;
    /** 차트 작도가 있는 결과 id 집합 — 여기 속한 카드만 작도 토글을 받는다. */
    overlaySourceRefs: ReadonlySet<string>;
    overlayControls: OverlayCardControls | undefined;
}

export function StrategiesSection({
    strategies,
    showConfidence,
    overlaySourceRefs,
    overlayControls,
}: StrategiesSectionProps) {
    const t = useTranslations('widgets.analysis');
    if (strategies.length === 0) return null;
    return (
        <div className="flex flex-col gap-2">
            <span className={LABEL_KO}>{t('AnalysisPanel.913a74')}</span>
            <div className="flex flex-col gap-1.5">
                {strategies.map(strategy => (
                    <StrategyAccordionItem
                        key={strategy.id}
                        strategy={strategy}
                        showConfidence={showConfidence}
                        overlay={
                            overlaySourceRefs.has(strategy.id)
                                ? overlayControls
                                : undefined
                        }
                    />
                ))}
            </div>
        </div>
    );
}

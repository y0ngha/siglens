'use client';

/**
 * 보조지표 신호 섹션 — 지표별 신호를 한 줄씩 나열한다. 표시할 지표가 없으면 그리지 않는다.
 */
import { useTranslations } from 'next-intl';
import type { IndicatorGuideResult } from '@y0ngha/siglens-core';
import { useSkillLabel } from '@/shared/i18n/skillLabel';
import { guidePathForSkill } from '@/shared/lib/guideLinkLookup';
import { LABEL_KO } from '@/shared/lib/typographyStyles';
import { SignalItem } from '../ui/SignalItem';

interface IndicatorSignalsSectionProps {
    /** `selectPanelSkillResults`로 패턴과 중복을 걸러낸 지표 결과. */
    indicatorResults: IndicatorGuideResult[];
}

export function IndicatorSignalsSection({
    indicatorResults,
}: IndicatorSignalsSectionProps) {
    const t = useTranslations('widgets.analysis');
    const skillLabel = useSkillLabel();
    if (indicatorResults.length === 0) return null;
    return (
        <div className="flex flex-col gap-2">
            <span className={LABEL_KO}>{t('AnalysisPanel.2a1bed')}</span>
            <div className="flex flex-col gap-1.5">
                {indicatorResults.map(indicatorResult =>
                    indicatorResult.signals.map((signal, index) => (
                        <SignalItem
                            key={`${indicatorResult.indicatorName}-${signal.type}-${index}`}
                            signal={signal}
                            typeLabel={skillLabel(
                                indicatorResult.indicatorName
                            )}
                            guidePath={guidePathForSkill(
                                indicatorResult.indicatorName
                            )}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

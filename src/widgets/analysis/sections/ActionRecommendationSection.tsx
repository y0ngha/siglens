'use client';

/**
 * 매매 전략 섹션 — 진입 판단 배지, 포지션·진입·청산·손익비 문단, 보정 레벨, 계획 점검.
 */
import { useTranslations } from 'next-intl';
import type {
    ActionRecommendation,
    EntryRecommendation,
} from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { LABEL_KO } from '@/shared/lib/typographyStyles';
import { EyeIcon } from '@/shared/ui/EyeIcon';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { PlanCheckBlock } from '../PlanCheckBlock';
import { ReconciledLevelsBlock } from '../ui/ReconciledLevelsBlock';

const ENTRY_RECOMMENDATION_LABEL: Record<EntryRecommendation, string> = {
    enter: 'entryRecommendation.enter',
    wait: 'entryRecommendation.wait',
    avoid: 'entryRecommendation.avoid',
};

const ENTRY_RECOMMENDATION_COLOR: Record<EntryRecommendation, string> = {
    enter: 'bg-chart-bullish/10 text-ui-success-text border border-chart-bullish/30',
    wait: 'bg-ui-warning/10 text-ui-warning-text border border-ui-warning/30',
    avoid: 'bg-chart-bearish/10 text-ui-danger-text border border-chart-bearish/30',
};

type ActionRecommendationTextKey =
    | 'positionAnalysis'
    | 'entry'
    | 'exit'
    | 'riskReward';

interface ActionRecommendationField {
    /** `widgets.analysis.sectionLabel` 기준 상대 키. */
    labelKey: string;
    key: ActionRecommendationTextKey;
}

const ACTION_RECOMMENDATION_FIELDS: readonly ActionRecommendationField[] = [
    { labelKey: 'currentPosition', key: 'positionAnalysis' },
    { labelKey: 'entryStrategy', key: 'entry' },
    { labelKey: 'exitStrategy', key: 'exit' },
    { labelKey: 'riskReward', key: 'riskReward' },
];

interface ActionRecommendationSectionProps {
    rec: ActionRecommendation;
    isChartVisible: boolean;
    /**
     * 없으면 차트 토글 버튼을 **렌더하지 않는다.** 공유 페이지(`views/share/kindPanelRegistry`)는
     * 핸들러를 넘기지 않고, 버튼이 숨기는 가격선(`StockChart`가 그린다)도 그 화면에는 없다 —
     * 눌러도 반응 없는 컨트롤을 남기지 않는다.
     */
    onToggleChart?: () => void;
}

export function ActionRecommendationSection({
    rec,
    isChartVisible,
    onToggleChart,
}: ActionRecommendationSectionProps) {
    const t = useTranslations('widgets.analysis');
    const tSection = useTranslations('widgets.analysis.sectionLabel');
    const tLabel = useTranslations('shared.enumLabel');
    return (
        <div className="flex flex-col gap-2 rounded-lg bg-secondary-700/30 p-3">
            {rec.entryRecommendation !== undefined && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-secondary-500">
                        {t('AnalysisPanel.edb872')}
                    </span>
                    <span
                        className={cn(
                            'rounded px-2 py-0.5 text-xs font-semibold',
                            ENTRY_RECOMMENDATION_COLOR[rec.entryRecommendation]
                        )}
                    >
                        {tLabel(
                            ENTRY_RECOMMENDATION_LABEL[rec.entryRecommendation]
                        )}
                    </span>
                </div>
            )}
            <div className="flex items-center justify-between">
                <span className={LABEL_KO}>{t('AnalysisPanel.034be7')}</span>
                {onToggleChart !== undefined && (
                    <button
                        type="button"
                        onClick={onToggleChart}
                        className={cn(
                            'focus-visible:ring-primary-500 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors focus-visible:ring-1 focus-visible:outline-none',
                            isChartVisible
                                ? 'text-primary-400 hover:text-primary-300'
                                : 'text-secondary-500 hover:text-secondary-400'
                        )}
                        // 토글은 이름 하나에 상태는 aria-pressed로만 싣는다(REACT.md#AX-3).
                        // 이름("차트 가격선 표시")은 보이는 문구("차트")를 포함한다.
                        aria-pressed={isChartVisible}
                        aria-label={t('AnalysisPanel.cfbeac')}
                    >
                        <EyeIcon isVisible={isChartVisible} />
                        {t('AnalysisPanel.06c8ed')}
                    </button>
                )}
            </div>
            <div className="flex flex-col gap-2">
                {ACTION_RECOMMENDATION_FIELDS.map(({ labelKey, key }) => {
                    const value = rec[key];
                    if (typeof value !== 'string' || value === '') return null;
                    return (
                        <div key={labelKey} className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-secondary-500">
                                {tSection(labelKey)}
                            </span>
                            <MarkdownText className="text-sm text-secondary-300">
                                {value}
                            </MarkdownText>
                        </div>
                    );
                })}
            </div>
            <ReconciledLevelsBlock reconciled={rec.reconciledLevels} />
            <PlanCheckBlock planCheck={rec.planCheck} />
        </div>
    );
}

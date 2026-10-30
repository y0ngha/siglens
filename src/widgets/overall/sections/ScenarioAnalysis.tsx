import { useTranslations } from 'next-intl';
import type {
    OverallScenario,
    OverallScenarioName,
} from '@y0ngha/siglens-core';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { cn } from '@/shared/lib/cn';
import { SectionCard } from '../ui/section/SectionCard';

/** OverallScenarioName → `shared.enumLabel.overallScenario` 카탈로그 키. */
const SCENARIO_LABEL_KEY: Record<OverallScenarioName, string> = {
    bullish: 'overallScenario.bullish',
    neutral: 'overallScenario.neutral',
    bearish: 'overallScenario.bearish',
};

const SCENARIO_CLASS: Record<OverallScenarioName, string> = {
    bullish: 'bg-ui-success/10 text-ui-success-text',
    neutral: 'bg-secondary-700 text-secondary-400',
    bearish: 'bg-ui-danger/10 text-ui-danger-text',
};

interface ScenarioAnalysisProps {
    scenarios: OverallScenario[];
}

/** 강세·중립·약세 시나리오를 발동 조건과 예상 가격대와 함께 보여 주는 섹션. 시나리오가 없으면 렌더하지 않는다. */
export function ScenarioAnalysis({ scenarios }: ScenarioAnalysisProps) {
    const t = useTranslations('widgets.overall');
    // extract.mjs의 동적 키 탐지는 이 파일 안에서 번역자를 직접 호출하는
    // 패턴만 본다 — `SCENARIO_LABEL_KEY[...]`를 그대로 `tLabel(...)`에
    // 넣어야 `shared.enumLabel`이 이 라우트의 클라이언트 번들에 실린다.
    const tLabel = useTranslations('shared.enumLabel');
    if (scenarios.length === 0) return null;
    return (
        <SectionCard
            headingId="scenario-analysis-heading"
            title={t('ScenarioAnalysis.bb732c')}
            headingGap="mb-4"
        >
            <ul aria-label={t('ScenarioAnalysis.239da9')} className="space-y-4">
                {scenarios.map(scenario => (
                    <li
                        key={scenario.name}
                        className="rounded-lg bg-secondary-800/40 p-4"
                    >
                        <div className="mb-2 flex items-center gap-2">
                            <span
                                className={cn(
                                    'rounded px-2 py-0.5 text-xs font-medium',
                                    SCENARIO_CLASS[scenario.name]
                                )}
                            >
                                {tLabel(SCENARIO_LABEL_KEY[scenario.name])}
                            </span>
                        </div>
                        <div className="mb-1.5 text-sm">
                            <p className="mb-0.5 font-medium text-secondary-100">
                                {t('ScenarioAnalysis.35e6f0')}
                            </p>
                            <MarkdownText className="text-secondary-400">
                                {scenario.triggerConditionKo}
                            </MarkdownText>
                        </div>
                        <div className="text-sm">
                            <p className="mb-0.5 font-medium text-secondary-100">
                                {t('ScenarioAnalysis.fcd702')}
                            </p>
                            <MarkdownText className="text-secondary-400">
                                {scenario.priceRangeKo}
                            </MarkdownText>
                        </div>
                    </li>
                ))}
            </ul>
        </SectionCard>
    );
}

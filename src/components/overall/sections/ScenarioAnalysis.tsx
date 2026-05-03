import type {
    OverallScenario,
    OverallScenarioName,
} from '@y0ngha/siglens-core';
import { cn } from '@/lib/cn';

const SCENARIO_LABEL: Record<OverallScenarioName, string> = {
    bullish: '강세',
    neutral: '중립',
    bearish: '약세',
};

const SCENARIO_CLASS: Record<OverallScenarioName, string> = {
    bullish: 'bg-ui-success/10 text-chart-bullish',
    neutral: 'bg-secondary-700 text-secondary-400',
    bearish: 'bg-ui-danger/10 text-chart-bearish',
};

interface ScenarioAnalysisProps {
    scenarios: OverallScenario[];
}

/** RSC section: bullish/neutral/bearish scenarios with trigger conditions and projected price ranges. */
export function ScenarioAnalysis({ scenarios }: ScenarioAnalysisProps) {
    if (scenarios.length === 0) return null;
    return (
        <section
            aria-labelledby="scenario-analysis-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="scenario-analysis-heading"
                className="mb-4 text-lg font-semibold text-balance"
            >
                시나리오 분석
            </h2>
            <ul aria-label="시나리오 목록" className="space-y-4">
                {scenarios.map(scenario => (
                    <li
                        key={scenario.name}
                        className="bg-secondary-800/40 rounded-lg p-4"
                    >
                        <div className="mb-2 flex items-center gap-2">
                            <span
                                className={cn(
                                    'rounded px-2 py-0.5 text-xs font-medium',
                                    SCENARIO_CLASS[scenario.name]
                                )}
                            >
                                {SCENARIO_LABEL[scenario.name]}
                            </span>
                        </div>
                        <p className="text-secondary-400 mb-1.5 text-sm leading-relaxed">
                            <span className="text-secondary-100 font-medium">
                                트리거 조건:{' '}
                            </span>
                            {scenario.triggerConditionKo}
                        </p>
                        <p className="text-secondary-400 text-sm leading-relaxed">
                            <span className="text-secondary-100 font-medium">
                                예상 가격대:{' '}
                            </span>
                            {scenario.priceRangeKo}
                        </p>
                    </li>
                ))}
            </ul>
        </section>
    );
}

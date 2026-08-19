import { useTranslations } from 'next-intl';
import type {
    OverallAnalysisResponse,
    OverallScenario,
} from '@y0ngha/siglens-core';

interface OverallFactsSummaryProps {
    symbol: string;
    analysis: OverallAnalysisResponse;
}

const SCENARIO_LABEL: Record<OverallScenario['name'], string> = {
    bullish: '강세 시나리오',
    neutral: '중립 시나리오',
    bearish: '약세 시나리오',
};

/**
 * 종합 분석의 결정적 텍스트를 크롤 가능한 SSR HTML로 노출한다(OverallContent가
 * useSearchParams로 CSR bailout하므로 fallback 경로로 SEO 텍스트를 박는다).
 *
 * 노출 필드: headlineKo(헤드라인), integratedConclusionKo(4축 종합 결론),
 * scenarios[](강세·중립·약세 시나리오 — 조건·가격대), riskFactorsKo[](위험 요인).
 * 이 텍스트는 OverallContent가 done 상태에서 렌더하는 내용과 동일하므로
 * 클로킹이 아니다 — hydration 전에 같은 텍스트가 노출될 뿐이다.
 */
export function OverallFactsSummary({
    symbol,
    analysis,
}: OverallFactsSummaryProps) {
    const t = useTranslations('widgets.overall');
    return (
        <section aria-label={`${symbol} 종합 분석 요약`} className="space-y-4">
            <h2 className="sr-only">
                {t('OverallFactsSummary.9a8ae8', { v0: symbol })}
            </h2>
            <p className="text-sm leading-relaxed text-secondary-300">
                {analysis.headlineKo}
            </p>
            <p className="text-sm leading-relaxed text-secondary-400">
                {analysis.integratedConclusionKo}
            </p>
            {analysis.scenarios.length > 0 && (
                <ul className="space-y-2">
                    {analysis.scenarios.map(scenario => (
                        <li
                            key={scenario.name}
                            className="text-sm text-secondary-400"
                        >
                            <span className="font-medium text-secondary-300">
                                {SCENARIO_LABEL[scenario.name]}:
                            </span>{' '}
                            {scenario.triggerConditionKo} —{' '}
                            {scenario.priceRangeKo}
                        </li>
                    ))}
                </ul>
            )}
            {analysis.riskFactorsKo.length > 0 && (
                <ul className="space-y-1">
                    {analysis.riskFactorsKo.map(risk => (
                        <li key={risk} className="text-sm text-secondary-400">
                            {risk}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

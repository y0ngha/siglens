/**
 * 패널·복사 리포트가 함께 쓰는 스킬 결과 선별 — 감지된 패턴, 패턴과 중복되지 않는
 * 전략·보조지표만 남긴다. 두 소비자가 같은 함수를 써야 화면과 복사본의 근거 목록이
 * 어긋나지 않는다.
 */
import type {
    AnalysisResponse,
    IndicatorGuideResult,
    PatternResult,
    StrategyResult,
} from '@y0ngha/siglens-core';

export interface PanelSkillResults {
    detectedPatterns: PatternResult[];
    strategies: StrategyResult[];
    indicatorResults: IndicatorGuideResult[];
}

/**
 * 표시할 스킬 결과를 고른다.
 *
 * confidence는 표시 가중치이지 포함 게이트가 아니다 — 그 값으로 결과를 제거(데이터
 * 손실)하지 않고, 패턴으로 이미 표시되는 이름의 전략·지표만 중복 제거한다.
 * 부분 응답이 직접 전달돼도 깨지지 않도록 배열 필드는 빈 배열로 기본값을 둔다.
 */
export function selectPanelSkillResults(
    analysis: Pick<
        AnalysisResponse,
        'patternSummaries' | 'strategyResults' | 'indicatorResults'
    >
): PanelSkillResults {
    const patternSummaries = analysis.patternSummaries ?? [];
    const patternSkillNames = new Set(patternSummaries.map(p => p.skillName));
    return {
        detectedPatterns: patternSummaries.filter(p => p.detected),
        strategies: (analysis.strategyResults ?? []).filter(
            s => !patternSkillNames.has(s.strategyName)
        ),
        indicatorResults: (analysis.indicatorResults ?? []).filter(
            r =>
                r.indicatorName !== '' &&
                !patternSkillNames.has(r.indicatorName)
        ),
    };
}

import type { Bar, PatternResult, PatternType } from '@/domain/types';

/**
 * activePatterns 에 포함된 패턴 타입 목록을 받는다.
 * 실제 패턴 감지는 buildAnalysisPrompt 단계에서 AI 가
 * skills/*.md 내용을 기반으로 수행하므로, 이 함수는 빈 배열을 반환한다.
 * activePatterns 가 비어 있으면 빈 배열을 반환한다.
 */
export function detectPatterns(
    bars: Bar[],
    activePatterns: PatternType[]
): PatternResult[] {
    void bars;
    void activePatterns;
    return [];
}

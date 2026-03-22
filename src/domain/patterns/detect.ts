import type { Bar, PatternResult, PatternType } from '@/domain/types';

/**
 * 패턴 감지는 AI가 skills/*.md 내용을 기반으로 수행한다.
 *
 * 흐름:
 *   infrastructure가 skills/*.md 중 type: pattern 파일을 파싱
 *   → frontmatter의 pattern 필드로 activePatterns 결정
 *   → buildAnalysisPrompt가 해당 skill 내용을 AI 프롬프트에 포함
 *   → AI가 skill 기준에 맞춰 패턴 감지 수행
 *
 * 이 함수는 인터페이스 계약을 제공한다.
 * activePatterns가 비어 있으면 빈 배열을 반환한다.
 */
export function detectPatterns(
    _bars: Bar[],
    activePatterns: PatternType[]
): PatternResult[] {
    if (activePatterns.length === 0) return [];
    return [];
}

/**
 * 애널리스트 등급 분포의 밴드 순서와 합계 판정.
 */
import type { FundamentalGradesConsensusInput } from '@y0ngha/siglens-core';

/** 강한 매수 → 강한 매도 순서의 밴드 키. 막대와 범례가 이 순서를 따른다. */
export const GRADE_BAND_KEYS = [
    'strongBuy',
    'buy',
    'hold',
    'sell',
    'strongSell',
] as const;

/** 등급 밴드 키. */
export type GradeBandKey = (typeof GRADE_BAND_KEYS)[number];

/** 등급 분포의 총 건수. */
export function totalGrades(grades: FundamentalGradesConsensusInput): number {
    return GRADE_BAND_KEYS.reduce((sum, key) => sum + grades[key], 0);
}

/**
 * 표시할 등급이 있는가. 전부 0이면 막대를 그릴 수 없으므로 없는 것으로 본다 —
 * 그렇지 않으면 제목만 남은 빈 섹션이 렌더된다.
 */
export function hasGrades(
    grades: FundamentalGradesConsensusInput | null
): grades is FundamentalGradesConsensusInput {
    return grades !== null && totalGrades(grades) > 0;
}

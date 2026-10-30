/**
 * 등급(A~F) → 배지·진행 막대·큰 글자 색 조회. 등급 램프(grade-*) 토큰을 쓴다.
 */
import type { FinancialsGrade } from '@y0ngha/siglens-core';

/**
 * 등급 배지 배경 + 글자색.
 *
 * 칩 텍스트는 `-text` 변형을 쓴다 — 기본 `grade-*`는 게이지 스트로크와 36px 대형 등급 글자(3:1)를
 * 겨냥한 값이라, 자기 /10 틴트 위 14px 굵은 글씨로 쓰면 라이트에서 4.32~4.48:1로 AA에 미달한다.
 */
export const GRADE_BADGE_CLASS: Record<FinancialsGrade, string> = {
    A: 'bg-grade-a/10 text-grade-a-text',
    B: 'bg-grade-b/10 text-grade-b-text',
    C: 'bg-grade-c/10 text-grade-c-text',
    D: 'bg-grade-d/10 text-grade-d-text',
    F: 'bg-grade-f/10 text-grade-f-text',
};

/** 축 점수 진행 막대(0–100)의 채움색. */
export const GRADE_PROGRESS_CLASS: Record<FinancialsGrade, string> = {
    A: 'bg-grade-a',
    B: 'bg-grade-b',
    C: 'bg-grade-c',
    D: 'bg-grade-d',
    F: 'bg-grade-f',
};

/**
 * 게이지 중앙의 큰 등급 글자색. `text-4xl font-bold`(36px)는 WCAG의 큰 텍스트라 기준이 3:1이므로
 * `-text` 변형이 필요 없다.
 */
export const GRADE_TEXT_COLOR: Record<FinancialsGrade, string> = {
    A: 'text-grade-a',
    B: 'text-grade-b',
    C: 'text-grade-c',
    D: 'text-grade-d',
    F: 'text-grade-f',
};

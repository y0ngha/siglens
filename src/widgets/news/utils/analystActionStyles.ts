/**
 * 애널리스트 등급 변경 행의 표시 테이블 — 액션별 라벨 키, 배지 색, 행 강조선.
 */
import type { GradesAction } from '@y0ngha/siglens-core';
import { SENTIMENT_CLASS } from '@/shared/lib/sentimentDisplay';

/**
 * GradesAction → `shared.enumLabel.gradesAction` 카탈로그 키. 소비 파일이 `tLabel(ACTION_LABEL_KEY[...])`를
 * 직접 호출해야 추출기가 `shared.enumLabel`을 그 라우트의 클라이언트 번들에 싣는다.
 */
export const ACTION_LABEL_KEY: Record<GradesAction, string> = {
    upgrade: 'gradesAction.upgrade',
    downgrade: 'gradesAction.downgrade',
    maintained: 'gradesAction.maintained',
    initiated: 'gradesAction.initiated',
    other: 'gradesAction.other',
};

/** 중립 배지는 뉴스 감성 중립과 같은 공유 토큰을 쓴다 — AA 대비 보정(`-300`)을 한 곳에서 유지한다. */
const NEUTRAL_BADGE_CLASS = SENTIMENT_CLASS.neutral;

/** 액션별 배지 색. */
export const ACTION_CLASS: Record<GradesAction, string> = {
    upgrade: 'bg-ui-success/10 text-ui-success-text',
    downgrade: 'bg-ui-danger/10 text-ui-danger-text',
    maintained: NEUTRAL_BADGE_CLASS,
    initiated: 'bg-ui-warning/10 text-ui-warning-text',
    other: NEUTRAL_BADGE_CLASS,
};

/** 액션별 행 왼쪽 강조선. */
export const ROW_ACCENT_CLASS: Record<GradesAction, string> = {
    upgrade: 'border-l-[3px] border-l-chart-bullish',
    downgrade: 'border-l-[3px] border-l-chart-bearish',
    maintained: 'border-l-[3px] border-l-secondary-600',
    initiated: 'border-l-[3px] border-l-ui-warning',
    other: 'border-l-[3px] border-l-secondary-600',
};

/**
 * Canonical **message key** for the reasoning feature's user-facing name
 * (`features.reasoning-toggle.a11y`).
 *
 * Single source of truth for the label so the toggle control
 * (`ReasoningToggle`) and the signup-nudge copy (`AnalysisSignupNudgeModal`)
 * never drift apart (CONVENTIONS.md#NC-1 — hardcoded-string duplication trap).
 *
 * 문자열이 아니라 키인 이유: 리터럴이면 모든 로케일에 한 언어의 이름이 나간다.
 * 두 소비자 모두 같은 키를 `t()`로 푼다.
 */
export const REASONING_FEATURE_LABEL_KEY = 'featureLabel';

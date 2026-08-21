/**
 * Canonical **message key** for the reasoning feature's user-facing name
 * (`features.reasoning-toggle.a11y`).
 *
 * Single source of truth for the label so the toggle control
 * (`ReasoningToggle`) and the signup-nudge copy (`AnalysisSignupNudgeModal`)
 * never drift apart (MISTAKES §15 — hardcoded-string duplication trap).
 *
 * 문자열이 아니라 키인 이유: 예전엔 한국어 리터럴이라 `/en`의 토글이 영어 UI
 * 안에서 `상세 분석`을 렌더했다. 두 소비자 모두 같은 키를 `t()`로 푼다.
 */
export const REASONING_FEATURE_LABEL_KEY = 'featureLabel';

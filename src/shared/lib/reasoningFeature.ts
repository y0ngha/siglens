/**
 * Canonical user-facing name of the reasoning ("상세 분석") feature.
 *
 * Single source of truth for the label so the toggle control
 * (`ReasoningToggle`) and the signup-nudge copy (`AnalysisSignupNudgeModal`)
 * never drift apart (MISTAKES §15 — hardcoded-string duplication trap). The
 * exact visible text must stay identical across every surface that names the
 * feature, so both consumers compose their strings from this constant.
 */
export const REASONING_FEATURE_LABEL = '상세 분석';

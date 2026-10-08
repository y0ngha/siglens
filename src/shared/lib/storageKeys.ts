export const LOCAL_STORAGE_ANALYSIS_MODEL_KEY =
    'siglens:selected-analysis-model';

/**
 * One-time flag marking that the legacy analysis-model migration has run in this
 * browser. Once set, users who stored the old default (`gemini-3.5-flash-lite`)
 * were moved to the new DeepSeek default; any later switch back to flash-lite is
 * a deliberate post-flip choice and must never be migrated again.
 */
export const LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY =
    'siglens_analysis_model_deepseek_migrated';

/**
 * Member "깊은 생각"(reasoning) toggle — member-reasoning-toggle spec Part A.
 * Persists the user's opt-in intent across sessions. Default OFF. The
 * *effective* value sent to the server is still gated by tier (free/anon
 * always forced off server-side) — this key only remembers the member's
 * preference so it survives a page reload.
 */
export const LOCAL_STORAGE_REASONING_KEY = 'siglens_reasoning_on';

/**
 * Anonymous distinct-symbol analysis counter — member-reasoning-toggle spec
 * Part B. Stores `{ dateUtc, symbols }`; resets on UTC date change. See
 * `shared/lib/anonAnalysisCount.ts`.
 */
export const LOCAL_STORAGE_ANON_ANALYZED_SYMBOLS_KEY =
    'siglens_anon_analyzed_symbols';

/**
 * "이미 오늘 넛지를 보여줬다" 플래그 — 같은 날 여러 종목을 분석해 문턱을 다시 넘어도
 * 모달을 반복 노출하지 않기 위한 nag-prevention 플래그. anonAnalysisCount와
 * 동일하게 UTC 날짜 기준으로 리셋된다.
 */
export const LOCAL_STORAGE_ANON_NUDGE_SHOWN_KEY = 'siglens_anon_nudge_shown';

/**
 * 비회원 가입 넛지 모달이 마지막으로 보여 준 문구 종류(`SignupNudgeVariant`). 다음 넛지는
 * 다른 문구를 보여 준다 — 같은 모달로 "상세 분석"과 "메일 리포트"를 번갈아 알린다.
 */
export const LOCAL_STORAGE_ANON_NUDGE_VARIANT_KEY =
    'siglens_anon_nudge_variant';

/**
 * 회원 메일 리포트 넛지 기록 — 회원 id별 `{ setupShown, symbolCounts, symbolsNudged,
 * lastSymbolNudgeAt }`. `features/email-report-nudge/lib/memberNudgeStorage.ts` 참조.
 */
export const LOCAL_STORAGE_MEMBER_EMAIL_REPORT_NUDGE_KEY =
    'siglens_member_email_report_nudge';

/**
 * "이 탭에서 넛지 모달을 이미 띄웠다" 플래그(sessionStorage). 한 세션에 넛지 모달은
 * 종류와 관계없이 하나만 띄운다.
 */
export const SESSION_STORAGE_NUDGE_SHOWN_KEY = 'siglens_nudge_shown_session';

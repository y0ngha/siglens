export const LOCAL_STORAGE_PROVIDER_KEY = 'siglens:selected-provider';
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
 * "이미 오늘 넛지를 보여줬다" 플래그 — 같은 날 여러 번 3-심볼 문턱을 재도달해도
 * 모달을 반복 노출하지 않기 위한 nag-prevention 플래그. anonAnalysisCount와
 * 동일하게 UTC 날짜 기준으로 리셋된다.
 */
export const LOCAL_STORAGE_ANON_NUDGE_SHOWN_KEY = 'siglens_anon_nudge_shown';

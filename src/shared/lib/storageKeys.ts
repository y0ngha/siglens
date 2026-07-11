export const LOCAL_STORAGE_PROVIDER_KEY = 'siglens:selected-provider';
export const LOCAL_STORAGE_ANALYSIS_MODEL_KEY =
    'siglens:selected-analysis-model';

/**
 * One-time flag marking that the legacy analysis-model migration has run in this
 * browser. Once set, users who stored the old default (`gemini-2.5-flash-lite`)
 * were moved to the new DeepSeek default; any later switch back to flash-lite is
 * a deliberate post-flip choice and must never be migrated again.
 */
export const LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY =
    'siglens_analysis_model_deepseek_migrated';

/**
 * Canonical key `useChat` persists the selected CHAT model under. Defined here
 * (not in `useChat.ts`) so the one-time chat-model migration in
 * `features/symbol-model/lib/migrateChatModel.ts` and `useChat` share a single
 * source of truth instead of duplicating the string literal across layers.
 */
export const LOCAL_STORAGE_CHAT_MODEL_KEY = 'siglens_chat_model';

/**
 * One-time flag marking that the legacy chat-model migration has run in this
 * browser. Mirrors `LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY` but for the CHAT
 * model default, which also flipped (from `gemini-2.5-flash` to the DeepSeek
 * default). Once set, a later deliberate switch back to `gemini-2.5-flash` is
 * preserved forever.
 */
export const LOCAL_STORAGE_CHAT_MODEL_MIGRATION_KEY =
    'siglens_chat_model_deepseek_migrated';

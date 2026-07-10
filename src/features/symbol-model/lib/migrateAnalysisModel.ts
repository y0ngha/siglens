import {
    DEEPSEEK_V4_FLASH_MODEL,
    GEMINI_2_5_FLASH_LITE_MODEL,
} from '@y0ngha/siglens-core';
import {
    LOCAL_STORAGE_ANALYSIS_MODEL_KEY,
    LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY,
} from '@/shared/lib/storageKeys';

/**
 * One-time migration of the persisted analysis model from the legacy default
 * (`gemini-2.5-flash-lite`) to the current default (`deepseek-v4-flash`).
 *
 * WHY a one-time flag distinguishes the two user groups:
 *   Before the DeepSeek default flip, the analysis model default was
 *   `gemini-2.5-flash-lite`, so any user who never touched the model selector
 *   has that exact value stored. After the flip, `deepseek-v4-flash` is the
 *   default. We want to move the first group forward WITHOUT touching users who
 *   *deliberately* pick `gemini-2.5-flash-lite` after the flip.
 *
 *   The migration runs exactly once per browser (guarded by the migration flag).
 *   At migration time, a stored `gemini-2.5-flash-lite` can only mean "old
 *   default" → migrate it. Once the flag is set, the migration never runs again,
 *   so a later deliberate switch back to flash-lite is preserved forever.
 *
 * Idempotent and SSR-safe: no-ops when `window` is undefined and returns early
 * once the flag is present. Only the exact legacy-default value is rewritten —
 * any other stored model (gpt, claude, gemini-2.5-flash, etc.) is left intact.
 */
export function migrateLegacyAnalysisModel(): void {
    if (typeof window === 'undefined') return;

    // Already migrated in this browser — never touch the stored model again.
    if (
        localStorage.getItem(LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY) !==
        null
    ) {
        return;
    }

    const stored = localStorage.getItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY);
    if (stored === GEMINI_2_5_FLASH_LITE_MODEL) {
        localStorage.setItem(
            LOCAL_STORAGE_ANALYSIS_MODEL_KEY,
            DEEPSEEK_V4_FLASH_MODEL
        );
    }

    // Always set the flag — even when there was nothing to migrate — so the
    // migration runs exactly once and later flash-lite choices stay untouched.
    localStorage.setItem(LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY, '1');
}

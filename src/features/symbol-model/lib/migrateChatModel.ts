import {
    DEEPSEEK_V4_FLASH_MODEL,
    GEMINI_2_5_FLASH_MODEL,
} from '@y0ngha/siglens-core';
import {
    LOCAL_STORAGE_CHAT_MODEL_KEY,
    LOCAL_STORAGE_CHAT_MODEL_MIGRATION_KEY,
} from '@/shared/lib/storageKeys';

/**
 * One-time migration of the persisted CHAT model from the legacy default
 * (`gemini-2.5-flash`) to the current default (`deepseek-v4-flash`).
 *
 * Mirrors `migrateLegacyAnalysisModel` (see that file for the full rationale on
 * why a one-time flag is required) but for the chat surface: `useChat` defaults
 * to `DEEPSEEK_V4_FLASH_MODEL` post-flip, but it also auto-persists
 * `selectedModel` to localStorage even without explicit user interaction. Any
 * chat user who never touched the model selector therefore has the exact
 * legacy default stored and needs the same one-time nudge forward.
 *
 * The migration runs exactly once per browser (guarded by the migration flag).
 * At migration time, a stored `gemini-2.5-flash` can only mean "old default" →
 * migrate it. Once the flag is set, the migration never runs again, so a later
 * deliberate switch back to `gemini-2.5-flash` is preserved forever.
 *
 * Idempotent and SSR-safe: no-ops when `window` is undefined and returns early
 * once the flag is present. Only the exact legacy-default value is rewritten —
 * any other stored model (gpt, claude, gemini-2.5-flash-lite, etc.) is left
 * intact.
 *
 * Wrapped in try/catch: some browsers (incognito / storage-blocked) throw a
 * `SecurityError` on `localStorage` access. A failed migration must never crash
 * the app at mount, so any storage error is swallowed and treated as a no-op.
 */
export function migrateLegacyChatModel(): void {
    if (typeof window === 'undefined') return;

    try {
        // Already migrated in this browser — never touch the stored model again.
        if (
            localStorage.getItem(LOCAL_STORAGE_CHAT_MODEL_MIGRATION_KEY) !==
            null
        ) {
            return;
        }

        const stored = localStorage.getItem(LOCAL_STORAGE_CHAT_MODEL_KEY);
        if (stored === GEMINI_2_5_FLASH_MODEL) {
            localStorage.setItem(
                LOCAL_STORAGE_CHAT_MODEL_KEY,
                DEEPSEEK_V4_FLASH_MODEL
            );
        }

        // Always set the flag — even when there was nothing to migrate — so the
        // migration runs exactly once and later gemini-2.5-flash choices stay
        // untouched.
        localStorage.setItem(LOCAL_STORAGE_CHAT_MODEL_MIGRATION_KEY, '1');
    } catch {
        // SecurityError (incognito / storage-blocked) — no-op, never crash at mount.
    }
}

import { DEEPSEEK_V4_1_FLASH_MODEL } from '@y0ngha/siglens-core';

/**
 * localStorage에 남아 있을 수 있는 **과거** 모델 ID들.
 *
 * core 레지스트리에서 제거된 값이라 `ModelId`로 표현할 수 없고, 상수도 함께
 * 사라졌으므로 리터럴로 고정한다. 이 목록은 "지금 고를 수 있는 모델"이 아니라
 * "예전에 저장됐을 수 있는 문자열"이므로, 레지스트리가 바뀌어도 따라 바꾸면 안
 * 된다 — 바꾸는 순간 마이그레이션이 겨냥하던 사용자를 놓친다.
 */
const LEGACY_GEMINI_2_5_FLASH = 'gemini-2.5-flash';
const LEGACY_GEMINI_2_5_FLASH_LITE = 'gemini-2.5-flash-lite';
import {
    LOCAL_STORAGE_CHAT_MODEL_KEY,
    LOCAL_STORAGE_CHAT_MODEL_MIGRATION_KEY,
    LOCAL_STORAGE_CHAT_MODEL_MIGRATION_V2_KEY,
} from '@/shared/lib/storageKeys';

/**
 * Models the chat surface migrates away from, per migration pass.
 *
 * Pass 1 moved the original legacy default (`gemini-2.5-flash`). Pass 2 adds
 * `gemini-2.5-flash-lite`: it was never the chat default, but chat auto-persists
 * `selectedModel` even without user interaction, so plenty of browsers hold it
 * from an earlier selector state, and DeepSeek is both cheaper and stronger for
 * this surface.
 *
 * Note the deliberate difference from `migrateLegacyAnalysisModel`: that one
 * only ever rewrites a value that *was* the default, so a post-flip choice is
 * always preserved. Pass 2 here can also rewrite a flash-lite that the user
 * picked on purpose. That is the intended product call — flash-lite is being
 * retired as a chat option — and it still happens at most once per browser, so
 * a re-selection after the migration sticks forever.
 */
const PASSES = [
    {
        flag: LOCAL_STORAGE_CHAT_MODEL_MIGRATION_KEY,
        from: [LEGACY_GEMINI_2_5_FLASH],
    },
    {
        flag: LOCAL_STORAGE_CHAT_MODEL_MIGRATION_V2_KEY,
        from: [LEGACY_GEMINI_2_5_FLASH_LITE, LEGACY_GEMINI_2_5_FLASH],
    },
] as const;

/**
 * One-time migration of the persisted CHAT model to `deepseek-v4-flash`.
 *
 * Runs each pass in {@link PASSES} at most once per browser, guarded by that
 * pass's own flag. A browser that already ran pass 1 skips it and runs only
 * pass 2 — which is the whole reason pass 2 carries a separate flag rather than
 * extending pass 1's model list (an extended list would never execute for the
 * already-migrated majority).
 *
 * Idempotent and SSR-safe: no-ops when `window` is undefined, and a pass whose
 * flag is present is skipped entirely. Only the listed models are rewritten —
 * any other stored model (gpt, claude, …) is left intact. Each pass sets its
 * flag even when there was nothing to rewrite, so it never runs twice.
 *
 * Wrapped in try/catch: some browsers (incognito / storage-blocked) throw a
 * `SecurityError` on `localStorage` access. A failed migration must never crash
 * the app at mount, so any storage error is swallowed and treated as a no-op.
 */
export function migrateLegacyChatModel(): void {
    if (typeof window === 'undefined') return;

    try {
        for (const pass of PASSES) {
            if (localStorage.getItem(pass.flag) !== null) continue;

            const stored = localStorage.getItem(LOCAL_STORAGE_CHAT_MODEL_KEY);
            if (
                stored !== null &&
                (pass.from as readonly string[]).includes(stored)
            ) {
                localStorage.setItem(
                    LOCAL_STORAGE_CHAT_MODEL_KEY,
                    DEEPSEEK_V4_1_FLASH_MODEL
                );
            }

            localStorage.setItem(pass.flag, '1');
        }
    } catch {
        // SecurityError (incognito / storage-blocked) — no-op, never crash at mount.
    }
}

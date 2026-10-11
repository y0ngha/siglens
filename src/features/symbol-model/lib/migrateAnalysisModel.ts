import { DEEPSEEK_V4_1_FLASH_MODEL, type ModelId } from '@y0ngha/siglens-core';
import {
    LOCAL_STORAGE_ANALYSIS_MODEL_KEY,
    LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY,
} from '@/shared/lib/storageKeys';

/**
 * localStorage에 남아 있을 수 있는 **과거** 모델 ID들.
 *
 * core 레지스트리에서 제거된 값이라 `ModelId`로 표현할 수 없고, 상수도 함께
 * 사라졌으므로 리터럴로 고정한다. 이 목록은 "지금 고를 수 있는 모델"이 아니라
 * "예전에 저장됐을 수 있는 문자열"이므로, 레지스트리가 바뀌어도 따라 바꾸면 안
 * 된다 — 바꾸는 순간 마이그레이션이 겨냥하던 사용자를 놓친다.
 */
const LEGACY_GEMINI_2_5_FLASH_LITE = 'gemini-2.5-flash-lite';

/**
 * 제공사가 지원을 종료하고 후속 모델로 자동 리다이렉트하는 모델 → 그 후속 모델.
 *
 * 키는 위 목록과 같은 이유로 리터럴이다(레지스트리에서 빠져 `ModelId`가 아니다).
 * `gemini-3.7-flash`는 2026-10 Google이 지원을 종료하고 `gemini-3.8-flash`로
 * 리다이렉트한다(가격 동일). 그냥 두면 allowlist 검증에서 탈락해 기본 모델
 * (DeepSeek)로 떨어지므로, 사용자가 고른 계열을 유지하도록 후속 모델로 옮긴다.
 */
const RETIRED_MODEL_SUCCESSORS: ReadonlyMap<string, ModelId> = new Map([
    ['gemini-3.7-flash', 'gemini-3.8-flash'],
]);

/**
 * One-time migration of the persisted analysis model from the legacy default
 * (`gemini-2.5-flash-lite`) to the current default (`deepseek-v4.1-flash`).
 *
 * WHY a one-time flag distinguishes the two user groups:
 *   Before the DeepSeek default flip, the analysis model default was
 *   `gemini-2.5-flash-lite`, so any user who never touched the model selector
 *   has that exact value stored. After the flip, `deepseek-v4.1-flash` is the
 *   default. We want to move the first group forward WITHOUT touching users who
 *   *deliberately* pick `gemini-2.5-flash-lite` after the flip.
 *
 *   The migration runs exactly once per browser (guarded by the migration flag).
 *   At migration time, a stored `gemini-2.5-flash-lite` can only mean "old
 *   default" → migrate it. Once the flag is set, the migration never runs again,
 *   so a later deliberate switch back to flash-lite is preserved forever.
 *   The flag is set **even when there was nothing to rewrite** for the same reason.
 *
 * SSR-safe (no-op without `window`). Wrapped in try/catch: some browsers
 * (incognito / storage-blocked) throw a `SecurityError` on `localStorage`
 * access, and a failed migration must never crash the app at mount.
 */
export function migrateLegacyAnalysisModel(): void {
    if (typeof window === 'undefined') return;

    try {
        if (
            localStorage.getItem(LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY) !==
            null
        ) {
            return;
        }
        if (
            localStorage.getItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY) ===
            LEGACY_GEMINI_2_5_FLASH_LITE
        ) {
            localStorage.setItem(
                LOCAL_STORAGE_ANALYSIS_MODEL_KEY,
                DEEPSEEK_V4_1_FLASH_MODEL
            );
        }
        localStorage.setItem(LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY, '1');
    } catch {
        // SecurityError (incognito / storage-blocked) — no-op, never crash at mount.
    }
}

/**
 * 저장된 분석 모델이 퇴역 모델이면 후속 모델로 바꾼다.
 *
 * {@link migrateLegacyAnalysisModel}과 달리 1회 플래그가 없다. 퇴역 모델은
 * 다시 고를 수 없으므로 저장값이 퇴역 ID라면 언제나 "예전 선택"이고, 매 읽기마다
 * 옮겨도 사용자의 의도적 선택을 덮을 일이 없다.
 *
 * SSR-safe, 저장소 차단 시 no-op — 형제 마이그레이션과 같은 이유.
 */
export function migrateRetiredAnalysisModel(): void {
    if (typeof window === 'undefined') return;

    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY);
        const successor =
            stored === null ? undefined : RETIRED_MODEL_SUCCESSORS.get(stored);
        if (successor === undefined) return;
        localStorage.setItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY, successor);
    } catch {
        // SecurityError (incognito / storage-blocked) — no-op, never crash at mount.
    }
}

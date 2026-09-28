import { DEEPSEEK_V4_1_FLASH_MODEL } from '@y0ngha/siglens-core';
import {
    LOCAL_STORAGE_ANALYSIS_MODEL_KEY,
    LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY,
} from '@/shared/lib/storageKeys';
import { runModelMigrationPasses } from './runModelMigrationPasses';

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
 *
 * The flag/rewrite/try-catch mechanics live in `runModelMigrationPasses`.
 */
export function migrateLegacyAnalysisModel(): void {
    runModelMigrationPasses({
        storageKey: LOCAL_STORAGE_ANALYSIS_MODEL_KEY,
        to: DEEPSEEK_V4_1_FLASH_MODEL,
        passes: [
            {
                flag: LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY,
                from: [LEGACY_GEMINI_2_5_FLASH_LITE],
            },
        ],
    });
}

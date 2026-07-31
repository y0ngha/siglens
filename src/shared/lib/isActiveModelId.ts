import type { ActiveModelId } from '@y0ngha/siglens-core';
import { MODEL_SPECS } from '@y0ngha/siglens-core';

/**
 * Type guard verifying that a raw string is a known {@link ActiveModelId} —
 * i.e. an own key of siglens-core's `MODEL_SPECS` map.
 *
 * Uses `Object.hasOwn` (not the `in` operator) to narrow the union without an
 * unsafe cast. `in` also matches inherited `Object.prototype` keys (`toString`,
 * `constructor`, `valueOf`, `__proto__`, …) since `MODEL_SPECS` is a plain
 * object literal — `'constructor' in MODEL_SPECS` is `true` even though
 * `MODEL_SPECS` has no own `constructor` model entry. `Object.hasOwn` only
 * matches own properties, so those prototype-chain keys correctly fail the
 * guard and the caller can safely treat a `false` result as "not a real
 * model" (e.g. throw, or fall back to a default) instead of letting
 * `MODEL_SPECS[model]` resolve to an inherited function/object that would
 * misbehave on a subsequent property access.
 *
 * Extracted to `shared/lib` because it is used from two different entity
 * slices — `entities/llm-provider/api/router.ts` (`isActiveModelId` there
 * throws `[router] Unknown model` on a `false` result) and
 * `entities/ticker/lib/config.ts` (`isValidGeminiModel` layers Gemini
 * provider + disabled-thinking-allowlist checks on top of this own-property
 * check) — and FSD forbids cross-slice imports between entities, so neither
 * slice may import the other's copy.
 */
export function isActiveModelId(model: string): model is ActiveModelId {
    return Object.hasOwn(MODEL_SPECS, model);
}

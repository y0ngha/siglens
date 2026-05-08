import { isFreeModel } from '@y0ngha/siglens-core';
import type { ModelId } from '@y0ngha/siglens-core';

/**
 * Returns true if the model is in the free tier (i.e., the platform/server pays
 * for inference). Delegates to siglens-core's `isFreeModel` for a single
 * source of truth across analysis and chat call sites.
 *
 * Like `isFreeModel`, this is a classifier of the model's intrinsic tier class
 * — it intentionally ignores `enableTierRestrictions`.
 */
export function isFreeChatModel(model: ModelId): boolean {
    return isFreeModel(model);
}

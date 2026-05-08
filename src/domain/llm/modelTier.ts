import { TIER_CONFIG } from '@y0ngha/siglens-core';
import type { ModelId } from '@y0ngha/siglens-core';

// Returns true if the model is in the free tier. Does not use getAllowedModels to avoid tier-restriction bypass.
export function isFreeChatModel(model: ModelId): boolean {
    // includes() requires string[], not readonly ModelId[] — widening is safe since TIER_CONFIG.models.free is always strings.
    return (TIER_CONFIG.models.free as readonly string[]).includes(model);
}

import { TIER_CONFIG, getProviderForModel } from '@y0ngha/siglens-core';
import type { ModelId, LlmProvider } from '@y0ngha/siglens-core';

/** Returns true if the model is in the free tier. Does not use getAllowedModels to avoid tier-restriction bypass. */
export function isFreeChatModel(model: ModelId): boolean {
    // Cast is safe: TierModel (ModelId) is a string union; includes() accepts only the union
    // member type, so widening to string[] is required for the runtime string comparison.
    return (TIER_CONFIG.models.free as readonly string[]).includes(model);
}

/** Returns the LLM provider required to use the given model. */
export function getRequiredProviderForModel(model: ModelId): LlmProvider {
    return getProviderForModel(model);
}

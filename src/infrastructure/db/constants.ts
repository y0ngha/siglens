import type {
    OAuthProvider,
    Tier,
    UsageActionType,
} from '@y0ngha/siglens-core';
import { LLM_PROVIDER_VALUES } from '@/domain/llm';

export { LLM_PROVIDER_VALUES };

/**
 * Database enum values for the user `tier` column. Mirrors the
 * `Tier` union exported from `@y0ngha/siglens-core` so the Postgres enum
 * stays in lockstep with the type used by tier-gating logic.
 */
export const USER_TIER_VALUES = [
    'free',
    'member',
    'pro',
] as const satisfies readonly Tier[];

/** All valid usage action type values tracked in usage logs. */
export const USAGE_ACTION_TYPE_VALUES = [
    'analysis',
    'chatbot',
    'premium_model',
] as const satisfies readonly UsageActionType[];

/** All supported OAuth provider identifiers. */
export const OAUTH_PROVIDER_VALUES = [
    'google',
    'kakao',
    'apple',
] as const satisfies readonly OAuthProvider[];

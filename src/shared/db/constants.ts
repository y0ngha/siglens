import type { Tier, UsageActionType } from '@y0ngha/siglens-core';
import type { OAuthProvider } from '@/shared/lib/types';
// Barrel import creates circular dependency:
// api-key/index → api-key/api → shared/db/schema → shared/db/constants → api-key/index.
// Direct lib import breaks the cycle. Safe: constants file has no DB/schema dependency.
// eslint-disable-next-line no-restricted-imports
import { LLM_PROVIDER_VALUES } from '@/entities/api-key/lib/constants';

export { LLM_PROVIDER_VALUES };

/** Database enum values for the user `tier` column; mirrors the `Tier` union from `@y0ngha/siglens-core` to keep the Postgres enum in lockstep. */
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

/** Legal terms document kinds tracked in the `terms` table. */
export const TERMS_KIND_VALUES = ['privacy', 'tos'] as const;
export type TermsKind = (typeof TERMS_KIND_VALUES)[number];

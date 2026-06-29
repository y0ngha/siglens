import type { Tier, UsageActionType } from '@y0ngha/siglens-core';
import type { OAuthProvider } from '@/shared/lib/types';
import { LLM_PROVIDER_VALUES } from '../config/llmProviders';

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

/** All valid shareable analysis kinds — used as a Postgres enum and UI discriminant. */
export const SHAREABLE_KIND_VALUES = [
    'chart',
    'overall',
    'news',
    'fundamental',
    'financials',
    'congress',
    'options',
    'fear-greed',
] as const;
export type ShareableKind = (typeof SHAREABLE_KIND_VALUES)[number];

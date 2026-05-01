import { DEFAULT_TIER, type Tier } from '@y0ngha/siglens-core';
import type { GetUserTierInput, UserTierDependencies } from './types';

/**
 * Look up a user's tier from persistence.
 *
 * Missing users degrade to the default free tier so callers can keep request
 * handling deterministic while treating unknown accounts as least privileged.
 *
 * @param input - Identifies the user whose tier should be looked up.
 * @param dependencies - Repository providing tier persistence access.
 * @returns The persisted tier, or the default free tier when the user is not found.
 *
 * @example
 * ```ts
 * const tier = await getUserTier(
 *     { userId: session.userId },
 *     { users: userTierRepository }
 * );
 * ```
 *
 * @see {@link UserTierRepository.getUserTier}
 */
export async function getUserTier(
    input: GetUserTierInput,
    dependencies: UserTierDependencies
): Promise<Tier> {
    const tier = await dependencies.users.getUserTier(input.userId);

    return tier ?? DEFAULT_TIER;
}

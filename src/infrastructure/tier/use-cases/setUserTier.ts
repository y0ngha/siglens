import type {
    SetUserTierInput,
    SetUserTierResult,
    UserTierDependencies,
} from './types';

/**
 * Manually change a user's tier for admin workflows.
 *
 * @param input - Target user id and the new tier to persist.
 * @param dependencies - Repository providing tier persistence access.
 * @returns A discriminated result indicating success with the persisted tier or
 *          a structured `user_not_found` error when the target user does not exist.
 *
 * @example
 * ```ts
 * const result = await setUserTier(
 *     { userId: 'user-1', tier: 'pro' },
 *     { users: userTierRepository }
 * );
 * if (!result.ok) {
 *     // result.error.code === 'user_not_found'
 * }
 * ```
 *
 * @see {@link UserTierRepository.updateUserTier}
 */
export async function setUserTier(
    input: SetUserTierInput,
    dependencies: UserTierDependencies
): Promise<SetUserTierResult> {
    const tier = await dependencies.users.updateUserTier(
        input.userId,
        input.tier
    );

    return tier === null
        ? {
              ok: false,
              error: { code: 'user_not_found', message: 'User was not found' },
          }
        : { ok: true, userId: input.userId, tier };
}

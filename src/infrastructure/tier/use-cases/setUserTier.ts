import type {
    SetUserTierInput,
    SetUserTierResult,
    UserTierDependencies,
} from './types';

/** Manually change a user's tier for admin workflows; returns a discriminated result with a `user_not_found` error when missing. */
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

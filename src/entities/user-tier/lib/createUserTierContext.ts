import { DEFAULT_TIER, type UserTierContext } from '@y0ngha/siglens-core';
import type {
    CreateUserTierContextInput,
    UserTierDependencies,
} from '../model';

/** Build request-scoped tier context; anonymous requests get the default free tier, missing accounts fall back to free. */
export async function createUserTierContext(
    input: CreateUserTierContextInput,
    dependencies: UserTierDependencies
): Promise<UserTierContext> {
    const userId = input.userId ?? null;
    const tier =
        userId === null
            ? DEFAULT_TIER
            : ((await dependencies.users.getUserTier(userId)) ?? DEFAULT_TIER);

    return { userId, tier };
}

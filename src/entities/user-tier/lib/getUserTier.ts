import { DEFAULT_TIER, type Tier } from '@y0ngha/siglens-core';
import type {
    GetUserTierInput,
    UserTierDependencies,
} from '@/infrastructure/tier/use-cases/types';

/** Look up a user's tier from persistence; missing users degrade to the default free tier (least privileged). */
export async function getUserTier(
    input: GetUserTierInput,
    dependencies: UserTierDependencies
): Promise<Tier> {
    const tier = await dependencies.users.getUserTier(input.userId);

    return tier ?? DEFAULT_TIER;
}

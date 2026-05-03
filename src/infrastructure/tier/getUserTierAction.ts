'use server';

import { DEFAULT_TIER, type Tier } from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleUserRepository } from '@/infrastructure/db/userRepository';
import { getUserTier } from '@/infrastructure/tier/use-cases/getUserTier';

/**
 * Server action that resolves the current user's tier for client-side gating.
 *
 * Returns {@link DEFAULT_TIER} (`'free'`) for guests and for authenticated
 * users without a persisted tier row, mirroring the server-side gates used by
 * the analysis and chat pipelines.
 */
export async function getUserTierAction(): Promise<Tier> {
    const user = await getCurrentUser();
    if (user === null) {
        return DEFAULT_TIER;
    }
    const { db } = getDatabaseClient();
    return getUserTier(
        { userId: user.id },
        { users: new DrizzleUserRepository(db) }
    );
}

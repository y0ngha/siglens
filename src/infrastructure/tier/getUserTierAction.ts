'use server';

import { DEFAULT_TIER, type Tier } from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleUserRepository } from '@/entities/user';
import { getUserTier } from '@/infrastructure/tier/use-cases/getUserTier';

/** Resolve the current user's tier for client-side gating; falls back to DEFAULT_TIER for guests/unset users. */
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

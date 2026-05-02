'use server';

import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleUserApiKeyRepository } from '@/infrastructure/db/userApiKeyRepository';
import type { RegisteredProvider } from '@/infrastructure/llm/types';

/**
 * Returns the list of LLM providers for which the current user has a
 * registered API key. Returns an empty array when the user is not logged in
 * or has no registered keys.
 */
export async function getRegisteredProvidersAction(): Promise<
    RegisteredProvider[]
> {
    const user = await getCurrentUser();
    if (user === null) return [];

    const { db } = getDatabaseClient();
    const repo = new DrizzleUserApiKeyRepository(db);
    const records = await repo.findByUser(user.id);

    return records.map(r => ({
        provider: r.provider,
        updatedAt: r.updatedAt,
    }));
}

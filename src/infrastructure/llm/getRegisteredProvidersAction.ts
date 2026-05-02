'use server';

import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleUserApiKeyRepository } from '@/infrastructure/db/userApiKeyRepository';
import type { RegisteredProvider } from '@/infrastructure/llm/types';

export async function getRegisteredProvidersAction(): Promise<
    RegisteredProvider[]
> {
    const user = await getCurrentUser();
    if (user === null) {
        return [];
    }

    const { db } = getDatabaseClient();
    const rows = await new DrizzleUserApiKeyRepository(db).findByUser(user.id);

    return rows
        .map(
            (row): RegisteredProvider => ({
                provider: row.provider,
                updatedAt: row.updatedAt,
            })
        )
        .sort((a, b) => a.provider.localeCompare(b.provider));
}

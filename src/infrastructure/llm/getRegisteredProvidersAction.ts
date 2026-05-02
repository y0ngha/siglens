'use server';

import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleUserApiKeyRepository } from '@/infrastructure/db/userApiKeyRepository';
import type { RegisteredProvider } from '@/domain/llm';

export async function getRegisteredProvidersAction(): Promise<
    RegisteredProvider[]
> {
    const user = await getCurrentUser();
    if (user === null) {
        return [];
    }

    try {
        const { db } = getDatabaseClient();
        const rows = await new DrizzleUserApiKeyRepository(db).findByUser(
            user.id
        );

        return rows
            .map(
                (row): RegisteredProvider => ({
                    provider: row.provider,
                    updatedAt: row.updatedAt,
                })
            )
            .toSorted((a, b) => a.provider.localeCompare(b.provider));
    } catch {
        return [];
    }
}

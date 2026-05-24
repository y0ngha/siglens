'use server';

import { getCurrentUser } from '@/entities/session/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleUserApiKeyRepository } from '@/entities/api-key';
import type { RegisteredProvider } from '../lib/types';

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
    } catch (error) {
        // Preserve the [] return shape for backward compatibility with the
        // existing UI consumer, but never silently swallow the failure — log
        // for observability so DB outages remain debuggable.
        console.error(
            '[getRegisteredProvidersAction] Failed to load registered providers',
            error
        );
        return [];
    }
}

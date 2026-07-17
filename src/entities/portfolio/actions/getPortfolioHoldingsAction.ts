'use server';

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { toView } from '../lib/toView';
import type { PortfolioHoldingView } from '../model';

/** Returns the current member's holdings, or `[]` when logged out — never redirects (mirrors getRegisteredProvidersAction). */
export async function getPortfolioHoldingsAction(): Promise<
    PortfolioHoldingView[]
> {
    const user = await getCurrentUser();
    if (user === null) return [];

    try {
        const { db } = getDatabaseClient();
        const rows = await new DrizzlePortfolioRepository(db).findByUser(
            user.id
        );
        return rows
            .map(toView)
            .toSorted((a, b) => a.symbol.localeCompare(b.symbol));
    } catch (error) {
        console.error(
            '[getPortfolioHoldingsAction] Failed to load holdings',
            error
        );
        return [];
    }
}

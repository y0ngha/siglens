'use server';

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { toView } from '../lib/toView';
import type { PortfolioHoldingView } from '../model';

/**
 * Returns the current member's holdings, or `[]` when logged out — never
 * redirects (the logged-out `[]`, no-redirect behavior mirrors
 * getRegisteredProvidersAction; that sibling otherwise swallows read errors
 * into `[]`, which this action deliberately does NOT do). A genuine read
 * failure (after the repository's transient retries — see
 * `DrizzlePortfolioRepository.findByUser`) is intentionally left to
 * propagate rather than caught: this runs as a React Query `queryFn`, so a
 * thrown error just sets `isError` on the query — it does NOT hijack
 * navigation like a thrown `NEXT_REDIRECT` would. Swallowing it here would
 * make a transient DB blip indistinguishable from "this member genuinely
 * has no holdings".
 */
export async function getPortfolioHoldingsAction(): Promise<
    PortfolioHoldingView[]
> {
    const user = await getCurrentUser();
    if (user === null) return [];

    const { db } = getDatabaseClient();
    const rows = await new DrizzlePortfolioRepository(db).findByUser(user.id);
    return rows
        .map(toView)
        .toSorted((a, b) => a.symbol.localeCompare(b.symbol));
}

import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { investorFlowsState } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';

/** `investor_flows_state`의 값 하나(커서·표식). 없으면 null. */
export async function readInvestorFlowsState(
    db: SiglensDatabase,
    key: string
): Promise<string | null> {
    const [row] = await withRetry(
        () =>
            db
                .select({ value: investorFlowsState.value })
                .from(investorFlowsState)
                .where(eq(investorFlowsState.key, key)),
        DB_TRANSIENT_RETRY
    );
    return row?.value ?? null;
}

/** `investor_flows_state`에 값을 쓴다(덮어쓴다). */
export async function writeInvestorFlowsState(
    db: SiglensDatabase,
    key: string,
    value: string
): Promise<void> {
    await withRetry(
        () =>
            db
                .insert(investorFlowsState)
                .values({ key, value })
                .onConflictDoUpdate({
                    target: investorFlowsState.key,
                    set: { value, updatedAt: sql`now()` },
                }),
        DB_TRANSIENT_RETRY
    );
}

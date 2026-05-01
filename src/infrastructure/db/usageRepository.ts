import {
    hashUsageIp,
    type RecordUsageInput,
    type UsageActionType,
    type UsageCounts,
    type UsageLogRecord,
    type UsageRepository,
} from '@y0ngha/siglens-core';
import { and, count, eq } from 'drizzle-orm';
import { usageLogs } from './schema';
import type { SiglensDatabase } from './types';

const EMPTY_USAGE_COUNTS: UsageCounts = {
    analysis: 0,
    chatbot: 0,
};

const UTC_DATE_LENGTH = 10;

/**
 * Mirrors `toUtcDateString` in @y0ngha/siglens-core
 * (src/infrastructure/usage/hash.ts — `@internal`).
 * Duplicated because the helper is not part of core's public API surface.
 * If the core copy changes (date-string format, padding, etc.), update this
 * file to match.
 */
function toUtcDateString(date: Date): string {
    return date.toISOString().slice(0, UTC_DATE_LENGTH);
}

function toUsageCounts(
    rows: readonly { actionType: UsageActionType; count: number | string }[]
): UsageCounts {
    return rows.reduce(
        (counts, row) => ({
            ...counts,
            [row.actionType]: Number(row.count),
        }),
        { ...EMPTY_USAGE_COUNTS }
    );
}

/**
 * Drizzle ORM implementation of {@link UsageRepository} backed by usage_logs.
 */
export class DrizzleUsageRepository implements UsageRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async recordUsage(input: RecordUsageInput): Promise<UsageLogRecord> {
        const occurredAt = input.occurredAt ?? new Date();
        const [usageLog] = await this.db
            .insert(usageLogs)
            .values({
                userId: input.userId ?? null,
                ipHash: hashUsageIp(input.ipAddress, occurredAt),
                actionType: input.actionType,
                modelUsed: input.modelUsed,
                date: toUtcDateString(occurredAt),
            })
            .returning({
                id: usageLogs.id,
                userId: usageLogs.userId,
                ipHash: usageLogs.ipHash,
                actionType: usageLogs.actionType,
                modelUsed: usageLogs.modelUsed,
                date: usageLogs.date,
                createdAt: usageLogs.createdAt,
            });

        return usageLog!;
    }

    async getUsageToday(
        ipHash: string,
        now: Date = new Date()
    ): Promise<UsageCounts> {
        const rows = await this.db
            .select({
                actionType: usageLogs.actionType,
                count: count(),
            })
            .from(usageLogs)
            .where(
                and(
                    eq(usageLogs.ipHash, ipHash),
                    eq(usageLogs.date, toUtcDateString(now))
                )
            )
            .groupBy(usageLogs.actionType);

        return toUsageCounts(rows);
    }
}

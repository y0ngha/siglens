import {
    hashUsageIp,
    type RecordUsageInput,
    type UsageActionType,
    type UsageLogRecord,
} from '@y0ngha/siglens-core';
import { and, count, eq } from 'drizzle-orm';
import { usageLogs } from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';
import type {
    SiglensUsageCounts,
    SiglensUsageRepository,
} from '@/infrastructure/db/usageCounts';

const EMPTY_USAGE_COUNTS: SiglensUsageCounts = {
    analysis: 0,
    chatbot: 0,
    premium_model: 0,
};

const UTC_DATE_LENGTH = 10;

// Mirrors toUtcDateString in @y0ngha/siglens-core infrastructure/usage/hash.ts (@internal). Update if date-string format changes.
function toUtcDateString(date: Date): string {
    return date.toISOString().slice(0, UTC_DATE_LENGTH);
}

function toUsageCounts(
    rows: readonly { actionType: UsageActionType; count: number | string }[]
): SiglensUsageCounts {
    return rows.reduce(
        (counts, row) => ({
            ...counts,
            [row.actionType]: Number(row.count),
        }),
        { ...EMPTY_USAGE_COUNTS }
    );
}

/** Drizzle ORM implementation of {@link SiglensUsageRepository} backed by usage_logs. */
export class DrizzleUsageRepository implements SiglensUsageRepository {
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
    ): Promise<SiglensUsageCounts> {
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

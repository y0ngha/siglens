import {
    hashUsageIp,
    type RecordUsageInput,
    type UsageActionType,
    type UsageLogRecord,
} from '@y0ngha/siglens-core';
import { and, count, eq } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { usageLogs } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { SiglensUsageCounts, SiglensUsageRepository } from './usageCounts';
import { withRetry } from '@/shared/lib/withRetry';

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
    // reduce + 스프레드는 행마다 객체를 새로 만들어 O(n²)이 된다 — 로컬 누적기를 채운다.
    const counts = { ...EMPTY_USAGE_COUNTS };
    for (const row of rows) {
        counts[row.actionType] = Number(row.count);
    }
    return counts;
}

/** Drizzle ORM implementation of {@link SiglensUsageRepository} backed by usage_logs. */
export class DrizzleUsageRepository implements SiglensUsageRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async recordUsage(input: RecordUsageInput): Promise<UsageLogRecord> {
        const occurredAt = input.occurredAt ?? new Date();
        // Usage 로깅은 사용자에게 직접 노출되는 동작(분석/챗봇 호출 등) 직후 동기로
        // 호출되므로 transient `fetch failed`가 그대로 에러로 노출되면 사용자가 본
        // 작업이 실패한 것처럼 보인다. retry로 흡수해 로그가 자가 회복되게 한다.
        const [usageLog] = await withRetry(
            () =>
                this.db
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
                    }),
            NEON_TRANSIENT_RETRY
        );

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

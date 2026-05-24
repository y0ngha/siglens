import type {
    CreateUsageLogInput,
    UsageLogRepository,
} from '@y0ngha/siglens-core';
import { NEON_TRANSIENT_RETRY } from '@/infrastructure/db/isNeonTransientError';
import { usageLogs } from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';
import { withRetry } from '@/shared/lib/withRetry';

/**
 * Drizzle ORM implementation of {@link UsageLogRepository} backed by a Neon
 * PostgreSQL database.
 */
export class DrizzleUsageLogRepository implements UsageLogRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async recordUsage(input: CreateUsageLogInput): Promise<void> {
        // siglens-core 호출 경로의 usage write — analysis/chatbot 호출 직후라
        // transient 실패가 사용자 화면 에러로 그대로 노출된다. retry로 흡수.
        await withRetry(
            () =>
                this.db.insert(usageLogs).values({
                    userId: input.userId,
                    ipHash: input.ipHash,
                    actionType: input.actionType,
                    modelUsed: input.modelUsed,
                    date: input.date,
                }),
            NEON_TRANSIENT_RETRY
        );
    }
}

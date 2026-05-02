import type {
    CreateUsageLogInput,
    UsageLogRepository,
} from '@y0ngha/siglens-core';
import { usageLogs } from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';

/**
 * Drizzle ORM implementation of {@link UsageLogRepository} backed by a Neon
 * PostgreSQL database.
 */
export class DrizzleUsageLogRepository implements UsageLogRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async recordUsage(input: CreateUsageLogInput): Promise<void> {
        await this.db.insert(usageLogs).values({
            userId: input.userId,
            ipHash: input.ipHash,
            actionType: input.actionType,
            modelUsed: input.modelUsed,
            date: input.date,
        });
    }
}

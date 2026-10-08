import { eq, sql } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { emailReportSubscriptions } from '@/shared/db/schema';
import type {
    EmailReportSubscriptionRecord,
    EmailReportSubscriptionRepository,
    SiglensDatabase,
    UpsertEmailReportSubscriptionInput,
} from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';

const columns = {
    userId: emailReportSubscriptions.userId,
    enabled: emailReportSubscriptions.enabled,
    daysOfWeek: emailReportSubscriptions.daysOfWeek,
    sendHour: emailReportSubscriptions.sendHour,
    timezone: emailReportSubscriptions.timezone,
    locale: emailReportSubscriptions.locale,
    consentedAt: emailReportSubscriptions.consentedAt,
    createdAt: emailReportSubscriptions.createdAt,
    updatedAt: emailReportSubscriptions.updatedAt,
};

/**
 * Drizzle implementation of {@link EmailReportSubscriptionRepository}. One row
 * per user (`user_id` is the primary key), so `upsert` merges on it.
 *
 * `consented_at` records the **last time the member turned delivery on**: an
 * upsert with `enabled = true` stamps it only when the stored row was off (or
 * absent). Re-saving an already-enabled subscription — changing the hour, say —
 * keeps the original consent time instead of silently moving it.
 */
export class DrizzleEmailReportSubscriptionRepository implements EmailReportSubscriptionRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async findByUser(
        userId: string
    ): Promise<EmailReportSubscriptionRecord | null> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select(columns)
                    .from(emailReportSubscriptions)
                    .where(eq(emailReportSubscriptions.userId, userId))
                    .limit(1),
            DB_TRANSIENT_RETRY
        );
        return row ?? null;
    }

    async upsert(
        input: UpsertEmailReportSubscriptionInput
    ): Promise<EmailReportSubscriptionRecord> {
        const [row] = await withRetry(
            () =>
                this.db
                    .insert(emailReportSubscriptions)
                    .values({
                        userId: input.userId,
                        enabled: input.enabled,
                        daysOfWeek: input.daysOfWeek,
                        sendHour: input.sendHour,
                        timezone: input.timezone,
                        locale: input.locale,
                        consentedAt: input.enabled ? sql`now()` : null,
                    })
                    .onConflictDoUpdate({
                        target: emailReportSubscriptions.userId,
                        set: {
                            enabled: input.enabled,
                            daysOfWeek: input.daysOfWeek,
                            sendHour: input.sendHour,
                            timezone: input.timezone,
                            locale: input.locale,
                            consentedAt: input.enabled
                                ? sql`case when ${emailReportSubscriptions.enabled} then ${emailReportSubscriptions.consentedAt} else now() end`
                                : sql`${emailReportSubscriptions.consentedAt}`,
                            updatedAt: sql`now()`,
                        },
                    })
                    .returning(columns),
            DB_TRANSIENT_RETRY
        );

        if (row === undefined) {
            throw new Error('Failed to upsert email report subscription');
        }
        return row;
    }
}

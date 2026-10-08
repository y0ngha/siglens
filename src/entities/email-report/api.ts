import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import {
    emailReportDeliveries,
    emailReportSubscriptions,
    users,
} from '@/shared/db/schema';
import type {
    EmailReportDeliveryOutcome,
    EmailReportDeliveryRepository,
    EmailReportRecipient,
    EmailReportSubscriptionRecord,
    EmailReportSubscriptionRepository,
    SiglensDatabase,
    UpsertEmailReportSubscriptionInput,
} from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';

/** 메일 리포트 대상 등급 — 가입 회원 이상(무료 회원 포함). */
const EMAIL_REPORT_TIERS = ['member', 'pro'] as const;

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

    async findEnabledRecipients(): Promise<EmailReportRecipient[]> {
        return withRetry(
            () =>
                this.db
                    .select({
                        userId: emailReportSubscriptions.userId,
                        email: users.email,
                        daysOfWeek: emailReportSubscriptions.daysOfWeek,
                        sendHour: emailReportSubscriptions.sendHour,
                        timezone: emailReportSubscriptions.timezone,
                        locale: emailReportSubscriptions.locale,
                    })
                    .from(emailReportSubscriptions)
                    .innerJoin(
                        users,
                        eq(users.id, emailReportSubscriptions.userId)
                    )
                    .where(
                        and(
                            eq(emailReportSubscriptions.enabled, true),
                            // 인증되지 않은 주소로는 보내지 않는다 — 남의 주소로 가입한
                            // 계정이 그 사람에게 정기 메일을 보내게 되면 안 된다.
                            eq(users.emailVerified, true),
                            inArray(users.tier, EMAIL_REPORT_TIERS)
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
    }

    async disable(userId: string): Promise<boolean> {
        const updated = await withRetry(
            () =>
                this.db
                    .update(emailReportSubscriptions)
                    .set({ enabled: false, updatedAt: sql`now()` })
                    .where(eq(emailReportSubscriptions.userId, userId))
                    .returning({ userId: emailReportSubscriptions.userId }),
            DB_TRANSIENT_RETRY
        );
        return updated.length > 0;
    }
}

/**
 * Drizzle implementation of {@link EmailReportDeliveryRepository}.
 *
 * `claim` inserts first and lets the `(user_id, local_date)` unique index
 * decide — `ON CONFLICT DO NOTHING` returns no row for the loser, so two
 * overlapping cron runs can never both send the same member's report.
 */
export class DrizzleEmailReportDeliveryRepository implements EmailReportDeliveryRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async claim(userId: string, localDate: string): Promise<string | null> {
        const [row] = await withRetry(
            () =>
                this.db
                    .insert(emailReportDeliveries)
                    .values({ userId, localDate, status: 'pending' })
                    .onConflictDoNothing({
                        target: [
                            emailReportDeliveries.userId,
                            emailReportDeliveries.localDate,
                        ],
                    })
                    .returning({ id: emailReportDeliveries.id }),
            DB_TRANSIENT_RETRY
        );
        return row?.id ?? null;
    }

    async finish(
        id: string,
        outcome: EmailReportDeliveryOutcome,
        symbols: readonly string[],
        error: string | null
    ): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .update(emailReportDeliveries)
                    .set({
                        status: outcome,
                        symbols: [...symbols],
                        error,
                        updatedAt: sql`now()`,
                    })
                    .where(eq(emailReportDeliveries.id, id)),
            DB_TRANSIENT_RETRY
        );
    }

    async pruneOlderThan(cutoff: Date): Promise<number> {
        const deleted = await withRetry(
            () =>
                this.db
                    .delete(emailReportDeliveries)
                    .where(lt(emailReportDeliveries.createdAt, cutoff))
                    .returning({ id: emailReportDeliveries.id }),
            DB_TRANSIENT_RETRY
        );
        return deleted.length;
    }
}

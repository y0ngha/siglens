import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import {
    emailReportDeliveries,
    emailReportExcludedSymbols,
    emailReportSubscriptions,
    users,
} from '@/shared/db/schema';
import type {
    EmailReportDeliveryOutcome,
    EmailReportExclusionRepository,
    ExcludeReportSymbolOutcome,
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

/**
 * Drizzle implementation of {@link EmailReportExclusionRepository}. `(user_id, symbol)` is the
 * primary key, so a symbol is excluded at most once per member.
 */
export class DrizzleEmailReportExclusionRepository implements EmailReportExclusionRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async findExcludedSymbols(userId: string): Promise<string[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({ symbol: emailReportExcludedSymbols.symbol })
                    .from(emailReportExcludedSymbols)
                    .where(eq(emailReportExcludedSymbols.userId, userId)),
            DB_TRANSIENT_RETRY
        );
        return rows.map(row => row.symbol);
    }

    /**
     * 회원 행을 `FOR NO KEY UPDATE`로 잠가 같은 회원의 동시 호출을 직렬화한다 — "개수 조회 →
     * 삽입"을 따로 하면 두 탭이 같은 개수를 보고 둘 다 통과해 상한을 넘긴다(관심종목
     * `addWithinLimit`과 같은 이유·같은 잠금 모드). 이미 뺀 심볼은 상한과 무관하게 멱등 성공이다.
     */
    async excludeSymbol(
        userId: string,
        symbol: string,
        limit: number
    ): Promise<ExcludeReportSymbolOutcome> {
        return withRetry(
            () =>
                this.db.transaction(async tx => {
                    await tx
                        .select({ id: users.id })
                        .from(users)
                        .where(eq(users.id, userId))
                        .for('no key update');
                    const owned = await tx
                        .select({ symbol: emailReportExcludedSymbols.symbol })
                        .from(emailReportExcludedSymbols)
                        .where(eq(emailReportExcludedSymbols.userId, userId));
                    const alreadyExcluded = owned.some(
                        row => row.symbol === symbol
                    );
                    if (!alreadyExcluded && owned.length >= limit) {
                        return 'limit_reached' as const;
                    }
                    await tx
                        .insert(emailReportExcludedSymbols)
                        .values({ userId, symbol })
                        .onConflictDoNothing({
                            target: [
                                emailReportExcludedSymbols.userId,
                                emailReportExcludedSymbols.symbol,
                            ],
                        });
                    return 'excluded' as const;
                }),
            DB_TRANSIENT_RETRY
        );
    }

    async includeSymbol(userId: string, symbol: string): Promise<boolean> {
        const deleted = await withRetry(
            () =>
                this.db
                    .delete(emailReportExcludedSymbols)
                    .where(
                        and(
                            eq(emailReportExcludedSymbols.userId, userId),
                            eq(emailReportExcludedSymbols.symbol, symbol)
                        )
                    )
                    .returning({ symbol: emailReportExcludedSymbols.symbol }),
            DB_TRANSIENT_RETRY
        );
        return deleted.length > 0;
    }
}

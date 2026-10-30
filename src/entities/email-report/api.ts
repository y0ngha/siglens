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

/** 구독 행의 select 컬럼 — 조회·upsert 반환이 같은 `EmailReportSubscriptionRecord` 모양을 쓴다. */
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
 * {@link EmailReportSubscriptionRepository}의 Drizzle 구현. 회원당 한 행(`user_id`가 기본키)이라
 * `upsert`는 그 키로 합친다. 모든 쿼리는 일시적 DB 오류에 한해 `withRetry`로 재시도한다.
 *
 * `consented_at`은 **회원이 수신을 마지막으로 켠 시각**이다. `enabled = true` upsert는 저장돼 있던
 * 행이 꺼져 있었거나(또는 없었을) 때만 이 값을 찍는다. 이미 켜진 구독을 다시 저장하면(예: 시각 변경)
 * 동의 시각을 조용히 옮기지 않고 원래 값을 지킨다.
 */
export class DrizzleEmailReportSubscriptionRepository implements EmailReportSubscriptionRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /** 회원의 구독 행. 한 번도 저장하지 않았으면 `null`. */
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

    /** 설정을 저장하며, `consented_at` 규칙은 클래스 설명을 따른다. */
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

    /** 발송 cron의 대상 — 수신을 켠 구독 중 인증된 이메일을 가진 가입 회원 이상(무료 포함). */
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

    /** 수신을 끈다. 구독 행이 없으면 아무것도 바꾸지 않고 `false`. */
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
 * {@link EmailReportDeliveryRepository}의 Drizzle 구현.
 *
 * `claim`은 먼저 삽입하고 `(user_id, local_date)` 유니크 인덱스가 승자를 정한다 —
 * `ON CONFLICT DO NOTHING`은 진 쪽에 행을 돌려주지 않으므로, 겹쳐 도는 두 cron이 같은
 * 회원의 리포트를 함께 보낼 수 없다. 모든 쿼리는 일시적 DB 오류에 한해 재시도한다.
 */
export class DrizzleEmailReportDeliveryRepository implements EmailReportDeliveryRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /** 회원의 로컬 발송일 슬롯을 선점한다. 이미 누군가 잡았으면 `null`. */
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

    /** 선점한 발송 행에 결과(상태·실린 심볼·오류)를 기록한다. */
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

    /** `cutoff`보다 먼저 만들어진 발송 기록을 지우고 지운 행 수를 돌려준다. */
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
 * {@link EmailReportExclusionRepository}의 Drizzle 구현. `(user_id, symbol)`이 기본키라
 * 심볼은 회원당 최대 한 번만 제외된다. 모든 쿼리는 일시적 DB 오류에 한해 재시도한다.
 */
export class DrizzleEmailReportExclusionRepository implements EmailReportExclusionRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /** 회원이 리포트에서 뺀 심볼 전부. */
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

    /** 뺀 심볼을 되돌린다. 뺀 적 없으면 `false`. */
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

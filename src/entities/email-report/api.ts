import {
    and,
    eq,
    gt,
    inArray,
    lt,
    ne,
    notExists,
    notInArray,
    or,
    sql,
} from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import {
    emailReportDeliveries,
    emailReportExcludedSymbols,
    emailReportSubscriptions,
    emailReportWelcomes,
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
    EmailReportWelcomeOutcome,
    EmailReportWelcomeRecipient,
    EmailReportWelcomeRepository,
    SiglensDatabase,
    UpsertEmailReportSubscriptionInput,
} from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import {
    EMAIL_REPORT_TIERS,
    WELCOME_MAX_ATTEMPTS,
    WELCOME_STALE_SENDING_MS,
    WELCOME_WINDOW_MS,
} from './lib/emailReportConstants';

/** 구독 행의 select 컬럼 — 조회·upsert 반환이 같은 `EmailReportSubscriptionRecord` 모양을 쓴다. */
const columns = {
    userId: emailReportSubscriptions.userId,
    enabled: emailReportSubscriptions.enabled,
    daysOfWeek: emailReportSubscriptions.daysOfWeek,
    sendHour: emailReportSubscriptions.sendHour,
    timezone: emailReportSubscriptions.timezone,
    locale: emailReportSubscriptions.locale,
    consentedAt: emailReportSubscriptions.consentedAt,
    consentSource: emailReportSubscriptions.consentSource,
    createdAt: emailReportSubscriptions.createdAt,
    updatedAt: emailReportSubscriptions.updatedAt,
};

/**
 * {@link EmailReportSubscriptionRepository}의 Drizzle 구현. 회원당 한 행(`user_id`가 기본키)이라
 * `upsert`는 그 키로 합친다. 모든 쿼리는 일시적 DB 오류에 한해 `withRetry`로 재시도한다.
 *
 * `consented_at`은 **회원이 수신을 마지막으로 켠 시각**이다. `enabled = true` upsert는 저장돼 있던
 * 행이 꺼져 있었거나(또는 없었을) 때만 이 값을 찍는다. 이미 켜진 구독을 다시 저장하면(예: 시각 변경)
 * 동의 시각을 조용히 옮기지 않고 원래 값을 지킨다. `consent_source`(수신을 켠 화면)도 같은 규칙이다:
 * 꺼진 상태에서 켤 때만 입력 값으로 바뀌고, 이미 켜져 있으면 처음 동의한 화면을 지킨다.
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
                        consentSource: input.enabled
                            ? input.consentSource
                            : null,
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
                            consentSource: input.enabled
                                ? sql`case when ${emailReportSubscriptions.enabled} then ${emailReportSubscriptions.consentSource} else ${input.consentSource} end`
                                : sql`${emailReportSubscriptions.consentSource}`,
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
 * {@link EmailReportWelcomeRepository}의 Drizzle 구현. 회원당 한 행(`user_id`가 기본키)이라
 * "가입 첫 리포트는 한 번만"을 PK가 보장한다 — cron이 **보내기 전에** 행을 삽입해 선점한다.
 * 모든 쿼리는 일시적 DB 오류에 한해 재시도한다.
 *
 * 대상은 가입 화면에서 수신을 고른 회원(`consent_source`가 `signup_email`·`signup_oauth`)이다.
 * 설정 화면에서 켠 회원에게는 첫 리포트를 보내지 않는다 — 그 회원은 정기 일정만 기다린다.
 * 인증된 주소와 메일 리포트 대상 등급만 받는다(`findEnabledRecipients`와 같은 기준).
 */
export class DrizzleEmailReportWelcomeRepository implements EmailReportWelcomeRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * 한 트랜잭션에서 (1) 대상 회원을 고르고 (2) 아직 행이 없는 회원을 `sending`으로 삽입하고 (3) 실패했거나
     * `sending`인 채 멈춘 행을 시도 횟수 안에서 다시 잡은 뒤 (4) 잡은 회원의 수신자 정보를 읽는다. 겹쳐 도는
     * 두 cron이 같은 대상을 함께 골라도 삽입은 PK 충돌(`ON CONFLICT DO NOTHING`은 진 쪽에 행을 돌려주지
     * 않는다), 갱신은 행 잠금과 재평가로 한쪽만 이긴다. 모든 시각 비교는 인자 `now`를 쓴다.
     */
    async claimDue(now: Date): Promise<EmailReportWelcomeRecipient[]> {
        const windowStart = new Date(now.getTime() - WELCOME_WINDOW_MS);
        const staleBefore = new Date(now.getTime() - WELCOME_STALE_SENDING_MS);
        return withRetry(
            () =>
                this.db.transaction(async tx => {
                    const eligible = await tx
                        .select({ userId: emailReportSubscriptions.userId })
                        .from(emailReportSubscriptions)
                        .innerJoin(
                            users,
                            eq(users.id, emailReportSubscriptions.userId)
                        )
                        .where(
                            and(
                                eq(emailReportSubscriptions.enabled, true),
                                inArray(
                                    emailReportSubscriptions.consentSource,
                                    ['signup_email', 'signup_oauth']
                                ),
                                gt(
                                    emailReportSubscriptions.consentedAt,
                                    windowStart
                                ),
                                eq(users.emailVerified, true),
                                inArray(users.tier, EMAIL_REPORT_TIERS),
                                // 동의한 뒤 정기 리포트가 이미 나갔으면 첫 리포트는 보내지 않는다 —
                                // 정기 메일 뒤에 환영 메일이 뒤따르면 순서가 거꾸로다.
                                notExists(
                                    tx
                                        .select({ one: sql`1` })
                                        .from(emailReportDeliveries)
                                        .where(
                                            and(
                                                eq(
                                                    emailReportDeliveries.userId,
                                                    emailReportSubscriptions.userId
                                                ),
                                                eq(
                                                    emailReportDeliveries.status,
                                                    'sent'
                                                ),
                                                gt(
                                                    emailReportDeliveries.updatedAt,
                                                    emailReportSubscriptions.consentedAt
                                                )
                                            )
                                        )
                                )
                            )
                        );
                    if (eligible.length === 0) return [];
                    const eligibleIds = eligible.map(row => row.userId);
                    const inserted = await tx
                        .insert(emailReportWelcomes)
                        .values(
                            eligibleIds.map(userId => ({
                                userId,
                                status: 'sending' as const,
                                attempts: 1,
                            }))
                        )
                        .onConflictDoNothing({
                            target: emailReportWelcomes.userId,
                        })
                        .returning({ userId: emailReportWelcomes.userId });
                    // 방금 삽입한 행은 재시도 대상이 아니다. 앱 시계가 DB `now()`보다 앞서면 `updated_at`이 "30분
                    // 전"보다 이전으로 보여 같은 트랜잭션에서 곧바로 다시 잡힐 수 있다.
                    const insertedIds = inserted.map(row => row.userId);
                    const retried = await tx
                        .update(emailReportWelcomes)
                        .set({
                            status: 'sending',
                            attempts: sql`${emailReportWelcomes.attempts} + 1`,
                            updatedAt: sql`now()`,
                        })
                        .where(
                            and(
                                inArray(
                                    emailReportWelcomes.userId,
                                    eligibleIds
                                ),
                                ...(insertedIds.length > 0
                                    ? [
                                          notInArray(
                                              emailReportWelcomes.userId,
                                              insertedIds
                                          ),
                                      ]
                                    : []),
                                lt(
                                    emailReportWelcomes.attempts,
                                    WELCOME_MAX_ATTEMPTS
                                ),
                                or(
                                    eq(emailReportWelcomes.status, 'failed'),
                                    and(
                                        eq(
                                            emailReportWelcomes.status,
                                            'sending'
                                        ),
                                        lt(
                                            emailReportWelcomes.updatedAt,
                                            staleBefore
                                        )
                                    )
                                )
                            )
                        )
                        .returning({ userId: emailReportWelcomes.userId });
                    const claimedIds = [...inserted, ...retried].map(
                        row => row.userId
                    );
                    if (claimedIds.length === 0) return [];
                    const rows = await tx
                        .select({
                            userId: emailReportSubscriptions.userId,
                            email: users.email,
                            daysOfWeek: emailReportSubscriptions.daysOfWeek,
                            sendHour: emailReportSubscriptions.sendHour,
                            timezone: emailReportSubscriptions.timezone,
                            locale: emailReportSubscriptions.locale,
                            consentedAt: emailReportSubscriptions.consentedAt,
                            attempts: emailReportWelcomes.attempts,
                        })
                        .from(emailReportWelcomes)
                        .innerJoin(
                            emailReportSubscriptions,
                            eq(
                                emailReportSubscriptions.userId,
                                emailReportWelcomes.userId
                            )
                        )
                        .innerJoin(
                            users,
                            eq(users.id, emailReportWelcomes.userId)
                        )
                        .where(inArray(emailReportWelcomes.userId, claimedIds));
                    // `consented_at`은 대상 조건(창 안)에서 null일 수 없지만 타입은 nullable이다.
                    return rows.flatMap(({ consentedAt, ...rest }) =>
                        consentedAt === null ? [] : [{ ...rest, consentedAt }]
                    );
                }),
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * 선점한 행에 결과를 기록한다. `sent`일 때만 보낸 시각을 찍는다. 이미 `sent`인 행은 `failed`·`retry`로
     * 덮어쓰지 않는다 — 보낸 메일을 실패로 남기면 다음 실행이 같은 회원에게 다시 보낸다. `retry`는 시도를
     * 쓰지 않은 채 `failed`로 돌려놓아(횟수를 되돌린다) 다음 실행이 같은 횟수로 다시 잡게 한다.
     */
    async finish(
        userId: string,
        outcome: EmailReportWelcomeOutcome,
        error: string | null
    ): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .update(emailReportWelcomes)
                    .set({
                        status: outcome === 'sent' ? 'sent' : 'failed',
                        error,
                        ...(outcome === 'sent' && { sentAt: sql`now()` }),
                        ...(outcome === 'retry' && {
                            attempts: sql`greatest(${emailReportWelcomes.attempts} - 1, 0)`,
                        }),
                        updatedAt: sql`now()`,
                    })
                    .where(
                        outcome === 'sent'
                            ? eq(emailReportWelcomes.userId, userId)
                            : and(
                                  eq(emailReportWelcomes.userId, userId),
                                  ne(emailReportWelcomes.status, 'sent')
                              )
                    ),
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * 정기 회차를 건너뛸 회원: `sentSince` 뒤에 첫 리포트를 보냈거나, 아직 `sending`이고 `inFlightSince`
     * 뒤에 갱신된 회원(겹친 다른 실행이 보내는 중일 수 있다).
     */
    async findWelcomed(
        sentSince: Date,
        inFlightSince: Date
    ): Promise<Set<string>> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({ userId: emailReportWelcomes.userId })
                    .from(emailReportWelcomes)
                    .where(
                        or(
                            and(
                                eq(emailReportWelcomes.status, 'sent'),
                                gt(emailReportWelcomes.sentAt, sentSince)
                            ),
                            and(
                                eq(emailReportWelcomes.status, 'sending'),
                                gt(emailReportWelcomes.updatedAt, inFlightSince)
                            )
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
        return new Set(rows.map(row => row.userId));
    }

    /** `cutoff`보다 먼저 만들어진 기록을 지우고 지운 행 수를 돌려준다. */
    async pruneOlderThan(cutoff: Date): Promise<number> {
        const deleted = await withRetry(
            () =>
                this.db
                    .delete(emailReportWelcomes)
                    .where(lt(emailReportWelcomes.createdAt, cutoff))
                    .returning({ userId: emailReportWelcomes.userId }),
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

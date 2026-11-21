import 'server-only';

import { and, eq, gte, inArray, isNull, lt, sql, type SQL } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import {
    mailAlertDeliveries,
    mailAlertSubscribers,
    mailAlertTopics,
    users,
} from '@/shared/db/schema';
import type {
    AddMailAlertTopicOutcome,
    MailAlertDeliveryOutcome,
    MailAlertDeliveryRepository,
    MailAlertDeliveryTarget,
    MailAlertOwner,
    MailAlertSubscriberRecord,
    MailAlertSubscriberRepository,
    MailAlertTopicRecord,
    RemoveMailAlertTopicOutcome,
    SiglensDatabase,
    UpsertVerifiedMailAlertSubscriberInput,
} from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';

/** 구독자 행의 select 컬럼 — 조회·갱신 반환이 같은 `MailAlertSubscriberRecord` 모양을 쓴다. */
const subscriberColumns = {
    id: mailAlertSubscribers.id,
    email: mailAlertSubscribers.email,
    userId: mailAlertSubscribers.userId,
    locale: mailAlertSubscribers.locale,
    includePortfolio: mailAlertSubscribers.includePortfolio,
    consentedAt: mailAlertSubscribers.consentedAt,
    consentSource: mailAlertSubscribers.consentSource,
    createdAt: mailAlertSubscribers.createdAt,
    updatedAt: mailAlertSubscribers.updatedAt,
};

/**
 * 인증한 주소의 주인 — 그 주소를 가진 인증된 회원 중 아직 구독자 행이 없는 회원의 id(없으면 null).
 * 호출자가 회원을 넘기지 않고 DB가 주소로 정한다: 세션의 회원이 남의 주소 행을 가져가지 못하고,
 * 주소를 바꾼 회원이 옛 주소 행으로 `user_id` 유니크에 걸리지도 않는다.
 */
function ownerOfAddress(email: string) {
    return sql`(select ${users.id} from ${users} where ${users.email} = ${email} and ${users.emailVerified} and not exists (select 1 from ${mailAlertSubscribers} where ${mailAlertSubscribers.userId} = ${users.id}))`;
}

/**
 * 구독자 행의 소유자 조건. 회원은 `user_id`로, 비회원은 서명된 쿠키가 담은 구독자 id로 **그리고**
 * `user_id`가 비어 있을 때만 행을 가리킨다 — id를 알아도 연결된(회원) 행은 건드릴 수 없고, 회원은 자기
 * `user_id`가 아닌 행(비회원 행 포함)을 id로 가리킬 길이 없다(DB-12). 서명된 메일 링크(`link`)만 id로 행을
 * 가리키며(비회원·연결된 행 모두), 그 권한은 호출자가 먼저 확인한 HMAC 서명이 준다.
 */
function ownerCondition(owner: MailAlertOwner): SQL {
    switch (owner.kind) {
        case 'member':
            return sql`${mailAlertSubscribers.userId} = ${owner.userId}`;
        case 'guest':
            return sql`${mailAlertSubscribers.id} = ${owner.subscriberId} and ${mailAlertSubscribers.userId} is null`;
        case 'link':
            return sql`${mailAlertSubscribers.id} = ${owner.subscriberId}`;
    }
}

/** 회원 본인의 인증된 주소(인증되지 않았으면 null) — 비회원 때 만든 행을 가져오거나 지울 때만 쓴다. */
function verifiedAddressOf(userId: string) {
    return sql`(select ${users.email} from ${users} where ${users.id} = ${userId} and ${users.emailVerified})`;
}

/**
 * {@link MailAlertSubscriberRepository}의 Drizzle 구현. 이메일 주소당 한 행(`email` 유니크)이고,
 * 행을 지우는 것이 곧 수신 거부다(받을 항목·발송 기록은 FK 연쇄로 사라진다). 모든 쿼리는 일시적 DB
 * 오류에 한해 `withRetry`로 재시도한다.
 *
 * 항목 추가·제거와 `include_portfolio` 변경은 구독자 행을 `FOR NO KEY UPDATE`로 잠근 트랜잭션에서
 * 한다 — "개수 조회 → 삽입"과 "남은 항목 조회 → 구독자 삭제"를 따로 하면 두 요청이 같은 상태를 보고
 * 상한을 넘기거나, 방금 추가된 항목이 있는 구독자를 지운다(메일 리포트 `excludeSymbol`과 같은 이유).
 */
export class DrizzleMailAlertSubscriberRepository implements MailAlertSubscriberRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * 같은 주소가 이미 있으면 그 행을 쓴다. `consented_at`·`consent_source`는 처음 값을 지키고(이미
     * 동의가 기록된 행이다), `user_id`는 비어 있을 때만 {@link ownerOfAddress}로 채운다. `xmax = 0`은 이번 문장이 새로 넣은 행일
     * 때만 참이다.
     */
    async upsertVerified(
        input: UpsertVerifiedMailAlertSubscriberInput
    ): Promise<{ id: string; created: boolean }> {
        const [row] = await withRetry(
            () =>
                this.db
                    .insert(mailAlertSubscribers)
                    .values({
                        email: input.email,
                        userId: ownerOfAddress(input.email),
                        locale: input.locale,
                        consentSource: input.consentSource,
                    })
                    .onConflictDoUpdate({
                        target: mailAlertSubscribers.email,
                        set: {
                            userId: sql`coalesce(${mailAlertSubscribers.userId}, excluded.user_id)`,
                            updatedAt: sql`now()`,
                        },
                    })
                    .returning({
                        id: mailAlertSubscribers.id,
                        created: sql<boolean>`(xmax = 0)`,
                    }),
            DB_TRANSIENT_RETRY
        );
        if (row === undefined) {
            throw new Error('Failed to upsert mail alert subscriber');
        }
        return row;
    }

    /** 소유자의 구독자 행. 소유자 조건은 {@link ownerCondition}. */
    async findByOwner(
        owner: MailAlertOwner
    ): Promise<MailAlertSubscriberRecord | null> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select(subscriberColumns)
                    .from(mailAlertSubscribers)
                    .where(ownerCondition(owner))
                    .limit(1),
            DB_TRANSIENT_RETRY
        );
        return row ?? null;
    }

    /**
     * 회원의 구독자 행. `user_id`로 먼저 찾고, 없으면 회원 본인의 **인증된** 주소(`users`에서 읽는다)로
     * 비회원 때 만든 행(`user_id`가 비어 있음)을 이 회원에게 연결해 돌려준다. 호출자가 주소를 넘기지
     * 않고 인증 전 계정은 아무것도 가져오지 못한다.
     */
    async findForMember(
        userId: string
    ): Promise<MailAlertSubscriberRecord | null> {
        const [linked] = await withRetry(
            () =>
                this.db
                    .select(subscriberColumns)
                    .from(mailAlertSubscribers)
                    .where(eq(mailAlertSubscribers.userId, userId))
                    .limit(1),
            DB_TRANSIENT_RETRY
        );
        if (linked !== undefined) return linked;
        const [adopted] = await withRetry(
            () =>
                this.db
                    .update(mailAlertSubscribers)
                    .set({ userId, updatedAt: sql`now()` })
                    .where(
                        and(
                            sql`${mailAlertSubscribers.email} = ${verifiedAddressOf(userId)}`,
                            isNull(mailAlertSubscribers.userId)
                        )
                    )
                    .returning(subscriberColumns),
            DB_TRANSIENT_RETRY
        );
        return adopted ?? null;
    }

    /** 소유자의 항목. 구독자 id는 소유자 조건으로 같은 문장 안에서 고른다. */
    async listTopics(owner: MailAlertOwner): Promise<MailAlertTopicRecord[]> {
        return withRetry(
            () =>
                this.db
                    .select({
                        kind: mailAlertTopics.kind,
                        key: mailAlertTopics.key,
                    })
                    .from(mailAlertTopics)
                    .where(
                        inArray(
                            mailAlertTopics.subscriberId,
                            this.db
                                .select({ id: mailAlertSubscribers.id })
                                .from(mailAlertSubscribers)
                                .where(ownerCondition(owner))
                        )
                    )
                    .orderBy(mailAlertTopics.createdAt, mailAlertTopics.key),
            DB_TRANSIENT_RETRY
        );
    }

    /** 이미 담은 항목은 상한과 무관하게 멱등 성공(`exists`)이다. */
    async addTopic(
        owner: MailAlertOwner,
        topic: MailAlertTopicRecord,
        max: number
    ): Promise<AddMailAlertTopicOutcome> {
        return withRetry(
            () =>
                this.db.transaction(async tx => {
                    const [locked] = await tx
                        .select({ id: mailAlertSubscribers.id })
                        .from(mailAlertSubscribers)
                        .where(ownerCondition(owner))
                        .for('no key update');
                    if (locked === undefined) {
                        return 'subscriber_missing' as const;
                    }
                    const subscriberId = locked.id;
                    const owned = await tx
                        .select({
                            kind: mailAlertTopics.kind,
                            key: mailAlertTopics.key,
                        })
                        .from(mailAlertTopics)
                        .where(eq(mailAlertTopics.subscriberId, subscriberId));
                    if (
                        owned.some(
                            row =>
                                row.kind === topic.kind && row.key === topic.key
                        )
                    ) {
                        return 'exists' as const;
                    }
                    if (owned.length >= max) return 'limit_reached' as const;
                    await tx
                        .insert(mailAlertTopics)
                        .values({
                            subscriberId,
                            kind: topic.kind,
                            key: topic.key,
                        })
                        .onConflictDoNothing();
                    return 'added' as const;
                }),
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * 항목을 지우고, 받을 것이 남지 않으면(항목 0개이고 `include_portfolio`가 꺼짐) 구독자도 지운다.
     * 지울 항목이 없었으면 구독자는 건드리지 않는다.
     */
    async removeTopic(
        owner: MailAlertOwner,
        topic: MailAlertTopicRecord
    ): Promise<RemoveMailAlertTopicOutcome> {
        return withRetry(
            () =>
                this.db.transaction(async tx => {
                    const [locked] = await tx
                        .select({
                            id: mailAlertSubscribers.id,
                            includePortfolio:
                                mailAlertSubscribers.includePortfolio,
                        })
                        .from(mailAlertSubscribers)
                        .where(ownerCondition(owner))
                        .for('no key update');
                    if (locked === undefined) {
                        return { deleted: false, subscriberDeleted: false };
                    }
                    const subscriberId = locked.id;
                    const removed = await tx
                        .delete(mailAlertTopics)
                        .where(
                            and(
                                eq(mailAlertTopics.subscriberId, subscriberId),
                                eq(mailAlertTopics.kind, topic.kind),
                                eq(mailAlertTopics.key, topic.key)
                            )
                        )
                        .returning({ key: mailAlertTopics.key });
                    if (removed.length === 0) {
                        return { deleted: false, subscriberDeleted: false };
                    }
                    const subscriberDeleted = await deleteIfNothingToReceive(
                        tx,
                        owner,
                        subscriberId,
                        locked.includePortfolio
                    );
                    return { deleted: true, subscriberDeleted };
                }),
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * 끄면서 받을 항목이 하나도 없으면 구독자를 지운다(`removeTopic`과 같은 규칙). 보유·관심종목은 회원
     * 것이라 회원이 아닌 소유자(비회원, 메일 링크)는 DB를 건드리지 않고 `found: false`로 거절한다 — 비회원
     * 행에는 이 스위치가 켜질 길이 없고, 켜져 있으면 발송이 존재하지 않는 포트폴리오를 읽는다.
     */
    async setIncludePortfolio(
        owner: MailAlertOwner,
        value: boolean
    ): Promise<{ found: boolean; subscriberDeleted: boolean }> {
        if (owner.kind !== 'member') {
            return { found: false, subscriberDeleted: false };
        }
        return withRetry(
            () =>
                this.db.transaction(async tx => {
                    const [locked] = await tx
                        .select({ id: mailAlertSubscribers.id })
                        .from(mailAlertSubscribers)
                        .where(ownerCondition(owner))
                        .for('no key update');
                    if (locked === undefined) {
                        return { found: false, subscriberDeleted: false };
                    }
                    const subscriberId = locked.id;
                    await tx
                        .update(mailAlertSubscribers)
                        .set({ includePortfolio: value, updatedAt: sql`now()` })
                        .where(
                            and(
                                eq(mailAlertSubscribers.id, subscriberId),
                                ownerCondition(owner)
                            )
                        );
                    const subscriberDeleted = await deleteIfNothingToReceive(
                        tx,
                        owner,
                        subscriberId,
                        value
                    );
                    return { found: true, subscriberDeleted };
                }),
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * 회원 계정 주소와 같은 주소의 연결 안 된 행을 그 회원에게 연결한다. 주소 일치와 "회원에게 아직 행이
     * 없음"은 같은 문장 안에서 확인한다. 인증 전 계정은 `upsertVerified`가 연결하지 못하므로, 호출자(흐름)가
     * 같은 요청에서 그 주소의 코드 확인을 마친 뒤에만 부른다 — 그 확인이 이 호출의 증거다.
     */
    async linkVerifiedMember(
        userId: string,
        subscriberId: string
    ): Promise<boolean> {
        const linked = await withRetry(
            () =>
                this.db
                    .update(mailAlertSubscribers)
                    .set({ userId, updatedAt: sql`now()` })
                    .where(
                        and(
                            eq(mailAlertSubscribers.id, subscriberId),
                            isNull(mailAlertSubscribers.userId),
                            sql`${mailAlertSubscribers.email} = (select ${users.email} from ${users} where ${users.id} = ${userId})`,
                            sql`not exists (select 1 from ${mailAlertSubscribers} as other where other.user_id = ${userId})`
                        )
                    )
                    .returning({ id: mailAlertSubscribers.id }),
            DB_TRANSIENT_RETRY
        );
        return linked.length > 0;
    }

    /** 소유자의 구독자 행을 지운다(수신 거부). 항목·발송 기록은 FK 연쇄로 사라진다. */
    async deleteByOwner(owner: MailAlertOwner): Promise<boolean> {
        const deleted = await withRetry(
            () =>
                this.db
                    .delete(mailAlertSubscribers)
                    .where(ownerCondition(owner))
                    .returning({ id: mailAlertSubscribers.id }),
            DB_TRANSIENT_RETRY
        );
        return deleted.length > 0;
    }

    /**
     * 회원 탈퇴용. `user_id` FK의 연쇄 삭제는 회원 행이 지워질 때 연결된 행만 지우므로, 같은 주소로
     * 비회원 때 신청해 아직 연결되지 않은 행은 주소로 따로 지운다. 주소는 `users`에서 읽고(인증된
     * 계정만), 그래서 회원 행을 지우기 **전에** 불러야 한다. 인증 전 계정은 남의 신청을 지우지 못한다.
     */
    async deleteForAccount(userId: string): Promise<number> {
        const deleted = await withRetry(
            () =>
                this.db
                    .delete(mailAlertSubscribers)
                    .where(
                        sql`${mailAlertSubscribers.userId} = ${userId} or (${mailAlertSubscribers.userId} is null and ${mailAlertSubscribers.email} = ${verifiedAddressOf(userId)})`
                    )
                    .returning({ id: mailAlertSubscribers.id }),
            DB_TRANSIENT_RETRY
        );
        return deleted.length;
    }

    /** 발송 대상 — 항목이 있거나 보유·관심종목 함께 받기가 켜진 구독자. 항목은 한 쿼리로 모은다. */
    async findAllForDelivery(): Promise<MailAlertDeliveryTarget[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        id: mailAlertSubscribers.id,
                        email: mailAlertSubscribers.email,
                        locale: mailAlertSubscribers.locale,
                        userId: mailAlertSubscribers.userId,
                        includePortfolio: mailAlertSubscribers.includePortfolio,
                        topics: sql<
                            MailAlertTopicRecord[]
                        >`coalesce(json_agg(json_build_object('kind', ${mailAlertTopics.kind}, 'key', ${mailAlertTopics.key}) order by ${mailAlertTopics.createdAt}, ${mailAlertTopics.key}) filter (where ${mailAlertTopics.kind} is not null), '[]'::json)`,
                    })
                    .from(mailAlertSubscribers)
                    .leftJoin(
                        mailAlertTopics,
                        eq(
                            mailAlertTopics.subscriberId,
                            mailAlertSubscribers.id
                        )
                    )
                    .groupBy(mailAlertSubscribers.id)
                    .having(
                        sql`${mailAlertSubscribers.includePortfolio} or count(${mailAlertTopics.kind}) > 0`
                    )
                    .orderBy(
                        mailAlertSubscribers.createdAt,
                        mailAlertSubscribers.id
                    ),
            DB_TRANSIENT_RETRY
        );
        return rows;
    }
}

/**
 * 잠긴 구독자 행에 대해: 항목이 0개이고 `include_portfolio`가 꺼져 있으면 지운다. 지웠는지 돌려준다.
 * 호출자가 같은 트랜잭션에서 행을 잠근 상태여야 한다(남은 항목 수를 믿을 수 있다).
 */
async function deleteIfNothingToReceive(
    tx: Pick<SiglensDatabase, 'select' | 'delete'>,
    owner: MailAlertOwner,
    subscriberId: string,
    includePortfolio: boolean
): Promise<boolean> {
    if (includePortfolio) return false;
    const remaining = await tx
        .select({ key: mailAlertTopics.key })
        .from(mailAlertTopics)
        .where(eq(mailAlertTopics.subscriberId, subscriberId))
        .limit(1);
    if (remaining.length > 0) return false;
    await tx
        .delete(mailAlertSubscribers)
        .where(
            and(
                eq(mailAlertSubscribers.id, subscriberId),
                ownerCondition(owner)
            )
        );
    return true;
}

/**
 * {@link MailAlertDeliveryRepository}의 Drizzle 구현. `claim`은 먼저 삽입하고
 * `(subscriber_id, alert_date)` 유니크 인덱스가 승자를 정한다 — 겹쳐 도는 두 실행이 같은 구독자의
 * 같은 날 메일을 함께 보낼 수 없다. 알림 날짜는 둘 다 앱이 구한 한국 날짜 문자열이다(DB 시간대 무관).
 */
export class DrizzleMailAlertDeliveryRepository implements MailAlertDeliveryRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async claim(
        subscriberId: string,
        alertDate: string
    ): Promise<string | null> {
        const [row] = await withRetry(
            () =>
                this.db
                    .insert(mailAlertDeliveries)
                    .values({ subscriberId, alertDate, status: 'pending' })
                    .onConflictDoNothing({
                        target: [
                            mailAlertDeliveries.subscriberId,
                            mailAlertDeliveries.alertDate,
                        ],
                    })
                    .returning({ id: mailAlertDeliveries.id }),
            DB_TRANSIENT_RETRY
        );
        return row?.id ?? null;
    }

    async finish(
        id: string,
        outcome: MailAlertDeliveryOutcome,
        itemKeys: readonly string[],
        error: string | null
    ): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .update(mailAlertDeliveries)
                    .set({
                        status: outcome,
                        itemKeys: [...itemKeys],
                        error,
                        updatedAt: sql`now()`,
                    })
                    .where(eq(mailAlertDeliveries.id, id)),
            DB_TRANSIENT_RETRY
        );
    }

    /** 실패한 발송은 반복 방지에 세지 않는다(그 항목은 받지 못했다). */
    async recentItemKeys(
        sinceAlertDate: string
    ): Promise<Map<string, Set<string>>> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        subscriberId: mailAlertDeliveries.subscriberId,
                        itemKeys: mailAlertDeliveries.itemKeys,
                    })
                    .from(mailAlertDeliveries)
                    .where(
                        and(
                            eq(mailAlertDeliveries.status, 'sent'),
                            gte(mailAlertDeliveries.alertDate, sinceAlertDate)
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
        return rows.reduce((byId, row) => {
            const keys = byId.get(row.subscriberId) ?? new Set<string>();
            row.itemKeys.forEach(key => keys.add(key));
            return byId.set(row.subscriberId, keys);
        }, new Map<string, Set<string>>());
    }

    async pruneBefore(alertDate: string): Promise<number> {
        const deleted = await withRetry(
            () =>
                this.db
                    .delete(mailAlertDeliveries)
                    .where(lt(mailAlertDeliveries.alertDate, alertDate))
                    .returning({ id: mailAlertDeliveries.id }),
            DB_TRANSIENT_RETRY
        );
        return deleted.length;
    }
}

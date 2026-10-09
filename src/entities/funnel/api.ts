import 'server-only';

import { and, count, eq, gte, lt, sql } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { funnelEvents, users, visitorDays } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type {
    FunnelEvent,
    FunnelEventContext,
} from '@/shared/lib/funnel/funnelEvents';
import { withRetry } from '@/shared/lib/withRetry';
import { RETENTION_WINDOWS } from './retentionWindows';
import type {
    FunnelKeyEventCount,
    SignupBreakdownRow,
    SignupCohortRow,
} from './types';

/** `record`가 남기는 한 행. `occurredAt`·`id`는 DB 기본값. */
export interface FunnelEventRecord {
    visitorHash: string;
    /** 로그인 회원이면 id, 아니면 null. */
    userId: string | null;
    event: FunnelEvent;
    context: FunnelEventContext;
}

/** `occurred_at`은 timestamptz라 KST 날짜 키를 그날 자정 시각으로 바꿔 비교한다. */
function kstMidnight(dateKey: string): Date {
    return new Date(`${dateKey}T00:00:00+09:00`);
}

export interface FunnelEventRepository {
    record(event: FunnelEventRecord): Promise<void>;
    /** `cutoffDate`(KST) **이전** 행을 지운다. 개인정보처리방침 §4의 보존 기간 집행. */
    pruneOlderThan(cutoffDate: string): Promise<void>;
    /**
     * `[from, toExclusive)` 구간의 (키, 이벤트)별 건수. 키는 context의 gate·kind·lastGate
     * 중 있는 것 — 게이트 클릭, 넛지 노출·클릭, 그 게이트를 lastGate로 가진 가입이 한
     * 키에 모인다. 키가 없는 이벤트(관심종목 등)는 `key: null`.
     */
    countByKeyAndEvent(
        from: Date,
        toExclusive: Date
    ): Promise<FunnelKeyEventCount[]>;
    /** 가입 방식 × lastGate 분포. */
    signupBreakdown(
        from: Date,
        toExclusive: Date
    ): Promise<SignupBreakdownRow[]>;
    /**
     * 가입 주(KST, 월요일 시작)별 D7·D30 재방문. 가입일 +7·+30 **이후 7일 창** 안에
     * `visitor_days.user_id` 방문이 있으면 재방문.
     */
    signupCohortRetention(
        from: Date,
        toExclusive: Date
    ): Promise<SignupCohortRow[]>;
}

export class DrizzleFunnelEventRepository implements FunnelEventRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async record(event: FunnelEventRecord): Promise<void> {
        await withRetry(
            () => this.db.insert(funnelEvents).values(event),
            DB_TRANSIENT_RETRY
        );
    }

    async pruneOlderThan(cutoffDate: string): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .delete(funnelEvents)
                    .where(
                        lt(funnelEvents.occurredAt, kstMidnight(cutoffDate))
                    ),
            DB_TRANSIENT_RETRY
        );
    }

    async countByKeyAndEvent(
        from: Date,
        toExclusive: Date
    ): Promise<FunnelKeyEventCount[]> {
        const key = sql<
            string | null
        >`coalesce(${funnelEvents.context} ->> 'gate', ${funnelEvents.context} ->> 'kind', ${funnelEvents.context} ->> 'lastGate')`;
        return this.db
            .select({ key, event: funnelEvents.event, count: count() })
            .from(funnelEvents)
            .where(
                and(
                    gte(funnelEvents.occurredAt, from),
                    lt(funnelEvents.occurredAt, toExclusive)
                )
            )
            .groupBy(key, funnelEvents.event);
    }

    async signupBreakdown(
        from: Date,
        toExclusive: Date
    ): Promise<SignupBreakdownRow[]> {
        const method = sql<string>`${funnelEvents.context} ->> 'method'`;
        const lastGate = sql<
            string | null
        >`${funnelEvents.context} ->> 'lastGate'`;
        return this.db
            .select({ method, lastGate, count: count() })
            .from(funnelEvents)
            .where(
                and(
                    eq(funnelEvents.event, 'signup_completed'),
                    gte(funnelEvents.occurredAt, from),
                    lt(funnelEvents.occurredAt, toExclusive)
                )
            )
            .groupBy(method, lastGate);
    }

    async signupCohortRetention(
        from: Date,
        toExclusive: Date
    ): Promise<SignupCohortRow[]> {
        // `visitor_days.date`는 KST 날짜라 가입 시각도 KST 날짜로 내려 비교한다. 쿼리
        // 빌더로 쓰기엔 EXISTS 서브쿼리 두 개가 길어 raw SQL로 둔다.
        // - postgres-js는 raw `sql` 템플릿의 Date 바인딩을 거부한다(ERR_INVALID_ARG_TYPE).
        //   그래서 기간은 ISO 문자열 + `::timestamptz`로 넘긴다.
        // - `count(...)::int`는 postgres-js가 bigint를 문자열로 돌려주는 것을 막는다.
        const rows = await this.db.execute<
            SignupCohortRow & Record<string, unknown>
        >(sql`
            with cohort as (
                select u.id, (u.created_at at time zone 'Asia/Seoul')::date as signup_date
                from ${users} u
                where u.created_at >= ${from.toISOString()}::timestamptz and u.created_at < ${toExclusive.toISOString()}::timestamptz
            )
            select
                to_char(date_trunc('week', c.signup_date), 'YYYY-MM-DD') as week,
                count(*)::int as signups,
                count(*) filter (where exists (
                    select 1 from ${visitorDays} v
                    where v.user_id = c.id
                      and v."date" between c.signup_date + ${RETENTION_WINDOWS.d7.startDay}::int and c.signup_date + ${RETENTION_WINDOWS.d7.endDay}::int
                ))::int as d7,
                count(*) filter (where exists (
                    select 1 from ${visitorDays} v
                    where v.user_id = c.id
                      and v."date" between c.signup_date + ${RETENTION_WINDOWS.d30.startDay}::int and c.signup_date + ${RETENTION_WINDOWS.d30.endDay}::int
                ))::int as d30
            from cohort c
            group by 1
            order by 1
        `);
        return [...rows];
    }
}

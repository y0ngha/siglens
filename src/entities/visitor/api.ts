import 'server-only';

import {
    and,
    count,
    countDistinct,
    desc,
    gte,
    isNotNull,
    isNull,
    lt,
    sql,
} from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { visitorDays } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { LOCALES } from '@/shared/i18n/locales';
import { withRetry } from '@/shared/lib/withRetry';
import { GUEST_RETURN_WINDOWS } from './lib/visitHistory';
import type {
    DailyActiveUsers,
    DailyLandingCount,
    EntrySource,
    EntrySourceSiteTally,
    FirstVisitBucket,
    LandingSite,
    LastVisitBucket,
    ReturnWindow,
    ReturnWindowRow,
    UserAgentTally,
    VisitDaysBucket,
    VisitDaysTally,
} from './types';

/**
 * `recordVisit`이 남기는 한 행.
 *
 * `visitorHash`·`date` 외의 필드는 집계에 쓰이지 않는 **진단용**이다. 봇 필터를
 * 통과한 트래픽이 정말 사람인지 사후에 확인하려면 원본 신호가 남아 있어야 한다.
 * 헤더가 없으면 `null`을 넣는다 — 빈 문자열로 채우면 "값이 없었다"와 "빈 값이
 * 왔다"가 구분되지 않는다.
 */
export interface VisitorDayRecord {
    visitorHash: string;
    /** KST `YYYY-MM-DD`. */
    date: string;
    userAgent: string | null;
    /** ISO 3166-1 alpha-2. Cloudflare를 거치지 않으면 null. */
    country: string | null;
    /** 쿼리스트링을 뺀 경로. */
    landingPath: string | null;
    /** 그날 첫 진입의 출처 분류. 같은 사이트 이동·직접 방문은 null. */
    entrySource: EntrySource | null;
    /** 비콘을 보낸 사이트. 그날 첫 행의 값이 남는다. Referer가 없으면 null. */
    landingSite: LandingSite | null;
    /** 방문 이력 구간값(`VisitSignals`). 브라우저가 못 보냈으면 전부 null. */
    firstVisitBucket: FirstVisitBucket | null;
    lastVisitBucket: LastVisitBucket | null;
    visitDaysBucket: VisitDaysBucket | null;
    returnWindow: ReturnWindow | null;
    /** 비콘 시점의 로그인 회원 id. 비회원이면 null. 회원 D7/D30 재방문의 축. */
    userId: string | null;
}

/** 방문자 일자 행의 적재·정리·집계. 날짜는 전부 KST `YYYY-MM-DD`. */
interface VisitorRepository {
    /** 방문자당 하루 1행. 이미 있으면 user_id만 비어 있을 때 채운다. */
    recordVisit(visit: VisitorDayRecord): Promise<void>;
    /** `cutoffDate` **이전** 행을 지운다. 개인정보처리방침에 고지한 보존 기간 집행. */
    pruneOlderThan(cutoffDate: string): Promise<void>;
    /** `fromDate` 이후의 날짜별 방문자 수. 최신 날짜가 먼저 온다. */
    dailyActiveUsers(fromDate: string): Promise<DailyActiveUsers[]>;
    /** `fromDate` 이후 구간의 고유 방문자 수. */
    monthlyActiveUsers(fromDate: string): Promise<number>;
    /** 테이블 전체 행 수. 집계 테이블 도입 시점을 판단하는 데 쓴다. */
    totalRows(): Promise<number>;
    /**
     * `fromDate` 이후 구간에서 많이 잡힌 (User-Agent, 국가) 조합.
     *
     * 집계가 아니라 **검수용**이다. 봇 필터를 통과한 것들 중 사람이 아닌 것이
     * 섞였는지는 UA를 직접 눈으로 보는 것 말고 방법이 없다.
     */
    topUserAgents(fromDate: string, limit: number): Promise<UserAgentTally[]>;
    /**
     * 최상위 `section`(예: `guide`) 아래로 진입한 방문의 날짜별 수 — 가이드 유입 추세용.
     * `landing_path`는 Referer의 pathname이라 로케일 접두사(`/en/guide/...`)가 붙을 수 있고
     * 허브(`/guide`)도 있으므로, 단순 접두사 비교가 아니라 로케일 접두사를 허용하는 정규식으로 센다.
     */
    landingSectionCounts(
        fromDate: string,
        section: string
    ): Promise<DailyLandingCount[]>;
    /**
     * `fromDate` 이후 구간의 (사이트, 첫 진입 출처)별 방문 행 수(많은 순). 출처 없음(직접 방문·같은
     * 사이트)은 `entrySource: null`, 사이트를 모르는 도입 전 행은 `site: null`. 새 방문·재방문은
     * `first_visit_bucket` 기준이라 구간값이 없는 행은 둘 다에서 빠진다.
     */
    entrySourceBySite(fromDate: string): Promise<EntrySourceSiteTally[]>;
    /** `fromDate` 이후 구간의 (사이트, 방문 날 수 구간)별 행 수. 구간값이 있는 행만 센다. */
    visitDaysDistribution(fromDate: string): Promise<VisitDaysTally[]>;
    /**
     * 첫 방문일이 `[fromDate, toDate]`(KST, 양 끝 포함)인 새 방문과, 그 코호트가 창 안에서 처음 돌아온
     * 건수를 사이트별로 센다. 돌아온 행은 창 중앙값만큼 옮긴 날짜 범위에서 센다(D1 정확, D7·D30 추정).
     */
    returnWindowCounts(
        fromDate: string,
        toDate: string
    ): Promise<ReturnWindowRow[]>;
}

/**
 * `^(/(ko|en|ja|zh))?/{section}(/|$)` — 선택적 로케일 접두사 + 허브·하위 경로. 로케일 목록은 i18n 설정에서 온다.
 * `section`은 호출부 상수(영숫자·하이픈)만 받는다.
 */
function landingSectionPattern(section: string): string {
    return `^(/(${LOCALES.join('|')}))?/${section}(/|$)`;
}

/**
 * `VisitorRepository`의 Postgres 구현. `/api/presence` 라우트(적재·정리)와
 * 지표 스크립트(집계)가 쓴다. server-only라 클라이언트에서 import하지 않는다.
 */
export class DrizzleVisitorRepository implements VisitorRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async recordVisit(visit: VisitorDayRecord): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(visitorDays)
                    .values(visit)
                    .onConflictDoUpdate({
                        target: [visitorDays.date, visitorDays.visitorHash],
                        // 같은 날 익명으로 먼저 온 행에만 회원 id를 채운다. 한 번 채워진
                        // 값은 바꾸지 않는다 — 공용 기기에서 다른 회원이 로그인해도 첫
                        // 회원에게 남는다(해시가 IP+UA라 어차피 한 사람으로 센다).
                        // `setWhere`는 채울 때만 행을 다시 쓰게 한다 — 없으면 방문마다 충돌한
                        // 행을 매번 UPDATE해 죽은 튜플이 쌓인다.
                        setWhere: and(
                            isNull(visitorDays.userId),
                            sql`excluded.user_id is not null`
                        ),
                        set: {
                            userId: sql`coalesce(${visitorDays.userId}, excluded.user_id)`,
                        },
                    }),
            DB_TRANSIENT_RETRY
        );
    }

    async pruneOlderThan(cutoffDate: string): Promise<void> {
        // 형제 쓰기 메서드와 같은 재시도 정책을 쓴다. Neon 일시 오류로 정리가
        // 계속 실패하면 방침에 고지한 보존 기간을 넘긴 행이 남는다.
        await withRetry(
            () =>
                this.db
                    .delete(visitorDays)
                    .where(lt(visitorDays.date, cutoffDate)),
            DB_TRANSIENT_RETRY
        );
    }

    async dailyActiveUsers(fromDate: string): Promise<DailyActiveUsers[]> {
        return this.db
            .select({ date: visitorDays.date, count: count() })
            .from(visitorDays)
            .where(gte(visitorDays.date, fromDate))
            .groupBy(visitorDays.date)
            .orderBy(desc(visitorDays.date));
    }

    async monthlyActiveUsers(fromDate: string): Promise<number> {
        const rows = await this.db
            .select({ value: countDistinct(visitorDays.visitorHash) })
            .from(visitorDays)
            .where(gte(visitorDays.date, fromDate));
        return rows[0]?.value ?? 0;
    }

    async totalRows(): Promise<number> {
        const rows = await this.db.select({ value: count() }).from(visitorDays);
        return rows[0]?.value ?? 0;
    }

    async topUserAgents(
        fromDate: string,
        limit: number
    ): Promise<UserAgentTally[]> {
        const tally = count();
        return this.db
            .select({
                userAgent: visitorDays.userAgent,
                country: visitorDays.country,
                count: tally,
            })
            .from(visitorDays)
            .where(gte(visitorDays.date, fromDate))
            .groupBy(visitorDays.userAgent, visitorDays.country)
            .orderBy(desc(tally))
            .limit(limit);
    }

    async landingSectionCounts(
        fromDate: string,
        section: string
    ): Promise<DailyLandingCount[]> {
        return this.db
            .select({ date: visitorDays.date, count: count() })
            .from(visitorDays)
            .where(
                and(
                    gte(visitorDays.date, fromDate),
                    sql`${visitorDays.landingPath} ~ ${landingSectionPattern(section)}`
                )
            )
            .groupBy(visitorDays.date)
            .orderBy(desc(visitorDays.date));
    }

    async entrySourceBySite(fromDate: string): Promise<EntrySourceSiteTally[]> {
        const tally = count();
        return this.db
            .select({
                site: visitorDays.landingSite,
                entrySource: visitorDays.entrySource,
                count: tally,
                newVisitors: sql<number>`(count(*) filter (where ${visitorDays.firstVisitBucket} = 'new'))::int`,
                returning: sql<number>`(count(*) filter (where ${visitorDays.firstVisitBucket} <> 'new'))::int`,
            })
            .from(visitorDays)
            .where(gte(visitorDays.date, fromDate))
            .groupBy(visitorDays.landingSite, visitorDays.entrySource)
            .orderBy(desc(tally));
    }

    async visitDaysDistribution(fromDate: string): Promise<VisitDaysTally[]> {
        return this.db
            .select({
                site: visitorDays.landingSite,
                bucket: sql<string>`${visitorDays.visitDaysBucket}`,
                count: count(),
            })
            .from(visitorDays)
            .where(
                and(
                    gte(visitorDays.date, fromDate),
                    isNotNull(visitorDays.visitDaysBucket)
                )
            )
            .groupBy(visitorDays.landingSite, visitorDays.visitDaysBucket)
            .orderBy(visitorDays.landingSite, visitorDays.visitDaysBucket);
    }

    async returnWindowCounts(
        fromDate: string,
        toDate: string
    ): Promise<ReturnWindowRow[]> {
        // 창 중앙값 이동: 창 안의 첫 방문은 첫 방문 뒤 `startDay..endDay`일 사이 어느 날이든 올 수 있어
        // 코호트를 중앙값(`round((startDay + endDay) / 2)`)만큼 옮겨 센다. D7·D30은 ±3일 경계의 추정이다.
        const shift = (window: { startDay: number; endDay: number }) =>
            Math.round((window.startDay + window.endDay) / 2);
        const { d1, d7, d30 } = GUEST_RETURN_WINDOWS;
        const lastEnd = Math.max(d1.endDay, d7.endDay, d30.endDay);
        // postgres-js는 raw sql의 날짜 문자열을 그대로 두므로 `::date`로 캐스팅하고, 이동 일수는 `::int`로 넘긴다.
        const rows = await this.db.execute<
            ReturnWindowRow & Record<string, unknown>
        >(sql`
            select
                landing_site as site,
                (count(*) filter (where first_visit_bucket = 'new' and "date" between ${fromDate}::date and ${toDate}::date))::int as "newVisitors",
                (count(*) filter (where return_window = 'd1' and "date" between ${fromDate}::date + ${shift(d1)}::int and ${toDate}::date + ${shift(d1)}::int))::int as d1,
                (count(*) filter (where return_window = 'd7' and "date" between ${fromDate}::date + ${shift(d7)}::int and ${toDate}::date + ${shift(d7)}::int))::int as d7,
                (count(*) filter (where return_window = 'd30' and "date" between ${fromDate}::date + ${shift(d30)}::int and ${toDate}::date + ${shift(d30)}::int))::int as d30
            from ${visitorDays}
            where "date" between ${fromDate}::date and ${toDate}::date + ${lastEnd}::int
              and first_visit_bucket is not null
            group by 1
            order by 1
        `);
        return [...rows];
    }
}

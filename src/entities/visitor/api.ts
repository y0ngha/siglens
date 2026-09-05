import 'server-only';

import { count, countDistinct, desc, gte, lt } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { visitorDays } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import type { DailyActiveUsers, UserAgentTally } from './types';

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
}

/** 방문자 일자 행의 적재·정리·집계. 날짜는 전부 KST `YYYY-MM-DD`. */
export interface VisitorRepository {
    /** 방문자당 하루 1행. 이미 있으면 아무 일도 하지 않는다. */
    recordVisit(visit: VisitorDayRecord): Promise<void>;
    /** `cutoffDate` **이전** 행을 지운다. 개인정보처리방침 §4의 보존 기간 집행. */
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
}

/** Drizzle ORM-backed implementation. */
export class DrizzleVisitorRepository implements VisitorRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async recordVisit(visit: VisitorDayRecord): Promise<void> {
        await withRetry(
            () =>
                this.db.insert(visitorDays).values(visit).onConflictDoNothing(),
            NEON_TRANSIENT_RETRY
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
            NEON_TRANSIENT_RETRY
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
}

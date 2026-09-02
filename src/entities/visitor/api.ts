import 'server-only';

import { count, countDistinct, desc, gte, lt } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { visitorDays } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import type { DailyActiveUsers } from './types';

/** 방문자 일자 행의 적재·정리·집계. 날짜는 전부 KST `YYYY-MM-DD`. */
export interface VisitorRepository {
    /** 방문자당 하루 1행. 이미 있으면 아무 일도 하지 않는다. */
    recordVisit(visitorHash: string, date: string): Promise<void>;
    /** `cutoffDate` **이전** 행을 지운다. 개인정보처리방침 §4의 보존 기간 집행. */
    pruneOlderThan(cutoffDate: string): Promise<void>;
    /** `fromDate` 이후의 날짜별 방문자 수. 최신 날짜가 먼저 온다. */
    dailyActiveUsers(fromDate: string): Promise<DailyActiveUsers[]>;
    /** `fromDate` 이후 구간의 고유 방문자 수. */
    monthlyActiveUsers(fromDate: string): Promise<number>;
    /** 테이블 전체 행 수. 집계 테이블 도입 시점을 판단하는 데 쓴다. */
    totalRows(): Promise<number>;
}

/** Drizzle ORM-backed implementation. */
export class DrizzleVisitorRepository implements VisitorRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async recordVisit(visitorHash: string, date: string): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(visitorDays)
                    .values({ visitorHash, date })
                    .onConflictDoNothing(),
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
}

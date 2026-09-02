/**
 * MAU/DAU 읽기. 관리자 UI도 API 라우트도 만들지 않는 이유는
 * `docs/superpowers/specs/2026-09-02-visitor-metrics-design.md` §6에 있다 —
 * `users`에 role 컬럼조차 없어 권한 체계부터 만들어야 한다.
 *
 * 실행: `yarn metrics`
 */
import { DrizzleVisitorRepository } from '@/entities/visitor';
import { getDatabaseClient } from '@/shared/db/client';
import { kstDateKey } from '@/shared/lib/etTimeUtils';

/** 표에 찍을 일수. */
const DAU_WINDOW_DAYS = 30;

/** MAU는 롤링 30일이다. 달력 월 기준은 월초에 1일치로 떨어져 추세를 못 읽는다. */
const MAU_WINDOW_DAYS = 30;

const MILLISECONDS_PER_DAY = 86_400_000;
const ISO_DATE_LENGTH = 10;

/** 달력 문자열 산술이라 UTC로 파싱한다. */
function daysBefore(todayKst: string, days: number): string {
    const base = new Date(`${todayKst}T00:00:00Z`);
    return new Date(base.getTime() - days * MILLISECONDS_PER_DAY)
        .toISOString()
        .slice(0, ISO_DATE_LENGTH);
}

async function main(): Promise<void> {
    const today = kstDateKey(new Date());
    const { db } = getDatabaseClient();
    const repo = new DrizzleVisitorRepository(db);

    const [daily, mau, total] = await Promise.all([
        repo.dailyActiveUsers(daysBefore(today, DAU_WINDOW_DAYS)),
        repo.monthlyActiveUsers(daysBefore(today, MAU_WINDOW_DAYS)),
        repo.totalRows(),
    ]);

    console.log('날짜         DAU');
    for (const row of daily) {
        console.log(`${row.date}   ${row.count.toLocaleString('ko-KR')}`);
    }
    if (daily.length === 0) {
        console.log('(행 없음 — VISITOR_HASH_PEPPER 설정을 먼저 확인한다)');
    }

    console.log('');
    console.log(
        `MAU (${MAU_WINDOW_DAYS}일 롤링): ${mau.toLocaleString('ko-KR')}`
    );
    // 이 수가 수백만이 되면 그때 일별 집계 테이블을 도입한다.
    console.log(`총 행 수: ${total.toLocaleString('ko-KR')}`);
}

if (require.main === module) {
    main().catch(err => {
        console.error('[metrics] failed:', err);
        process.exit(1);
    });
}

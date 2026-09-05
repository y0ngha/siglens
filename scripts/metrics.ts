/**
 * MAU/DAU 읽기. 관리자 UI도 API 라우트도 만들지 않는 이유는
 * `docs/superpowers/specs/2026-09-02-visitor-metrics-design.md` §6에 있다 —
 * `users`에 role 컬럼조차 없어 권한 체계부터 만들어야 한다.
 *
 * 실행: `yarn metrics`
 */
import { DrizzleVisitorRepository } from '@/entities/visitor';
import { getDatabaseClient } from '@/shared/db/client';
import { kstDateKey, kstDateKeyDaysBefore } from '@/shared/lib/etTimeUtils';

/** 표에 찍을 일수. */
const DAU_WINDOW_DAYS = 30;

/** MAU는 롤링 30일이다. 달력 월 기준은 월초에 1일치로 떨어져 추세를 못 읽는다. */
const MAU_WINDOW_DAYS = 30;

/** UA 검수 표에 찍을 줄 수. 눈으로 훑는 용도라 화면 한 장을 넘기지 않는다. */
const USER_AGENT_SAMPLE_ROWS = 30;

/** 표에서 UA를 자를 길이. 원문 전체가 필요하면 DB를 직접 본다. */
const USER_AGENT_DISPLAY_LENGTH = 90;

async function main(): Promise<void> {
    const today = kstDateKey(new Date());
    const { db } = getDatabaseClient();
    const repo = new DrizzleVisitorRepository(db);

    const [daily, mau, total, userAgents] = await Promise.all([
        repo.dailyActiveUsers(kstDateKeyDaysBefore(today, DAU_WINDOW_DAYS)),
        repo.monthlyActiveUsers(kstDateKeyDaysBefore(today, MAU_WINDOW_DAYS)),
        repo.totalRows(),
        repo.topUserAgents(
            kstDateKeyDaysBefore(today, DAU_WINDOW_DAYS),
            USER_AGENT_SAMPLE_ROWS
        ),
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

    // 봇 필터를 통과한 것들이 정말 사람인지 눈으로 본다. 여기 크롤러 UA가
    // 보이면 `src/shared/api/isBot.ts`에 토큰을 추가한다.
    console.log('');
    console.log(`상위 User-Agent (${DAU_WINDOW_DAYS}일)`);
    for (const row of userAgents) {
        const label = (row.userAgent ?? '(없음)').slice(
            0,
            USER_AGENT_DISPLAY_LENGTH
        );
        console.log(
            `${String(row.count).padStart(6)}  ${row.country ?? '--'}  ${label}`
        );
    }
    if (userAgents.length === 0) {
        console.log('(행 없음)');
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error('[metrics] failed:', err);
        process.exit(1);
    });
}

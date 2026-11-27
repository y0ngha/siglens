/**
 * MAU/DAU 읽기. 관리자 UI도 API 라우트도 만들지 않는 이유는 `users`에 role
 * 컬럼조차 없어 권한 체계부터 만들어야 하기 때문이다.
 *
 * 실행: `yarn metrics`
 */
import { DrizzleVisitorRepository } from '@/entities/visitor/api';
import {
    VISIT_DAYS_BUCKETS,
    type VisitDaysBucket,
} from '@/entities/visitor/types';
import { endDatabaseClient, getDatabaseClient } from '@/shared/db/client';
import { kstDateKey, kstDateKeyDaysBefore } from '@/shared/lib/etTimeUtils';
import { renderTable } from './lib/funnelReport';
import { pivotEntrySources, pivotVisitDays } from './lib/visitReport';

/**
 * 방문 날 수 구간의 표 머리글. `Record`라 구간이 늘면 여기서 타입 오류로 드러난다.
 * 열 순서는 `VISIT_DAYS_BUCKETS`를 따른다.
 */
const VISIT_DAYS_HEADERS: Record<VisitDaysBucket, string> = {
    n1: '1일',
    n2: '2일',
    n3_4: '3~4일',
    n5_9: '5~9일',
    n10_19: '10~19일',
    n20_plus: '20일 이상',
};

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

    const [
        daily,
        mau,
        total,
        userAgents,
        guideLandings,
        lpLandings,
        entrySources,
        visitDays,
    ] = await Promise.all([
        repo.dailyActiveUsers(kstDateKeyDaysBefore(today, DAU_WINDOW_DAYS)),
        repo.monthlyActiveUsers(kstDateKeyDaysBefore(today, MAU_WINDOW_DAYS)),
        repo.totalRows(),
        repo.topUserAgents(
            kstDateKeyDaysBefore(today, DAU_WINDOW_DAYS),
            USER_AGENT_SAMPLE_ROWS
        ),
        repo.landingSectionCounts(
            kstDateKeyDaysBefore(today, DAU_WINDOW_DAYS),
            'guide'
        ),
        repo.landingSectionCounts(
            kstDateKeyDaysBefore(today, DAU_WINDOW_DAYS),
            'lp'
        ),
        repo.entrySourceBySite(kstDateKeyDaysBefore(today, DAU_WINDOW_DAYS)),
        repo.visitDaysDistribution(
            kstDateKeyDaysBefore(today, DAU_WINDOW_DAYS)
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
        '가이드 진입(landing_path /guide, /guide/*, 로케일 접두사 포함)'
    );
    for (const row of guideLandings) {
        console.log(`${row.date}   ${row.count.toLocaleString('ko-KR')}`);
    }

    console.log('');
    console.log('광고 랜딩 진입(landing_path /lp/*, 로케일 접두사 포함)');
    for (const row of lpLandings) {
        console.log(`${row.date}   ${row.count.toLocaleString('ko-KR')}`);
    }
    if (lpLandings.length === 0) {
        console.log('(행 없음)');
    }

    // 첫 진입 출처(AI 답변 서비스·검색·SNS·광고·메일·공유 링크) × 사이트.
    console.log('');
    console.log(`첫 진입 출처 × 사이트 (${DAU_WINDOW_DAYS}일, 방문 행 수)`);
    console.log(
        renderTable(
            ['출처', 'main', 'ai', '(미상)', '합계', '재방문 비율'],
            pivotEntrySources(entrySources).map(row => [
                row.source,
                String(row.main),
                String(row.ai),
                String(row.unknown),
                String(row.total),
                row.returningShare,
            ])
        )
    );
    console.log(
        '((없음)은 직접 방문, 사이트 내부, 도입 전 행이다. 사이트 (미상)은 도입 전 행이다. 도입 전의 google에는 광고 클릭이 섞여 있다. 사이트는 그날 첫 진입 기준이다.)'
    );

    console.log('');
    console.log(`방문 날 수 분포 (${DAU_WINDOW_DAYS}일, 구간값이 있는 행)`);
    console.log(
        renderTable(
            [
                '사이트',
                ...VISIT_DAYS_BUCKETS.map(bucket => VISIT_DAYS_HEADERS[bucket]),
                '1일 비중',
            ],
            pivotVisitDays(visitDays).map(row => [
                row.site,
                ...VISIT_DAYS_BUCKETS.map(bucket =>
                    String(row.buckets.get(bucket) ?? 0)
                ),
                row.n1Share,
            ])
        )
    );
    console.log(
        '(방문 날 수는 브라우저가 로컬 스토리지에 쌓은 값이다. 사파리는 7일 미방문 시 지워져 다시 1일로 보이고, 시크릿 창은 늘 1일이다. 구간값으로 행을 서로 잇지 않는다.)'
    );

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
    main()
        .catch(err => {
            console.error('[metrics] failed:', err);
            process.exitCode = 1;
        })
        // 풀을 닫지 않으면 유휴 소켓(idle_timeout 20s)이 프로세스를 그만큼 붙잡는다.
        .finally(() => endDatabaseClient());
}

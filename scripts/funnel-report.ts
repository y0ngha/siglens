/**
 * 가입 퍼널 리포트 — 표 세 개.
 *  1. 게이트·넛지별 게이트 클릭·노출·CTA 클릭·클릭률·그 게이트를 lastGate로 가진 가입 수
 *  2. 가입 방식 × lastGate 분포
 *  3. 가입 주별 D7·D30 재방문율(가입일 +7·+30 이후 7일 창)
 *  4. 하루 무료 공개 미터 — 노출 상태별 방문자와 이후 7일 안 가입 전환
 *
 * 실행: `yarn funnel:report --from 2026-10-01 --to 2026-10-31` (KST, 양끝 포함)
 * 운영 DB는 `yarn db:tunnel`로 터널을 연 뒤 **읽기 전용 URL**로 — `scripts/metrics.ts`와
 * 같은 관례. 읽기만 하므로 원격 쓰기 가드(`guardRemoteWrite`)는 부르지 않는다.
 * 대시보드 UI는 범위 밖이다.
 */
import { DrizzleFunnelEventRepository } from '@/entities/funnel/api';
import { endDatabaseClient, getDatabaseClient } from '@/shared/db/client';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import {
    buildGateTable,
    cohortMaturity,
    formatRate,
    kstRangeBounds,
    parseReportArgs,
    renderTable,
} from './lib/funnelReport';

const UNSETTLED = '미확정';

const n = (value: number): string => value.toLocaleString('ko-KR');

async function main(): Promise<void> {
    const today = kstDateKey(new Date());
    const range = parseReportArgs(process.argv.slice(2));
    const { from, toExclusive } = kstRangeBounds(range);
    const { db } = getDatabaseClient();
    const repo = new DrizzleFunnelEventRepository(db);

    const [counts, breakdown, cohorts, meterCohort] = await Promise.all([
        repo.countByKeyAndEvent(from, toExclusive),
        repo.signupBreakdown(from, toExclusive),
        repo.signupCohortRetention(from, toExclusive),
        repo.meterCohort(from, toExclusive),
    ]);

    console.log(`가입 퍼널 ${range.from} ~ ${range.to} (KST)`);
    console.log('');
    console.log('1. 게이트·넛지별');
    console.log(
        renderTable(
            [
                '키',
                '게이트 클릭',
                '노출',
                'CTA 클릭',
                'CTA 클릭률',
                '가입(lastGate)',
            ],
            buildGateTable(counts).map(row => [
                row.key,
                n(row.gateClicks),
                n(row.shown),
                n(row.ctaClicks),
                formatRate(row.ctaClicks, row.shown),
                n(row.signups),
            ])
        )
    );

    console.log('');
    console.log('2. 가입 방식 × lastGate');
    console.log(
        renderTable(
            ['방식', 'lastGate', '가입'],
            breakdown.map(row => [
                row.method,
                row.lastGate ?? '(없음)',
                n(row.count),
            ])
        )
    );

    console.log('');
    console.log('3. 가입 주별 재방문 (주 시작 = 월요일 KST)');
    console.log(
        renderTable(
            ['가입 주', '가입', 'D7', 'D7율', 'D30', 'D30율'],
            cohorts.map(row => {
                const maturity = cohortMaturity(row.week, today);
                return [
                    row.week,
                    n(row.signups),
                    maturity.d7 ? n(row.d7) : UNSETTLED,
                    maturity.d7 ? formatRate(row.d7, row.signups) : UNSETTLED,
                    maturity.d30 ? n(row.d30) : UNSETTLED,
                    maturity.d30 ? formatRate(row.d30, row.signups) : UNSETTLED,
                ];
            })
        )
    );
    console.log(
        `(${UNSETTLED}: 그 주 마지막 가입자의 D7 창(+13일)·D30 창(+36일)이 아직 닫히지 않았다)`
    );

    console.log('');
    console.log('4. 하루 무료 공개 미터 (노출 뒤 7일 안 가입)');
    console.log(
        renderTable(
            ['노출 상태', '방문자', '가입', '전환율'],
            meterCohort.map(row => [
                row.state,
                n(row.visitors),
                n(row.signups),
                formatRate(row.signups, row.visitors),
            ])
        )
    );
    console.log(
        '(같은 기간 안에서 revealed와 exhausted를 비교한다. 최근 7일 안의 노출은 아직 전환 창이 닫히지 않았다)'
    );
}

if (require.main === module) {
    main()
        .catch(err => {
            console.error('[funnel-report] failed:', err);
            process.exitCode = 1;
        })
        // 풀을 닫지 않으면 유휴 소켓(idle_timeout 20s)이 프로세스를 그만큼 붙잡는다.
        .finally(() => endDatabaseClient());
}

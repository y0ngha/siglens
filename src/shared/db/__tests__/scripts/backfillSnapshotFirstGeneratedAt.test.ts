import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SEO_SNAPSHOT_TABS } from '@/entities/seo-snapshot/model';

const SOURCE = readFileSync(
    join(process.cwd(), 'db/scripts/backfillSnapshotFirstGeneratedAt.ts'),
    'utf8'
);

/**
 * 백필이 탭을 빠뜨리면 **그 탭만 조용히 `NULL`로 남는다** — 렌더는 발행일을 생략할
 * 뿐이라 화면도 빌드도 멀쩡하고, 스냅샷 upsert는 기존 행을 UPDATE로 다시 구우면서
 * 이 컬럼을 건드리지 않으므로(최초 값 보존이 목적) **영원히** 채워지지 않는다.
 * 이 스크립트가 유일한 경로라 커버리지를 여기서 고정한다.
 */
describe('backfillSnapshotFirstGeneratedAt 커버리지', () => {
    it.each(SEO_SNAPSHOT_TABS)('%s 탭이 어느 plan에든 들어 있다', tab => {
        // 탭 이름은 상수(`NEWS_TAB`·`TECHNICAL_TAB`)나 `APPROXIMATED_TABS` 배열의
        // 리터럴로 등장한다. 어느 쪽이든 문자열이 소스에 있어야 한다.
        expect(SOURCE).toContain(`'${tab}'`);
    });

    /**
     * 근사치 plan은 `analysis_history`를 쓰면 안 된다. 그 테이블은 2026-09-05부터라
     * 8월에 이미 있던 페이지를 "9월 발행"이라고 주장하게 된다 — 이 컬럼이 없애려던
     * 거짓 신선도 신호를 그대로 되살리는 방향이다.
     */
    it('근사치 plan은 뉴스 수집 시각을 쓰고 analysis_history를 쓰지 않는다', () => {
        // `PLANS` 배열 끝까지만 본다. 파일 끝까지 자르면 아래 로그 문구가 설명용으로
        // 언급하는 `analysis_history`까지 물어 단언이 거짓으로 깨진다.
        const plansEnd = SOURCE.indexOf('];', SOURCE.indexOf('const PLANS'));
        const approxPlan = SOURCE.slice(
            SOURCE.indexOf('APPROXIMATED_TABS,'),
            plansEnd
        );
        expect(approxPlan).toContain('MIN(fetched_at)');
        expect(approxPlan).not.toContain('analysis_history');
    });

    /**
     * 멱등성의 근거는 `IS NULL` 조건 하나다. 운영 절차가 2패스(배포 전·후)라
     * 이게 빠지면 두 번째 실행이 이미 채운 값을 덮어써 최초 시각이 배포 시각으로
     * 밀린다.
     */
    it('이미 채워진 행은 건드리지 않는다 — WHERE에 IS NULL이 있다', () => {
        const updates = SOURCE.split('UPDATE seo_analysis_snapshots').slice(1);
        expect(updates.length).toBeGreaterThan(0);
        for (const statement of updates) {
            expect(statement.slice(0, 400)).toContain(
                'first_generated_at IS NULL'
            );
        }
    });

    /** 기본이 dry-run이어야 한다 — 운영 DB에 대고 잘못 돌렸을 때 아무 일도 없게. */
    it('--apply 없이는 쓰지 않는다', () => {
        expect(SOURCE).toContain("process.argv.includes('--apply')");
        expect(SOURCE).toContain('assertRemoteWriteAllowed');
    });
});

import { DrizzleAnalysisHistoryRepository } from '@/entities/analysis/analysisHistoryRepository';
import { warmOptionsLastGood } from '@/entities/options-chain/server/warmOptionsLastGood';
import { getDatabaseClient } from '@/shared/db/client';
import { releasePrewarmLock } from './lock';
import { pruneExpiredRows } from './pruneExpiredRows';
import { recordSignalHistory } from './recordSignalHistory';
import { BATCH_WALL_CLOCK_BUDGET_MS, runPrewarmBatch } from './runPrewarmBatch';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/**
 * 신호 이력 단계의 상한(ms). 대상이 약 860종목(S&P 500·코스피 200·코스닥 150)이라 한 실행이 다 못 끝낸다 —
 * 종목별 진행 표식이 있어 다음 실행(5분 뒤)이 이어 받으므로, 이 상한은 "한 번에 얼마나 하나"를 정할 뿐이다.
 * 업스트림 호출은 FMP 분당 200건·yahoo 분당 240건으로 묶여(`SIGNAL_SCAN_PACING_MS`) 한 시장이 150초에
 * 약 500건을 받는다. 두 시장은 서로 다른 provider라 같은 시간 안에 병렬로 돈다. 배치 몫은 여전히
 * `lockAcquiredAtMs + BATCH_WALL_CLOCK_BUDGET_MS`가 묶는다.
 */
const SIGNAL_HISTORY_STEP_MAX_MS = 150_000;

/** 한 단계의 예외를 삼키고 로그만 남긴다 — 뒤 단계(워밍·정리·락 해제)가 앞 단계 실패에 막히지 않게 한다. */
async function logFailure(
    label: string,
    step: () => Promise<void>
): Promise<void> {
    try {
        await step();
    } catch (error) {
        console.error(
            `[seo-prewarm] ${label} failed:`,
            redactDbErrorForLog(error)
        );
    }
}

/** 보유 토큰으로 루트 락을 푼다. 해제 실패는 로그만 남긴다 — 락은 TTL이 만료되면 풀리고, 던지면 백그라운드 작업이 처리되지 않은 거부로 끝난다. */
async function releaseLockSafely(token: string): Promise<void> {
    try {
        await releasePrewarmLock(token);
    } catch (error) {
        console.error(
            '[seo-prewarm] lock release failed:',
            redactDbErrorForLog(error)
        );
    }
}

/**
 * 락을 잡은 SEO pre-warm 실행의 본문 — 신호 이력 → 배치 → 옵션 워밍 → 보존 정리 → 락 해제 순서로 돈다.
 * `route.ts`가 `afterWithDrain` 안에서 부르며, 이 함수는 던지지 않는다(`afterWithDrain`의 계약).
 *
 * 단계마다 실패를 격리한다: 어느 단계가 던져도 뒤 단계와 락 해제는 반드시 돈다. 옵션 워밍은 별도
 * EventBridge 규칙 없이 이 락 안에서 배치 직후에 돌고, 보존 정리(이력·만료 행)도 별도 엔드포인트 없이
 * 이 cron에 얹혀 있다.
 *
 * @param lockToken - `acquirePrewarmLock`이 돌려준 보유 토큰. 해제는 이 토큰일 때만 지운다.
 * @param lockAcquiredAtMs - 락 획득 시각. 옵션 워밍 마감(획득 시각 + 배치 예산)의 기준이라 prune·락 해제 몫을 건드리지 않는다.
 */
export async function runSeoPrewarmJob(
    lockToken: string,
    lockAcquiredAtMs: number
): Promise<void> {
    // 신호 이력은 배치 **앞**에서 돈다. 마감 뒤 창에서는 세션이 완료될 때까지(약 860종목, 실행마다 최대
    // `SIGNAL_HISTORY_STEP_MAX_MS`) 매 틱 이 단계가 한도까지 돌 수 있어 가볍지 않다. 그래도 앞에 두는 까닭은
    // 예산을 다 쓰도록 짜인 배치 뒤에 두면 바쁜 밤마다 예산이 바닥나 그 세션을 영영 못 완료하기 때문이다.
    // 대신 자기 상한을 따로 둬 배치 몫을 제한한다. 완료된 뒤의 틱은 진행 표식만 읽고 곧바로 끝난다.
    // 스스로 던지지 않는다.
    await logFailure('signal history', async () => {
        const { db } = getDatabaseClient();
        const outcome = await recordSignalHistory(db, {
            budgetEndMs: Math.min(
                lockAcquiredAtMs + BATCH_WALL_CLOCK_BUDGET_MS,
                Date.now() + SIGNAL_HISTORY_STEP_MAX_MS
            ),
        });
        console.log(
            '[seo-prewarm] signal history done:',
            JSON.stringify(outcome)
        );
    });
    await logFailure('batch', async () => {
        const counts = await runPrewarmBatch(undefined, lockAcquiredAtMs);
        console.log('[seo-prewarm] batch done:', JSON.stringify(counts));
    });
    // 미국 마감+15분 ~ 19:45 ET 구간 밖이면 즉시 반환한다. LLM은 쓰지 않는다.
    await logFailure('options warm', async () => {
        const outcome = await warmOptionsLastGood(new Date(), {
            budgetEndMs: lockAcquiredAtMs + BATCH_WALL_CLOCK_BUDGET_MS,
        });
        console.log(
            '[seo-prewarm] options warm done:',
            JSON.stringify(outcome)
        );
    });
    // 정리는 배치 뒤에 둬 정리 실패가 배치 결과에 영향을 주지 못하고, 락 해제를 늦추는 것도
    // 정리 쿼리(이력 정리·만료 정리) 몫만큼으로 제한된다.
    // `pruneAnalysisHistory`·`pruneExpiredRows`는 스스로 던지지 않지만, DB 클라이언트 조회·저장소 생성의
    // 예외까지 여기서 막는다.
    await logFailure('prune', async () => {
        const { db } = getDatabaseClient();
        const pruneCounts = await new DrizzleAnalysisHistoryRepository(
            db
        ).pruneAnalysisHistory();
        console.log('[seo-prewarm] prune done:', JSON.stringify(pruneCounts));
        const expiryCounts = await pruneExpiredRows(db);
        console.log(
            '[seo-prewarm] expiry prune done:',
            JSON.stringify(expiryCounts)
        );
    });
    await releaseLockSafely(lockToken);
}

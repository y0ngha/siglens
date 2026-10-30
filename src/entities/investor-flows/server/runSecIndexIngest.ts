import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR } from '../lib/investorFlowsPolicy';
import { deriveFilingsStatus } from '../lib/investorFlowsReadiness';
import type { Ingest13fResult, Ingest13fStop } from './ingest13fTypes';
import type {
    IngestSecFilingsDeps,
    IngestSecFilingsResult,
} from './ingestSecFilingsTypes';

/**
 * 공시(Form 144·증자) 백로그가 있을 때 공시 단계에 떼어 두는 실행 마감의 몫. 13F는 나머지(≈70%)까지만 쓴다 — 13F 백필(수천 건)이
 * 마감을 다 쓰면 공시 단계가 매 실행 건너뛰어져 13F 백필이 끝날 때까지(며칠) Form 144·증자가 한 건도 들어오지 않았다
 * (실데이터 리허설: 13F `deadline`, 공시 `skipped`). 공시 백필은 180일 index를 날짜마다 하나씩 읽어 3분이면 여러 실행에 걸쳐 따라잡는다.
 */
export const SEC_FILINGS_BACKLOG_BUDGET_SHARE = 0.3;
/**
 * 백로그가 없을 때도 공시 단계에 보장하는 최소 시간 — 평소 증분(겹침 3일 + 오늘 index, 문서 몇 건)은 수 초면 끝나므로 13F에서 거의
 * 빼앗지 않는다. 13F가 일찍 끝나면 공시 단계는 남은 시간을 모두 쓴다.
 */
export const SEC_FILINGS_MIN_BUDGET_MS = 60_000;

/**
 * `sec-13f` cron 한 실행 — **13F 먼저**, 그다음 Form 144·증자 공시. 두 단계는 같은 SEC 게이트·같은 공유 락
 * (`investor-flows:cron-lock:sec`) 아래라 차례로 돌고 SEC 합계 속도는 늘지 않는다.
 *
 * 시간 예산: 실행 마감 `deadlineMs` 중 공시 몫 `reserve`(백로그가 있으면 `SEC_FILINGS_BACKLOG_BUDGET_SHARE`, 없으면
 * `SEC_FILINGS_MIN_BUDGET_MS`)를 빼고 13F에 준다. 공시 단계의 마감은 `max(실행 마감, 공시 시작 + reserve)` — 13F가 진행 중
 * 작업·집계 flush로 자기 마감을 넘겨 끝나도 공시는 자기 몫을 받는다. 그래서 최악의 합은 `(deadlineMs − reserve) + 13F 꼬리 +
 * reserve + 공시 꼬리 = deadlineMs + 두 꼬리`로 예전(13F가 마감을 다 쓰던 때)과 같다(`app/api/cron/sec-13f/route.ts`의 CC-7 계산).
 *
 * 13F가 `sec_blocked`로 멈췄으면 공시 단계를 시작하지 않는다(그 실행의 SEC 요청을 전부 멈춘다). 유니버스 게이트
 * (`universe_incomplete`·`empty_universe`)도 두 단계가 공유한다. 13F가 마감(`deadline`)에 걸린 것은 공시 단계를 막지 않는다.
 */
export interface SecIndexIngestSteps {
    /** 실행 마감(ms) — cron의 `deadlineMs`. */
    deadlineMs: number;
    /** 단조 시계(ms). */
    now: () => number;
    /** 공시 커서가 아직 따라잡는 중인가(`hasSecFilingsBacklog`). */
    hasFilingsBacklog: () => Promise<boolean>;
    run13f: (isDeadlineReached: () => boolean) => Promise<Ingest13fResult>;
    runFilings: (
        isDeadlineReached: () => boolean
    ) => Promise<IngestSecFilingsResult>;
}

/** 공시 단계를 건너뛰게 하는 13F의 멈춤 — SEC 차단과 두 단계가 공유하는 유니버스 게이트. */
type FilingsSkipReason = Exclude<Ingest13fStop, 'complete' | 'deadline'>;

export interface SecIndexIngestResult {
    thirteenF: Ingest13fResult;
    /** 실행했으면 그 결과, 건너뛰었으면 13F가 멈춘 이유. */
    filings: IngestSecFilingsResult | { skipped: FilingsSkipReason };
}

const skipsFilings = (stop: Ingest13fStop): stop is FilingsSkipReason =>
    stop !== 'complete' && stop !== 'deadline';

export async function runSecIndexIngest(
    steps: SecIndexIngestSteps
): Promise<SecIndexIngestResult> {
    const startedAt = steps.now();
    const runDeadlineAt = startedAt + steps.deadlineMs;
    const reserveMs = (await steps.hasFilingsBacklog())
        ? steps.deadlineMs * SEC_FILINGS_BACKLOG_BUDGET_SHARE
        : SEC_FILINGS_MIN_BUDGET_MS;
    const thirteenFDeadlineAt = runDeadlineAt - reserveMs;
    const thirteenF = await steps.run13f(
        () => steps.now() >= thirteenFDeadlineAt
    );
    if (skipsFilings(thirteenF.stoppedBy)) {
        return { thirteenF, filings: { skipped: thirteenF.stoppedBy } };
    }
    const filingsDeadlineAt = Math.max(runDeadlineAt, steps.now() + reserveMs);
    return {
        thirteenF,
        filings: await steps.runFilings(() => steps.now() >= filingsDeadlineAt),
    };
}

/**
 * 공시 커서가 준비 기준(`deriveFilingsStatus`)에 못 미치는가 — 첫 백필 중이거나 오래 멈췄다 돌아온 경우. 상태를 읽지 못하면 백로그가
 * 있다고 본다(공시 몫을 떼어 두는 쪽이 안전하다 — 틀려도 13F가 그 실행에서 30%를 덜 쓸 뿐이다).
 */
export async function hasSecFilingsBacklog(
    deps: Pick<IngestSecFilingsDeps, 'now' | 'log'> & {
        repo: Pick<IngestSecFilingsDeps['repo'], 'getState'>;
    }
): Promise<boolean> {
    try {
        const cursor = await deps.repo.getState(
            INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR
        );
        return (
            deriveFilingsStatus(cursor, toUtcIsoDate(deps.now())) ===
            'collecting'
        );
    } catch (error) {
        deps.log(
            '[sec-13f] could not read the filings cursor — reserving the backlog budget for the filings step:',
            error instanceof Error ? error.message : String(error)
        );
        return true;
    }
}

/**
 * 한 실행 안에서 daily index를 두 단계(13F·공시)가 함께 쓰도록 **최근 날짜만** 기억하는 래퍼. 평소(두 커서가 오늘 근처)에는
 * 공시 단계가 13F가 이미 받은 index를 다시 받지 않는다. 백필 중의 옛 날짜는 기억하지 않는다(index 하나 ≈0.7MB, 200일이면
 * 140MB라 메모리에 쌓지 않는다 — 그 날짜는 공시 단계가 따로 받는다). `null`(없는 날)도 기억한다.
 */
export function rememberRecentIndexes(
    fetchDailyFormIndex: (date: string) => Promise<string | null>,
    rememberFrom: string
): (date: string) => Promise<string | null> {
    const remembered = new Map<string, string | null>();
    return async date => {
        if (date < rememberFrom) return fetchDailyFormIndex(date);
        if (remembered.has(date)) return remembered.get(date) ?? null;
        const text = await fetchDailyFormIndex(date);
        remembered.set(date, text);
        return text;
    };
}

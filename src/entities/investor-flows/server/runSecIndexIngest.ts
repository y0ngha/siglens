import type { Ingest13fResult, Ingest13fStop } from './ingest13f';
import type { IngestSecFilingsResult } from './ingestSecFilings';

/**
 * `sec-13f` cron 한 실행 — **13F 먼저**, 13F가 마감·차단 없이 끝났을 때만 남은 시간으로 Form 144·증자 공시. 두 단계는 같은
 * SEC 게이트·같은 공유 락(`investor-flows:cron-lock:sec`)·같은 마감(`isDeadlineReached`) 아래다. 13F가 `deadline`·`sec_blocked`로
 * 멈췄으면 두 번째 단계를 시작하지 않는다 — 차단이면 그 실행의 SEC 요청을 전부 멈추는 것이고, 마감이면 남은 시간이 없다.
 * 유니버스 게이트(`universe_incomplete`·`empty_universe`)도 두 단계가 공유한다.
 */
export interface SecIndexIngestSteps {
    run13f: () => Promise<Ingest13fResult>;
    runFilings: () => Promise<IngestSecFilingsResult>;
}

export interface SecIndexIngestResult {
    thirteenF: Ingest13fResult;
    /** 실행했으면 그 결과, 건너뛰었으면 13F가 멈춘 이유. */
    filings:
        | IngestSecFilingsResult
        | { skipped: Exclude<Ingest13fStop, 'complete'> };
}

export async function runSecIndexIngest(
    steps: SecIndexIngestSteps
): Promise<SecIndexIngestResult> {
    const thirteenF = await steps.run13f();
    if (thirteenF.stoppedBy !== 'complete') {
        return { thirteenF, filings: { skipped: thirteenF.stoppedBy } };
    }
    return { thirteenF, filings: await steps.runFilings() };
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

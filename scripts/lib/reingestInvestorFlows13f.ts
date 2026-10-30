import {
    INVESTOR_FLOWS_13F_BACKFILL_DAYS,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
} from '../../src/entities/investor-flows/lib/investorFlowsPolicy';
import {
    addDays,
    eachDate,
    isWeekend,
} from '../../src/entities/investor-flows/lib/investorFlowsDates';

/**
 * 늦게 매핑된 CUSIP을 위한 13F **재수집 준비**의 순수 흐름. DB·CLI는 `scripts/reingest-investor-flows-13f.ts`가 주입한다.
 *
 * 왜 필요한가: sec-13f는 제출을 "그 시점의 유니버스(`cusip_symbol_map`)"로 걸러 포지션을 저장하고 accession을 "처리됨"으로
 * 표시한다. cusip-map이 **전수 한 바퀴를 끝낸 뒤**에 생긴 매핑(신규 상장·CUSIP 변경·한 바퀴에서 못 얻어 나중에 풀린 종목)은
 * 이미 처리된 제출에 들어 있던 그 CUSIP의 행을 영영 못 얻는다 — 이를 baseline 규칙(`aggregateSql.ts`)이 NULL로 가려 주지만,
 * 그 종목의 기관 보유를 채우려면 보존 분기의 제출을 새 유니버스로 다시 읽어야 한다.
 *
 * 무엇을 하는가: 일일 커서 창(`INVESTOR_FLOWS_13F_BACKFILL_DAYS`, 200일) 안의 원장(`sec_13f_filings`) 행을 **지운다**. 커서는
 * `max(filing_date)`이라 원장 행이 사라지면 sec-13f가 창 시작일부터 다시 훑고(최초 백필과 똑같이), 지워진 accession은
 * 처리 전이라 다시 내려받아 반영한다. 이 스크립트는 포지션·집계를 직접 지우지 않으며, 재수집은 **덮어쓰기가 아니라 병합**으로
 * 반영된다: 원장이 비었는데 그 (cik, 분기)의 포지션이 이미 있으면(`hasPositions`) 원본 13F-HR을 `replace`가 아니라 `merge`로
 * 반영한다(`ingest13fFiling.ts`). 그래서 같은 값의 행은 그대로이고(`IS DISTINCT FROM` 가드) 새 CUSIP의 행만 추가·dirty 표시되며, 이미
 * 병합돼 있던 NEW HOLDINGS 정정 행도 지워지지 않는다 — 재수집이 도는 며칠 동안 보유 기관·수량이 줄어드는 구간이 없다.
 * 재수집된 제출의 `universe_stamp`는 새 유니버스 시각으로 갱신된다.
 * 남는 한계: **RESTATEMENT** 필러는 정의상 교체라, 교체본을 다시 읽는 순간 그 뒤에 병합됐던 정정 행이 정정을 다시 읽을 때까지
 * (같은 재수집 안) 빠진다. 반대로 원본이 먼저 재반영되면(병합) 그 RESTATEMENT가 이미 버린 옛 원본 행이 교체본을 다시 읽을 때까지
 * 잠시 더해져 있다. 둘 다 RESTATEMENT를 낸 소수 필러에 한정되고 같은 재수집이 끝나면 풀린다.
 * 재수집이 진행되는 동안 분기 필러 수가 임계(1,000) 아래로 내려가면 분기 모드가 기준 없음으로 잠시 바뀌는데(변화 열은
 * 건드리지 않는다), `reconcilePeriodModes`가 모드가 돌아올 때 그 분기를 전부 다시 계산한다.
 *
 * 비용(추정): 제출 1건 = SEC 3요청, 창의 평일마다 daily index 1요청. 실행당 ≈ 940건(10분 마감 × ≈1.5건/초), 2시간마다 한 번 →
 * 최초 백필과 같은 규모(≈ 1.75만 건 ≈ 19회 ≈ 1.5~3일). **모든 제출을 다시 읽어야 한다** — information table은 발행사 전체를
 * 담고 있어 "새 CUSIP이 들어 있을 제출"을 파싱 없이 가려낼 수 없다. 오래된 필러(창 밖에서 제출된 정정 등)는 지워지지 않아
 * 다시 읽히지 않는다(창이 최초 백필과 같기 때문).
 */

/** 제출 1건당 SEC 요청 수(index.json + primary_doc + information table). */
export const SEC_REQUESTS_PER_FILING = 3;
/** sec-13f 한 실행이 처리하는 제출 수(마감 10분 × ≈1.5건/초, CRON.md "속도·메모리 예산"). */
export const FILINGS_PER_RUN = 940;
/** sec-13f 실행 간격(시간, 스케줄 `cron(15 0/2 * * ? *)`). */
export const RUN_INTERVAL_HOURS = 2;

export interface LedgerWindowStats {
    rows: number;
    processed: number;
    /** 처리 전(재시도 대기·영구 실패) 행. */
    unprocessed: number;
}

export interface ReingestDeps {
    /** 영구 상태 값(`investor_flows_state`). */
    getState(key: string): Promise<string | null>;
    /** `filing_date >= sinceDate`인 원장 행의 규모. */
    countLedgerSince(sinceDate: string): Promise<LedgerWindowStats>;
    /** `filing_date >= sinceDate`인 원장 행을 지운다. 지운 행 수. */
    deleteLedgerSince(sinceDate: string): Promise<number>;
    log: (message: string) => void;
}

export interface ReingestOptions {
    today: string;
    dryRun: boolean;
}

export interface ReingestResult {
    sinceDate: string;
    ledger: LedgerWindowStats;
    /** 창 안의 평일 수(daily index 요청 수). */
    indexRequests: number;
    estimatedSecRequests: number;
    estimatedRuns: number;
    estimatedHours: number;
    deleted: number;
    dryRun: boolean;
}

export async function prepareReingest(
    deps: ReingestDeps,
    options: ReingestOptions
): Promise<ReingestResult> {
    // 게이트가 서기 전에는 sec-13f가 아무것도 읽지 않는다 — 지워도 소용이 없고, 유니버스가 덜 찬 채로 시작하는 것이 이 스크립트가
    // 고치려는 문제 자체다.
    if (
        (await deps.getState(INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE)) === null
    ) {
        throw new Error(
            'cusip-map has not finished a full pass yet (investor_flows_state marker missing) — nothing to re-ingest; run cusip-map first'
        );
    }
    const sinceDate = addDays(options.today, -INVESTOR_FLOWS_13F_BACKFILL_DAYS);
    const ledger = await deps.countLedgerSince(sinceDate);
    const indexRequests = eachDate(sinceDate, options.today).filter(
        date => !isWeekend(date)
    ).length;
    const estimatedRuns = Math.ceil(ledger.rows / FILINGS_PER_RUN);
    const result: ReingestResult = {
        sinceDate,
        ledger,
        indexRequests,
        estimatedSecRequests:
            ledger.rows * SEC_REQUESTS_PER_FILING + indexRequests,
        estimatedRuns,
        estimatedHours: estimatedRuns * RUN_INTERVAL_HOURS,
        deleted: 0,
        dryRun: options.dryRun,
    };
    deps.log(
        `${options.dryRun ? '[dry-run] ' : ''}ledger rows since ${sinceDate}: ${ledger.rows} (${ledger.processed} processed, ${ledger.unprocessed} unprocessed); ` +
            `re-reading them costs ≈ ${result.estimatedSecRequests} SEC requests ≈ ${estimatedRuns} sec-13f runs ≈ ${result.estimatedHours} h at one run per ${RUN_INTERVAL_HOURS} h`
    );
    if (options.dryRun) return result;
    result.deleted = await deps.deleteLedgerSince(sinceDate);
    deps.log(
        `deleted ${result.deleted} ledger rows — the next sec-13f run restarts from ${sinceDate}`
    );
    return result;
}

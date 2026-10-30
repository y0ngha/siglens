import type { InvestorFlowsUniverse } from '../api/investorFlowsUniverseRepository';
import type { AmendmentFiling } from '../lib/amendmentPlan';
import type { FilingRecord, Sec13fIndexEntry } from '../model';
import type { ApplyFilingInput } from '../api/apply13fFiling';
import type {
    DirtyBatch,
    FilingFailureInput,
    PendingFiling,
} from '../api/investorFlows13fRepository';
import type { AggregateMode } from '../api/aggregateSql';

/** 13F 수집이 SEC에서 읽는 네 가지 — daily form index, 제출 index.json, 문서 본문(텍스트·스트림). */
export interface Sec13fSource {
    fetchDailyFormIndex(date: string): Promise<string | null>;
    fetchFilingIndexJson(
        cik: string,
        accession: string
    ): Promise<unknown | null>;
    fetchFilingDocumentText(
        cik: string,
        accession: string,
        fileName: string
    ): Promise<string | null>;
    fetchFilingDocumentStream(
        cik: string,
        accession: string,
        fileName: string
    ): Promise<AsyncIterable<Uint8Array> | null>;
}

/** 13F 수집이 쓰는 DB 연산 — 실제 구현은 `Drizzle13fRepository` + 유니버스·상태 저장소를 `createDeps`가 묶는다. */
export interface Ingest13fRepository {
    findFilings(
        accessions: readonly string[]
    ): Promise<Map<string, FilingRecord>>;
    latestFilingDate(): Promise<string | null>;
    listPendingRetries(
        maxAttempts: number,
        limit: number
    ): Promise<PendingFiling[]>;
    countExhaustedFailures(maxAttempts: number): Promise<number>;
    recordFailure(filing: FilingFailureInput, error: string): Promise<void>;
    findProcessedFilings(
        cik: string,
        period: string
    ): Promise<AmendmentFiling[]>;
    countProcessedFilersForPeriod(period: string): Promise<number>;
    hasPositions(cik: string, period: string): Promise<boolean>;
    applyFiling(input: ApplyFilingInput): Promise<string[]>;
    takeDirty(limit: number): Promise<DirtyBatch | null>;
    clearDirty(period: string, ids: readonly number[]): Promise<void>;
    markPeriodDirty(period: string): Promise<number>;
    recomputeAggregates(
        period: string,
        cusips: readonly string[],
        mode: AggregateMode
    ): Promise<void>;
    prunePositionsBefore(
        floor: string,
        shouldStop: () => boolean
    ): Promise<{ deleted: number; done: boolean }>;
    pruneAggregatesBefore(cutoffPeriod: string): Promise<number>;
    pruneFilingsBefore(cutoffDate: string): Promise<number>;
    getState(key: string): Promise<string | null>;
    setState(key: string, value: string): Promise<void>;
}

/** `run13fIngest`가 받는 의존 전체 — SEC·DB·시계·캐시 무효화가 모두 주입된다. */
export interface Ingest13fDeps {
    sec: Sec13fSource;
    repo: Ingest13fRepository;
    loadUniverse: () => Promise<InvestorFlowsUniverse>;
    /** SEC가 거절(속도 제한·차단)했는지 — 배치는 그 즉시 멈춘다. */
    isSecBlockedError: (error: unknown) => boolean;
    now: () => Date;
    /** true면 새 일을 시작하지 않는다(진행 중 제출은 끝낸다). */
    isDeadlineReached: () => boolean;
    /** 집계가 바뀐 심볼의 캐시 태그 무효화(실행당 상한 `INVESTOR_FLOWS_REVALIDATE_CAP`). */
    invalidateSymbols: (symbols: readonly string[]) => void | Promise<void>;
    /**
     * 초기 백필 완료 표식이 **이번 실행에서 처음** 섰을 때 한 번 부른다 — 수급 탭의 "13F 수집 중" 안내를 담은 준비 상태
     * 캐시를 무효화한다. 생략하면 캐시 TTL(12시간)이 지나서야 안내가 사라진다.
     */
    onBackfillCompleted?: () => void | Promise<void>;
    log: (message: string, detail?: unknown) => void;
}

/** 실행이 멈춘 이유. */
export type Ingest13fStop =
    | 'complete'
    | 'deadline'
    | 'sec_blocked'
    | 'empty_universe'
    /** cusip-map이 아직 전수 한 바퀴를 끝내지 않았다 — 덜 찬 유니버스로 제출을 "처리됨" 처리하지 않는다. */
    | 'universe_incomplete';

/** 한 실행의 집계 — cron 응답과 로그가 그대로 싣는다. */
export interface Ingest13fResult {
    stoppedBy: Ingest13fStop;
    startDate: string;
    datesScanned: number;
    filingsListed: number;
    filingsProcessed: number;
    filingsAlreadyDone: number;
    filingsFailed: number;
    retried: number;
    aggregateChunks: number;
    invalidated: number;
    pruned: { positions: number; aggregates: number; filings: number };
    /** 초기 백필 완료 표식(`INVESTOR_FLOWS_STATE_BACKFILL_DONE`)이 이번 실행에서 처음 섰는가. */
    backfillCompleted: boolean;
}

/** 처리할 제출 하나 — daily index 항목 또는 재시도 대상. */
export type FilingTarget = Pick<
    Sec13fIndexEntry,
    'accession' | 'cik' | 'filingDate'
> & {
    formType: string;
    /** daily index의 회사명 — primary_doc에 이름이 없을 때의 대체. 재시도 대상에는 없다. */
    companyName: string | null;
};

/** 제출 처리 루프가 멈춘 이유(`error`는 실패 기록 자체가 실패해 던진 경우). */
export type RunStop = 'deadline' | 'sec_blocked' | 'error';

/** 실행 하나의 가변 진행 상태 — 제출 처리·집계 flush가 제자리에서 갱신한다. */
export interface RunState {
    result: Ingest13fResult;
    attempted: Set<string>;
    /** 집계가 바뀐 심볼(무효화 대상). */
    symbols: Set<string>;
    stop: RunStop | null;
}

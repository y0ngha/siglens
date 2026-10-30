import type {
    FilingFailureTarget,
    FilingsPruneCutoffs,
    FilingsPruneResult,
} from '../api/investorFlowsFilingsRepository';
import type { FilingRetry, Form144Row, OfferingFilingRow } from '../model';

/** Form 144·증자 공시 수집이 SEC에서 읽는 것 — daily form index와 제출 문서(전체 또는 머리 일부). */
export interface SecFilingsSource {
    fetchDailyFormIndex(date: string): Promise<string | null>;
    fetchFilingDocumentText(
        cik: string,
        accession: string,
        fileName: string
    ): Promise<string | null>;
    fetchFilingDocumentHead(
        cik: string,
        accession: string,
        fileName: string
    ): Promise<string | null>;
}

/** Form 144·증자 공시 수집이 쓰는 DB 연산. */
export interface IngestSecFilingsRepository {
    getState(key: string): Promise<string | null>;
    setState(key: string, value: string): Promise<void>;
    loadCikSymbols(): Promise<Map<number, string[]>>;
    findStoredForm144(accessions: readonly string[]): Promise<Set<string>>;
    findStoredOfferings(accessions: readonly string[]): Promise<Set<string>>;
    findFailureAttempts(
        accessions: readonly string[]
    ): Promise<Map<string, number>>;
    upsertForm144(rows: readonly Form144Row[]): Promise<void>;
    upsertOfferings(rows: readonly OfferingFilingRow[]): Promise<void>;
    recordFailure(target: FilingFailureTarget, error: string): Promise<void>;
    recordSkipped(
        target: FilingFailureTarget,
        reason: string,
        maxAttempts: number
    ): Promise<void>;
    listRetries(maxAttempts: number, limit: number): Promise<FilingRetry[]>;
    countExhaustedFailures(maxAttempts: number): Promise<number>;
    pruneBefore(cutoffs: FilingsPruneCutoffs): Promise<FilingsPruneResult>;
}

/** `runSecFilingsIngest`가 받는 의존 전체 — SEC·DB·시계·캐시 무효화가 모두 주입된다. */
export interface IngestSecFilingsDeps {
    sec: SecFilingsSource;
    repo: IngestSecFilingsRepository;
    /** SEC가 거절(속도 제한·차단)했는지 — 그 즉시 이 실행의 SEC 요청을 전부 멈춘다. */
    isSecBlockedError: (error: unknown) => boolean;
    now: () => Date;
    /** true면 새 날짜·새 문서를 시작하지 않는다(진행 중 문서는 끝낸다). */
    isDeadlineReached: () => boolean;
    /** 새 공시가 저장된 심볼의 캐시 태그 무효화(실행당 상한 `INVESTOR_FLOWS_REVALIDATE_CAP`). */
    invalidateSymbols: (symbols: readonly string[]) => void | Promise<void>;
    /**
     * 공시 커서가 이번 실행에서 "따라잡음"(오늘에서 `INVESTOR_FLOWS_SEC_FILINGS_READY_LAG_DAYS`일 안, `deriveFilingsStatus`)으로
     * **넘어갔을 때** 한 번 부른다 — 수급 탭의 Form 144·증자 공시 "수집 중" 안내를 담은 준비 상태 캐시를 무효화한다(`runFinraIngest`의
     * `onFirstDataStored`와 같은 역할). 실행 전에 이미 따라잡은 상태였으면 부르지 않는다.
     */
    onCaughtUp?: () => void | Promise<void>;
    log: (message: string, detail?: unknown) => void;
}

/** 실행이 멈춘 이유. */
export type IngestSecFilingsStop =
    | 'complete'
    | 'deadline'
    | 'sec_blocked'
    | 'universe_incomplete'
    /** `sec_cik_symbol_map`이 비었다 — cusip-map cron이 `company_tickers.json`을 아직 받지 않았다. 커서를 움직이지 않는다. */
    | 'cik_map_empty';

/** 한 실행의 집계 — cron 응답과 로그가 그대로 싣는다. */
export interface IngestSecFilingsResult {
    stoppedBy: IngestSecFilingsStop;
    startDate: string;
    datesScanned: number;
    /** 이번 실행이 끝까지 처리한 마지막 날짜(커서). */
    cursor: string | null;
    form144Stored: number;
    offeringsStored: number;
    documentsFetched: number;
    documentsFailed: number;
    /** 읽었지만 일부러 저장하지 않아 음성 표식을 남긴 문서(유니버스 밖 발행사의 Form 144). */
    documentsSkipped: number;
    retried: number;
    invalidated: number;
    pruned: FilingsPruneResult;
    /** 이번 실행으로 커서가 처음 "따라잡음"이 됐는가(= 준비 상태 `collecting` → `ready`). */
    caughtUp: boolean;
}

/** 실행 하나의 가변 진행 상태 — 문서 처리·저장이 제자리에서 갱신한다. */
export interface RunState {
    result: IngestSecFilingsResult;
    symbols: Set<string>;
    attempted: Set<string>;
}

import type { DartClient, DartFatalReason } from '@/shared/api/dart/dartClient';
import type { KrDartUniverse } from '../lib/dartSymbol';
import type {
    DartInsiderReportRow,
    DartMajorHoldingRow,
    DartTradingPlanRow,
} from '../model';

/** `runDartFilingsIngest`가 받는 의존 전체 — DART·DB·시계·캐시 무효화가 모두 주입된다. */
export interface IngestDartFilingsDeps {
    dart: Pick<
        DartClient,
        | 'isEnabled'
        | 'fetchDisclosureList'
        | 'fetchMajorStock'
        | 'fetchExecutiveStock'
    >;
    repo: {
        getState(key: string): Promise<string | null>;
        setState(key: string, value: string): Promise<void>;
        setStateIfAbsent(key: string, value: string): Promise<void>;
        listKrSymbols(): Promise<string[]>;
        loadCorpCodeMap(): Promise<Map<string, string>>;
        upsertMajorHoldings(
            rows: readonly DartMajorHoldingRow[]
        ): Promise<void>;
        upsertInsiderReports(
            rows: readonly DartInsiderReportRow[]
        ): Promise<void>;
        upsertTradingPlans(rows: readonly DartTradingPlanRow[]): Promise<void>;
        pruneBefore(cutoffDate: string): Promise<number>;
    };
    /** 그 실행의 DART 요청을 멈출 오류의 이유(`dartFatalReason`), 아니면 null. */
    fatalReason: (error: unknown) => DartFatalReason | null;
    now: () => Date;
    isDeadlineReached: () => boolean;
    invalidateSymbols: (symbols: readonly string[]) => void | Promise<void>;
    /**
     * 최초 백필 완료 표식(`dart_backfill_done`)을 **처음** 기록한 실행이 한 번 부른다 — 한국 수급 탭의 "지분공시 수집 중" 안내를 담은
     * 준비 상태 캐시를 무효화한다(`sec-13f`의 `onBackfillCompleted`와 같은 역할). 이후 실행은 부르지 않는다.
     */
    onBackfillCompleted?: () => void | Promise<void>;
    log: (message: string, detail?: unknown) => void;
}

/** 실행이 끝난 이유 — 정상 완료이거나 중단·비활성 사유. */
export type IngestDartFilingsStatus =
    | 'disabled'
    | 'corp_codes_missing'
    | 'empty_universe'
    | 'complete'
    | 'deadline'
    /** 실행당 호출 상한(`INVESTOR_FLOWS_DART_MAX_CALLS_PER_RUN`)에 닿았다 — 남은 일은 다음 실행이 잇는다. */
    | 'call_cap'
    | Exclude<DartFatalReason, 'disabled'>;

/** 한 실행의 집계 — cron 응답과 로그가 그대로 싣는다. */
export interface IngestDartFilingsResult {
    status: IngestDartFilingsStatus;
    /** 이번 실행의 DART 호출 수(목록 페이지 + 회사별). */
    calls: number;
    listPages: number;
    /**
     * 공시검색 창을 세 유형 모두 끝까지 읽었는가. 거래계획보고서(D005)가 페이지 상한에 걸리면 거짓이다 — 그때 D005는 읽은
     * 마지막 접수일(`tradingPlansFrom`)부터 다음 실행이 잇는다.
     */
    listComplete: boolean;
    /** 새 D001·D002 공시가 있던 유니버스 회사 수. */
    changedCorps: number;
    tradingPlansStored: number;
    /** 대기열(새 공시)에서 다시 받은 회사 수. */
    corpsRefetched: number;
    /** 최초 백필로 받은 회사 수. */
    backfillCorps: number;
    /** 최초 백필이 아직 받지 않은 유니버스 회사 수(끝났으면 0). */
    backfillRemaining: number;
    backfillDone: boolean;
    /** 실행 끝에 대기열에 남은 회사 수. */
    pendingRemaining: number;
    /** 일시 오류로 실패한 회사 수(대기열에 다시 줄 선다). */
    failedCorps: number;
    /** 시도 횟수를 소진해 대기열에서 뺀 회사 수. */
    droppedCorps: number;
    majorRowsStored: number;
    insiderRowsStored: number;
    /** 형식이 맞지 않아 버린 응답 행 수. */
    skippedRows: number;
    /** 요청한 상세 유형의 보고서가 아니어서 버린 공시검색 행 수(`disclosureMatchesDetailType`). 0이 아니면 필터가 무시되고 있다. */
    mismatchedRows: number;
    /** 고유번호를 찾지 못한 한국 심볼 수(ETF·ETN 등). */
    unmappedSymbols: number;
    invalidated: number;
    pruned: number;
}

/** 실행을 멈춘 이유 — 데드라인·호출 상한·DART 거절. */
export type StopReason =
    | 'deadline'
    | 'call_cap'
    | Exclude<DartFatalReason, 'disabled'>;

/** 실행 하나의 가변 상태(오케스트레이션 — 순수 계산이 아니라 진행 기록이라 제자리에서 갱신한다). */
export interface RunContext {
    readonly deps: IngestDartFilingsDeps;
    readonly universe: KrDartUniverse;
    readonly universeCorps: ReadonlySet<string>;
    readonly today: string;
    readonly retentionFloor: string;
    calls: number;
    stop: StopReason | null;
    readonly result: IngestDartFilingsResult;
}

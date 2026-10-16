import type {
    DartClient,
    DartDisclosureDetailType,
    DartFatalReason,
    DartListPage,
} from '@/shared/api/dart/dartClient';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import {
    mergePending,
    parseDartBackfillCursor,
    parseDartListCursor,
    serializeDartBackfillCursor,
    serializeDartListCursor,
    type DartPendingCorp,
} from '../lib/dartIngestState';
import {
    parseDisclosureListRows,
    parseExecutiveStockRows,
    parseMajorStockRows,
    toTradingPlanRow,
} from '../lib/dartParsers';
import { buildKrDartUniverse, type KrDartUniverse } from '../lib/dartSymbol';
import { addDays } from '../lib/investorFlowsDates';
import {
    INVESTOR_FLOWS_DART_LIST_INITIAL_LOOKBACK_DAYS,
    INVESTOR_FLOWS_DART_LIST_MAX_LOOKBACK_DAYS,
    INVESTOR_FLOWS_DART_MAX_ATTEMPTS,
    INVESTOR_FLOWS_DART_MAX_CALLS_PER_RUN,
    INVESTOR_FLOWS_DART_MAX_LIST_PAGES,
    INVESTOR_FLOWS_DART_RETENTION_DAYS,
    INVESTOR_FLOWS_DART_STATE_FLUSH_EVERY,
    INVESTOR_FLOWS_REVALIDATE_CAP,
    INVESTOR_FLOWS_STATE_DART_BACKFILL_CURSOR,
    INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE,
    INVESTOR_FLOWS_STATE_DART_LIST_CURSOR,
} from '../lib/investorFlowsPolicy';
import type {
    DartDisclosureListRow,
    DartInsiderReportRow,
    DartMajorHoldingRow,
    DartTradingPlanRow,
} from '../model';

/** 회사 하나를 다시 받는 데 드는 DART 호출 수(`majorstock` + `elestock`). */
const CALLS_PER_CORP = 2;

/** 대량보유(D001)·소유보고(D002) — 새 공시가 있으면 그 회사의 두 보고를 다시 받는다. */
const REFETCH_TRIGGER_TYPES: readonly DartDisclosureDetailType[] = [
    'D001',
    'D002',
];
/** 거래계획보고서(D005) — 목록 행 자체를 저장한다. */
const TRADING_PLAN_TYPE: DartDisclosureDetailType = 'D005';

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
    log: (message: string, detail?: unknown) => void;
}

export type IngestDartFilingsStatus =
    | 'disabled'
    | 'corp_codes_missing'
    | 'empty_universe'
    | 'complete'
    | 'deadline'
    /** 실행당 호출 상한(`INVESTOR_FLOWS_DART_MAX_CALLS_PER_RUN`)에 닿았다 — 남은 일은 다음 실행이 잇는다. */
    | 'call_cap'
    | Exclude<DartFatalReason, 'disabled'>;

export interface IngestDartFilingsResult {
    status: IngestDartFilingsStatus;
    /** 이번 실행의 DART 호출 수(목록 페이지 + 회사별). */
    calls: number;
    listPages: number;
    /** 공시검색 창을 끝까지 읽어 커서를 오늘로 옮겼는가. */
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
    /** 고유번호를 찾지 못한 한국 심볼 수(ETF·ETN 등). */
    unmappedSymbols: number;
    invalidated: number;
    pruned: number;
}

const emptyResult = (
    status: IngestDartFilingsStatus
): IngestDartFilingsResult => ({
    status,
    calls: 0,
    listPages: 0,
    listComplete: false,
    changedCorps: 0,
    tradingPlansStored: 0,
    corpsRefetched: 0,
    backfillCorps: 0,
    backfillRemaining: 0,
    backfillDone: false,
    pendingRemaining: 0,
    failedCorps: 0,
    droppedCorps: 0,
    majorRowsStored: 0,
    insiderRowsStored: 0,
    skippedRows: 0,
    unmappedSymbols: 0,
    invalidated: 0,
    pruned: 0,
});

/** 실행을 멈춘 이유 — 데드라인·호출 상한·DART 거절. */
type StopReason =
    | 'deadline'
    | 'call_cap'
    | Exclude<DartFatalReason, 'disabled'>;

/** 실행 하나의 가변 상태(오케스트레이션 — 순수 계산이 아니라 진행 기록이라 제자리에서 갱신한다). */
interface RunContext {
    readonly deps: IngestDartFilingsDeps;
    readonly universe: KrDartUniverse;
    readonly universeCorps: ReadonlySet<string>;
    readonly today: string;
    readonly retentionFloor: string;
    calls: number;
    stop: StopReason | null;
    readonly result: IngestDartFilingsResult;
}

/** 호출 `count`건을 시작해도 되는가 — 아니면 멈춘 이유를 기록한다. */
function canCall(ctx: RunContext, count: number): boolean {
    if (ctx.stop !== null) return false;
    if (ctx.deps.isDeadlineReached()) {
        ctx.stop = 'deadline';
        return false;
    }
    if (ctx.calls + count > INVESTOR_FLOWS_DART_MAX_CALLS_PER_RUN) {
        ctx.stop = 'call_cap';
        return false;
    }
    return true;
}

/** DART 거절(할당량·IP·키·점검)이면 실행을 멈추고 true. 그 밖의 오류는 false(호출부가 그 요청만 실패로 센다). */
function stopOnFatal(ctx: RunContext, error: unknown): boolean {
    const reason = ctx.deps.fatalReason(error);
    if (reason === null) return false;
    // `disabled`는 실행 시작에서 걸러지므로 여기 오지 않지만, 오면 키 문제와 같이 다룬다.
    ctx.stop = reason === 'disabled' ? 'auth_failed' : reason;
    ctx.deps.log(
        `[dart-filings] ${ctx.stop} — DART refused the request, stopping`
    );
    return true;
}

const errorMessage = (error: unknown): string =>
    (error instanceof Error ? error.message : String(error)).slice(0, 300);

interface ScanOutcome {
    complete: boolean;
    changedCorps: Set<string>;
    plans: DartTradingPlanRow[];
}

/** 상세 유형 하나의 검색 시작일 — 커서가 없으면 유형별 첫 창, 있으면 그날부터(3개월 검색 한도로 자른다). */
function scanStart(
    through: string | null,
    detailType: DartDisclosureDetailType,
    today: string
): string {
    const floor = addDays(today, -INVESTOR_FLOWS_DART_LIST_MAX_LOOKBACK_DAYS);
    const initial =
        detailType === TRADING_PLAN_TYPE
            ? floor
            : addDays(today, -INVESTOR_FLOWS_DART_LIST_INITIAL_LOOKBACK_DAYS);
    const start = through ?? initial;
    return start < floor ? floor : start;
}

/**
 * 상세 유형 하나를 `from`~오늘 끝까지 페이지로 읽는다. 끝까지 읽었으면 true. 페이지 상한
 * (`INVESTOR_FLOWS_DART_MAX_LIST_PAGES`)을 넘는 창이면 `overflow`로 알린다(호출부가 대응한다).
 */
async function scanDetailType(
    ctx: RunContext,
    detailType: DartDisclosureDetailType,
    from: string,
    onRows: (rows: readonly DartDisclosureListRow[]) => void
): Promise<'complete' | 'overflow' | 'stopped'> {
    let pageNo = 1;
    for (;;) {
        if (!canCall(ctx, 1)) return 'stopped';
        ctx.calls += 1;
        let page: DartListPage;
        try {
            // 페이지는 차례로 — 다음 페이지 번호가 앞 페이지의 `total_page`에 달려 있다.
            page = await ctx.deps.dart.fetchDisclosureList({
                beginDate: from,
                endDate: ctx.today,
                detailType,
                pageNo,
            });
        } catch (error) {
            if (!stopOnFatal(ctx, error)) {
                ctx.deps.log(
                    `[dart-filings] list ${detailType} page ${pageNo} failed:`,
                    errorMessage(error)
                );
            }
            return 'stopped';
        }
        ctx.result.listPages += 1;
        const parsed = parseDisclosureListRows(page.rows);
        ctx.result.skippedRows += parsed.skipped;
        onRows(parsed.rows.filter(row => ctx.universeCorps.has(row.corpCode)));
        if (pageNo >= page.totalPage) return 'complete';
        if (pageNo >= INVESTOR_FLOWS_DART_MAX_LIST_PAGES) return 'overflow';
        pageNo += 1;
    }
}

/**
 * 공시검색으로 커서~오늘의 D001·D002(재조회할 회사)와 D005(거래계획보고서 행)를 모은다. 하나라도 끝까지 못 읽으면
 * `complete: false` — 커서를 옮기지 않아 다음 실행이 같은 창을 다시 읽는다(멱등).
 *
 * D001·D002 창이 페이지 상한을 넘으면(장기 중단 뒤) 목록으로 회사를 고르는 대신 **유니버스 전체**를 대기열에 넣는다 — 그 창의
 * 변동을 모두 담는 가장 싼 방법이 회사별 전체 이력 재조회다. D005가 넘치면 상한까지의 행만 저장하고 남긴다.
 */
async function scanDisclosures(
    ctx: RunContext,
    through: string | null
): Promise<ScanOutcome> {
    const changedCorps = new Set<string>();
    const plans: DartTradingPlanRow[] = [];
    let complete = true;
    for (const detailType of [...REFETCH_TRIGGER_TYPES, TRADING_PLAN_TYPE]) {
        // 유형은 차례로 — 호출 상한·데드라인을 같은 순서로 소비한다.
        const outcome = await scanDetailType(
            ctx,
            detailType,
            scanStart(through, detailType, ctx.today),
            rows => {
                for (const row of rows) {
                    if (detailType === TRADING_PLAN_TYPE) {
                        plans.push(toTradingPlanRow(row));
                    } else {
                        changedCorps.add(row.corpCode);
                    }
                }
            }
        );
        if (outcome === 'stopped') {
            complete = false;
            break;
        }
        if (outcome === 'overflow') {
            ctx.deps.log(
                `[dart-filings] list ${detailType} exceeds ${INVESTOR_FLOWS_DART_MAX_LIST_PAGES} pages since ${scanStart(through, detailType, ctx.today)}` +
                    (detailType === TRADING_PLAN_TYPE
                        ? ' — storing the first pages only'
                        : ' — queueing the whole universe for a full refetch')
            );
            if (detailType !== TRADING_PLAN_TYPE) {
                for (const corpCode of ctx.universe.corpCodes) {
                    changedCorps.add(corpCode);
                }
            }
        }
    }
    return { complete, changedCorps, plans };
}

type RefetchOutcome =
    | { kind: 'stored'; rows: number }
    | { kind: 'failed'; message: string }
    | { kind: 'stopped' };

/** 회사 하나의 대량보유·소유보고 전체 이력을 받아 보존 창 안의 행만 upsert한다. */
async function refetchCorp(
    ctx: RunContext,
    corpCode: string
): Promise<RefetchOutcome> {
    if (!canCall(ctx, CALLS_PER_CORP)) return { kind: 'stopped' };
    let major: DartMajorHoldingRow[];
    let insider: DartInsiderReportRow[];
    try {
        ctx.calls += 1;
        const majorParsed = parseMajorStockRows(
            await ctx.deps.dart.fetchMajorStock(corpCode),
            corpCode
        );
        ctx.calls += 1;
        const insiderParsed = parseExecutiveStockRows(
            await ctx.deps.dart.fetchExecutiveStock(corpCode),
            corpCode
        );
        ctx.result.skippedRows += majorParsed.skipped + insiderParsed.skipped;
        major = majorParsed.rows.filter(
            row => row.receiptDate >= ctx.retentionFloor
        );
        insider = insiderParsed.rows.filter(
            row => row.receiptDate >= ctx.retentionFloor
        );
    } catch (error) {
        if (stopOnFatal(ctx, error)) return { kind: 'stopped' };
        return { kind: 'failed', message: errorMessage(error) };
    }
    // DB 오류는 일시 오류 재시도(`DB_TRANSIENT_RETRY`)를 지난 뒤라 실행 전체 실패로 올린다 — 회사 탓이 아니다.
    await ctx.deps.repo.upsertMajorHoldings(major);
    await ctx.deps.repo.upsertInsiderReports(insider);
    ctx.result.majorRowsStored += major.length;
    ctx.result.insiderRowsStored += insider.length;
    return { kind: 'stored', rows: major.length + insider.length };
}

/**
 * 한국 DART 지분공시 수집(`dart-filings` cron, 하루 2회 — 설계 §4.2).
 *
 * 1. **공시검색**: 커서(`dart_list_cursor.through`)~오늘(KST)의 D001 대량보유·D002 임원·주요주주 소유·D005 거래계획보고서.
 *    D001·D002가 있는 유니버스 회사는 재조회 대기열에 넣고, D005 행은 그대로 `dart_trading_plans`에 저장한다.
 * 2. **재조회**: 대기열 회사마다 `majorstock`·`elestock`(둘 다 날짜 필터 없는 전체 이력)을 받아 최근 2년 행만 upsert한다.
 * 3. **최초 백필**: 대기열을 비운 뒤 남은 호출로 유니버스 회사를 고유번호 순으로 같은 방식으로 받는다(`dart_backfill_cursor`).
 *    끝까지 닿으면 `dart_backfill_done`(set-once)을 세운다.
 *
 * 유니버스 = 티커 DB(`korean_tickers`)의 상장 한국 심볼을 `dart_corp_code`로 매핑한 회사(우선주는 보통주 회사로 모인다,
 * `dartSymbol.ts`). 실행당 호출 `INVESTOR_FLOWS_DART_MAX_CALLS_PER_RUN`건·데드라인·DART 거절(할당량 `020`은 클라이언트가
 * KST 자정까지 회로 차단)에서 멈추고, 진행은 `investor_flows_state`에 남아 다음 실행이 잇는다. 키가 없으면 HTTP·DB 없이 `disabled`.
 */
export async function runDartFilingsIngest(
    deps: IngestDartFilingsDeps
): Promise<IngestDartFilingsResult> {
    if (!deps.dart.isEnabled()) return emptyResult('disabled');
    const corpByStock = await deps.repo.loadCorpCodeMap();
    if (corpByStock.size === 0) {
        deps.log(
            '[dart-filings] corp_codes_missing — dart_corp_code is empty; run dart-corp-code first'
        );
        return emptyResult('corp_codes_missing');
    }
    const universe = buildKrDartUniverse(
        await deps.repo.listKrSymbols(),
        corpByStock
    );
    if (universe.corpCodes.length === 0) {
        deps.log(
            '[dart-filings] empty universe — no listed KR symbol maps to a DART corp code'
        );
        return emptyResult('empty_universe');
    }
    const today = kstDateKey(deps.now());
    const ctx: RunContext = {
        deps,
        universe,
        universeCorps: new Set(universe.corpCodes),
        today,
        retentionFloor: addDays(today, -INVESTOR_FLOWS_DART_RETENTION_DAYS),
        calls: 0,
        stop: null,
        result: {
            ...emptyResult('complete'),
            unmappedSymbols: universe.unmappedSymbols.length,
        },
    };
    const { result } = ctx;

    const listCursor = parseDartListCursor(
        await deps.repo.getState(INVESTOR_FLOWS_STATE_DART_LIST_CURSOR)
    );
    let backfillCursor = parseDartBackfillCursor(
        await deps.repo.getState(INVESTOR_FLOWS_STATE_DART_BACKFILL_CURSOR)
    );
    const backfillAlreadyDone =
        (await deps.repo.getState(INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE)) !==
        null;

    // ── 1) 공시검색 ──
    const scan = await scanDisclosures(ctx, listCursor.through);
    const plans = scan.plans.filter(
        row => row.receiptDate >= ctx.retentionFloor
    );
    if (plans.length > 0) await deps.repo.upsertTradingPlans(plans);
    result.tradingPlansStored = plans.length;
    result.changedCorps = scan.changedCorps.size;
    result.listComplete = scan.complete;
    const through = scan.complete ? today : listCursor.through;
    // 대기열 = 이전 대기열 + 새 공시 회사(순서 유지). 유니버스에서 빠진 회사(상장폐지 등)는 버린다.
    const pending = new Map(
        mergePending(
            listCursor.pending,
            [...scan.changedCorps].map(corpCode => ({ corpCode, attempts: 0 }))
        )
            .filter(entry => ctx.universeCorps.has(entry.corpCode))
            .map(entry => [entry.corpCode, entry] as const)
    );
    const saveState = async (): Promise<void> => {
        await deps.repo.setState(
            INVESTOR_FLOWS_STATE_DART_LIST_CURSOR,
            serializeDartListCursor({ through, pending: [...pending.values()] })
        );
        await deps.repo.setState(
            INVESTOR_FLOWS_STATE_DART_BACKFILL_CURSOR,
            serializeDartBackfillCursor(backfillCursor)
        );
    };
    await saveState();

    // ── 2) 대기열 재조회 → 3) 최초 백필 ──
    const changed = new Set<string>();
    const handled = new Set<string>();
    let sinceFlush = 0;
    const flushIfDue = async (): Promise<void> => {
        sinceFlush += 1;
        if (sinceFlush < INVESTOR_FLOWS_DART_STATE_FLUSH_EVERY) return;
        sinceFlush = 0;
        await saveState();
    };
    const retryLater = (entry: DartPendingCorp, message: string): void => {
        result.failedCorps += 1;
        const attempts = entry.attempts + 1;
        pending.delete(entry.corpCode);
        if (attempts >= INVESTOR_FLOWS_DART_MAX_ATTEMPTS) {
            result.droppedCorps += 1;
            deps.log(
                `[dart-filings] corp ${entry.corpCode} dropped after ${attempts} failed attempts:`,
                message
            );
            return;
        }
        deps.log(`[dart-filings] corp ${entry.corpCode} failed:`, message);
        // 대기열 끝으로 — 영구히 실패하는 회사가 앞자리를 차지해 뒤를 굶기지 않는다.
        pending.set(entry.corpCode, { corpCode: entry.corpCode, attempts });
    };

    // 실행 시작 시점의 대기열 사본을 돈다 — 실패한 회사는 `retryLater`가 원본의 끝으로 옮기므로 같은 실행에서 다시 받지 않는다.
    const pendingAtStart = [...pending.values()];
    for (const entry of pendingAtStart) {
        // 회사는 차례로 — DART 속도 게이트·호출 상한을 같은 순서로 소비한다.
        const outcome = await refetchCorp(ctx, entry.corpCode);
        if (outcome.kind === 'stopped') break;
        handled.add(entry.corpCode);
        if (outcome.kind === 'failed') {
            retryLater(entry, outcome.message);
        } else {
            pending.delete(entry.corpCode);
            result.corpsRefetched += 1;
            if (outcome.rows > 0) changed.add(entry.corpCode);
        }
        await flushIfDue();
    }

    const backfillTargets = backfillAlreadyDone
        ? []
        : universe.corpCodes.filter(
              corpCode =>
                  backfillCursor.afterCorpCode === null ||
                  corpCode > backfillCursor.afterCorpCode
          );
    let backfillReachedEnd = backfillTargets.length === 0;
    for (const [index, corpCode] of backfillTargets.entries()) {
        if (handled.has(corpCode) || pending.has(corpCode)) {
            // 이번 실행에 대기열로 이미 받았거나 대기열이 받을 회사 — 백필 커서만 넘긴다.
            backfillCursor = { afterCorpCode: corpCode };
        } else {
            const outcome = await refetchCorp(ctx, corpCode);
            if (outcome.kind === 'stopped') break;
            backfillCursor = { afterCorpCode: corpCode };
            if (outcome.kind === 'failed') {
                // 백필 실패는 대기열로 넘긴다(시도 1회로 센다) — 백필 커서는 앞으로만 간다.
                retryLater({ corpCode, attempts: 0 }, outcome.message);
            } else {
                result.backfillCorps += 1;
                if (outcome.rows > 0) changed.add(corpCode);
            }
            await flushIfDue();
        }
        if (index === backfillTargets.length - 1) backfillReachedEnd = true;
    }
    await saveState();
    const backfillDone = backfillAlreadyDone || backfillReachedEnd;
    if (backfillDone && !backfillAlreadyDone) {
        await deps.repo.setStateIfAbsent(
            INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE,
            today
        );
        deps.log(
            `[dart-filings] initial backfill complete (${universe.corpCodes.length} corps)`
        );
    }

    const pruned = await deps.repo.pruneBefore(ctx.retentionFloor);
    const toInvalidate = [...changed]
        .flatMap(corpCode => universe.symbolsByCorp.get(corpCode) ?? [])
        .toSorted()
        .slice(0, INVESTOR_FLOWS_REVALIDATE_CAP);
    if (toInvalidate.length > 0) await deps.invalidateSymbols(toInvalidate);

    return {
        ...result,
        status: ctx.stop ?? 'complete',
        calls: ctx.calls,
        backfillDone,
        backfillRemaining: backfillDone
            ? 0
            : universe.corpCodes.filter(
                  corpCode =>
                      backfillCursor.afterCorpCode === null ||
                      corpCode > backfillCursor.afterCorpCode
              ).length,
        pendingRemaining: pending.size,
        invalidated: toInvalidate.length,
        pruned,
    };
}

import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { addDays, eachDate, isWeekend } from '../lib/investorFlowsDates';
import {
    INVESTOR_FLOWS_REG_SHO_BACKFILL_DAYS,
    INVESTOR_FLOWS_REG_SHO_RETENTION_DAYS,
    INVESTOR_FLOWS_REVALIDATE_CAP,
    INVESTOR_FLOWS_STATE_REG_SHO_CURSOR,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
} from '../lib/investorFlowsPolicy';
import {
    parseRegShoCursor,
    serializeRegShoCursor,
    type RegShoCursor,
} from '../lib/regShoCursor';
import { parseRegShoThresholdList } from '../lib/regShoParsers';
import {
    buildSymbolAliasResolver,
    type SymbolResolver,
} from '../lib/symbolAliasResolver';
import type { RegShoThresholdRow } from '../model';

/**
 * 게시가 아직 안 됐을 수 있는 최근 날짜의 범위(일) — 이 안의 날짜가 "없음"이면 그 시장은 이번 실행에서 멈추고 다음 실행이 다시
 * 본다. 그보다 오래된 날짜가 "없음"이면 휴장일로 보고 넘어간다(그래야 커서가 휴장일에 영영 걸리지 않는다).
 * 게시 시각(2026-10-15 실측 푸터): Nasdaq 23:00·NYSE 22:02(ET, 당일 밤), Cboe 다음 날 03:05 — 05:00 UTC 실행에서 전 거래일은 모두 있다.
 */
export const REG_SHO_PUBLICATION_GRACE_DAYS = 1;

/** NYSE 계열은 미래·미게시 날짜도 헤더만 있는 200을 준다 — 푸터 날짜 검증이 필요한 시장. */
const FOOTER_DATED_MARKETS: ReadonlySet<string> = new Set([
    'nyse',
    'nyse_american',
    'nyse_arca',
]);

export interface IngestRegShoDeps {
    /** `REG_SHO_THRESHOLD_DATA_ENABLED` — 꺼지면 HTTP·DB 없이 즉시 끝난다. */
    isEnabled: () => boolean;
    markets: readonly string[];
    fetchList: (market: string, date: string) => Promise<string | null>;
    repo: {
        getState(key: string): Promise<string | null>;
        setState(key: string, value: string): Promise<void>;
        insertListings(rows: readonly RegShoThresholdRow[]): Promise<void>;
        pruneBefore(cutoffDate: string): Promise<number>;
    };
    loadUniverseSymbols: () => Promise<string[]>;
    now: () => Date;
    isDeadlineReached: () => boolean;
    invalidateSymbols: (symbols: readonly string[]) => void | Promise<void>;
    /**
     * 받은 목록이 하나도 없던 상태(`reg_sho_cursor.ingestedDates` 비어 있음)에서 **처음** 목록을 받은 실행이 한 번 부른다 — 수급 탭의
     * "과열 목록 수집 중" 안내를 담은 준비 상태 캐시를 무효화한다(`runFinraIngest`의 `onFirstDataStored`와 같은 역할).
     */
    onFirstListStored?: () => void | Promise<void>;
    log: (message: string, detail?: unknown) => void;
}

export interface IngestRegShoResult {
    status:
        | 'disabled'
        | 'universe_incomplete'
        | 'empty_universe'
        | 'ok'
        | 'deadline';
    /** 받은 목록 수(시장·거래일). */
    listsFetched: number;
    /** 휴장일로 보고 넘긴 (시장, 날짜) 수. */
    holidaysSkipped: number;
    rowsStored: number;
    /** 거래소 오류로 이번 실행에서 멈춘 시장. */
    failedMarkets: string[];
    invalidated: number;
    pruned: number;
    /** 이번 실행이 처음으로 목록을 받았는가(= 준비 상태가 `collecting` → `ready`로 바뀌었다). */
    firstListStored: boolean;
}

const emptyResult = (
    status: IngestRegShoResult['status']
): IngestRegShoResult => ({
    status,
    listsFetched: 0,
    holidaysSkipped: 0,
    rowsStored: 0,
    failedMarkets: [],
    invalidated: 0,
    pruned: 0,
    firstListStored: false,
});

interface MarketOutcome {
    lastDate: string | null;
    ingestedDates: string[];
    rows: RegShoThresholdRow[];
    listsFetched: number;
    holidaysSkipped: number;
    deadline: boolean;
    failed: boolean;
}

/** 한 시장을 커서 다음 거래일부터 오늘까지 — 미게시(최근)면 멈추고, 오래된 "없음"은 휴장일로 넘긴다. */
async function ingestMarket(
    deps: IngestRegShoDeps,
    market: string,
    from: string,
    today: string,
    resolve: SymbolResolver
): Promise<MarketOutcome> {
    const outcome: MarketOutcome = {
        lastDate: null,
        ingestedDates: [],
        rows: [],
        listsFetched: 0,
        holidaysSkipped: 0,
        deadline: false,
        failed: false,
    };
    const pendingFrom = addDays(today, -REG_SHO_PUBLICATION_GRACE_DAYS);
    for (const date of eachDate(from, today)) {
        if (isWeekend(date)) continue;
        if (deps.isDeadlineReached()) {
            outcome.deadline = true;
            break;
        }
        let text: string | null;
        try {
            // 거래일은 순서대로 — 커서가 앞으로만 간다.
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            text = await deps.fetchList(market, date);
        } catch (error) {
            deps.log(
                `[reg-sho-threshold] ${market} ${date} failed:`,
                error instanceof Error ? error.message : error
            );
            outcome.failed = true;
            break;
        }
        const parsed =
            text === null
                ? ({ status: 'unavailable' } as const)
                : parseRegShoThresholdList(text, {
                      requestedDate: date,
                      requireFooterDate: FOOTER_DATED_MARKETS.has(market),
                  });
        if (parsed.status === 'unavailable') {
            if (date >= pendingFrom) break;
            outcome.holidaysSkipped += 1;
            outcome.lastDate = date;
            continue;
        }
        outcome.listsFetched += 1;
        outcome.ingestedDates.push(date);
        outcome.lastDate = date;
        const symbols = new Set(
            parsed.symbols.flatMap(symbol => {
                const ours = resolve(symbol);
                return ours === null ? [] : [ours];
            })
        );
        for (const symbol of symbols) {
            outcome.rows.push({ symbol, tradeDate: date, market });
        }
    }
    return outcome;
}

/**
 * Reg SHO 과열 목록 수집(`reg-sho-threshold` cron, 평일 05:00 UTC) — Nasdaq·NYSE·NYSE American·NYSE Arca·Cboe BZX 다섯 목록.
 * 시장마다 커서(`reg_sho_cursor.lastByMarket`)부터 오늘까지(비었으면 최근 60일) 받고, 유니버스 심볼로 해석된 등재 행만 저장한다.
 * 목록 심볼은 CUSIP이 없어 별칭 해석(`BRK.B`·`BRK B`·`BRK/B` → `BRK-B`)으로 맞춘다.
 *
 * ⚠️ 비상업 라이선스 — `deps.isEnabled()`가 false면 **아무 요청도 보내지 않고** DB도 읽지 않고 끝낸다
 * (`shared/api/exchange/regShoThresholdDataEnabled.ts`, 이슈 #1042). 거래소 서버라 SEC 요청 예산과는 무관하다.
 */
export async function runRegShoIngest(
    deps: IngestRegShoDeps
): Promise<IngestRegShoResult> {
    if (!deps.isEnabled()) return emptyResult('disabled');
    if (
        (await deps.repo.getState(INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE)) ===
        null
    ) {
        deps.log(
            '[reg-sho-threshold] universe_incomplete — cusip-map has not finished a full pass yet; nothing ingested'
        );
        return emptyResult('universe_incomplete');
    }
    const universeSymbols = await deps.loadUniverseSymbols();
    if (universeSymbols.length === 0) {
        deps.log('[reg-sho-threshold] empty universe — run cusip-map first');
        return emptyResult('empty_universe');
    }
    const resolve = buildSymbolAliasResolver(universeSymbols);
    const today = toUtcIsoDate(deps.now());
    const backfillFrom = addDays(today, -INVESTOR_FLOWS_REG_SHO_BACKFILL_DAYS);
    const retentionFloor = addDays(
        today,
        -INVESTOR_FLOWS_REG_SHO_RETENTION_DAYS
    );

    let cursor: RegShoCursor = parseRegShoCursor(
        await deps.repo.getState(INVESTOR_FLOWS_STATE_REG_SHO_CURSOR)
    );
    const hadIngestedDate = cursor.ingestedDates.length > 0;
    const result = emptyResult('ok');
    const changed = new Set<string>();
    for (const market of deps.markets) {
        const last = cursor.lastByMarket[market];
        const from =
            last === undefined || last < backfillFrom
                ? backfillFrom
                : addDays(last, 1);
        // 시장은 하나씩 — 시장마다 커서를 따로 저장한다.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const outcome = await ingestMarket(deps, market, from, today, resolve);
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await deps.repo.insertListings(outcome.rows);
        result.listsFetched += outcome.listsFetched;
        result.holidaysSkipped += outcome.holidaysSkipped;
        result.rowsStored += outcome.rows.length;
        for (const row of outcome.rows) changed.add(row.symbol);
        if (outcome.failed) result.failedMarkets.push(market);
        if (outcome.lastDate !== null) {
            cursor = {
                lastByMarket: {
                    ...cursor.lastByMarket,
                    [market]: outcome.lastDate,
                },
                ingestedDates: [
                    ...cursor.ingestedDates,
                    ...outcome.ingestedDates,
                ],
            };
            // 커서는 그 시장의 행을 저장한 **뒤에** 쓴다 — 도중에 죽으면 다음 실행이 같은 날을 다시 받는다(삽입은 멱등).
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await deps.repo.setState(
                INVESTOR_FLOWS_STATE_REG_SHO_CURSOR,
                serializeRegShoCursor(cursor, retentionFloor)
            );
        }
        if (outcome.deadline) {
            result.status = 'deadline';
            break;
        }
    }

    result.pruned = await deps.repo.pruneBefore(retentionFloor);
    const toInvalidate = [...changed]
        .toSorted()
        .slice(0, INVESTOR_FLOWS_REVALIDATE_CAP);
    if (toInvalidate.length > 0) await deps.invalidateSymbols(toInvalidate);
    result.invalidated = toInvalidate.length;
    result.firstListStored =
        !hadIngestedDate && cursor.ingestedDates.length > 0;
    if (result.firstListStored) await deps.onFirstListStored?.();
    return result;
}

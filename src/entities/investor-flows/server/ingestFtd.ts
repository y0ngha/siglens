import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { unzipSingle } from '@/shared/lib/unzipSingle';
import { addDays } from '../lib/investorFlowsDates';
import {
    INVESTOR_FLOWS_FTD_BACKFILL_FILES,
    INVESTOR_FLOWS_FTD_MAX_ATTEMPTS,
    INVESTOR_FLOWS_FTD_MAX_FILES_PER_RUN,
    INVESTOR_FLOWS_FTD_RETENTION_DAYS,
    INVESTOR_FLOWS_REVALIDATE_CAP,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
} from '../lib/investorFlowsPolicy';
import {
    extractFtdFileLinks,
    ftdTrailerMatches,
    parseFtdFile,
    resolveFtdRows,
    type FtdUniverse,
} from '../lib/ftdParser';
import { buildSymbolAliasResolver } from '../lib/symbolAliasResolver';
import type {
    FtdFileLink,
    FtdFileState,
    FtdRow,
    ParsedFtdFile,
} from '../model';
import type { InvestorFlowsUniverse } from '../api/investorFlowsUniverseRepository';

/**
 * 압축을 푼 FTD 텍스트 상한(바이트). 실측(2026-09b): zip 1.5MB → txt 4.2MB. 크게 여유를 둔다 — 넘으면 형식이 바뀐 것이다.
 */
export const FTD_MAX_UNZIPPED_BYTES = 64 * 1024 * 1024;

export interface IngestFtdDeps {
    sec: {
        fetchFailsToDeliverListing(): Promise<string | null>;
        fetchSecFile(path: string): Promise<Uint8Array | null>;
    };
    repo: {
        getState(key: string): Promise<string | null>;
        listFileStates(): Promise<Map<string, FtdFileState>>;
        recordRejected(fileKey: string, error: string): Promise<void>;
        storeFile(fileKey: string, rows: readonly FtdRow[]): Promise<void>;
        pruneBefore(cutoffDate: string): Promise<number>;
    };
    loadUniverse: () => Promise<InvestorFlowsUniverse>;
    /** SEC가 거절(속도 제한·차단)했는지 — 그 즉시 이 실행의 SEC 요청을 전부 멈춘다. */
    isSecBlockedError: (error: unknown) => boolean;
    now: () => Date;
    isDeadlineReached: () => boolean;
    invalidateSymbols: (symbols: readonly string[]) => void | Promise<void>;
    /**
     * 저장된 파일이 하나도 없던 상태에서 **처음** 파일이 저장된 실행이 한 번 부른다 — 수급 탭의 "결제 불이행 수집 중" 안내를 담은
     * 준비 상태 캐시를 무효화한다(`runFinraIngest`의 `onFirstDataStored`와 같은 역할). 이후 실행은 부르지 않는다.
     */
    onFirstFileStored?: () => void | Promise<void>;
    log: (message: string, detail?: unknown) => void;
}

export type IngestFtdStop =
    | 'complete'
    | 'deadline'
    | 'sec_blocked'
    | 'universe_incomplete'
    | 'empty_universe'
    /** 목록 페이지가 없었다(404) — 형식·주소가 바뀌었을 수 있다. */
    | 'listing_missing';

export interface IngestFtdResult {
    stoppedBy: IngestFtdStop;
    /** 목록에 있던 파일 중 보존 창(최근 24개) 안이고 아직 저장 안 된 것. */
    pendingFiles: number;
    filesStored: number;
    rowsStored: number;
    /** trailer가 맞지 않아 저장하지 않은 파일 키. */
    rejectedFiles: string[];
    invalidated: number;
    pruned: number;
    /** 이번 실행이 비어 있던 저장소에 처음으로 파일을 저장했는가(= 준비 상태가 `collecting` → `ready`로 바뀌었다). */
    firstFileStored: boolean;
}

/**
 * 받을 파일 순서 — 저장된 파일과 시도를 소진한 파일을 빼고, **실패한 적 없는 파일이 먼저**(최신부터), 실패한 파일은 시도가 적은 순으로
 * 그 뒤에 선다. 영구히 깨진 최신 파일이 실행당 상한을 매번 차지해 옛 파일 백필을 굶기지 않는다.
 */
export function pendingFiles(
    links: readonly FtdFileLink[],
    states: ReadonlyMap<string, FtdFileState>
): FtdFileLink[] {
    const attemptsOf = (link: FtdFileLink): number =>
        states.get(link.fileKey)?.attempts ?? 0;
    return links
        .filter(link => {
            const state = states.get(link.fileKey);
            return (
                state?.processed !== true &&
                (state?.attempts ?? 0) < INVESTOR_FLOWS_FTD_MAX_ATTEMPTS
            );
        })
        .toSorted((a, b) => attemptsOf(a) - attemptsOf(b));
}

/** zip → 파싱된 파일. 깨진 zip·파일 수·크기 위반은 그 파일만의 실패라 던지지 않고 오류로 돌려준다. */
function readFtdZip(zip: Uint8Array): ParsedFtdFile | Error {
    try {
        return parseFtdFile(
            new TextDecoder('utf-8').decode(
                unzipSingle(zip, FTD_MAX_UNZIPPED_BYTES).data
            )
        );
    } catch (error) {
        return error instanceof Error ? error : new Error(String(error));
    }
}

function ftdUniverseOf(universe: InvestorFlowsUniverse): FtdUniverse {
    const symbolByCusip = new Map(
        [...universe.cusips].map(([cusip, { symbol }]) => [cusip, symbol])
    );
    const cusipsBySymbol = [...symbolByCusip].reduce(
        (bySymbol, [cusip, symbol]) =>
            bySymbol.set(symbol, [...(bySymbol.get(symbol) ?? []), cusip]),
        new Map<string, string[]>()
    );
    return {
        symbolByCusip,
        cusipsBySymbol,
        resolveSymbol: buildSymbolAliasResolver(universe.symbols),
    };
}

/**
 * SEC fails-to-deliver 반월 파일 수집(`sec-ftd` cron, 매일 1회). 목록 페이지에서 파일 링크를 읽고, 최신 24개(1년) 중 아직 저장하지
 * 않은 파일을 **최신부터 실행당 4개까지** 받는다(저장에 실패한 파일은 뒤로, 3번 실패하면 제외 — `pendingFiles`) — 처음엔 며칠에 걸쳐 1년을 채우고, 그 뒤엔 반월마다 새 파일 하나다(기간 종료
 * ≈2주 뒤 게시). 각 파일은 trailer(행 수·수량 합계)가 정확히 맞을 때만 유니버스 CUSIP 행을 저장한다.
 *
 * SEC 요청: 목록 1건 + 파일 ≤4건 — `sec-13f`와 **공유 락**(`investor-flows:cron-lock:sec`) 아래라 동시에 돌지 않는다.
 */
export async function runFtdIngest(
    deps: IngestFtdDeps
): Promise<IngestFtdResult> {
    const result: IngestFtdResult = {
        stoppedBy: 'complete',
        pendingFiles: 0,
        filesStored: 0,
        rowsStored: 0,
        rejectedFiles: [],
        invalidated: 0,
        pruned: 0,
        firstFileStored: false,
    };
    if (
        (await deps.repo.getState(INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE)) ===
        null
    ) {
        deps.log(
            '[sec-ftd] universe_incomplete — cusip-map has not finished a full pass yet; nothing ingested'
        );
        return { ...result, stoppedBy: 'universe_incomplete' };
    }
    const universe = await deps.loadUniverse();
    if (universe.cusips.size === 0) {
        deps.log('[sec-ftd] empty universe — run cusip-map first');
        return { ...result, stoppedBy: 'empty_universe' };
    }

    const symbols = new Set<string>();
    let stoppedBy: IngestFtdStop = 'complete';
    // 실행 전에 저장된 파일이 있었는가 — 없었는데 이번에 저장했으면 준비 상태 전환이다. 목록 조회 전에 끝나면 판정하지 않는다.
    let hadStoredFile = true;
    try {
        const html = await deps.sec.fetchFailsToDeliverListing();
        if (html === null) {
            deps.log(
                '[sec-ftd] listing_missing — the FTD listing page returned 404'
            );
            return { ...result, stoppedBy: 'listing_missing' };
        }
        const states = await deps.repo.listFileStates();
        hadStoredFile = [...states.values()].some(state => state.processed);
        const pending = pendingFiles(
            extractFtdFileLinks(html).slice(
                0,
                INVESTOR_FLOWS_FTD_BACKFILL_FILES
            ),
            states
        );
        result.pendingFiles = pending.length;
        const reject = async (
            fileKey: string,
            error: string
        ): Promise<void> => {
            result.rejectedFiles.push(fileKey);
            await deps.repo.recordRejected(fileKey, error);
        };
        const ftdUniverse = ftdUniverseOf(universe);
        for (const link of pending.slice(
            0,
            INVESTOR_FLOWS_FTD_MAX_FILES_PER_RUN
        )) {
            if (deps.isDeadlineReached()) {
                stoppedBy = 'deadline';
                break;
            }
            // 파일 하나의 실패(일시 오류·DB 오류 등)는 그 파일만 거부로 세고 다음 파일로 간다 — 이미 저장한 파일의 무효화·정리가
            // 실행 끝에서 그대로 돈다. SEC 거절(403·429)만 실행 전체를 멈춘다(바깥 catch).
            try {
                // 파일은 하나씩 받는다(각 ≈1.5MB, 풀면 ≈4MB) — 메모리와 SEC 부담을 묶는다.
                // react-doctor-disable-next-line react-doctor/async-await-in-loop
                const zip = await deps.sec.fetchSecFile(link.path);
                if (zip === null) {
                    deps.log(`[sec-ftd] file missing ${link.path}`);
                    // react-doctor-disable-next-line react-doctor/async-await-in-loop
                    await reject(link.fileKey, `missing ${link.path}`);
                    continue;
                }
                const parsed = readFtdZip(zip);
                if (parsed instanceof Error) {
                    deps.log(
                        `[sec-ftd] unreadable zip ${link.fileKey}:`,
                        parsed.message
                    );
                    // react-doctor-disable-next-line react-doctor/async-await-in-loop
                    await reject(link.fileKey, parsed.message.slice(0, 500));
                    continue;
                }
                if (!ftdTrailerMatches(parsed)) {
                    // 메트릭 필터 접두(`[sec-ftd] trailer mismatch`, infra/aws/19-*) — 형식 변경·잘린 파일. 저장하지 않고 시도만 센다:
                    // 다음 실행은 건강한 파일 뒤에 다시 받고, `INVESTOR_FLOWS_FTD_MAX_ATTEMPTS`번 실패하면 더 받지 않는다.
                    deps.log(`[sec-ftd] trailer mismatch ${link.fileKey}`, {
                        trailer: parsed.trailer,
                        dataLines: parsed.dataLines,
                        malformedLines: parsed.malformedLines,
                        parsedQuantity: parsed.parsedQuantity,
                    });
                    // react-doctor-disable-next-line react-doctor/async-await-in-loop
                    await reject(link.fileKey, 'trailer mismatch');
                    continue;
                }
                const rows = resolveFtdRows(parsed.rows, ftdUniverse);
                // react-doctor-disable-next-line react-doctor/async-await-in-loop
                await deps.repo.storeFile(link.fileKey, rows);
                result.filesStored += 1;
                result.rowsStored += rows.length;
                for (const row of rows) symbols.add(row.symbol);
            } catch (error) {
                if (deps.isSecBlockedError(error)) throw error;
                const message = (
                    error instanceof Error ? error.message : String(error)
                ).slice(0, 500);
                deps.log(`[sec-ftd] file failed ${link.fileKey}:`, message);
                // react-doctor-disable-next-line react-doctor/async-await-in-loop
                await reject(link.fileKey, message);
            }
        }
    } catch (error) {
        if (!deps.isSecBlockedError(error)) throw error;
        stoppedBy = 'sec_blocked';
        deps.log('[sec-ftd] sec_blocked — SEC refused the request, stopping');
    }

    const today = toUtcIsoDate(deps.now());
    const pruned = await deps.repo.pruneBefore(
        addDays(today, -INVESTOR_FLOWS_FTD_RETENTION_DAYS)
    );
    const toInvalidate = [...symbols]
        .toSorted()
        .slice(0, INVESTOR_FLOWS_REVALIDATE_CAP);
    if (toInvalidate.length > 0) await deps.invalidateSymbols(toInvalidate);
    const firstFileStored = !hadStoredFile && result.filesStored > 0;
    if (firstFileStored) await deps.onFirstFileStored?.();
    return {
        ...result,
        stoppedBy,
        invalidated: toInvalidate.length,
        pruned,
        firstFileStored,
    };
}

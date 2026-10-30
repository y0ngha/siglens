import { kstDateKey } from '@/shared/lib/etTimeUtils';
import {
    parseDartBackfillCursor,
    parseDartListCursor,
    serializeDartBackfillCursor,
    serializeDartListCursor,
    type DartPendingCorp,
} from '../lib/dartIngestState';
import {
    backfillTargetsAfter,
    nextPendingQueue,
    symbolsToInvalidate,
} from '../lib/dartIngestPlan';
import { buildKrDartUniverse } from '../lib/dartSymbol';
import { addDays } from '../lib/investorFlowsDates';
import {
    INVESTOR_FLOWS_DART_MAX_ATTEMPTS,
    INVESTOR_FLOWS_DART_RETENTION_DAYS,
    INVESTOR_FLOWS_DART_STATE_FLUSH_EVERY,
    INVESTOR_FLOWS_STATE_DART_BACKFILL_CURSOR,
    INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE,
    INVESTOR_FLOWS_STATE_DART_LIST_CURSOR,
} from '../lib/investorFlowsPolicy';
import { refetchCorp } from './dartCorpRefetch';
import { scanDisclosures } from './dartListScan';
import { emptyResult } from './dartRunContext';
import type {
    IngestDartFilingsDeps,
    IngestDartFilingsResult,
    RunContext,
} from './ingestDartFilingsTypes';

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
    // 백필 진행 위치 — 회사를 끝낼 때마다 앞으로 옮기고 `saveState`가 그때의 값을 저장한다.
    let backfillCursor = parseDartBackfillCursor(
        await deps.repo.getState(INVESTOR_FLOWS_STATE_DART_BACKFILL_CURSOR)
    );
    const backfillAlreadyDone =
        (await deps.repo.getState(INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE)) !==
        null;

    // ── 1) 공시검색 ──
    const scan = await scanDisclosures(ctx, listCursor);
    const plans = scan.plans.filter(
        row => row.receiptDate >= ctx.retentionFloor
    );
    if (plans.length > 0) await deps.repo.upsertTradingPlans(plans);
    result.tradingPlansStored = plans.length;
    result.changedCorps = scan.changedCorps.size;
    result.listComplete = scan.complete && scan.tradingPlansFrom === null;
    // 멈췄으면 두 커서 모두 그대로(다음 실행이 같은 창을 다시 읽는다). 끝까지 읽었으면 `through`는 오늘로 가고, D005는 넘쳤을 때만
    // 읽은 마지막 접수일에 남는다.
    const through = scan.complete ? today : listCursor.through;
    const tradingPlansFrom = scan.complete
        ? scan.tradingPlansFrom
        : listCursor.tradingPlansFrom;
    // 대기열 = 이전 대기열 + 새 공시 회사(순서 유지). 유니버스에서 빠진 회사(상장폐지 등)는 버린다.
    const pending = new Map(
        nextPendingQueue(
            listCursor.pending,
            scan.changedCorps,
            ctx.universeCorps
        ).map(entry => [entry.corpCode, entry] as const)
    );
    const saveState = async (): Promise<void> => {
        await deps.repo.setState(
            INVESTOR_FLOWS_STATE_DART_LIST_CURSOR,
            serializeDartListCursor({
                through,
                pending: [...pending.values()],
                tradingPlansFrom,
            })
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
    // 마지막 상태 저장 뒤 끝낸 회사 수 — `INVESTOR_FLOWS_DART_STATE_FLUSH_EVERY`마다 0으로 돌린다.
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
        : backfillTargetsAfter(universe.corpCodes, backfillCursor);
    // 백필이 유니버스 마지막 회사까지 닿았는가 — 루프가 마지막 항목을 끝냈을 때만 참이 된다(중간에 멈추면 거짓 그대로).
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
        await deps.onBackfillCompleted?.();
    }

    const pruned = await deps.repo.pruneBefore(ctx.retentionFloor);
    const toInvalidate = symbolsToInvalidate(changed, universe.symbolsByCorp);
    if (toInvalidate.length > 0) await deps.invalidateSymbols(toInvalidate);

    return {
        ...result,
        status: ctx.stop ?? 'complete',
        calls: ctx.calls,
        backfillDone,
        backfillRemaining: backfillDone
            ? 0
            : backfillTargetsAfter(universe.corpCodes, backfillCursor).length,
        pendingRemaining: pending.size,
        invalidated: toInvalidate.length,
        pruned,
    };
}

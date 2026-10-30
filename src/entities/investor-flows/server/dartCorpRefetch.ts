import {
    parseExecutiveStockRows,
    parseMajorStockRows,
} from '../lib/dartParsers';
import type { DartInsiderReportRow, DartMajorHoldingRow } from '../model';
import { canCall, errorMessage, stopOnFatal } from './dartRunContext';
import type { RunContext } from './ingestDartFilingsTypes';

/** 회사 하나를 다시 받는 데 드는 DART 호출 수(`majorstock` + `elestock`). */
const CALLS_PER_CORP = 2;

/** 회사 하나를 다시 받은 결과 — 저장했다 / 그 회사만 실패했다 / 실행을 멈춰야 한다. */
export type RefetchOutcome =
    | { kind: 'stored'; rows: number }
    | { kind: 'failed'; message: string }
    | { kind: 'stopped' };

/** 회사 하나의 대량보유·소유보고 전체 이력을 받아 보존 창 안의 행만 upsert한다. */
export async function refetchCorp(
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

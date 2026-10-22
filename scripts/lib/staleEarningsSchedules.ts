/**
 * `earnings_reports`에 남은 **옛 예정일** 행을 고르는 순수 로직.
 * DB·CLI는 `scripts/prune-stale-earnings-schedules.ts`가 맡는다.
 *
 * 왜 생기나: 실적 행의 키는 `(symbol, earnings_date)`이고 upsert는 행을 지우지 않는다.
 * 회사가 예정일을 옮기면(COP: 10-29 → 11-05) 새 날짜 행이 추가되고 옛 날짜 행이 실적
 * 미발표 상태로 남는다. 2026-10 실측에서 1,172개 심볼이 미래 미발표 행을 2개 이상 가졌다.
 * 수집 경로는 이제 갱신 때 정리하지만(`pruneSupersededUpcoming`), 이미 쌓인 행은 이
 * 스크립트로 한 번 치운다.
 *
 * 판정: 심볼별 미래 미발표 행 중 `fetched_at`이 가장 최근인 갱신(같은 upsert 문은 같은
 * `fetched_at`을 쓴다)에 든 행만 남기고, 그보다 먼저 받아 온 행을 옛 예정일로 본다. upsert가
 * 응답에 든 행의 `fetched_at`을 갱신하므로, 더 오래된 `fetched_at`은 "최신 응답에 없었다"는
 * 뜻이다. 미래 행이 하나뿐인 심볼은 대체할 일정이 없으니 지우지 않는다(수집 경로와 같은 규칙).
 */

/** 미래(기준일 이후)·실적 미발표 행. 조회 쿼리가 이 조건으로 이미 걸러서 넘긴다. */
export interface UpcomingEarningsRow {
    symbol: string;
    earningsDate: string;
    fetchedAt: Date;
}

export interface StaleScheduleSelection {
    /** 검사한 미래 미발표 행 수. */
    scannedRows: number;
    /** 미래 미발표 행이 2개 이상인 심볼 수. */
    symbolsWithMultiple: number;
    /** 지울 행이 하나라도 있는 심볼 수. */
    symbolsAffected: number;
    /** 지울 행(옛 예정일). */
    stale: UpcomingEarningsRow[];
}

export function selectStaleSchedules(
    rows: readonly UpcomingEarningsRow[]
): StaleScheduleSelection {
    const bySymbol = Map.groupBy(rows, row => row.symbol);
    const stale: UpcomingEarningsRow[] = [];
    let symbolsWithMultiple = 0;
    let symbolsAffected = 0;

    for (const group of bySymbol.values()) {
        if (group.length < 2) continue;
        symbolsWithMultiple += 1;
        const latest = Math.max(...group.map(r => r.fetchedAt.getTime()));
        const superseded = group.filter(r => r.fetchedAt.getTime() < latest);
        if (superseded.length === 0) continue;
        symbolsAffected += 1;
        stale.push(...superseded);
    }

    return {
        scannedRows: rows.length,
        symbolsWithMultiple,
        symbolsAffected,
        stale,
    };
}

/** 한 번의 DELETE에 묶는 키 수 — 다른 DB 스크립트의 청크 크기(500)와 같다. */
export const STALE_SCHEDULE_DELETE_CHUNK_SIZE = 500;

export function chunkRows<T>(rows: readonly T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < rows.length; i += size) {
        chunks.push(rows.slice(i, i + size));
    }
    return chunks;
}

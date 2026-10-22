import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq, gte, isNull, or } from 'drizzle-orm';
import { earningsReports } from '../src/shared/db/schema';
import { kstDateKey } from '../src/shared/lib/etTimeUtils';
import { guardRemoteWrite, readDatabaseUrl } from '../db/scripts/lib/dbTarget';
import {
    chunkRows,
    selectStaleSchedules,
    STALE_SCHEDULE_DELETE_CHUNK_SIZE,
    type UpcomingEarningsRow,
} from './lib/staleEarningsSchedules';

/**
 * `earnings_reports`의 옛 예정일 행 일회성 정리 —
 * `yarn db:prune:stale-earnings [--apply]`.
 *
 * 판정 규칙과 배경은 `scripts/lib/staleEarningsSchedules.ts` 머리말. 수집 경로
 * (`pruneSupersededUpcoming`)가 앞으로의 갱신은 정리하므로, 이 스크립트는 이미 쌓인
 * 행을 한 번 치우는 용도다.
 *
 * 기본은 **dry-run**이다 — 건수만 찍고 쓰지 않는다(심볼·행 목록도 찍지 않는다).
 * `--apply`일 때만 지우며, 쓰기 스크립트라 원격 대상이면 DB-4대로 거부한다
 * (`guardRemoteWrite`; 운영에는 `ALLOW_REMOTE_DB_WRITE=1`). 지운 심볼은 다음 조회 때
 * 24h 신선도 게이트를 따라 다시 받아 온다 — 남는 최신 예정일 행이 있으므로 그 사이에도
 * 다음 실적일은 비지 않는다.
 *
 * 삭제 문은 키 `(symbol, earnings_date)`에 더해 "실적 미발표" 조건을 다시 건다 — 조회와
 * 삭제 사이에 실적이 채워진 행은 지우지 않는다.
 */
/** 기준일 이후·실적 미발표 행. 조회와 삭제가 같은 조건을 건다(삭제 직전에 실적이 채워진 행은 남는다). */
function unreportedFrom(today: string) {
    return and(
        gte(earningsReports.earningsDate, today),
        isNull(earningsReports.epsActual),
        isNull(earningsReports.revenueActual)
    );
}

const apply = process.argv.includes('--apply');
const { databaseUrl } = readDatabaseUrl();

async function run(): Promise<void> {
    if (apply) guardRemoteWrite(databaseUrl, 'db:prune:stale-earnings');
    else
        console.log(
            '[db] dry-run (default): no writes. Pass --apply to delete.'
        );

    const client = postgres(databaseUrl, { max: 1 });
    try {
        const db = drizzle(client);
        const today = kstDateKey(new Date());
        // 쿼리 빌더로 읽어 열 타입(`earnings_date`는 date 문자열 모드, `fetched_at`은 Date)이 스키마에서
        // 나온다 — 원시 SQL 결과를 단언할 필요가 없다.
        const rows: UpcomingEarningsRow[] = await db
            .select({
                symbol: earningsReports.symbol,
                earningsDate: earningsReports.earningsDate,
                fetchedAt: earningsReports.fetchedAt,
            })
            .from(earningsReports)
            .where(unreportedFrom(today));

        const selection = selectStaleSchedules(rows);
        console.log(
            JSON.stringify({
                today,
                scannedRows: selection.scannedRows,
                symbolsWithMultiple: selection.symbolsWithMultiple,
                symbolsAffected: selection.symbolsAffected,
                staleRows: selection.stale.length,
            })
        );
        if (!apply || selection.stale.length === 0) return;

        // 청크마다 DELETE 한 문. `max: 1` 커넥션이라 postgres-js가 문을 차례로 보낸다 — `Promise.all`은
        // 동시 실행이 아니라 대기열이다. `.returning`으로 실제로 지운 행을 세므로 "0건"과 "알 수 없음"이
        // 섞이지 않는다(드라이버의 `count` 필드에 기대지 않는다).
        const removed = await Promise.all(
            chunkRows(selection.stale, STALE_SCHEDULE_DELETE_CHUNK_SIZE).map(
                chunk =>
                    db
                        .delete(earningsReports)
                        .where(
                            and(
                                or(
                                    ...chunk.map(r =>
                                        and(
                                            eq(
                                                earningsReports.symbol,
                                                r.symbol
                                            ),
                                            eq(
                                                earningsReports.earningsDate,
                                                r.earningsDate
                                            )
                                        )
                                    )
                                ),
                                unreportedFrom(today)
                            )
                        )
                        .returning({ symbol: earningsReports.symbol })
            )
        );
        const deleted = removed.reduce((sum, rows) => sum + rows.length, 0);
        console.log(JSON.stringify({ deletedRows: deleted }));
    } finally {
        await client.end();
    }
}

run().catch((error: unknown) => {
    console.error('prune-stale-earnings-schedules failed:', error);
    process.exit(1);
});

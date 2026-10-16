import 'server-only';
import { affectedRows } from './affectedRows';
import { and, eq, gte, sql } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { regShoThreshold } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import {
    INVESTOR_FLOWS_STATE_REG_SHO_CURSOR,
    INVESTOR_FLOWS_UPSERT_CHUNK_SIZE,
} from '../lib/investorFlowsPolicy';
import { parseRegShoCursor } from '../lib/regShoCursor';
import type { RegShoThresholdRow, ThresholdListingRecord } from '../model';
import {
    readInvestorFlowsState,
    writeInvestorFlowsState,
} from './investorFlowsState';

/**
 * Reg SHO 과열 목록 저장소(⚠ 거래소 데이터 비상업 라이선스 — `shared/api/exchange/regShoThresholdDataEnabled.ts`).
 * 등재된 (심볼, 거래일, 시장)만 행이 있다 — 행이 없으면 그날 그 시장 목록에 없었다(수집된 날이라면).
 */
export class DrizzleInvestorFlowsRegShoRepository {
    constructor(private readonly db: SiglensDatabase) {}

    getState(key: string): Promise<string | null> {
        return readInvestorFlowsState(this.db, key);
    }

    setState(key: string, value: string): Promise<void> {
        return writeInvestorFlowsState(this.db, key, value);
    }

    async insertListings(rows: readonly RegShoThresholdRow[]): Promise<void> {
        for (
            let i = 0;
            i < rows.length;
            i += INVESTOR_FLOWS_UPSERT_CHUNK_SIZE
        ) {
            const chunk = rows.slice(i, i + INVESTOR_FLOWS_UPSERT_CHUNK_SIZE);
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await withRetry(
                () =>
                    this.db
                        .insert(regShoThreshold)
                        .values(chunk.map(row => ({ ...row })))
                        .onConflictDoNothing(),
                DB_TRANSIENT_RETRY
            );
        }
    }

    async pruneBefore(cutoffDate: string): Promise<number> {
        return affectedRows(
            await withRetry(
                () =>
                    this.db.execute(
                        sql`DELETE FROM reg_sho_threshold WHERE trade_date < ${cutoffDate}::date`
                    ),
                DB_TRANSIENT_RETRY
            )
        );
    }

    /** 심볼의 등재 기록(`sinceDate` 이후) — 거래일마다 등재된 시장들. `summarizeThresholdListings`의 입력. */
    async findListings(
        symbol: string,
        sinceDate: string
    ): Promise<ThresholdListingRecord[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        tradeDate: regShoThreshold.tradeDate,
                        market: regShoThreshold.market,
                    })
                    .from(regShoThreshold)
                    .where(
                        and(
                            eq(regShoThreshold.symbol, symbol),
                            gte(regShoThreshold.tradeDate, sinceDate)
                        )
                    )
                    .orderBy(regShoThreshold.tradeDate, regShoThreshold.market),
            DB_TRANSIENT_RETRY
        );
        const byDate = new Map<string, string[]>();
        for (const row of rows) {
            byDate.set(row.tradeDate, [
                ...(byDate.get(row.tradeDate) ?? []),
                row.market,
            ]);
        }
        return [...byDate].map(([tradeDate, markets]) => ({
            tradeDate,
            markets,
        }));
    }

    /**
     * 목록을 받은 거래일들(`sinceDate` 이후, 오래된 순) — 어느 시장이든 목록이 들어온 날. 등재 연속 일수의 분모다. 등재 행으로는
     * 알 수 없어(유니버스 종목이 하나도 없던 날은 행이 없다) 수집 상태(`reg_sho_cursor`)에서 읽는다.
     */
    async listTradeDates(sinceDate: string): Promise<string[]> {
        const cursor = parseRegShoCursor(
            await this.getState(INVESTOR_FLOWS_STATE_REG_SHO_CURSOR)
        );
        return cursor.ingestedDates.filter(date => date >= sinceDate);
    }
}

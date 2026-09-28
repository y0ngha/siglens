/**
 * 방문 후보 선정에 필요한 DB 입력을 한 번에 읽는다 — SELECT만.
 *
 * 실패하면 경고만 찍고 `null`을 돌려준다. 방문 후보는 부가 신호라 DB가 안 되면(테이블
 * 미적용·네트워크) 스크립트의 주 기능(거래량·시총 후보)은 그대로 돌아야 한다.
 *
 * `server-only` 모듈을 끌어오므로 호출 스크립트는 `--conditions=react-server`로 실행한다
 * (package.json 참고).
 */
import { DrizzleSymbolViewRepository } from '@/entities/symbol-view/api';
import type { SymbolViewTally } from '@/entities/symbol-view/types';
import { DrizzleKoreanTickerRepository } from '@/entities/ticker/api';
import { getDatabaseClient } from '@/shared/db/client';
import { cryptoAssets } from '@/shared/db/schema';
import { kstDateKey, kstDateKeyDaysBefore } from '@/shared/lib/etTimeUtils';
import { MIN_WEEKLY_VIEWS, VISIT_LOOKBACK_DAYS } from './visitCandidates';

export interface VisitSources {
    readonly tallies: readonly SymbolViewTally[];
    /** 상장 중인 KR 종목 → 한글명 (`korean_tickers`, `delisted_at IS NULL`). */
    readonly krNames: ReadonlyMap<string, string>;
    /** `crypto_assets` 심볼 — 방문 심볼의 크립토 판별용. */
    readonly cryptoSymbols: ReadonlySet<string>;
}

export async function loadVisitSources(
    now: Date = new Date()
): Promise<VisitSources | null> {
    try {
        const { db } = getDatabaseClient();
        const fromDate = kstDateKeyDaysBefore(
            kstDateKey(now),
            VISIT_LOOKBACK_DAYS
        );
        const [tallies, krRows, cryptoRows] = await Promise.all([
            new DrizzleSymbolViewRepository(db).topViewed(
                fromDate,
                MIN_WEEKLY_VIEWS
            ),
            new DrizzleKoreanTickerRepository(db).findAll(),
            db.select({ symbol: cryptoAssets.symbol }).from(cryptoAssets),
        ]);
        return {
            tallies,
            krNames: new Map(krRows.map(r => [r.symbol, r.koreanName])),
            cryptoSymbols: new Set(cryptoRows.map(r => r.symbol)),
        };
    } catch (error) {
        console.warn(
            `[visit] 방문 후보를 건너뛴다 — DB 조회 실패: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
        return null;
    }
}

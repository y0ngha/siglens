import 'server-only';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';
import { getSectorSignalsStatic } from '@/entities/sector-signal/api/sectorSignalsStaticCache';
import { selectTodaySignals } from '@/entities/sector-signal/lib/selectTodaySignals';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import {
    KR_DASHBOARD_SCOPE,
    US_DASHBOARD_SCOPE,
    type DashboardScope,
} from '@/shared/config/dashboardScope';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/** 시장마다 브리핑에 싣는 신호 종목 수. 요약 표 한 장에 두 시장이 들어가는 양이다. */
export const MARKET_PICKS_PER_MARKET = 5;

/** 시장 브리핑의 읽기 소스. 테스트가 갈아 끼울 수 있게 주입받는다. */
export interface MarketPickSources {
    getSignals: (scope: DashboardScope) => Promise<SectorSignalsResult>;
}

/** 운영 소스 — 홈 "오늘의 시장"·`/market`과 같은 스캐너 정적 캐시(같은 키라 보통 캐시 적중). */
export function createMarketPickSources(): MarketPickSources {
    return {
        getSignals: scope =>
            getSectorSignalsStatic(scope, DEFAULT_DASHBOARD_TIMEFRAME),
    };
}

async function picksFor(
    scope: DashboardScope,
    sources: MarketPickSources
): Promise<string[]> {
    try {
        const result = await sources.getSignals(scope);
        return selectTodaySignals(result.stocks, MARKET_PICKS_PER_MARKET).map(
            row => row.symbol
        );
    } catch (error) {
        console.warn(
            `[email-report] ${scope.id} 신호 조회 실패 — 그 시장 없이 브리핑한다`,
            redactDbErrorForLog(error)
        );
        return [];
    }
}

/**
 * 관심종목이 없는 회원에게 보낼 시장 브리핑 종목 — 미국, 그다음 한국. 홈 "오늘의 시장"과 같은
 * 선택(`selectTodaySignals`)이라 메일과 홈이 같은 날 같은 종목을 보여 준다. 한 시장 조회가 실패하면
 * 그 시장만 비우고, 둘 다 비면 빈 목록이다(호출자가 그날 발송을 건너뛴다).
 */
export async function loadMarketPicks(
    sources: MarketPickSources
): Promise<string[]> {
    const [us, kr] = await Promise.all([
        picksFor(US_DASHBOARD_SCOPE, sources),
        picksFor(KR_DASHBOARD_SCOPE, sources),
    ]);
    return [...us, ...kr];
}

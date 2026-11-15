import 'server-only';

import type { FearGreedReading } from '@y0ngha/siglens-core';
import { getMarketFearGreedReading } from '@/entities/market-fear-greed/api/marketFearGreedReading';
import { getSectorSignalsStatic } from '@/entities/sector-signal/api/sectorSignalsStaticCache';
import { isOfflineBuild } from '@/shared/api/offlineBuild';
import {
    shortenRevalidateForRuntimeDegrade,
    shortenRevalidateIfFmpFailedAtBuild,
} from '@/shared/cache/buildDegradedRevalidate';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import {
    KR_DASHBOARD_SCOPE,
    US_DASHBOARD_SCOPE,
    type DashboardScope,
} from '@/shared/config/dashboardScope';
import { selectTodaySignals, type TodaySignalRow } from './selectTodaySignals';

/** 시장마다 홈에 보일 신호 종목 수. 한 화면에 시장 둘이 나란히 들어가는 양이다. */
const SIGNAL_ROWS_PER_MARKET = 4;

export type TodayMarketId = 'us' | 'kr' | 'crypto';

/** 한 시장의 신호 종목과 그 스캔 시각. */
export interface TodayMarketSignals {
    readonly rows: readonly TodaySignalRow[];
    /**
     * 스캐너가 계산한 시각(ISO). 화면이 "언제 기준"을 밝히는 데 쓴다 — 주말·장 전에는 직전 세션
     * 데이터라 "오늘"로만 적으면 틀린다. 계산 시각이 없으면 `null`.
     */
    readonly computedAt: string | null;
}

export interface HomeTodayMarketData {
    readonly fearGreed: Readonly<
        Record<TodayMarketId, FearGreedReading | null>
    >;
    readonly signals: {
        readonly us: TodayMarketSignals;
        readonly kr: TodayMarketSignals;
    };
}

const NO_SIGNALS: TodayMarketSignals = { rows: [], computedAt: null };

export const EMPTY_HOME_TODAY_MARKET: HomeTodayMarketData = {
    fearGreed: { us: null, kr: null, crypto: null },
    signals: { us: NO_SIGNALS, kr: NO_SIGNALS },
};

interface LoadedSignals {
    readonly signals: TodayMarketSignals;
    readonly failed: boolean;
}

async function loadSignals(scope: DashboardScope): Promise<LoadedSignals> {
    try {
        const result = await getSectorSignalsStatic(
            scope,
            DEFAULT_DASHBOARD_TIMEFRAME
        );
        return {
            failed: false,
            signals: {
                rows: selectTodaySignals(result.stocks, SIGNAL_ROWS_PER_MARKET),
                computedAt: result.computedAt === '' ? null : result.computedAt,
            },
        };
    } catch (error) {
        console.warn(
            `[home-today-market] ${scope.id} 신호 조회 실패 — 비운 채로 진행한다`,
            error
        );
        return { failed: true, signals: NO_SIGNALS };
    }
}

/**
 * 홈 "오늘의 시장" 데이터 — 시장별 공포탐욕 요약과 신호가 잡힌 종목.
 *
 * 새 외부 호출을 만들지 않는다. 공포탐욕은 `/[symbol]/fear-greed`와 같은
 * `getMarketFearGreedReading`, 신호는 `/market`과 같은 `getSectorSignalsStatic`(같은 캐시 키)을
 * 읽는다. 둘 다 `unstable_cache`라 ISR 렌더 중 I/O가 캐시 밖으로 새지 않는다.
 *
 * 어느 쪽이 실패해도 던지지 않는다 — 비운 칸은 섹션이 숨긴다. 대신 그 렌더의 재생성 주기를
 * 짧게 건다. 그러지 않으면 일시 장애로 빈 섹션이 홈 재생성 주기(1h) 내내 CDN에 굳는다.
 * - 빌드 중 FMP 차단: `shortenRevalidateIfFmpFailedAtBuild`(60s)
 * - 런타임 실패: 신호 조회가 던졌거나 공포탐욕이 `null`(로더가 실패를 `null`로 삼킨다)이면
 *   `shortenRevalidateForRuntimeDegrade`(300s)
 */
export async function loadHomeTodayMarket(): Promise<HomeTodayMarketData> {
    if (isOfflineBuild()) return EMPTY_HOME_TODAY_MARKET;
    const [us, kr, crypto, usSignals, krSignals] = await Promise.all([
        getMarketFearGreedReading('us-equity'),
        getMarketFearGreedReading('kr-equity'),
        getMarketFearGreedReading('crypto'),
        loadSignals(US_DASHBOARD_SCOPE),
        loadSignals(KR_DASHBOARD_SCOPE),
    ]);
    await shortenRevalidateIfFmpFailedAtBuild();
    const degraded =
        usSignals.failed ||
        krSignals.failed ||
        us === null ||
        kr === null ||
        crypto === null;
    if (degraded) await shortenRevalidateForRuntimeDegrade();
    return {
        fearGreed: { us, kr, crypto },
        signals: { us: usSignals.signals, kr: krSignals.signals },
    };
}

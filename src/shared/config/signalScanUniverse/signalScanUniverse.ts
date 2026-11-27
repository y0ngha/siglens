import { dashboardScopeOf } from '@/shared/config/dashboardScope';
import { compareCodeUnits } from '@/shared/lib/compareCodeUnits';
import { KR_INDEX_UNIVERSE_SNAPSHOT } from './krIndexUniverse.generated';
import { US_SP500_SNAPSHOT } from './usSp500.generated';

/**
 * 신호 이력을 기록하는 시장. `entities/signal-history`의 `SignalHistoryMarket`과 같은 값이다
 * (shared는 entities를 import할 수 없어 여기서 따로 선언하고, 테스트가 둘이 같음을 고정한다).
 */
export type SignalScanMarket = 'us' | 'kr';

export interface SignalScanTarget {
    readonly symbol: string;
    /** 한글 종목명. 미국 종목 대부분은 없어 `null`이다. */
    readonly koreanName: string | null;
}

/**
 * 시장별 스캔 대상 — S&P 500(미국), 코스피 200 + 코스닥 150(한국)에 대시보드 스캐너 종목
 * (`sectorStocks`)을 합친 목록이다. 대시보드 종목을 합치는 이유: 이미 신호 페이지에 올라 있는 종목이
 * 지수에서 빠져도 기록이 끊기지 않게 하려는 것이다. 대시보드 탭의 종목 목록(`sectorStocks`)은 늘리지
 * 않는다 — 이 목록은 기록기 전용이다.
 *
 * 심볼 순으로 정렬하고 중복을 없앤다. `sectorStocks`를 먼저 넣어 같은 심볼이면 손으로 고른 한글명이 이긴다.
 */
export function signalScanTargets(
    market: SignalScanMarket
): readonly SignalScanTarget[] {
    return TARGETS_BY_MARKET[market];
}

function buildTargets(market: SignalScanMarket): readonly SignalScanTarget[] {
    const curated: readonly SignalScanTarget[] = dashboardScopeOf(
        market
    ).sectorStocks.map(stock => ({
        symbol: stock.symbol,
        koreanName: stock.koreanName,
    }));
    const snapshot: readonly SignalScanTarget[] =
        market === 'us'
            ? US_SP500_SNAPSHOT.symbols.map(symbol => ({
                  symbol,
                  koreanName: null,
              }))
            : [
                  ...KR_INDEX_UNIVERSE_SNAPSHOT.kospi200,
                  ...KR_INDEX_UNIVERSE_SNAPSHOT.kosdaq150,
              ].map(entry => ({
                  symbol: entry.symbol,
                  koreanName: entry.koreanName,
              }));
    const bySymbol = new Map<string, SignalScanTarget>();
    [...curated, ...snapshot].forEach(target => {
        if (!bySymbol.has(target.symbol)) bySymbol.set(target.symbol, target);
    });
    return [...bySymbol.values()].sort((a, b) =>
        compareCodeUnits(a.symbol, b.symbol)
    );
}

const TARGETS_BY_MARKET: Readonly<
    Record<SignalScanMarket, readonly SignalScanTarget[]>
> = { us: buildTargets('us'), kr: buildTargets('kr') };

/**
 * 시장별 스캔 대상 수. 지금은 읽는 곳이 없다 — app-3가 신호 페이지 소개 문구의 종목 수를 이 값에서 읽어
 * 문구와 실제 대상이 어긋나지 않게 한다.
 */
export const SIGNAL_SCAN_UNIVERSE_SIZE: Readonly<
    Record<SignalScanMarket, number>
> = { us: TARGETS_BY_MARKET.us.length, kr: TARGETS_BY_MARKET.kr.length };

/** 시장별 스냅샷 기준일(`YYYY-MM-DD`) — 기록기가 오래된 목록을 로그로 알리는 데 쓴다. */
export const SIGNAL_SCAN_UNIVERSE_AS_OF: Readonly<
    Record<SignalScanMarket, string>
> = { us: US_SP500_SNAPSHOT.asOf, kr: KR_INDEX_UNIVERSE_SNAPSHOT.asOf };

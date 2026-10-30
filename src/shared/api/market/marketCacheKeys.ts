import type { GetBarsOptions } from '@y0ngha/siglens-core';

/**
 * 시세 스냅샷 키. `getQuote`(시세)와 일봉의 오늘 봉(`getCachedDailyBars`)이 같은 키를
 * 읽는다 — 둘 다 업스트림 `quote` 한 번에서 나오는데, 예전에는 `quote:<SYM>`과
 * `bars:today:<SYM>` 두 키로 같은 데이터를 두 번 받았다.
 *
 * 이름이 `quote:<SYM>`/`bars:today:<SYM>`과 겹치지 않아야 한다: 옛 키는 각각 `MarketQuote`·
 * `Bar[]` 모양이라, 같은 키를 재사용하면 배포 직후 옛 엔트리를 스냅샷으로 잘못 읽는다.
 * 옛 키는 읽는 코드가 없어 각자의 세션 TTL로 저절로 사라진다.
 */
export function buildQuoteSnapshotKey(symbol: string): string {
    return `quote:snapshot:${symbol.toUpperCase()}`;
}

/**
 * 캐시 키는 결과에 영향을 줄 수 있는 `GetBarsOptions` 필드를 모두 포함한다 —
 * symbol/timeframe/from/before에 더해 limit까지. 현재 FmpMarketProvider는 limit을
 * URL에 쓰지 않지만, 캐시를 거치는 호출부(fetchBarsWithIndicators)는 limit을
 * timeframe별 상수(TIMEFRAME_BARS_LIMIT)로 고정하므로 limit은 timeframe에 종속이다 →
 * 키에 포함해도 캐시 분할이 생기지 않으면서, 향후 옵션이 결과에 영향을 주도록 바뀌어도
 * 키 충돌(서로 다른 요청이 같은 캐시 반환)을 방지한다. `GetBarsOptions`에 결과-영향
 * 필드가 추가되면 이 키도 함께 갱신할 것.
 */
export function buildBarsRawKey(o: GetBarsOptions): string {
    return `bars:raw:${o.symbol.toUpperCase()}:${o.timeframe}:${o.from ?? ''}:${o.before ?? ''}:${o.limit ?? ''}`;
}

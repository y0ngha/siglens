import { MARKET_INDICES } from '@/shared/config/dashboard-tickers';
import type { AssetInfo } from '@/shared/lib/types';

const INDEX_ALIASES: ReadonlyMap<string, AssetInfo> = new Map(
    MARKET_INDICES.map(index => [
        index.symbol,
        {
            symbol: index.symbol,
            name: index.displayName,
            koreanName: index.koreanName,
            fmpSymbol: index.fmpSymbol,
        },
    ])
);

/**
 * 대시보드가 쓰는 미국 지수 심볼(`VIX`·`GSPC`·`DJI`·`IXIC`)을 FMP 지수 심볼(`^VIX` …)로
 * 바로 해석한다. 해당하지 않으면 `null`.
 *
 * `search-symbol`에는 지수 행(`^VIX`)이 US 거래소 행으로 오지 않아 `VIX`를 검색으로
 * 풀면 정확 일치가 없다. 예전에는 그때 첫 US 행(VIXM ETF)으로 폴백해 그 매핑이
 * `asset_translations`에 영구 저장됐고, AI 도구가 VIXM 종가를 "VIX"로 내보냈다
 * (대시보드는 `MARKET_INDICES`로 `^VIX`를 읽어 두 값이 달랐다). 대시보드와 같은 표를
 * 정본으로 써서 두 경로가 같은 종목을 보게 한다.
 *
 * `getAssetInfo`는 이 해석을 `asset_translations` 조회보다 **먼저** 한다 — 이미 잘못
 * 저장된 `VIX→VIXM` 행이 남아 있어도 지수가 이긴다. 결과는 저장하지 않는다(상수 표라
 * 매번 다시 만들어도 비용이 없다).
 */
export function resolveIndexAlias(upperSymbol: string): AssetInfo | null {
    const alias = INDEX_ALIASES.get(upperSymbol);
    return alias === undefined ? null : { ...alias };
}

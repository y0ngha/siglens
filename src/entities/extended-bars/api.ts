import 'server-only';
import type { Bar } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import type { ExtendedBarTimeframe } from '@/shared/api/market/extendedBarsSession';
import { getCachedExtendedBarsProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { getAssetInfoStatic } from '@/entities/ticker/server/getAssetInfoStatic';
import { marketProfileForAssetInfo } from '@/entities/ticker/lib/resolveMarketProfile';
import { extendedBarsFrom } from './lib/extendedBarsRequest';

/**
 * 미국 주식 인트라데이의 프리·애프터마켓 봉(**정규장 밖 봉만**) — **표시 전용**. 결과를 지표·분석·
 * 섹터 스캔·SEO에 섞지 않는다(`extendedBarsDisplayOnly` 가드).
 *
 * 순서가 곧 FMP 대역폭 방어선이다(싼 검사부터):
 * 1. E2E → `null`. FMP·Redis·자산 조회 어느 것도 건드리지 않는다(E2E는 FMP 키가 없다는 전제).
 * 2. `getAssetInfoStatic`으로 자산을 푼다(24h Next 데이터 캐시 — `getBarsAction`이 치르는 비용과
 *    같다). 자산이 없거나 us-equity가 아니면(한국 주식·크립토·지수) **확장 봉용 FMP 호출을 하지 않는다**.
 * 3. 확장 provider(`CachedMarketDataProvider`, 새 키 계통 `bars:intrahist-ext`·`bars:raw-ext`)에 위임.
 *    1Day는 입력 검증(`parseExtendedBarsRequest`)에서 이미 걸렀다.
 *
 * 입력(심볼·타임프레임 형식)과 티어 게이트는 호출부(Server Action)가 이 함수 **앞에서** 끝낸다.
 */
export async function loadExtendedBars(
    ticker: string,
    timeframe: ExtendedBarTimeframe,
    now: Date = new Date()
): Promise<Bar[] | null> {
    if (isE2E()) return null;

    const asset = await getAssetInfoStatic(ticker);
    if (asset === null || marketProfileForAssetInfo(asset) !== 'us-equity') {
        return null;
    }
    // 조회할 FMP 심볼은 서버가 푼 자산이 정한다 — 클라이언트가 보낸 값은 쓰지 않는다(임의 심볼 조회 통로가 된다).
    const providerSymbol = asset.fmpSymbol ?? ticker;
    // 지수(`^SPX`)에는 확장 세션이 없다.
    if (providerSymbol.startsWith('^')) return null;

    const provider = getCachedExtendedBarsProvider();
    if (provider === null) return null;
    return provider.getExtendedBars({
        symbol: providerSymbol,
        timeframe,
        from: extendedBarsFrom(timeframe, now),
    });
}

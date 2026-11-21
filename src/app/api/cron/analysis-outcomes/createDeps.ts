import 'server-only';
import { fetchBarsWithIndicators } from '@y0ngha/siglens-core';
import { DrizzleAnalysisOutcomeRepository } from '@/entities/analysis-outcome/api/analysisOutcomeRepository';
import type { OutcomeLabellerDeps } from '@/entities/analysis-outcome/types';
import { getAssetInfoResilient } from '@/entities/ticker/server/getAssetInfoResilient';
import { marketProfileForAssetInfo } from '@/entities/ticker/lib/resolveMarketProfile';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { tryGetDatabaseClient } from '@/shared/db/client';

/**
 * I/O 구성은 이 호출자에 둔다(EN-1) — 엔티티는 다른 엔티티를 import하지 않으므로 종목 해석(`ticker`)과 시장
 * provider 배선이 여기 있다. DB가 없으면 던진다.
 *
 * 그룹 봉 로드는 분석 경로와 **같은 호출**이다: `getAssetInfoResilient` → 시장 프로필 → 세션 스펙 →
 * `getCachedMarketDataProvider(session)` → `fetchBarsWithIndicators(provider, symbol, timeframe, fmpSymbol)`
 * (`entities/analysis/api.ts`의 `prewarmTechnical`과 같다). 그래서 Redis 캐시 키가 같고 새 키를 만들지 않는다.
 *
 * 종목 해석이 인프라 실패로 degrade했거나 종목을 못 찾으면 **던진다**: degrade 결과의 시장 프로필은 기본값
 * (us-equity)이라 한국 종목에 미국 세션·FMP를 쓰면 빈 봉이 오고, 그 행이 되돌릴 수 없는 `anchor_missing`이 된다.
 * 던지면 라벨러가 그룹 실패로 기록하고 6시간 뒤 다시 시도한다.
 */
export function createAnalysisOutcomesDeps(
    isDeadlineReached: () => boolean
): OutcomeLabellerDeps {
    const client = tryGetDatabaseClient();
    if (client === null) {
        throw new Error('[analysis-outcomes] database unavailable');
    }
    return {
        repo: new DrizzleAnalysisOutcomeRepository(client.db),
        loadGroupBars: async (symbol, timeframe) => {
            const { assetInfo, degraded } = await getAssetInfoResilient(symbol);
            if (assetInfo === null || degraded) {
                throw new Error(
                    `asset info unavailable for ${symbol} (${degraded ? 'degraded' : 'unknown symbol'})`
                );
            }
            const session = sessionSpecFor(
                marketProfileForAssetInfo(assetInfo)
            );
            const { bars } = await fetchBarsWithIndicators(
                getCachedMarketDataProvider(session),
                symbol,
                timeframe,
                assetInfo.fmpSymbol
            );
            return { bars, session };
        },
        now: () => new Date(),
        isDeadlineReached,
    };
}

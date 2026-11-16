import 'server-only';
import { isE2EFakeMode } from '@/shared/api/e2eEnv';
import { getYahooAnalystSummary } from '@/shared/api/yahoo/yahooAnalystSource';
import { buildEstimates } from '../lib/buildAnalystViews';
import type { AnalystEstimatePeriod } from '../model';

/**
 * 펀더멘털 탭 "전망과 목표가" 카드의 실적 추정치 변화(Yahoo `earningsTrend`, 미국·한국). **`staticSymbolCache`
 * 로더 안에서만** 부른다 — 바깥에서 부르면 렌더 중 캐시 밖 I/O가 ISR을 동적으로 뒤집는다.
 *
 * 변경 이력 모듈은 요청하지 않는다(`includeActions: false`) — 이 카드에는 필요 없고 수백 행이다. Yahoo 조회가
 * 실패하면 던진다: 결과가 하루 캐시되므로 일시 장애의 `null`이 굳으면 안 되고, 호출부(`loadOptionalSection`)가
 * 경고만 남기고 그 줄 없이 렌더한다. "추정치가 없음"(ETF·커버리지 없는 소형주)은 정상 `null`이다.
 */
export async function loadAnalystEstimateTrend(
    symbol: string
): Promise<AnalystEstimatePeriod[] | null> {
    // E2E는 네트워크에 나가지 않는다.
    if (isE2EFakeMode()) return null;
    const yahoo = await getYahooAnalystSummary(symbol, {
        includeActions: false,
        includeEstimates: true,
    });
    if (yahoo === null) {
        throw new Error(`Yahoo estimate trend unavailable for ${symbol}`);
    }
    return buildEstimates(yahoo);
}

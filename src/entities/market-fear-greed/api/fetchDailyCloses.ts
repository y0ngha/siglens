import 'server-only';
import type { MarketDailyClose } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { e2eDailyCloses } from '../lib/e2eFearGreedFixture';
import { parseDailyCloseRows, priceSourceFor } from '../lib/parseFmpEodRows';

/**
 * 미국 판독용 한 티커의 일별 종가 — FMP 배당 조정 EOD 엔드포인트(지수 심볼은
 * `light`, `priceSourceFor`). 캐시 계층(`getCachedMarketFearGreed`)이 시리즈마다 호출한다.
 *
 * ETF는 일부러 `light`(미조정 `price`)를 쓰지 않는다: 2026-08-12 `HYG`의 `light` 종가
 * (79.61)가 배당 조정 종가(79.18)와 다른 것을 확인했다. 이 바스켓의 채권 ETF(`HYG`,
 * `LQD`, `TLT`)는 월별 분배금을 내서 미조정 시리즈는 배당락일마다 가짜 하락을 보이고,
 * 그게 `junk_bond`/`safe_haven` 요인이 비교하는 20세션 수익률 스프레드를 왜곡한다.
 * `getBarsStatic`을 타지 않는 이유도 있다: 그 경로는 `calculateIndicators` 전체를 돌려
 * 심볼당 ~500KB를 만드는데 여기는 숫자 하나짜리 시계열 여섯 개면 된다.
 *
 * E2E(`isE2E()`)는 FMP 키 없이 도는 것이 의도된 설계라, 실호출을 두면 이 페이지가 항상
 * "표본 부족"으로만 검증된다. 결정적 fixture로 대체해 게이지·비교·요인 막대까지 렌더시킨다.
 *
 * FMP는 알 수 없는/상장폐지 심볼에 에러가 아니라 `200 []`로 답한다. 이를 조용히 돌려주면
 * 날짜 inner join이 비어 "표본이 부족합니다"로 보이고 로그에는 아무것도 안 남는다
 * (업스트림 장애가 워밍업 메시지로 위장). 그래서 던진다 — `getOrSetCache`는 던지면 쓰지
 * 않고, 페이지의 catch가 정상 200을 렌더한다.
 *
 * @param symbol - FMP 티커 (예: `SPY`, `^VIX`).
 * @param from - 포함하는 ISO `YYYY-MM-DD` 하한.
 * @param to - 포함하는 ISO `YYYY-MM-DD` 상한. `lastPublishedSessionDate` 참고.
 * @returns FMP가 준 순서 그대로의 일별 종가 — `computeMarketFearGreed*`가 정렬한다.
 * @throws FMP 실패, 또는 쓸 수 있는 행이 하나도 없을 때.
 */
export async function fetchDailyCloses(
    symbol: string,
    from: string,
    to: string
): Promise<MarketDailyClose[]> {
    if (isE2E()) return e2eDailyCloses(symbol);

    const { endpoint, field } = priceSourceFor(symbol);
    const rows = await fmpGet<unknown>(endpoint, { symbol, from, to });
    const closes = parseDailyCloseRows(rows, field);

    if (closes.length === 0) {
        throw new Error(
            `[marketFearGreed] no usable closes for ${symbol} (${from}..${to})`
        );
    }

    return closes;
}

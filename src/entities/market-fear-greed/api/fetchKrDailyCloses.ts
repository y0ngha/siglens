import 'server-only';
import type { MarketDailyClose } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { getYahooClient } from '@/shared/api/yahoo/createYahooClient';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { e2eDailyCloses } from '../lib/e2eFearGreedFixture';
import { parseYahooDailyCloses } from '../lib/parseYahooChartRows';

/**
 * 한국 판독용 한 티커의 일별 종가 — yahoo `chart`.
 *
 * **미국 경로(`fetchDailyCloses`)와 대칭이되 소스만 다르다.** FMP 플랜에 KRX가
 * 없어서다. `getBarsStatic`을 타지 않는 이유도 같다: 그 경로는 지표 전체를 계산해
 * 심볼당 ~500KB를 만드는데, 여기 필요한 건 숫자 하나짜리 시계열이다.
 *
 * 날짜는 **KST 달력일**로 변환한다. yahoo가 주는 `Date`는 UTC 인스턴트다. 현재
 * 바스켓(KRX 종가 봉)에서 UTC 날짜와 KST 날짜가 어긋나는 것을 관측한 적은 없고, 이 변환은
 * 방어적이다 — KST 자정 전후 시각에 찍히는 시리즈가 섞여도 날짜 키가 KST로 통일된다.
 * core가 여섯 시리즈를 날짜로 inner join하므로 하루만 어긋나도 표본이 통째로 비는데, 그건
 * "표본 부족"으로만 보이고 원인이 로그에 남지 않는다.
 *
 * E2E는 외부 키·네트워크 없이 도는 것이 의도된 설계다. 미국 경로와 같은 결정적 fixture를
 * 재사용해 게이지·비교·요인 막대까지 실제로 렌더시킨다.
 *
 * @throws 사용 가능한 행이 하나도 없을 때. 조용한 빈 배열은 `getOrSetCache`가
 *   그대로 캐시해 버려, 업스트림 장애가 "표본이 부족합니다" 화면으로 굳는다.
 */
export async function fetchKrDailyCloses(
    symbol: string,
    from: Date,
    to: Date
): Promise<MarketDailyClose[]> {
    if (isE2E()) return e2eDailyCloses(symbol);

    const client = getYahooClient();
    const result = await client.chart(symbol, {
        period1: from,
        period2: to,
        interval: '1d',
    });

    const closes = parseYahooDailyCloses(result?.quotes);

    if (closes.length === 0) {
        throw new Error(
            `[marketFearGreedKr] no usable closes for ${symbol} (${toUtcIsoDate(from)}..${toUtcIsoDate(to)})`
        );
    }

    return closes;
}

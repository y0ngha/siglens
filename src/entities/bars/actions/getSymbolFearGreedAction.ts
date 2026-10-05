'use server';

import { loadBarsData } from '../lib/loadBarsData';
import {
    clientSymbolFearGreed,
    type SymbolFearGreedSeries,
} from '../lib/symbolFearGreed';
import { DEFAULT_TIMEFRAME } from '@/shared/config/market';

/**
 * 종목 공포·탐욕 점수와 최근 history — **서버에서 5년 일봉으로 계산**해 돌려준다.
 *
 * 예전 클라이언트 게이지는 `useBars`가 받은 2년 일봉으로 직접 계산했다. 점수가
 * 5년 기준이 되면서(core 2.10.0) 클라이언트가 같은 값을 내려면 5년 일봉을 받아야
 * 하는데, 그러면 차트·공포탐욕 탭 응답이 2.5배가 된다. 그래서 계산을 서버로 옮기고
 * 결과만 보낸다(history는 최근 2년만).
 *
 * `getBarsAction`과 같은 봉 캐시를 quantize 없이 읽는다. 그래서 장중에는 예전처럼
 * 형성 중인 당일 봉까지 반영한 값이 나온다. FMP 오류 번역도 `loadBarsData`가 한다.
 *
 * 티어 검사가 없는 이유: `getBarsAction`의 검사는 **타임프레임** 제한(분봉 등)이다.
 * 이 액션은 일봉(`DEFAULT_TIMEFRAME`)으로 고정이고 일봉은 모든 티어에 열려 있어
 * 검사할 대상이 없다. 받는 인자도 심볼뿐이라 비회원에게 열린 공포·탐욕 페이지와 같다.
 *
 * 예외를 결과 객체로 바꾸지 않고 던지는 이유: 호출부가 `useSuspenseQuery`라
 * 실패는 위젯의 에러 경계가 받고, React Query 재시도도 throw를 기준으로 돈다.
 * `getBarsAction`과 같은 계약이며, 던지는 메시지는 `loadBarsData`가 번역한 것이다.
 */
export async function getSymbolFearGreedAction(
    symbol: string,
    fmpSymbol?: string
): Promise<SymbolFearGreedSeries> {
    const data = await loadBarsData(symbol, DEFAULT_TIMEFRAME, fmpSymbol);
    return clientSymbolFearGreed(data);
}

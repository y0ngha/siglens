import 'server-only';
import type { CryptoDailyBar } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { e2eCryptoDailyBars } from '../lib/e2eFearGreedFixture';
import { parseCryptoBarRows } from '../lib/parseFmpEodRows';

/**
 * 한 심볼의 일봉(종가 + 거래량) — FMP `historical-price-eod/full`.
 *
 * FMP 코인 `volume`은 호가 통화(USD) 기준 거래대금이라 모든 코인이 같은 단위다.
 * 금(`GCUSD`)도 같은 엔드포인트를 쓰고 호출부가 종가만 꺼낸다.
 *
 * E2E는 FMP 키 없이 돈다. 결정적 fixture로 게이지·비교·요인 막대까지 렌더시킨다.
 *
 * @throws FMP 실패, 또는 쓸 수 있는 행이 하나도 없을 때(`200 []`). 조용한 빈 배열은
 *   날짜 inner join을 통째로 비워 "표본 부족" 화면으로 굳고 로그에는 아무것도 안 남는다.
 */
export async function fetchCryptoDailyBars(
    symbol: string,
    from: string,
    to: string
): Promise<CryptoDailyBar[]> {
    if (isE2E()) return e2eCryptoDailyBars(symbol);

    const rows = await fmpGet<unknown>('historical-price-eod/full', {
        symbol,
        from,
        to,
    });
    const bars = parseCryptoBarRows(rows);

    if (bars.length === 0) {
        throw new Error(
            `[marketFearGreedCrypto] no usable bars for ${symbol} (${from}..${to})`
        );
    }

    return bars;
}

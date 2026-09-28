import type { CryptoDailyBar } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { MS_PER_DAY } from '@/shared/config/time';
import { e2eCryptoDailyBars } from './e2eFearGreedFixture';
import { MARKET_FEAR_GREED_CRYPTO_LOOKBACK_DAYS } from './marketFearGreedCryptoSymbols';

/** One row of FMP `/stable/historical-price-eod/full`. */
interface FmpEodFullRow {
    date?: unknown;
    close?: unknown;
    volume?: unknown;
}

function isoDate(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
}

/** 조회 창의 하한. 캐시 계층이 한 번 계산해 21개 시리즈 전부에 같은 값을 넘긴다. */
export function cryptoLookbackStartDate(now: Date): string {
    return isoDate(
        now.getTime() - MARKET_FEAR_GREED_CRYPTO_LOOKBACK_DAYS * MS_PER_DAY
    );
}

/**
 * 조회 창의 상한 — 마지막으로 **완전히 닫힌** UTC 일(어제, UTC).
 *
 * FMP는 진행 중인 날에도 그날 날짜의 행을 주고 `close`에 실시간 시세를 넣는다. 오늘을
 * 포함하면 지수가 하루 종일 흔들리면서 화면에는 "종가 기준"이라고 적힌다 — 미국판이
 * `lastClosedSessionDate`로 막은 것과 같은 결함이다. 코인은 24시간 거래라 세션 달력
 * 대신 UTC 자정이 마감이다.
 */
export function lastClosedUtcDate(now: Date): string {
    return isoDate(now.getTime() - MS_PER_DAY);
}

/**
 * 한 심볼의 일봉(종가 + 거래량) — FMP `historical-price-eod/full`.
 *
 * FMP 코인 `volume`은 호가 통화(USD) 기준 거래대금이라 모든 코인이 같은 단위다.
 * 금(`GCUSD`)도 같은 엔드포인트를 쓰고 호출부가 종가만 꺼낸다.
 *
 * 종가가 양의 유한수가 아닌 행은 버린다. 거래량이 숫자가 아니면 0으로 둔다 — 거래량은
 * 합의 비율로만 쓰여 한 행의 0은 그날 가중치만 줄일 뿐 요인을 오염시키지 않는다.
 *
 * @throws FMP 실패, 또는 쓸 수 있는 행이 하나도 없을 때(`200 []`). 조용한 빈 배열은
 *   날짜 inner join을 통째로 비워 "표본 부족" 화면으로 굳고 로그에는 아무것도 안 남는다.
 */
export async function fetchCryptoDailyBars(
    symbol: string,
    from: string,
    to: string
): Promise<CryptoDailyBar[]> {
    // E2E는 FMP 키 없이 돈다. 결정적 fixture로 게이지·비교·요인 막대까지 렌더시킨다.
    if (isE2E()) return e2eCryptoDailyBars(symbol);

    const rows = await fmpGet<FmpEodFullRow[]>('historical-price-eod/full', {
        symbol,
        from,
        to,
    });

    const bars = Array.isArray(rows)
        ? rows.flatMap(row =>
              typeof row.date === 'string' &&
              typeof row.close === 'number' &&
              Number.isFinite(row.close) &&
              row.close > 0
                  ? [
                        {
                            date: row.date,
                            close: row.close,
                            volume:
                                typeof row.volume === 'number' &&
                                Number.isFinite(row.volume) &&
                                row.volume > 0
                                    ? row.volume
                                    : 0,
                        },
                    ]
                  : []
          )
        : [];

    if (bars.length === 0) {
        throw new Error(
            `[marketFearGreedCrypto] no usable bars for ${symbol} (${from}..${to})`
        );
    }

    return bars;
}

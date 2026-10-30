import type { CryptoDailyBar, MarketDailyClose } from '@y0ngha/siglens-core';

/** FMP가 종가를 싣는 엔드포인트와 행 필드. 심볼 종류로 정해진다(`priceSourceFor`). */
export interface FmpPriceSource {
    endpoint:
        | 'historical-price-eod/light'
        | 'historical-price-eod/dividend-adjusted';
    field: 'price' | 'adjClose';
}

function isPositiveFinite(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** FMP EOD 응답의 한 행. 외부 응답이라 모든 필드를 `unknown`으로 받는다. */
type FmpEodRow = Partial<
    Record<'date' | 'adjClose' | 'price' | 'close' | 'volume', unknown>
>;

/**
 * `symbol`의 종가를 어느 FMP 엔드포인트·필드에서 읽는지.
 *
 * ETF는 배당 조정 종가를 읽는다(`fetchDailyCloses` 참고). 지수 심볼(`^VIX`)은 분배금이
 * 없어 조정할 게 없고, FMP가 지수의 `dividend-adjusted` 조회를 유료 플랜 뒤에 두기 때문에
 * 못 읽는다 — 2026-09-11 `^VIX`가 거기서 `402 Premium Query Parameter`를 내고 `light`는
 * 전체 이력을 주는 것을 확인했다. `^VIX`를 조정가 엔드포인트로 보내면 던져서 미국 지수
 * 전체가 죽는다.
 */
export function priceSourceFor(symbol: string): FmpPriceSource {
    return symbol.startsWith('^')
        ? { endpoint: 'historical-price-eod/light', field: 'price' }
        : {
              endpoint: 'historical-price-eod/dividend-adjusted',
              field: 'adjClose',
          };
}

/**
 * FMP EOD 응답에서 쓸 수 있는 일별 종가만 추린다.
 *
 * 문자열 날짜와 양의 유한 숫자 종가가 없는 행은 하류가 아니라 여기서 버려, 일부가 깨진
 * 응답이 요인을 오염시키지 않고 세션 수만 줄이게 한다. 검사를 `Number(...)` 변환이 아니라
 * `typeof`로 하는 이유: `Number(null)`은 유한한 `0`이라 명시적 `"adjClose": null`이
 * 종가 0으로 통과한다. 배열이 아닌 응답은 빈 배열이고, `null` 원소는 속성 접근에서 던진다 —
 * 호출부(fetch)가 reject해 캐시에 쓰지 않고 페이지는 빈 상태를 렌더한다.
 */
export function parseDailyCloseRows(
    rows: unknown,
    field: FmpPriceSource['field']
): MarketDailyClose[] {
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((row: FmpEodRow) => {
        const close = row[field];
        return typeof row.date === 'string' && isPositiveFinite(close)
            ? [{ date: row.date, close }]
            : [];
    });
}

/**
 * FMP `historical-price-eod/full` 응답에서 쓸 수 있는 크립토 일봉만 추린다.
 *
 * 종가가 양의 유한수가 아닌 행은 버린다. 거래량이 양의 유한수가 아니면 0으로 둔다 —
 * 거래량은 합의 비율로만 쓰여 한 행의 0은 그날 가중치만 줄일 뿐 요인을 오염시키지 않는다.
 * 배열이 아닌 응답은 빈 배열이다.
 */
export function parseCryptoBarRows(rows: unknown): CryptoDailyBar[] {
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((row: FmpEodRow) => {
        return typeof row.date === 'string' && isPositiveFinite(row.close)
            ? [
                  {
                      date: row.date,
                      close: row.close,
                      volume: isPositiveFinite(row.volume) ? row.volume : 0,
                  },
              ]
            : [];
    });
}

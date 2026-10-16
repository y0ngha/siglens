/**
 * Reg SHO 과열 목록 수집 상태(`investor_flows_state.reg_sho_cursor`, JSON 한 덩어리).
 *
 *  - `lastByMarket`: 시장별로 끝까지 처리한(받았거나 휴장일로 넘긴) 마지막 거래일. 시장마다 게시 시각이 달라 따로 둔다.
 *  - `ingestedDates`: 어느 시장이든 목록을 **받은** 거래일. 저장소에는 유니버스 종목의 등재 행만 있어서, 유니버스 종목이 하나도
 *    없던 날은 행으로는 알 수 없다 — 등재 연속 일수(`summarizeThresholdListings`)의 분모를 여기서 읽는다. 보존 기간 밖 날짜는 버린다.
 */
export interface RegShoCursor {
    lastByMarket: Readonly<Record<string, string>>;
    ingestedDates: readonly string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const EMPTY_REG_SHO_CURSOR: RegShoCursor = {
    lastByMarket: {},
    ingestedDates: [],
};

/** 저장 문자열 → 상태. 비었거나 깨졌으면 빈 상태(처음부터 백필) — 깨진 값으로 수집이 멈추지 않게 한다. */
export function parseRegShoCursor(raw: string | null): RegShoCursor {
    if (raw === null) return EMPTY_REG_SHO_CURSOR;
    try {
        const value: unknown = JSON.parse(raw);
        if (typeof value !== 'object' || value === null) {
            return EMPTY_REG_SHO_CURSOR;
        }
        const { lastByMarket, ingestedDates } = value as {
            lastByMarket?: unknown;
            ingestedDates?: unknown;
        };
        const markets =
            typeof lastByMarket === 'object' && lastByMarket !== null
                ? Object.fromEntries(
                      Object.entries(lastByMarket).filter(
                          (entry): entry is [string, string] =>
                              typeof entry[1] === 'string' &&
                              ISO_DATE.test(entry[1])
                      )
                  )
                : {};
        const dates = Array.isArray(ingestedDates)
            ? ingestedDates.filter(
                  (d): d is string => typeof d === 'string' && ISO_DATE.test(d)
              )
            : [];
        return { lastByMarket: markets, ingestedDates: dates };
    } catch {
        return EMPTY_REG_SHO_CURSOR;
    }
}

/** 상태 → 저장 문자열. 받은 날짜는 중복을 지우고 정렬하며 `keepFrom`보다 이른 날짜는 버린다. */
export function serializeRegShoCursor(
    cursor: RegShoCursor,
    keepFrom: string
): string {
    return JSON.stringify({
        lastByMarket: cursor.lastByMarket,
        ingestedDates: [...new Set(cursor.ingestedDates)]
            .filter(date => date >= keepFrom)
            .sort(),
    });
}

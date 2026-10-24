import 'server-only';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { toFiniteNumber } from '@/shared/api/fmp/toFiniteNumber';
import { sym } from '@/shared/api/fmp/symKey';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { FMP_FUNDAMENTAL_CACHE_TTL_SECONDS } from '@/shared/config/time';

/** FMP `/stable/dividends` 한 행 중 에이전트가 쓰는 필드만 추린 형태. */
export interface FmpDividendRow {
    /** 배당락일(ex-dividend date, `YYYY-MM-DD`). */
    exDate: string;
    /** 지급일(`YYYY-MM-DD`). 미정이면 null. */
    payDate: string | null;
    /** 주당 현금배당(상장 통화 기준). */
    amount: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDateOrNull(value: unknown): string | null {
    return typeof value === 'string' && ISO_DATE.test(value) ? value : null;
}

/** 와이어 한 행을 정규화한다. 배당락일이나 금액이 깨졌으면 null. */
function toRow(item: unknown): FmpDividendRow | null {
    if (typeof item !== 'object' || item === null) return null;
    // 객체임을 위에서 확인했고 모든 필드를 unknown으로 읽어 아래 검사기가 값을 직접 검증한다.
    const wire = item as Record<string, unknown>;
    const exDate = isoDateOrNull(wire.date);
    const amount = toFiniteNumber(wire.dividend);
    return exDate === null || amount === null
        ? null
        : { exDate, payDate: isoDateOrNull(wire.paymentDate), amount };
}

/**
 * 와이어 행을 정규화한다 — 배당락일이나 금액이 깨진 행은 버리고, 최신 배당락일 순으로 정렬한다.
 * `dividend`(원 금액)를 쓴다: `adjDividend`는 분할 소급 조정값이라 당시 실제 지급액과 다르다.
 *
 * **진짜 빈 배열만 "배당 이력 없음"이다.** 배열이 아닌 본문(200으로 오는 `{"Error Message": …}` 등)이나
 * 행이 있는데 전부 깨진 응답은 throw한다 — 그래야 `getOrSetCache`가 쓰기를 건너뛰고 호출부가 "무배당"이
 * 아니라 "모름"으로 degrade한다(무배당 `0`을 하루 동안 캐시하는 오답 방지).
 */
export function normalizeDividendRows(raw: unknown): FmpDividendRow[] {
    if (!Array.isArray(raw))
        throw new Error('FMP dividends: response is not an array');
    // `Array.isArray`가 `any[]`로 좁히므로 `unknown[]`로 받아 항목을 `toRow`가 직접 검사한다.
    const items: unknown[] = raw;
    const rows = items
        .map(toRow)
        .filter((row): row is FmpDividendRow => row !== null);
    if (items.length > 0 && rows.length === 0)
        throw new Error('FMP dividends: every row is malformed');
    return rows.toSorted((a, b) => b.exDate.localeCompare(a.exDate));
}

/**
 * 심볼의 배당 이력(최신 배당락일 순). `[]`은 "배당 이력 없음"(정상), throw는 FMP 장애다 —
 * 호출부가 둘을 구분해야 하므로 에러를 삼키지 않고, 장애 결과는 캐시되지 않는다.
 *
 * 키 `dividends:<SYM>` — 24h TTL. 배당은 분기·반기 단위로 공시되므로 하루 지연은 무해하다.
 * 트레일링 합계·수익률처럼 날짜·가격에 의존하는 값은 캐시하지 않고 읽는 쪽에서 계산한다.
 */
export function getFmpDividendHistory(
    symbol: string
): Promise<FmpDividendRow[]> {
    const upper = sym(symbol);
    return getOrSetCache(
        `dividends:${upper}`,
        FMP_FUNDAMENTAL_CACHE_TTL_SECONDS,
        async () =>
            normalizeDividendRows(
                await fmpGet<unknown>('dividends', { symbol: upper })
            )
    );
}

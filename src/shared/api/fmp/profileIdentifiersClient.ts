import { fmpGet } from './httpClient';

/** FMP `profile`에서 증권 식별자 수집에 필요한 필드만. */
export interface FmpProfileIdentifiers {
    cusip: string | null;
    isin: string | null;
    isEtf: boolean;
    isFund: boolean;
}

interface RawProfileIdentifiers {
    cusip?: string | null;
    isin?: string | null;
    isEtf?: boolean | null;
    isFund?: boolean | null;
}

/**
 * 심볼의 CUSIP·ISIN과 ETF/펀드 여부. 프로필이 없으면(빈 배열) `null`. FMP 장애는 그대로 던진다 —
 * 호출부가 "프로필 없음"(영구 miss 후보)과 "장애"(다음 실행에 재시도)를 구분해야 하기 때문이다.
 */
export async function fetchFmpProfileIdentifiers(
    symbol: string
): Promise<FmpProfileIdentifiers | null> {
    const raw = await fmpGet<RawProfileIdentifiers[]>('profile', { symbol });
    const row = Array.isArray(raw) ? raw[0] : undefined;
    if (row === undefined) return null;
    return {
        cusip: row.cusip ?? null,
        isin: row.isin ?? null,
        isEtf: row.isEtf === true,
        isFund: row.isFund === true,
    };
}

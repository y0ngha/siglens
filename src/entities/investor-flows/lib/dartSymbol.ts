import { KR_EXCHANGE_SUFFIX_RE, KR_SYMBOL_RE } from '@/shared/config/ticker';
import type { DartCorpMatch } from '../model';

/**
 * siglens 한국 심볼 ↔ DART 고유번호 매핑(설계 §4.3, 순수).
 *
 * - 심볼 `005930.KS`/`0001A0.KQ` → 거래소 접미사를 뗀 단축코드 → `dart_corp_code.stock_code`.
 * - **우선주는 corpCode에 없다**(대표 종목코드만 실린다). KRX 단축코드는 같은 발행사의 종목이 앞 5자리를 공유하고 보통주가
 *   끝자리 `0`이다 — 1·2·3우선주는 `5`·`7`·`9`(`005935` 삼성전자우 → `005930`, `005387` 현대차2우B → `005380`), 신형
 *   우선주는 영문(`00088K` 한화3우B → `000880`). 그래서 **끝자리를 `0`으로 바꾼 코드**를 두 번째 후보로 보고, 그 코드가
 *   `dart_corp_code`에 **있을 때만** 매핑한다(추측으로 다른 회사에 붙지 않게).
 * - 끝자리가 이미 `0`인 코드(보통주·영문 신규 코드 `0001A0`)는 자기 자신만 후보다. 둘 다 없으면(ETF·ETN·리츠 일부 등
 *   corpCode에 종목코드가 없는 종목) 매핑하지 않는다 — 화면은 DART 섹션을 "데이터 없음"으로 둔다.
 */

const COMMON_SHARE_LAST_CHAR = '0';

/** `005930.KS` → `005930`. 한국 심볼 형상이 아니면 null. */
export function krSymbolToStockCode(symbol: string): string | null {
    const upper = symbol.trim().toUpperCase();
    return KR_SYMBOL_RE.test(upper)
        ? upper.replace(KR_EXCHANGE_SUFFIX_RE, '')
        : null;
}

/** 찾아볼 종목코드 후보 — 자기 자신, 그리고 끝자리가 `0`이 아니면 끝자리를 `0`으로 바꾼 보통주 코드. */
export function commonShareCandidates(stockCode: string): string[] {
    const code = stockCode.toUpperCase();
    return code.endsWith(COMMON_SHARE_LAST_CHAR)
        ? [code]
        : [code, `${code.slice(0, -1)}${COMMON_SHARE_LAST_CHAR}`];
}

/** 단축코드 → 고유번호. `corpByStock`(= `dart_corp_code`)에 있는 첫 후보로 정한다. 없으면 null. */
export function resolveDartCorp(
    stockCode: string,
    corpByStock: ReadonlyMap<string, string>
): DartCorpMatch | null {
    const candidates = commonShareCandidates(stockCode);
    const matched = candidates.find(candidate => corpByStock.has(candidate));
    const corpCode =
        matched === undefined ? undefined : corpByStock.get(matched);
    if (matched === undefined || corpCode === undefined) return null;
    return {
        corpCode,
        matchedStockCode: matched,
        viaCommonShare: matched !== candidates[0],
    };
}

/** 한국 유니버스 — DART를 조회할 회사와, 회사별 siglens 심볼(캐시 무효화용). */
export interface KrDartUniverse {
    /** 고유번호 오름차순(백필 커서가 이 순서로 나아간다). */
    corpCodes: string[];
    symbolsByCorp: ReadonlyMap<string, readonly string[]>;
    /** 고유번호를 찾지 못한 심볼. */
    unmappedSymbols: string[];
}

/** 상장 한국 심볼 목록과 `dart_corp_code` 맵으로 유니버스를 만든다. 한 회사의 보통주·우선주는 한 고유번호로 모인다. */
export function buildKrDartUniverse(
    symbols: readonly string[],
    corpByStock: ReadonlyMap<string, string>
): KrDartUniverse {
    const resolved = symbols.map(symbol => {
        const stockCode = krSymbolToStockCode(symbol);
        return {
            symbol,
            corpCode:
                stockCode === null
                    ? null
                    : (resolveDartCorp(stockCode, corpByStock)?.corpCode ??
                      null),
        };
    });
    const symbolsByCorp = resolved.reduce((byCorp, { symbol, corpCode }) => {
        if (corpCode === null) return byCorp;
        return byCorp.set(corpCode, [...(byCorp.get(corpCode) ?? []), symbol]);
    }, new Map<string, string[]>());
    return {
        corpCodes: [...symbolsByCorp.keys()].toSorted(),
        symbolsByCorp,
        unmappedSymbols: resolved
            .filter(entry => entry.corpCode === null)
            .map(entry => entry.symbol),
    };
}

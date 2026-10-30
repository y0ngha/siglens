import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import type { TickerSearchResult } from '@/shared/lib/types';

/**
 * 구두점과 연속 공백만 지운다.
 *
 * 법인격 접미사(`Co`/`Ltd`/`Inc`)까지 지우는 안을 검토했다가 뺐다 — 실측한 유일한
 * 쌍(`SSNLF` vs `005930.KS`)은 FMP와 yahoo가 **같은** 표기(`Samsung Electronics
 * Co., Ltd.`)를 주고, 구두점만 지우면 이미 일치한다. 접미사까지 지우면 매칭만
 * 느슨해져 서로 다른 회사를 묶을 위험이 생기는데, 그걸 정당화할 실제 사례가 없다.
 */
function normalizedEnglishName(r: TickerSearchResult): string {
    return (r.name ?? '')
        .toLowerCase()
        .replace(/[.,]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const isKrx = (r: TickerSearchResult): boolean => isKrEquitySymbol(r.symbol);

const isOtc = (r: TickerSearchResult): boolean =>
    (r.exchangeFullName ?? '').toLowerCase().includes('otc');

const koreanNameOf = (r: TickerSearchResult): string =>
    (r.koreanName ?? '').trim().toLowerCase();

/**
 * 같은 회사의 KRX 상장을 그 회사의 미국 장외(OTC) 중복 **바로 앞**에 놓는다.
 *
 * `삼성전자`는 `005930.KS`(KOSPI 주 상장, 원화)와 `SSNLF`(Other OTC, 비후원, 거래
 * 희박) 둘 다로 잡힌다. 둘 다 보여주되 — 의도적으로 OTC를 찾는 사용자를 막지
 * 않는다 — 기본값은 주 상장이어야 한다.
 *
 * **목록 끝으로 미는 게 아니라 짝 옆에 붙이는 이유**: 호출부가 곧바로
 * `slice(0, MAX_SEARCH_RESULTS)`한다. `삼성`처럼 같은 접두를 가진 종목이 많은 질의는
 * 결과가 10개를 쉽게 넘으므로, 끝으로 밀면 강등이 아니라 **삭제**가 된다(영문 경로는
 * 그 결과를 캐시에 써서 TTL 동안 고정시킨다). 짝을 붙여 두면 컷이 둘을 함께 자른다.
 *
 * 매칭 키는 한글명 **또는** 영문명이다. 한글명만 보면 영문 질의 경로에서 조용히
 * 아무 일도 일어나지 않는다 — 그 경로의 KRX 행에는 한글명이 안 붙어 있을 수 있다.
 * 영문명 비교는 구두점·연속 공백만 지우고 한다(법인격 접미사는 일부러 남긴다 —
 * 이유는 `normalizedEnglishName` 주석 참고).
 *
 * 같은 회사의 KRX 상장이 목록에 있는 OTC 항목만 대상이다. 무조건 OTC를 내리면 OTC만
 * 있는 종목의 순위가 이유 없이 떨어진다.
 */
export function preferPrimaryListing(
    results: TickerSearchResult[]
): TickerSearchResult[] {
    const krxRows = results.filter(isKrx);
    if (krxRows.length === 0) return results;

    const matchingKrx = (
        otc: TickerSearchResult
    ): TickerSearchResult | undefined => {
        const ko = koreanNameOf(otc);
        const en = normalizedEnglishName(otc);
        return krxRows.find(
            krx =>
                (ko.length > 0 && koreanNameOf(krx) === ko) ||
                (en.length > 0 && normalizedEnglishName(krx) === en)
        );
    };

    const pairs = results.flatMap(row => {
        if (isKrx(row) || !isOtc(row)) return [];
        const krx = matchingKrx(row);
        return krx ? [{ otc: row, krxSymbol: krx.symbol }] : [];
    });
    if (pairs.length === 0) return results;

    const demoted = new Set(pairs.map(p => p.otc));
    return results.flatMap(row =>
        demoted.has(row)
            ? []
            : [
                  row,
                  ...pairs
                      .filter(p => p.krxSymbol === row.symbol)
                      .map(p => p.otc),
              ]
    );
}

import type { MarketQuote } from '@y0ngha/siglens-core';

/**
 * 한국 상장 종목의 표시명을 yahoo quote로 조회한다. `fetchCryptoQuoteName`의 대응물.
 *
 * **`null`은 "그런 종목이 없다"는 뜻**이라 심볼 폴백을 하지 않는다 —
 * `fetchCryptoQuoteName`은 멤버십을 이미 DB로 확인한 뒤라 이름만 못 찾은 상황이지만,
 * 여기서는 형상 정규식만 통과한 상태(`005930.KS`는 형상일 뿐 실재 보장이 아니다)라
 * quote 부재가 곧 미상장이다. 심볼로 폴백하면 `999999.KS` 같은 가짜 티커가 404 대신
 * 빈 종목 페이지로 렌더된다(실측: yahoo가 미상장 심볼에 `undefined`를 반환).
 *
 * 네트워크 실패도 `null`로 수렴한다. 상위 `getAssetInfoResilient`가 throw를 degrade
 * 경로로 처리하는 것과 달리 여기서는 구분이 불가능하지만, 실패 시 캐시에 쓰이지 않으므로
 * 다음 요청에서 자연히 회복된다.
 *
 * **동적 import를 쓰는 이유**: `YahooMarketProvider`는 `server-only`이고
 * `yahoo-finance2`는 `child_process`/`dns` 같은 Node 전용 모듈을 요구한다(옵션체인이
 * barrel에서 제외된 것과 같은 이유 — `entities/CLAUDE.md` 참조). 이 함수를 호출하는
 * `getAssetInfo`는 `getAssetInfoStatic` → `getAssetInfoResilient`를 거쳐 ticker barrel에
 * 노출되고, 그 barrel은 클라이언트 컴포넌트(`TickerAutocomplete` 등)가 import한다.
 * 정적 import였다면 그 체인을 타고 yahoo가 클라이언트 번들에 끌려간다.
 *
 * 반환되는 이름은 yahoo 기준이라 영문이다("Samsung Electronics Co., Ltd."). 한글명은
 * 호출부가 기존 `translateCompanyNames` 경로로 별도 채운다 — 미국 종목과 동일한 흐름이다.
 */
export async function fetchKrEquityQuoteName(
    symbol: string
): Promise<string | null> {
    try {
        const quote = await getYahooQuote(symbol);
        return quote?.name ?? null;
    } catch (e) {
        console.warn('[krEquityQuoteName] fetchKrEquityQuoteName failed', e);
        return null;
    }
}

let providerPromise: Promise<{
    getQuote(symbol: string): Promise<MarketQuote | null>;
}> | null = null;

/** provider 인스턴스를 모듈 레벨에서 1회만 만든다(호출마다 동적 import + new 방지). */
function getYahooQuote(symbol: string): Promise<MarketQuote | null> {
    providerPromise ??= import('@/shared/api/yahoo/YahooMarketProvider').then(
        m => new m.YahooMarketProvider()
    );
    return providerPromise.then(p => p.getQuote(symbol));
}

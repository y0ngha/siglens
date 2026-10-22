import { isE2E } from '@/shared/api/e2eEnv';
import { loadYahooProvider } from '@/shared/api/yahoo/lazyYahooProvider';
import { CURATED_KOREAN_NAMES } from '@/shared/config/popular-tickers';
import { QUOTE_MAX_AGE_MS } from '@/shared/config/quoteFreshness';

/**
 * 한국 상장 종목의 표시명을 yahoo quote로 조회한다. `fetchCryptoQuoteName`의 대응물.
 *
 * **`null`은 "그런 종목이 없다"는 뜻**이라 심볼 폴백을 하지 않는다 —
 * `fetchCryptoQuoteName`은 멤버십을 이미 DB로 확인한 뒤라 이름만 못 찾은 상황이지만,
 * 여기서는 형상 정규식만 통과한 상태(`005930.KS`는 형상일 뿐 실재 보장이 아니다)라
 * quote 부재가 곧 미상장이다. 심볼로 폴백하면 `999999.KS` 같은 가짜 티커가 404 대신
 * 빈 종목 페이지로 렌더된다(실측: yahoo가 미상장 심볼에 `undefined`를 반환).
 *
 * **인프라 실패는 삼키지 않고 그대로 던진다.** 삼키면 `null`이 "미상장"과 "yahoo가 지금
 * 안 된다"를 동시에 뜻하게 되고, 호출부는 전자로 읽어 실재하는 종목에 하드 404를 낸다.
 * 미국 경로가 `throwOnInfraFailure: true`로 그 둘을 가르는 것과 같은 이유다 — 던지면
 * `getAssetInfoResilient`가 잡아 degrade 200 + noindex로 떨어뜨린다.
 *
 * **동적 import를 쓰는 이유**: `YahooMarketProvider`는 `server-only`이고
 * `yahoo-finance2`는 `child_process`/`dns` 같은 Node 전용 모듈을 요구한다. 이 함수를
 * 호출하는 `getAssetInfo`는 `getAssetInfoStatic` → `getAssetInfoResilient` 체인에 있고,
 * 그 체인이 클라이언트 번들 그래프에 닿으면 정적 import가 yahoo를 클라이언트 번들로
 * 끌고 간다.
 *
 * 반환되는 이름은 yahoo 기준이라 영문이다("Samsung Electronics Co., Ltd."). 한글명은
 * 호출부가 기존 `translateCompanyNames` 경로로 별도 채운다 — 미국 종목과 동일한 흐름이다.
 */
export async function fetchKrEquityQuoteName(
    symbol: string
): Promise<string | null> {
    // E2E는 외부 네트워크를 타지 않는다(다른 provider는 전부 FakeMarketProvider로 가고
    // 여기만 yahoo에 직접 붙어 있었다). 큐레이션 카탈로그를 실재 여부의 근거로 삼으면
    // "시드된 종목은 렌더, 형상만 맞는 가짜 티커는 404"라는 실제 계약이 그대로 재현된다.
    if (isE2E()) {
        return CURATED_KOREAN_NAMES.get(symbol.toUpperCase()) ?? null;
    }

    // try/catch를 두지 않는다 — 위 doc-comment의 "인프라 실패는 던진다" 계약.
    const listing = await loadYahooProvider().then(p =>
        p.getListingOrThrow(symbol)
    );
    if (listing === null || isDeadFundListing(listing, Date.now())) return null;
    return listing.name;
}

/**
 * 거래가 멈춘 펀드 리스팅이면 "그런 종목이 없다"로 본다 — 같은 코드의 다른 시장 접미사에 남은 죽은
 * 리스팅이다. 실측(2026-10-22): `253450.KS`는 2024-07-19에 멈춘 `MUTUALFUND`이고 실제 종목은
 * `253450.KQ`다(다시 보려면 yahoo `quote('253450.KS')`의 `quoteType`·`regularMarketTime`). 이 함수가 이름을
 * 주면 `getAssetInfo`가 그 리스팅을 종목으로 굳힌다.
 *
 * **두 조건을 함께 본다.** `quoteType`만 보면 yahoo가 펀드로 분류한 살아 있는 상품까지 404가 되고,
 * 나이만 보면 장기 거래정지 종목이 첫 방문에 404가 된다. 둘이 겹치는 경우만 죽은 리스팅이다.
 * 문턱은 에이전트 도구와 같은 {@link QUOTE_MAX_AGE_MS}(14일, KRX 연휴 클러스터는 약 8일)를 공유한다 —
 * 도구가 시세를 `stale_listing`으로 거부하는 리스팅과 여기서 미상장으로 보는 리스팅의 경계가 같아야 한다.
 */
function isDeadFundListing(
    listing: { quoteType: string | null; lastTradeMs: number | null },
    nowMs: number
): boolean {
    return (
        listing.quoteType === 'MUTUALFUND' &&
        listing.lastTradeMs !== null &&
        nowMs - listing.lastTradeMs > QUOTE_MAX_AGE_MS
    );
}

import { VALID_TICKER_RE } from '@/shared/config/market';
import { isKrEquitySymbol } from '@/shared/config/marketProfile';

/**
 * Returns `true` when a ticker cannot be resolved because both FMP and the
 * crypto_assets DB are simultaneously degraded AND the symbol does not match
 * the conventional U.S. ticker shape (`VALID_TICKER_RE`).
 *
 * **Why this guard exists**
 * - All `[symbol]` route pages call `getAssetInfoResilient` (or an equivalent
 *   resilient resolver) which returns `{ degraded: true }` when FMP is down.
 * - For symbols that *start with a digit* (e.g. `1INCHUSD`), the U.S.-ticker
 *   regex never matches. If both data sources are unavailable there is no way
 *   to confirm the symbol exists, so returning a 404 is more honest than
 *   serving a degraded 200 (noindex) for an unresolvable URL.
 * - Symbols that DO match `VALID_TICKER_RE` (e.g. `AAPL`) represent real U.S.
 *   equities that are only *transiently* unresolvable; the existing
 *   degrade-200 + noindex behaviour is correct for them and must be preserved.
 *
 * **Usage** — 상태 코드를 좌우하는 호출은 `src/app/[symbol]/layout.tsx` 최상단이다
 * (Suspense 경계보다 위라 진짜 404가 나가는 유일한 지점). 9개 자식 page.tsx에도 같은
 * 가드가 남아 있는데, 그건 `generateMetadata`와 짝을 이루고 레이아웃 없이 페이지
 * 컴포넌트만 렌더하는 단위 테스트 경로를 지키기 위한 것이다 — **지우지 말 것**.
 * ```ts
 * const { assetInfo, degraded } = await getAssetInfoResilient(ticker);
 * if (isUnresolvableDegraded(ticker, degraded)) notFound();
 * ```
 *
 * ⚠️ **2026-07-26 이후 이 판정의 실제 무게가 달라졌다.** 그 전까지 여기서 나온
 * `notFound()`는 Suspense 경계 안이라 HTTP **200**(soft 404)으로 새어 나갔다 —
 * 사용자에겐 404 화면이 보이지만 상태 코드는 200. 판정을 레이아웃으로 올린 뒤로는
 * **진짜 404**가 나간다. 즉 위 "404가 더 정직하다"는 설계 의도가 이제서야 실제로
 * 집행된다(그 전엔 사실상 무해한 장식이었다).
 *
 * 실질적 영향: crypto_assets와 FMP가 **동시에** 죽은 동안 `1INCHUSD` 같은 숫자 시작
 * 크립토가 하드 404를 받는다. 이 404가 캐시에 굳지는 않는다 — cache-handler가
 * `status >= 400` 엔트리 저장을 건너뛰므로(cache-handler/index.mjs) 장애가 풀리는 즉시
 * 다음 요청부터 정상 렌더된다. 반대로 `VALID_TICKER_RE`를 통과하는 미국 종목은 종전대로
 * degrade 200 + noindex를 유지하므로, 색인된 페이지가 장애 중 대량 404가 되는 일은 없다.
 */
export function isUnresolvableDegraded(
    ticker: string,
    degraded: boolean
): boolean {
    if (!degraded) return false;
    // 국내 상장 종목은 미국 티커와 같은 쪽에 세운다. `KR_SYMBOL_RE`는 **닫힌 형상**
    // (6자리 숫자 + 알려진 거래소 접미사)이라, 이 형상을 통과한 심볼은 크립토처럼
    // "존재를 확인할 방법이 없는" 후보가 아니다 — sitemap에 실린 20종목은 확실히 실재한다.
    // 이 분기가 없으면 KR 심볼이 숫자로 시작한다는 이유만으로 `VALID_TICKER_RE`에서
    // 떨어져, yahoo 일시 장애 중 색인된 국내 종목 페이지가 전부 하드 404가 된다.
    if (isKrEquitySymbol(ticker)) return false;
    return !VALID_TICKER_RE.test(ticker);
}

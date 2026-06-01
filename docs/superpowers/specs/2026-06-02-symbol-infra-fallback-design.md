# [symbol] 인프라 실패 graceful fallback — 설계

- 날짜: 2026-06-02
- 상태: 설계 승인됨, 구현 대기
- 관련: PR #543(b3c220dc, `throwOnInfraFailure` 도입), 회귀 핫픽스

## 배경 / 문제

PR #543(b3c220dc, "FMP 404 safety")이 `getAssetInfo`의 FMP 조회를 바꿨다:

```diff
- const fmpResults = await searchBySymbol(upper);
+ const fmpResults = await searchBySymbol(upper, { throwOnInfraFailure: true });
```

`throwOnInfraFailure`는 FMP 인프라 에러(config 누락 / HTTP 에러 / fetch 실패 / JSON 파싱 실패 / 비배열 응답)일 때 빈 배열로 degrade하는 대신 **throw**한다. 원래 의도는 *transient FMP outage가 `null → notFound()` 404로 ISR(`revalidate=3600`)에 영구 캐시되는 것을 막기 위함*이었다(throw하면 ISR이 에러를 캐시하지 않으므로 복구 후 재시도 가능).

### 회귀 증상

`[symbol]` 라우트에는 `error.tsx`가 없다. 그래서 `getAssetInfo`의 throw가 **global-error 화면**으로 떨어진다(사용자가 prod에서 본 "500"). 데이터 흐름은 **cache(Upstash) → DB(Neon) → FMP**이고, 세 단계가 모두 miss/실패해야 throw에 도달한다:

- 평상시: 인기 종목은 cache/DB hit → 200 정상.
- 봇 공격 + 캐시율 5.8% 상황(prod): 봇이 cache/DB에 없는 다양한 ticker를 대량 요청 → FMP rate limit/과부하 → `throwOnInfraFailure` throw 연쇄 → **정상 종목 페이지까지 깨짐**.

`[symbol]` 6개 라우트(차트/news/fundamental/options/overall/fear-greed)가 모두 `getAssetInfoCached`에 의존하므로 한 번에 영향받는다.

## 목표

1. 인프라 일시 실패가 **정상 종목 페이지를 깨지 않게** 한다(graceful degrade — ticker만으로 페이지 렌더).
2. 실재하지 않는 종목은 그대로 **notFound 404**를 유지한다(SEO — 무한 [symbol] 페이지 방지).
3. degrade된 fallback 응답이 ISR에 굳지 않게 한다(인프라 복구 즉시 정상 회복).

## 비목표

- `getAssetInfo` / `throwOnInfraFailure` 자체는 바꾸지 않는다. throw는 "인프라 실패" vs null "실재 안 함"을 가르는 **유일한 시그널**이므로 유지한다.
- 캐시/DB/FMP 인프라 자체의 부하 대응(캐시율 개선, 봇 차단 강화)은 별도 후속 작업이다.

## 접근

`getAssetInfo` 내부는 손대지 않고, **데이터 fetch 경계(page RSC)에서** throw를 흡수한다. 세 상황을 구분한다:

| getAssetInfo 결과 | 의미 | 처리 |
|---|---|---|
| `AssetInfo` 반환 | 정상 | 그대로 렌더, ISR 캐시 |
| **throw** | 인프라 일시 실패 | catch → 캐시 회피 + ticker fallback 렌더 |
| `null` 반환 | 실재하지 않는 종목 (FMP 200 + 빈 결과) | `notFound()` 404 |

> **구현 중 보강 (noindex):** 사용자 결정으로, throw(존재 불명) 시 body는 fallback 200을 렌더하되
> `generateMetadata`는 noindex(`{ robots: { index: false, follow: false } }`)를 반환해 가짜 티커가
> 검색에 노출되지 않게 한다. 이를 위해 헬퍼는 아래 코드 블록의 `AssetInfo | null` 대신
> `{ assetInfo: AssetInfo | null; degraded: boolean }`(`ResilientAssetInfo`)를 반환한다. body 호출부는
> `const { assetInfo } = ...`로 `degraded`를 무시(fallback 렌더), `generateMetadata`는
> `const { assetInfo, degraded } = ...` 후 `if (degraded) return { robots: { index: false, follow: false } }`.

## 컴포넌트

### 새 헬퍼: `getAssetInfoResilient(ticker)`

`entities/ticker`에 추가. `getAssetInfoCached`를 감싸 throw를 ticker fallback으로 흡수한다.

```ts
export async function getAssetInfoResilient(
    ticker: string
): Promise<AssetInfo | null> {
    try {
        return await getAssetInfoCached(ticker); // null이면 그대로 null → notFound
    } catch (e) {
        // 인프라 일시 실패(FMP throwOnInfraFailure 등). 이 degrade 응답이 ISR로
        // 굳으면 revalidate 주기 동안 fallback이 노출되므로, 이 렌더만 동적 처리해
        // 캐시를 건너뛴다 — 인프라 복구 즉시 다음 요청부터 정상 assetInfo로 회복.
        console.error(
            '[getAssetInfoResilient] infra failure, ticker fallback:',
            e
        );
        // Next 16에서 단일 렌더 캐시 opt-out API(unstable_noStore / connection 등)
        // 중 ISR 라우트에서 실제로 동작하는 것을 구현 시 검증해 적용한다.
        noStore();
        return { symbol: ticker, name: ticker };
    }
}
```

- fallback 객체는 **`symbol` + `name`만** 채운다. `fmpSymbol`/`koreanName`은 생략한다.
  - `fmpSymbol` 생략 → 다운스트림 bars/peek가 `symbol`(ticker)로 fetch. US 종목은 canonical === fmpSymbol이라 정상. 해외 심볼(예: 캐시 miss + 인프라 실패가 겹친 비-US 종목)은 일시적으로 부정확할 수 있으나, 인프라 복구 후 정상화되는 짧은 degrade 구간으로 수용한다.
  - `koreanName` 생략 → 표시명이 영문 ticker로 degrade.

### 적용 범위

6개 라우트의 `getAssetInfoCached(...)` 호출을 `getAssetInfoResilient(...)`로 교체:

- `app/[symbol]/page.tsx` (page body)
- `app/[symbol]/news/page.tsx`
- `app/[symbol]/fundamental/page.tsx`
- `app/[symbol]/options/page.tsx`
- `app/[symbol]/overall/page.tsx`
- `app/[symbol]/fear-greed/page.tsx`
- `app/[symbol]/layout.tsx` (assetInfo 사용 시)

`generateMetadata`의 호출도 함께 교체한다. fallback 시 ticker 기반 메타로 degrade되며, 이는 기존 `assetInfo ? ... : ticker` null 처리와 일관된다. `getAssetInfoCached`가 `React.cache`로 dedupe되므로 generateMetadata와 body가 같은 throw를 공유하고, 각자 catch하여 동일한 fallback을 얻는다.

> 구현 시 확인: `noStore()`(또는 동등 API)를 어느 호출에서 부르는지에 따라 라우트 전체가 동적화된다. fallback 경로에서만 호출되어 **정상 경로의 ISR 캐시는 그대로 유지**되어야 한다.

## 데이터 흐름

```
GET /AAPL
  → SymbolPage RSC
    → getAssetInfoResilient('AAPL')
        → getAssetInfoCached → getAssetInfo: cache → DB → FMP
        ├─ 정상:     AssetInfo            → ISR 캐시, 200 정상 렌더
        ├─ throw:    catch → noStore()    → 캐시 회피, 200 ticker fallback 렌더
        └─ null:     null                 → notFound() 404
```

## 에러 처리

- throw(인프라) ↔ null(실재 안 함) 구분은 `throwOnInfraFailure`가 보장한다. 이 시그널을 page 경계에서 분기 처리한다.
- catch에서 에러를 **로깅**하되 삼키지 않고 fallback으로 degrade한다(렌더는 절대 깨지 않는다).

## 테스트

- `getAssetInfoResilient` 유닛 테스트(`getAssetInfoCached` mock):
  - 정상 → 반환값 그대로 통과
  - throw → `{ symbol: ticker, name: ticker }` fallback 객체 반환
  - null → null 그대로 반환(notFound 트리거 위임)
- `noStore()` 캐시 회피 동작은 단위 테스트 범위 밖(통합/실측)이라, 구현 시 `E2E_TEST=1 yarn build` 또는 dev 재현으로 fallback 경로가 정상 200을 내는지 확인한다.

## 미해결 / 구현 시 검증

- Next.js 16(`cacheComponents` 비활성) ISR 라우트에서 단일 렌더 캐시 opt-out API의 정확한 형태(`unstable_noStore` vs `connection()` vs 기타)와 동작.
- fallback 객체 `fmpSymbol` 생략이 `peekAnalysisCache` / `getBarsAction` 시그니처(undefined 허용 여부)와 호환되는지.

# SEO index quality gate and longtail footprint reduction

- 작성일: 2026-07-07
- 상태: Design, 사용자 리뷰 대기
- 범위: SEO 긴급 회복, symbol chart indexability, sitemap footprint, chart SSR content quality

## 1. 배경

2026-07-01 21:00 KST 전후 배포 이후 Google Search Console에서 노출수와 평균 게재순위가 사이트 전반으로 급락했다. 2026-06-28부터 2026-06-30까지는 정상 범위였고, 2026-07-04부터 2026-07-06까지는 모든 페이지군에서 하락이 확인됐다.

라이브 sitemap 감사 결과 현재 sitemap은 총 31,720 URL을 광고한다. 이 중 longtail URL이 28,505개이며, 표본 감사에서 `sitemap-longtail-*` 쪽에 많은 thin/저신뢰 후보가 `robots: index, follow`와 self canonical 상태로 열려 있었다.

대표 위험 후보:

```text
/0NEUSD
/0P00000SXJ
/0XBTCUSD
/1000SATSUSD
/3CEOUSD
/4TOKENUSD
/777USD
/A2EUSD
/AARTUSD
/ABATUSD
```

`MU`, `AI`, `ZS` 같은 정상 인기 티커도 단순 패턴 기반 감사에서는 위험 후보로 잡힐 수 있으므로, 단순 정규식 차단이 아니라 사이트가 직접 통제하는 indexability 정책이 필요하다.

## 2. 목표

1. 검색엔진에 광고하는 URL 수를 즉시 줄여 저품질 longtail 풋프린트를 축소한다.
2. sitemap과 metadata가 같은 중앙 품질 판정을 사용하게 한다.
3. longtail은 기본 `noindex`로 닫고, 승인된 심볼만 다시 index 허용할 수 있는 구조를 만든다.
4. 차트 페이지의 hidden keyword/stuffing 리스크를 줄인다.
5. 차트 페이지의 SSR HTML에 실제 데이터 기반 고유 서술을 늘린다.

## 3. 비목표

- 전체 라우트의 SEO 정책을 이번 작업에서 모두 재설계하지 않는다.
- `overall`, `news`, `fundamental`, `financials`, `options`, `fear-greed`의 페이지별 품질 기준은 후속 설계로 분리한다.
- AI 분석 프롬프트, 지표 계산, 분석 캐시 정책은 변경하지 않는다. 이 영역은 `@y0ngha/siglens-core` 경계에 걸릴 수 있다.
- 실시간 외부 API를 대량 호출해서 longtail 품질을 매 요청 평가하지 않는다.
- 기존 indexable popular/crypto 핵심 페이지를 의도 없이 noindex하지 않는다.

## 4. 핵심 정책

이번 작업의 핵심은 longtail을 단순히 제거하는 것이 아니라, "어떤 symbol URL을 Google 색인에 열어둘지"를 한 곳에서 결정하는 것이다.

정책:

- `popular` ticker는 기본 index 허용
- curated `crypto` ticker는 기본 index 허용
- `longtail` ticker는 기본 `noindex`와 sitemap 제외
- approved longtail allowlist에 있는 ticker만 index 허용
- sitemap에 들어간 URL은 반드시 indexable이어야 한다
- `noindex` URL은 sitemap에 절대 들어가지 않는다
- metadata와 sitemap은 같은 판정 함수를 사용한다

초기 구현의 판정은 저비용이어야 한다. `bars >= 120` 같은 데이터 기반 기준은 후속 단계에서 approved longtail을 자동 확장할 때 사용한다. 1차 회복 배포에서는 정적 목록과 이미 로드된 `assetInfo`만 사용한다.

## 5. Indexability API

중앙 판정 모듈을 추가한다.

예상 위치:

```text
src/entities/symbol-indexability/
```

초기 public API:

```ts
export interface SymbolIndexabilityInput {
    symbol: string;
    route: 'chart';
    assetInfo: AssetInfo | null;
    degraded: boolean;
}

export type SymbolIndexabilityReason =
    | 'popular'
    | 'curated-crypto'
    | 'approved-longtail'
    | 'invalid-symbol'
    | 'asset-missing'
    | 'degraded'
    | 'longtail-default-blocked';

export interface SymbolIndexabilityDecision {
    indexable: boolean;
    reason: SymbolIndexabilityReason;
}

export function evaluateSymbolIndexability(
    input: SymbolIndexabilityInput
): SymbolIndexabilityDecision;
```

초기 판정:

```text
invalid symbol shape  -> noindex, reason invalid-symbol
assetInfo 없음        -> noindex, reason asset-missing
degraded === true     -> noindex, reason degraded
popular ticker        -> index, reason popular
curated crypto        -> index, reason curated-crypto
approved longtail     -> index, reason approved-longtail
그 외 longtail        -> noindex, reason longtail-default-blocked
```

`approved longtail`은 처음에는 빈 목록 또는 극소수 수동 allowlist로 시작한다. 이 목록은 `config` 파일로 두고, 추후 데이터 기반 manifest로 교체할 수 있게 한다.

## 6. Sitemap 설계

현재 sitemap index:

```text
/sitemap-static.xml
/sitemap-popular.xml
/sitemap-crypto.xml
/sitemap-longtail-1.xml
/sitemap-longtail-2.xml
/sitemap-longtail-3.xml
```

1차 변경 후 sitemap index:

```text
/sitemap-static.xml
/sitemap-popular.xml
/sitemap-crypto.xml
```

`/sitemap-longtail-{n}.xml`은 sitemap index에서 제거한다.
`/sitemap-crypto.xml`도 curated `POPULAR_CRYPTOS` 기반 URL만 포함한다. DB에서 가져온
crypto longtail URL은 중앙 indexability gate에서 기본 `noindex`가 되므로 sitemap에
광고하지 않는다.

기존 longtail sitemap route는 `410 Gone`을 반환한다. 이유:

- 이전에 제출된 sitemap URL이 더 이상 유효하지 않다는 신호가 명확하다.
- 새 sitemap index와 충돌하지 않는다.
- Google이 예전 sitemap URL을 다시 가져가도 빠르게 폐기할 수 있다.

approved longtail을 재개방하는 Phase에서는 기존 이름을 재사용하지 않고 별도 sitemap을 사용한다.

```text
/sitemap-longtail-approved.xml
```

이 approved sitemap은 `evaluateSymbolIndexability` 결과가 `indexable: true`인 longtail만 포함한다.

## 7. Metadata 설계

`src/app/[symbol]/page.tsx`의 `generateMetadata`에서 기존 `assetInfo`와 `degraded` 가드 이후 중앙 판정을 호출한다.

개념 흐름:

```ts
const { assetInfo, degraded } = await getAssetInfoResilient(ticker);

const decision = evaluateSymbolIndexability({
    symbol: ticker,
    route: 'chart',
    assetInfo,
    degraded,
});

if (!decision.indexable) {
    return NOINDEX_SYMBOL_METADATA;
}
```

본문 렌더링은 1차에서 404로 바꾸지 않는다.

정책:

```text
invalid shape        -> 기존 notFound/noindex 흐름 유지
assetInfo 없음       -> 기존 notFound/noindex 흐름 유지
degraded fallback    -> 200 + noindex
longtail 미승인      -> 200 + noindex
popular/crypto/승인  -> 200 + index
```

이 방식은 기존에 발견되거나 색인된 URL을 급격히 404로 바꾸지 않으면서, 다음 크롤에서 색인 제거를 유도한다.

## 8. 차트 페이지 콘텐츠 품질

`TechnicalFactsSummary`는 이미 차트 페이지의 SSR fallback에 포함되어 있다. 이번 작업에서는 이 컴포넌트를 더 강한 고유 콘텐츠로 만든다.

현재 정보:

```text
현재가
RSI
MACD 모멘텀
52주 위치
```

추가할 정보는 AI 생성이 아니라 bars/indicators 기반 결정적 문장이다.

예시:

```text
AAPL은 최근 종가 212.34달러 기준으로 직전 거래일 대비 1.24% 상승했습니다.
RSI 58.2로 중립 구간이며, MACD 히스토그램은 양수라 단기 모멘텀은 상승 쪽입니다.
52주 고점 대비 -4.8%, 52주 저점 대비 +36.1% 위치에 있습니다.
```

예상 pure function:

```ts
export function buildTechnicalFactsNarrative(
    symbol: string,
    facts: TechnicalFacts,
    marketProfile: MarketProfileId
): string[];
```

규칙:

- facts가 없으면 narrative도 렌더하지 않는다.
- 가격 포맷은 market profile을 따른다.
- RSI나 MACD 값이 없으면 해당 문장 조각을 생략한다.
- 투자 조언처럼 보이는 표현은 피하고, 관측값 중심으로 작성한다.
- 사용자에게도 보이는 콘텐츠로 렌더한다. 봇 전용 콘텐츠를 만들지 않는다.

## 9. Hidden Keyword와 FAQ 정책

차트 페이지의 hidden 보조 설명에서 키워드 나열을 제거한다.

현재 위험:

```text
RSI, MACD, 볼린저밴드...
도지나 해머, 장악형...
차트 패턴...
```

이 문장은 접근성 설명 목적이 일부 있지만, 수천 종목에서 반복될 때 hidden keyword/stuffing 리스크가 있다.

변경:

- `sr-only` h1 fallback은 유지한다.
- hidden keyword 나열 문단은 제거하거나 짧은 일반 설명으로 축소한다.
- 실제 데이터 기반 요약은 `TechnicalFactsSummary`의 가시 콘텐츠로 제공한다.
- 차트 페이지의 FAQ JSON-LD는 1차에서 제거한다.

차트 페이지 FAQ JSON-LD를 제거하는 이유:

- 전 종목 반복되는 사이트 기능 설명에 가깝다.
- 페이지별 고유 FAQ가 아니다.
- rich result 기대값보다 boilerplate 리스크가 크다.

## 10. Phase

### Phase 1: 긴급 회복 배포

목표: 저품질 longtail index footprint를 즉시 줄인다.

작업:

1. `evaluateSymbolIndexability` 모듈 추가
2. popular/curated crypto/approved longtail 판정 구현
3. chart `generateMetadata`에 중앙 판정 적용
4. sitemap index에서 `sitemap-longtail-*` 제거
5. longtail sitemap route를 `410 Gone`으로 변경
6. chart page hidden keyword 문단 제거
7. chart page FAQ JSON-LD 제거

검증:

```text
/sitemap.xml                  -> longtail sitemap 없음
/sitemap-longtail-1.xml       -> 410
/AAPL                         -> index, follow
/NVDA                         -> index, follow
/BTCUSD                       -> index, follow
/0NEUSD                       -> noindex
/0P00000SXJ                   -> noindex
/3CEOUSD                      -> noindex
/777USD                       -> noindex
```

### Phase 2: 차트 SSR 품질 강화

목표: 남겨둔 indexable 차트 페이지의 고유 SSR 콘텐츠를 강화한다.

작업:

1. `buildTechnicalFactsNarrative` pure function 추가
2. `TechnicalFactsSummary`에 데이터 기반 문장 추가
3. crypto/us-equity 가격 포맷 모두 검증
4. bars 부족 또는 indicators 일부 null일 때 graceful omission 보장

검증:

```text
/AAPL HTML에 현재가, RSI, MACD, 52주 위치 기반 문장 존재
/BTCUSD HTML에 crypto 가격 포맷으로 문장 존재
bars 부족 시 크래시 없이 섹션 생략
```

### Phase 3: 후속 설계

이번 구현 범위에서는 문서화만 한다.

후속 주제:

- `overall`, `news`, `fundamental`, `financials`, `options`, `fear-greed` 라우트별 indexability 기준
- FAQ/JSON-LD 전역 정책
- approved longtail manifest 자동 생성
- Search Console sitemap 재제출과 핵심 URL 색인 재요청 운영 절차
- GSC coverage와 performance 회복 추적 대시보드

## 11. 테스트 전략

단위 테스트:

- `evaluateSymbolIndexability`
  - popular ticker는 index
  - curated crypto는 index
  - approved longtail은 index
  - unapproved longtail은 noindex
  - degraded는 noindex
  - assetInfo missing은 noindex
  - invalid shape은 noindex
- `buildTechnicalFactsNarrative`
  - full facts 문장 생성
  - RSI null 문장 생략
  - MACD null 문장 생략
  - crypto price formatting
  - bars 부족으로 facts null이면 호출부가 렌더 생략

라우트 테스트:

- sitemap index에 longtail URL이 없는지 확인
- longtail sitemap route가 410을 반환하는지 확인
- chart metadata가 popular/crypto는 index, unapproved longtail은 noindex를 반환하는지 확인
- chart page에서 FAQ JSON-LD가 제거됐는지 확인
- chart page에서 hidden keyword 문단이 제거됐는지 확인

실측 테스트:

```bash
curl -I https://siglens.io/sitemap-longtail-1.xml
curl -s https://siglens.io/sitemap.xml
curl -s -A 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' https://siglens.io/AAPL
curl -s -A 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' https://siglens.io/0NEUSD
```

배포 후 기대:

- `/sitemap.xml`에 longtail sitemap이 없어야 한다.
- `/sitemap-longtail-1.xml`은 410이어야 한다.
- `/AAPL`은 `index, follow`여야 한다.
- `/0NEUSD`는 `noindex`여야 한다.

## 12. 운영 절차

배포 후 Search Console에서 새 sitemap index를 다시 제출한다.

우선 재요청할 핵심 URL:

```text
https://siglens.io/
https://siglens.io/AAPL
https://siglens.io/NVDA
https://siglens.io/TSLA
https://siglens.io/MSFT
https://siglens.io/BTCUSD
https://siglens.io/ETHUSD
```

longtail 제거 효과는 즉시 ranking 복구를 보장하지 않는다. 개선 배포 후 Google 재크롤과 재평가가 필요하다. 관측 기준은 다음과 같다.

```text
1일 단위: sitemap fetch 성공, 핵심 URL indexability 확인
1주 단위: GSC impressions, average position, indexed pages 추이
수 주 단위: longtail 제외 후 핵심 페이지 평균 게재순위 회복 여부
```

## 13. 예상 영향 파일

```text
src/entities/symbol-indexability/
src/entities/sitemap-entry/
src/app/api/sitemap/route.ts
src/app/api/sitemap/longtail/[page]/route.ts
src/app/api/sitemap/__tests__/
src/app/[symbol]/page.tsx
src/app/[symbol]/__tests__/
src/views/symbol/TechnicalFactsSummary.tsx
src/views/symbol/utils/technicalFacts.ts
src/views/symbol/__tests__/
```

## 14. 승인된 결정

- 최우선 범위는 "복구 + 중앙 품질 게이트"다.
- longtail은 기본 `noindex`와 sitemap 제외로 처리한다.
- 차트 페이지 한정으로 SSR 고유 콘텐츠 강화와 hidden keyword 리스크 제거를 포함한다.
- 전체 라우트 SEO 재설계는 이번 범위에서 제외하고 후속 Phase로 분리한다.
- longtail sitemap route는 410 Gone을 반환한다.
- 차트 페이지 FAQ JSON-LD는 제거한다.

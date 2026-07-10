# www apex canonicalization and symbol SSR quality reinforcement

- 작성일: 2026-07-08
- 상태: Design, 사용자 리뷰 대기
- 범위: `www.siglens.io` 정규화, symbol sibling page SSR factual content 강화

> **[2026-07-10 업데이트 — www 정규화 구현 방식 이관]**
> 이 문서(및 §3.1의 ALB HTTPS listener rule 설계, `infra/aws/reconcile-www-redirect.sh`)는
> `www -> apex` 301 정규화를 **AWS ALB 리스너 규칙**으로 구현하는 것으로 계획했다.
> 실제로는 **Cloudflare 대시보드 Redirect Rule**(`http.host eq "www.siglens.io"` →
> `concat("https://siglens.io", http.request.uri.path)`, 301, query string 보존)로 이관했다.
> Cloudflare가 엣지에서 301하므로 요청이 ALB까지 도달하지 않는다.
> 이에 따라 `reconcile-www-redirect.sh`·테스트·CI/deploy 통합·ALB IAM 권한은 모두 제거됐다.
> ACM 인증서의 `www.siglens.io` SAN(`infra/aws/03-acm.sh`)은 grey-cloud fallback 시
> ALB 직결 TLS를 위해 방어적으로 유지한다. 아래 §3.1 ALB rule 설계는 히스토리 참고용이다.

## 1. 배경

2026-07-01 전후 SEO 급락 대응으로 1차 조치에서는 longtail index footprint를 축소하고 chart page의 SSR factual content를 강화했다. 후속 확인에서 `www.siglens.io`가 apex로 redirect되지 않고 독립 호스트로 `200` 응답하는 것이 확인됐다.

확인된 라이브 응답:

```text
https://www.siglens.io/                 -> HTTP/2 200
https://www.siglens.io/AAPL?tf=1Day     -> HTTP/2 200
http://www.siglens.io/                  -> 301 Location: https://www.siglens.io/
http://www.siglens.io/AAPL?tf=1Day      -> 301 Location: https://www.siglens.io/AAPL?tf=1Day
```

현재 metadata canonical은 apex(`https://siglens.io/...`)를 가리키지만, `www`가 200으로 열리면 crawler가 같은 HTML을 두 호스트에서 발견할 수 있다. canonical이 방어 신호를 주더라도, 호스트 정규화가 없는 상태는 SEO 위생상 불필요한 중복 URL surface를 만든다.

또한 chart page는 `TechnicalFactsSummary`를 통해 crawler-visible factual text가 강화됐지만, sibling page 중 `news`와 `overall`은 여전히 Suspense/client AI 영역 비중이 크다. `fundamental`은 profile description, valuation, analyst consensus 등 데이터 기반 SSR text가 이미 상당히 노출된다. 따라서 이번 범위는 `news`와 `overall`에 집중한다.

## 2. 목표

1. `www.siglens.io`의 모든 HTML URL을 apex `https://siglens.io`로 영구 정규화한다.
2. query string과 path를 보존한 301 redirect를 보장한다.
3. `news` page에 crawler-visible, 사용자-visible, deterministic factual summary를 추가한다.
4. `overall` page에서 AI cache miss 시에도 스켈레톤만 남지 않도록 deterministic factual fallback을 추가한다.
5. hidden keyword stuffing이나 얇은 템플릿 문구를 늘리지 않고, 실제 종목별 데이터로만 SSR 본문을 보강한다.

## 3. 비목표

- 전체 symbol sibling page를 이번 작업에서 모두 재설계하지 않는다.
- AI 분석 프롬프트, 분석 알고리즘, indicator 계산식은 변경하지 않는다.
- `@y0ngha/siglens-core`의 cache key나 analysis domain logic을 변경하지 않는다.
- Google ranking의 즉시 회복을 보장하지 않는다. 이번 변경은 재크롤 시 평가될 기술/콘텐츠 품질 개선이다.
- 숨김 텍스트나 keyword list를 추가하지 않는다.
- `noindex`/sitemap 중앙 gate 정책은 변경하지 않는다.

## 4. 접근안 비교

### A. 최소 위생 수정

`www -> apex` 301만 추가한다.

장점:

- 가장 빠르고 리스크가 낮다.
- 중복 호스트 문제를 명확히 제거한다.

단점:

- `news`/`overall`의 crawler-visible content 약점은 그대로 남는다.

### B. 권장안

`www -> apex` 301과 `news`/`overall` SSR factual layer를 함께 추가한다.

장점:

- 확인된 host canonicalization 문제를 즉시 해결한다.
- 1차 SEO 품질 작업에서 제외된 sibling page 중 가장 얇은 후보를 보강한다.
- `fundamental`, `financials`, `options`, `congress`, `fear-greed`까지 범위를 넓히지 않아 변경량을 통제할 수 있다.

단점:

- SSR factual layer의 품질 기준을 명확히 지키지 않으면 또 다른 boilerplate가 될 수 있다.

### C. 전면 SSR 강화

모든 symbol sibling page에 SSR summary를 추가한다.

장점:

- 장기적으로 symbol section 전체의 content quality를 균일하게 만들 수 있다.

단점:

- 범위가 크고 검증 비용이 높다.
- 충분한 데이터가 없는 탭까지 템플릿 문구를 늘릴 위험이 있다.

결정: 이번 작업은 B로 진행한다.

## 5. www -> apex 301 설계

### 5.1 적용 위치

1차 구현 위치는 AWS ALB HTTPS listener rule이다.

이유:

- 현재 라이브에서 `https://www` 요청은 Cloudflare를 거쳐 app까지 도달하고 있다.
- 현재 `http://www` 요청은 Cloudflare가 이미 `https://www`로 301 정규화한다. 따라서 이번 작업은 HTTPS `www`가 apex로 이어지지 않는 마지막 구간을 닫는다.
- ALB listener에서 redirect하면 Next.js render/cache/ISR 계층에 도달하기 전에 중복 호스트를 제거할 수 있다.
- `infra/aws/06-alb-asg.sh`가 ALB와 HTTPS listener의 멱등 source-of-truth 역할을 이미 갖고 있다.
- ACM script(`infra/aws/03-acm.sh`)는 `www.siglens.io`를 SAN에 포함하고 있으므로 HTTPS redirect 조건을 충족한다.

### 5.2 Redirect rule

조건:

```text
Host header == www.siglens.io
```

동작:

```text
HTTP_301
Protocol: HTTPS
Host: siglens.io
Port: 443
Path: /#{path}
Query: #{query}
```

예상 결과:

```text
https://www.siglens.io/             -> 301 Location: https://siglens.io/
https://www.siglens.io/AAPL         -> 301 Location: https://siglens.io/AAPL
https://www.siglens.io/AAPL?tf=1Day -> 301 Location: https://siglens.io/AAPL?tf=1Day
https://www.siglens.io/sitemap.xml  -> 301 Location: https://siglens.io/sitemap.xml
http://www.siglens.io/AAPL?tf=1Day  -> 301 https://www... -> 301 https://siglens.io/AAPL?tf=1Day
```

### 5.3 Idempotency

`infra/aws/06-alb-asg.sh`는 다음을 보장해야 한다.

- HTTPS listener가 없으면 기존처럼 생성한다.
- HTTPS listener가 있으면 `www -> apex` redirect rule 존재 여부를 확인한다.
- 같은 host condition rule이 없을 때만 생성한다.
- 이미 존재하면 중복 rule을 만들지 않는다.
- priority 충돌을 피한다. 고정 priority를 쓰되, 충돌 시 명확히 실패하거나 사용 가능한 priority를 계산한다.

## 6. News SSR factual layer 설계

### 6.1 데이터 소스

`src/app/[symbol]/news/page.tsx`는 이미 page body에서 다음을 가져온다.

```ts
const newsItems = await staticSymbolCache(
    [NEWS_LIST_CACHE_KEY, upper],
    upper,
    () => getNewsList(upper),
    [`news:${upper}`],
    SECONDS_PER_HALF_DAY
).catch(...)
```

이 `newsItems`를 재사용한다. 추가 remote fetch를 만들지 않는다.

### 6.2 렌더 위치

`SymbolPageHeading` 아래, `NewsAiSummaryErrorBoundary` 위에 사용자-visible section을 추가한다.

이유:

- crawler가 main content 초반에서 factual text를 볼 수 있다.
- 사용자도 현재 뉴스 데이터 상태를 읽을 수 있다.
- `sr-only` hidden block이 아니므로 hidden text/stuffing 리스크가 없다.

### 6.3 콘텐츠 규칙

허용:

- 최근 수집 뉴스 개수
- 최신 뉴스 발행일
- AI enrichment가 완료된 기사 수
- sentiment 분포(긍정/중립/부정 등 기존 row에 있는 값만)
- 최근 headline 3-5개
- equity일 때 earnings/analyst sections가 함께 제공된다는 안내
- crypto일 때 뉴스 중심 페이지라는 안내

금지:

- 없는 AI 결론을 만들어내기
- sentiment가 없는데 sentiment 판단 문장 만들기
- keyword list 나열
- `display:none`, `sr-only`로 검색어만 숨겨 넣기
- 모든 ticker에 동일한 장문 boilerplate 반복

### 6.4 Empty/degraded 상태

`newsItems`가 비어 있으면 다음처럼 사실만 말한다.

```text
AAPL 최신 뉴스 데이터가 아직 준비되지 않았습니다. 뉴스 카드가 분석되면 최근 기사와 분위기 요약이 이 영역에 표시됩니다.
```

이 문장은 indexability gate와 충돌하지 않는다. 다만 빈 뉴스가 장기간 지속되는 symbol은 이미 1차 품질 gate에서 longtail 기본 noindex 대상이므로 sitemap footprint를 늘리지 않는다.

## 7. Overall SSR factual layer 설계

### 7.1 현재 상태

`overall`은 `cachedOverall`이 있으면 Suspense fallback에 `OverallFactsSummary`를 넣는다. 이 경우 AI 종합 분석 결론, 시나리오, 위험 요인이 SSR HTML에 노출된다.

문제는 cache miss다. 현재 cache miss에서는 스켈레톤 fallback만 렌더되므로, crawler-visible 고유 본문이 guide copy와 cross links 중심으로 약해진다.

### 7.2 보강 방식

`cachedOverall`이 있을 때:

- 기존 `OverallFactsSummary`를 그대로 사용한다.

`cachedOverall`이 없을 때:

- 새 deterministic factual fallback을 렌더한다.
- 데이터는 이미 page에서 조회한 `newsItems`, `hasEnrichedNews`, `assetClass`, `displayName`, `upper`만 사용한다.
- AI 결론/시나리오를 추정하지 않는다.

예상 문장 구성:

```text
AAPL 종합 분석은 차트, 뉴스, 펀더멘털, 옵션, 공포 탐욕 지수를 함께 봅니다.
현재 서버가 확인한 최근 뉴스는 12건이며, 이 중 7건은 AI 뉴스 카드 분석이 완료됐습니다.
종합 AI 결론이 아직 캐시되지 않은 경우, 분석 요청 후 강세/중립/약세 시나리오와 위험 요인이 이 영역에 표시됩니다.
```

crypto의 경우:

```text
BTCUSD 종합 분석은 차트, 뉴스, 공포 탐욕 지수를 함께 봅니다.
현재 서버가 확인한 최근 뉴스는 8건이며, 이 중 5건은 AI 뉴스 카드 분석이 완료됐습니다.
```

### 7.3 기존 guide copy와의 관계

현재 `overall-guide-heading` section은 "어떻게 봐야 할까"를 설명하는 안내 성격이다. 새 fallback은 "현재 이 symbol에서 실제로 확인된 데이터 상태"를 설명한다. 둘은 역할이 다르므로 중복이 아니다.

## 8. 품질 기준

SSR factual layer는 다음 기준을 만족해야 한다.

1. **Factual only**: 서버가 이미 가진 데이터에서만 문장을 만든다.
2. **Visible content**: SEO 목적의 hidden text를 만들지 않는다.
3. **Ticker-specific**: symbol, displayName, count, date, headline 등 종목별 값이 들어간다.
4. **No fabricated analysis**: AI 분석 결과가 없으면 결론을 말하지 않는다.
5. **No new external dependency**: 기존 page data fetch를 재사용한다.
6. **No indexability drift**: noindex/sitemap 판정은 기존 central gate를 그대로 따른다.
7. **Graceful degraded state**: fetch failure는 기존처럼 page crash 대신 empty factual state로 degrade한다.

## 9. 테스트 및 검증

### 9.1 Unit tests

추가/수정할 테스트:

- `www -> apex` ALB rule script가 중복 rule을 만들지 않는지 가능한 범위에서 shell/static 검증
- `news` factual layer:
  - news item이 있으면 count/headline/sentiment summary를 렌더
  - empty state에서 과장 문구 없이 준비 중 문구를 렌더
  - equity/crypto 문구 분기
- `overall` fallback:
  - cached overall이 있으면 기존 `OverallFactsSummary` 렌더
  - cached overall이 없으면 deterministic factual fallback 렌더
  - equity/crypto 분석 축 문구 분기

### 9.2 Local verification

```bash
yarn lint
yarn test
yarn typecheck
```

변경 범위가 작으면 관련 테스트를 먼저 실행하고, 최종적으로 전체 lint/typecheck를 실행한다.

### 9.3 Live verification after deploy

배포 후 확인:

```bash
curl -sS -D - -o /dev/null https://www.siglens.io/
curl -sS -D - -o /dev/null 'https://www.siglens.io/AAPL?tf=1Day'
curl -sS -D - -o /dev/null https://www.siglens.io/sitemap.xml
curl -sS -L -D - -o /dev/null 'http://www.siglens.io/AAPL?tf=1Day'
curl -sS https://siglens.io/AAPL/news | rg '최신 뉴스|뉴스 데이터|canonical'
curl -sS https://siglens.io/AAPL/overall | rg '종합 분석|최근 뉴스|canonical'
```

기대:

- `www` URL은 모두 `301`.
- `Location`은 apex URL이며 path/query를 보존.
- `http://www`는 Cloudflare의 HTTPS 정규화 뒤 최종적으로 apex에 도달.
- apex URL은 `200`.
- `news`/`overall` HTML에는 JavaScript 실행 전에도 symbol-specific factual text가 포함.

## 10. 자체 검토

### 10.1 확인된 문제를 직접 해결하는가?

**문제 1: `www.siglens.io`가 200으로 열린다.**

해결된다. ALB listener rule은 request가 Next.js로 들어가기 전에 host를 apex로 301 정규화한다. canonical link보다 강한 신호이며, crawler가 `www` HTML을 별도 URL로 계속 수집하는 surface를 줄인다.

**문제 2: `news`/`overall`의 crawler-visible 고유 본문이 약하다.**

부분적으로 해결된다. `news`는 이미 서버에서 확보한 `newsItems`를 이용해 최근 뉴스 상태와 headline을 visible SSR content로 노출한다. `overall`은 AI cache miss에도 symbol-specific factual fallback을 제공하므로 스켈레톤-only 상태를 줄인다.

**문제 3: hidden keyword/stuffing 리스크를 다시 만들 수 있다.**

설계상 방지한다. 새 content는 `sr-only`가 아니라 visible section이며, keyword list가 아니라 count/date/headline/status 중심의 factual text다.

### 10.2 해결하지 못하는 것

- 이 변경만으로 Google 평균 게재순위가 즉시 복구되지는 않는다. 재크롤과 재평가가 필요하다.
- `financials`, `options`, `congress`, `fear-greed`의 SSR 품질은 이번 범위에서 직접 개선하지 않는다.
- Cloudflare dashboard-level redirect rule이 별도로 있다면, 이 설계는 ALB 쪽 source-of-truth만 다룬다. 다만 현재 `https://www`가 app까지 200으로 도달하므로 ALB rule만으로도 확인된 라이브 문제는 해결 가능하다. `http://www`는 이미 Cloudflare가 `https://www`로 보낸다.
- `newsItems` 자체가 장기간 비어 있는 symbol의 콘텐츠 품질은 개선되지 않는다. 이는 1차 indexability gate의 longtail noindex 정책으로 관리한다.

### 10.3 부작용 검토

- `www` redirect가 query를 보존하므로 `/?q=AAPL` 같은 SearchAction URL도 apex로 먼저 정규화된 뒤 기존 proxy search redirect 흐름을 탄다.
- ALB에서 redirect하므로 Next.js cache key에 `www` variant가 새로 쌓이지 않는다.
- `overall` fallback이 AI 결론을 추정하지 않으므로 사용자-visible AI 결과와 충돌하지 않는다.
- `news` factual layer가 기존 `newsItems`를 재사용하므로 TTFB를 늘리는 추가 네트워크 호출이 없다.

### 10.4 최종 판단

이 설계는 이번에 새로 확인한 `www` 중복 호스트 문제를 직접 해결하고, 1차 SEO 품질 작업 이후 남은 가장 큰 sibling page 약점인 `news`/`overall`의 SSR 고유 본문 부족을 좁은 범위에서 개선한다.

다만 이것은 기술 SEO와 콘텐츠 품질의 후속 보강이지, ranking collapse의 단일 원인을 확정하거나 즉시 회복을 보장하는 조치는 아니다. 배포 후에는 GSC에서 `www` URL 발견/색인 상태, canonical 선택, `news`/`overall` 대표 URL의 HTML fetch 결과를 함께 확인해야 한다.

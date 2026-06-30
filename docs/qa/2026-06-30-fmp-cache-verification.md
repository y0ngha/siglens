# FMP 캐시 개선 — 배포 전 검증 Spec & Test Cases

> 대상 브랜치: `perf/fmp-cache-optimization` (워크트리 `/Users/y0ngha/Project/siglens-fmp-cache`)
> 설계 문서: [`docs/superpowers/specs/2026-06-30-fmp-cache-optimization-design.md`](../superpowers/specs/2026-06-30-fmp-cache-optimization-design.md)
> 작성일: 2026-06-30
> 목적: FMP 호출·egress 절감을 위한 캐시 개선이 **사용자 화면·SEO·데이터 정확성을 무손상**으로
> 유지하는지 prod-like 로컬 실행에서 curl(응답/Status) + Chrome(시각/DOM) 두 트랙으로 실증한다.
>
> 핵심 검증 가설: **이 변경은 순수 I/O/캐시 최적화다. 사용자에게 보이는 모든 것은 변경 전과 동일해야 한다.**
> 단위/E2E 테스트가 로직을 커버하더라도, 실제 production 빌드에서 페이지·차트·SEO에 회귀가 없는지 확인한다.

---

## 1. 변경 범위 & 리스크 요약 (Scope & Risk)

### 1.1 변경된 것 (3 파트)

| # | 변경 | 코드 위치 |
|---|---|---|
| **1** | fundamental 캐시 TTL **1h → 24h** (단일 상수 `FMP_FUNDAMENTAL_REVALIDATE_SECONDS = SECONDS_PER_DAY`가 Next Data Cache `revalidate` + Redis `getOrSetCache` TTL 둘 다 구동) | `src/shared/api/fmp/fundamentalClient.ts:45`, `src/shared/api/fmp/CachedFundamentalProvider.ts:29` (`TTL`) |
| **2** | **peer 목록 split** — 페이지(`PeersTable`)는 enrich 없는 raw peer(티커·회사명·시총만), 분석/FactLayer는 enriched(per/psr 유지). 신규 `getStockPeersRaw` 추가, 페이지 위임 전환 | `src/shared/api/fmp/CachedFundamentalProvider.ts:206-211` (`getStockPeersRaw`), `src/app/[symbol]/fundamental/fundamentalData.ts:70-73`, `src/shared/api/fmp/fundamentalProvider.types.ts` (`FundamentalProviderWithRawPeers`), `FakeFundamentalDataProvider.ts:83` |
| **3** | **1Day EOD 봉 split** — 긴 lookback의 일봉을 불변 과거(`before=오늘−7d`, long-TTL=2d) + 최근 live(`from=오늘−10d`, 세션 TTL)로 나눠 fetch 후 `mergeBarsByTime`으로 병합. 짧은 lookback·인트라데이·`before` 페이지네이션은 기존 단일 경로 유지 | `src/shared/api/market/CachedMarketDataProvider.ts:90-142`, `src/shared/api/market/mergeBarsByTime.ts` |

커밋:
```
ba3128dd perf(fmp): extend fundamental cache TTL 1h -> 24h
a3c25195 feat(fmp): add getStockPeersRaw (un-enriched, page-only peer list)
c4c310aa perf(fundamental): page peers use raw (un-enriched) list, drop per/psr fan-out
c704f2c7 feat(market): add mergeBarsByTime pure helper for EOD cache split
6332f950 perf(market): split 1Day EOD into immutable-history(long) + recent(live) caches
d28707cc test(market): cover EOD-split edge cases + guard short 1Day windows
```

`@y0ngha/siglens-core`(0.27.0)·`FmpMarketProvider`·`FmpFundamentalClient`(inner)는 **무변경**. 캐싱·병합은 전부 데코레이터 레이어에 있다.

### 1.2 사용자에게 보이는 동작 — **반드시 동일** (회귀 금지)

이 항목들이 변경 전과 **시각·구조·값이 동일**해야 검증 통과다.

- **Peer 테이블 내용**: 3컬럼(티커 / 회사명 / 시가총액). 티커는 `/{PEER}/fundamental` 내부 링크. 시총은 `Intl.NumberFormat('ko-KR', compact, USD)` 포맷(예: `US$3.5조` / `US$3.5T` 류 compact 통화). **변경 전과 동일한 peer 목록·동일 컬럼**. (per/psr은 원래도 이 표에 없었음 — 표에는 영향 0.)
- **밸류에이션 카드(ValuationCard)**: **본 종목**의 PER/PSR/EPS 등 — `getKeyMetricsTtm(symbol)` 경로로 변경 무관, 그대로 노출.
- **차트 일봉(1Day)**: 차트 페이지 `/{SYMBOL}`의 일봉 캔들 — split 병합 결과가 단일 `getBars(from=now−730d)`와 **동일 집합**이어야 한다(개수·순서·오늘 봉 포함 동일).
- **가격 신선도**: 오늘 봉/현재가/등락률 — 최근 live 윈도우(세션 TTL 60s) + 클라 React Query refetch 30s 그대로. 지연 없음.
- **SEO/메타/JSON-LD**: title/description/canonical/robots/og·twitter, WebPage·BreadcrumbList·FAQPage JSON-LD — 모두 불변(SEO 콘텐츠는 데이터 fetch와 분리됨).
- **분석/FactLayer 품질**: AI 펀더멘털 분석의 peer per/psr — enriched `getStockPeers`(core 분석 경로)는 유지되므로 N/A 회귀 없어야 함(**회귀 가드**, 설계 §변경2).

### 1.3 내부 동작 — 변경됨 (curl로 직접 관측 불가)

- **FMP 호출/egress 감소**: peer fan-out 페이지 제거, EOD 730일 재fetch를 거래일당 1회로. → **로컬 curl로는 직접 보이지 않는다.** FMP usage 대시보드(prod)나 서버 로그/타이밍으로만 간접 관측 가능(§5).
- **캐시 키 구조 변경**: `fundamental:peers-raw:<SYM>` 신규, `bars:eodhist:<SYM>:<from>:<histTo>` / `bars:eodrecent:<SYM>:<recentFrom>` 신규(기존 `bars:raw:*`는 짧은 lookback·인트라데이용으로 잔존). 동작 정확성은 사용자 화면(§3·§4)으로 검증하고, 키는 §5에서 best-effort 확인.

### 1.4 리스크 핫스폿 (집중 검증 포인트)

| 리스크 | 시나리오 | 검증 |
|---|---|---|
| R-A | merge 버그로 차트 일봉이 **누락/중복/순서 어긋남** | C-CHART / B-CHART (개수·오늘 봉) |
| R-B | 윈도우 경계(주말·공휴일·DST) **갭** — 3일 overlap이 못 막음 | B-CHART(연속성 시각 확인), §5 |
| R-C | peer split로 **페이지 peer 목록이 비거나 달라짐** | C-PEER / B-PEER |
| R-D | enriched 경로 회귀로 **분석 peer per/psr이 N/A** | B-ANALYSIS(분석 결과 peer 비교 문구) |
| R-E | 24h TTL로 **본 종목 valuation 카드 빈값** degrade | C-VAL / B-VAL |
| R-F | 짧은 lookback이 split를 타서 **과거 윈도우 역전**(빈 결과) | C-CHART(차트 200·데이터 존재), §5 |
| R-G | SEO/JSON-LD 회귀 | C-SEO / B-SEO |

---

## 2. 환경 설정 (Prod-like 로컬 실행)

> 베이스 가이드: [QA_ENV_SETUP.md](./QA_ENV_SETUP.md). 본 절은 이 변경에 필요한 부분만 추린다.

### 2.1 필요한 env

| 키 | 필요성 | 비고 |
|---|---|---|
| `FMP_API_KEY` | **필수** | 변경 1·3 모두 실데이터 검증 시 실제 FMP 응답 필요. 없으면 fundamental/차트가 degrade되어 검증 무의미. `.env.local`/`.env.production`에 존재 확인. |
| `DATABASE_URL` | **필수** | 펀더멘털 페이지가 `getProfileDescriptionKo`(DB 번역)·`getAssetInfoResilient`에서 DB 접근. prod build의 정적 prerender도 DB를 읽으므로 연결 가능한 DB 필요(Neon 또는 docker). |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` / `_READONLY_TOKEN` | **선택(권장)** | 캐싱 동작(§5)을 실증하려면 필요. **미설정 시 `getOrSetCache`가 fetcher 직접 호출로 graceful fallback** → 기능은 정상, 단 캐시 hit/TTL은 관측 불가. docker SRH(`localhost:8079`)로 실제 Redis 검증 가능(QA_ENV_SETUP §1). |
| `NEXT_PUBLIC_SITE_URL` | 선택 | 미설정 시 `https://siglens.io` 기본값(SEO canonical 검증 시 이 도메인으로 나옴). 로컬 검증은 그대로 둬도 됨. |

> ⚠️ **env 원복 주의**(MEMORY): `.env.local`·`.env.production`은 gitignore라 swap 후 복원 누락이 잦다.
> 검증 끝나면 형제 워크트리(메인 레포)와 키셋 비교로 원복 확인. OAuth 등 메인 전용 값은 통째 복사 금지.

### 2.2 prod-like 빌드 → 실행

```bash
# 워크트리 node_modules는 symlink 금지(Turbopack 거부/dual-React). 독립 install 권장:
#   cd /Users/y0ngha/Project/siglens-fmp-cache && yarn install
# (core 0.27.0 핀이 메인 레포 node_modules와 다를 수 있음 → 워크트리 독립 install이 안전, MEMORY 트랩)

cd /Users/y0ngha/Project/siglens-fmp-cache

# 빌드 (exit code는 파이프 없이 직접 캡처 — yarn build | tail 은 실패를 exit 0으로 가린다)
yarn build > /tmp/fmp-cache-build.log 2>&1; echo "EXIT=$?"
# EXIT=0 이어야 함. tail /tmp/fmp-cache-build.log 로 prerender 에러 0 확인.

# prod 서버 (포트 4300 권장 — 메인 dev 4200과 충돌 회피)
yarn start -p 4300
```

- 기본 포트: `yarn start`는 3000. 본 문서는 **4300**을 사용(아래 모든 curl이 `localhost:4300`).
- 빌드 시점 env 주의(MEMORY): `/economy`·`/market` 등 빌드타임 prerender 페이지는 FMP_API_KEY가 빌드 env에도 있어야 full 데이터가 baked된다. **단 fundamental·차트는 on-demand ISR**(`generateStaticParams = []`)이라 빌드타임 prerender 대상이 아니며 첫 요청에 렌더된다 → 런타임 env로 충분.

### 2.3 ISR 리터럴 규칙 (회귀 false-positive 방지, MEMORY/MISTAKES §15)

`FMP_FUNDAMENTAL_REVALIDATE_SECONDS`는 route segment의 `export const revalidate`로 **쓰이지 않는다**(사용처 = `fmpGet` opts + Redis TTL 2곳뿐). 따라서 이 상수의 24h 변경은 "revalidate는 리터럴이어야 한다" 규칙과 **무관**하다. 페이지의 `export const revalidate = 86400`(리터럴)은 그대로 유지됨(`fundamental/page.tsx:60`). 리뷰봇이 이를 blocker로 들면 근거와 함께 반려.

### 2.4 dev 폴백 (full prod 빌드가 어려울 때)

```bash
cd /Users/y0ngha/Project/siglens-fmp-cache && yarn dev   # 포트 4200
```

폴백 시 손실되는 충실도:
- **ISR/캐시 hit 거동이 prod와 다름**(dev는 매 요청 재렌더, Next Data Cache 미적용) → §5 캐싱 spot-check는 사실상 무의미.
- prerender 에러(S-BUILD)는 못 잡음.
- 단, **기능 정확성(peer 표·차트 봉·SEO 마크업)은 dev에서도 검증 가능** → C-/B- 케이스 대부분은 유효. 포트만 4200으로 바꿔 실행.

---

## 3. Method A — curl 테스트 케이스

> 베이스 URL `http://localhost:4300`. 실증 심볼: **AAPL, MSFT, NVDA**(대형·유동성), 엣지 **SPY**(ETF), **ZZZZ**(무효).
> 모든 응답은 HTML(또는 redirect). 마커는 실제 컴포넌트 출력 문자열에 근거.
> 공통: `-s`(silent) `-i`(헤더 포함) `-A`(데스크톱 UA로 봇 분기 회피).

```bash
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
```

### 3.1 펀더멘털 페이지 — peer 표 & 밸류에이션 (변경 1·2)

| ID | 라우트 / 명령 | 기대 Status | 기대 마커 (substring) | Pass 기준 |
|---|---|---|---|---|
| C-PEER-1 | `curl -s -A "$UA" http://localhost:4300/AAPL/fundamental` | 200 | `동종업계 비교`(peer 섹션 제목), peer 내부 링크 `href="/MSFT/fundamental"`(또는 타 peer), 컬럼 헤더 `티커`·`회사명`·`시가총액`, 시총 compact 통화 문자열(`US$`+`조`/`T`/`B` 류) | peer 표 제목·3컬럼 헤더·≥1개 `/{PEER}/fundamental` 링크·compact 시총 모두 존재. **per/psr 컬럼 헤더는 없어야 함(원래도 없음)** |
| C-PEER-2 | `curl -s -A "$UA" http://localhost:4300/MSFT/fundamental \| grep -o 'href="/[A-Z]\{1,5\}/fundamental"' \| sort -u` | 200 | peer 티커 링크 목록 | 2개 이상 서로 다른 peer `/{X}/fundamental` 링크(크롤 가능) |
| C-PEER-3 | `curl -s -A "$UA" http://localhost:4300/NVDA/fundamental` | 200 | `동종업계 비교` + peer 링크 | NVDA에도 peer 표 정상 렌더(빈 EmptySectionCard 아님 — 단, 데이터 희소 시 EmptySection 허용하나 500 금지) |
| C-VAL-1 | `curl -s -A "$UA" http://localhost:4300/AAPL/fundamental` | 200 | ValuationCard 영역(밸류에이션 지표 — PER/PSR/EPS 등 카드). `재무지표와 애널리스트 의견`(H1), `밸류에이션` 관련 텍스트 | 본 종목 밸류에이션 카드 존재, 빈 N/A 일색 아님 |
| C-VAL-2 | `curl -s -A "$UA" http://localhost:4300/SPY/fundamental` | 200 또는 404 | ETF는 fundamental 탭 정책에 따라 — profile 있으면 200(degrade/empty 섹션 가능), 없으면 notFound | **500 없음**. 200이면 페이지 크롬 정상 렌더, 404면 noindex |

### 3.2 차트 페이지 — 일봉(1Day) split (변경 3)

> 차트 일봉은 SSR HTML에 직접 캔들 값이 안 박힐 수 있다(클라 hydrate). curl로는 **페이지 200 + 차트 컨테이너 존재 + 500 부재**까지 확인하고, 봉 개수·연속성은 Chrome 트랙(B-CHART)에서 본다.

| ID | 라우트 / 명령 | 기대 Status | 기대 마커 | Pass 기준 |
|---|---|---|---|---|
| C-CHART-1 | `curl -s -i -A "$UA" http://localhost:4300/AAPL \| head -1` | `HTTP/1.1 200` | — | 차트(심볼) 페이지 200. cold-gen에서도 500 없음(ISR connection() 미사용, MEMORY) |
| C-CHART-2 | `curl -s -A "$UA" http://localhost:4300/MSFT` | 200 | 차트 위젯 마커(예: 가격/차트 섹션 컨테이너, `차트` 또는 캔들 위젯 root), SymbolPageHeading | 페이지 본문 정상, 차트 영역 존재 |
| C-CHART-3 | `curl -s -i -A "$UA" http://localhost:4300/NVDA \| head -1` | `HTTP/1.1 200` | — | 200, 500 없음 |
| C-CHART-4 (edge: 무효) | `curl -s -i -A "$UA" http://localhost:4300/ZZZZ \| head -1` | 404(또는 graceful degraded 200) | — | **500 없음**. 무효 심볼이 split 경로를 타도 빈 결과 graceful 처리 |

### 3.3 SEO / 크롤 (변경 무관 — 회귀 가드)

| ID | 라우트 / 명령 | 기대 Status | 기대 마커 | Pass 기준 |
|---|---|---|---|---|
| C-SEO-1 | `curl -s -A "$UA" http://localhost:4300/AAPL/fundamental \| grep -i '<title>'` | 200 | `<title>` 에 종목명/티커 포함(`buildSymbolFundamentalSeoContent`) | title 비어있지 않음, AAPL/Apple 관련 |
| C-SEO-2 | `curl -s -A "$UA" http://localhost:4300/AAPL/fundamental \| grep -io 'rel="canonical"[^>]*'` | 200 | `canonical` → `…/AAPL/fundamental` | canonical 존재, 경로 일치 |
| C-SEO-3 | `curl -s -A "$UA" http://localhost:4300/AAPL/fundamental \| grep -o '"@type":"[A-Za-z]*"' \| sort -u` | 200 | `"@type":"WebPage"`, `"@type":"BreadcrumbList"`, `"@type":"FAQPage"`(+ FAQ 내 Question/Answer) | 3종 JSON-LD `@type` 모두 존재, 유효 JSON |
| C-SEO-4 | `curl -s -A "$UA" http://localhost:4300/AAPL/fundamental \| grep -io 'name="robots"[^>]*'` | 200 | robots 메타 — 유효 심볼은 noindex 아님(index 허용) | 유효 심볼에 noindex 없음(또는 index,follow) |
| C-SEO-5 (무효) | `curl -s -A "$UA" http://localhost:4300/ZZZZ/fundamental \| grep -io 'name="robots"[^>]*'` | 200/404 | `noindex` (NOINDEX_SYMBOL_METADATA) | 무효/미존재 심볼은 **noindex** |
| C-SEO-6 | `curl -s -A "$UA" http://localhost:4300/AAPL/fundamental \| grep -o 'href="/[A-Z]\{1,5\}/fundamental"' \| wc -l` | 200 | peer 내부 링크 수 | ≥1 — peer 링크가 크롤용으로 HTML에 존재(변경 2 후에도 internal link 보존) |

### 3.4 회귀 — 기존 탭 (변경이 깨지 않았는지)

| ID | 라우트 | 기대 | Pass |
|---|---|---|---|
| C-REG-1 | `curl -s -i -A "$UA" http://localhost:4300/AAPL/overall \| head -1` | 200 | overall 페이지 정상(분석 경로 enriched peer 소비처) |
| C-REG-2 | `curl -s -i -A "$UA" http://localhost:4300/AAPL/news \| head -1` | 200 | 기존 탭 회귀 없음 |
| C-REG-3 | `curl -s -i -A "$UA" http://localhost:4300/AAPL/financials \| head -1` | 200 | 기존 탭 회귀 없음 |

---

## 4. Method B — Chrome 테스트 케이스 (browser automation)

> claude-in-chrome MCP로 navigate → get_page_text / read_page(DOM) → read_console_messages.
> 시각·구조 확인 + 콘솔 에러 0 + 차트 캔들 실렌더 확인이 핵심. 베이스 `http://localhost:4300`.

| ID | 라우트 | 액션 | 확인 항목 | Pass 기준 |
|---|---|---|---|---|
| B-PEER-1 | `/AAPL/fundamental` | navigate → DOM 읽기(peer 섹션) | "동종업계 비교" 섹션에 표가 **정확히 3컬럼**(티커/회사명/시가총액)으로 렌더. 각 행 티커는 링크, 시총은 compact 통화 표기, 값 채워짐 | 3컬럼·데이터 행 ≥1·시총 포맷 정상. per/psr 컬럼 부재 |
| B-PEER-2 | `/MSFT/fundamental` | peer 티커 클릭(예: 첫 행) | 해당 peer의 fundamental 페이지로 이동(`/{PEER}/fundamental`) | 내부 링크 네비게이션 동작 |
| B-VAL-1 | `/AAPL/fundamental` | DOM 읽기(ValuationCard) | **본 종목** 밸류에이션 카드에 PER/PSR(및 EPS 등) 값이 **실제 숫자**로 표시(N/A 일색 아님) | 본 종목 PER·PSR 숫자 노출 |
| B-CHART-1 | `/AAPL` | navigate → 차트 로드 대기 → DOM/canvas 확인 | 일봉(1Day) 차트가 캔들로 렌더. 봉이 **연속**(주말·공휴일 갭은 정상, 중간 누락/중복 없음), 가장 오른쪽 봉 = 최신(오늘/직전 거래일) | 캔들 렌더, 우측 끝 최신 봉 존재, 시각적 갭/중복 없음 |
| B-CHART-2 | `/MSFT` → 기간 토글이 있으면 1D/일봉 선택 | 일봉 뷰에서 장기 구간(예: 1Y/Max) 스크롤 | split 경계(오늘−7d~−10d 구간)에서 봉 누락/중복 없음 | 경계 구간 연속, 단일 시리즈처럼 보임 |
| B-CHART-3 | `/NVDA` | navigate → 차트+현재가 확인 | 현재가/등락률이 최신값으로 표시(최근 live 윈도우+클라 refetch). 차트 우측 끝 봉과 현재가 정합 | 가격 신선, 차트-가격 불일치 없음 |
| B-ANALYSIS-1 (회귀 가드) | `/AAPL/fundamental` | AI 펀더멘털 요약 submit→poll 완료 대기, 분석 텍스트 확인 | 분석 결과에 **동종업계 PER/PSR 비교** 관련 문구가 정상(peer per/psr이 enriched로 채워져 N/A·결측 회귀 없음) | 분석 완료, peer 비교 내용에 결측/N/A 폭증 없음 |
| B-SEO-1 | `/AAPL/fundamental` | `<head>` 읽기 | title·description·canonical·og·twitter 메타 존재, JSON-LD 3종 | 메타+JSON-LD 정상(C-SEO와 교차 확인) |
| B-CONSOLE-1 | `/AAPL/fundamental`, `/AAPL` | navigate 후 콘솔 읽기 | 런타임 콘솔 **에러 0**(의도된 warn 제외) | error 레벨 메시지 없음 |
| B-REG-1 | `/AAPL/overall` | navigate → 렌더 확인 | overall 페이지 정상(분석 통합) | 페이지 정상, 콘솔 에러 없음 |

---

## 5. 캐싱 동작 spot-check (best-effort, 선택)

> ⚠️ curl/Chrome로 캐시 hit·TTL·FMP 호출 감소를 **직접** 관측할 수 없다(내부 거동). 아래는 간접 신호이며,
> Redis(docker SRH 또는 Upstash)가 연결돼 있을 때만 의미가 있다. Redis 미설정 시 전 경로가 fallback 직접 fetch라 이 절은 스킵.

### 5.1 EOD split 키 존재 확인 (docker Redis 사용 시 가장 확실)

QA_ENV_SETUP §1대로 docker 백엔드를 띄우고 앱이 SRH를 보게 한 뒤:

```bash
# 차트 1회 요청으로 캐시 워밍
curl -s -A "$UA" http://localhost:4300/AAPL > /dev/null

# docker redis에서 키 확인 (split가 동작하면 eodhist/eodrecent 키가 생긴다)
docker exec -it <redis_container> redis-cli KEYS 'bars:eod*:AAPL*'
#  기대: bars:eodhist:AAPL:<from>:<histTo>  와  bars:eodrecent:AAPL:<recentFrom>  둘 다 존재
docker exec -it <redis_container> redis-cli KEYS 'fundamental:peers-raw:AAPL'
#  기대: 변경 2의 raw peer 키 존재
docker exec -it <redis_container> redis-cli TTL 'bars:eodhist:AAPL:<from>:<histTo>'
#  기대: 24h~48h 범위(EOD_HIST_TTL=2d). recent 키 TTL은 세션 의존(장중 ~60s).
docker exec -it <redis_container> redis-cli TTL 'fundamental:key-metrics:AAPL'
#  기대: ~24h(변경 1, 이전엔 ~1h)
```

Pass: `bars:eodhist:*`·`bars:eodrecent:*`·`fundamental:peers-raw:*` 키가 생성되고, hist TTL이 long(>1d)·fundamental TTL이 ~24h.

### 5.2 응답 타이밍 (Redis 없을 때 약한 신호)

```bash
# 동일 페이지 2회 — warm일수록 빨라짐(단 ISR/Next Data Cache 등 교란 많아 결정적이지 않음)
for i in 1 2; do curl -s -A "$UA" -o /dev/null -w "req$i: %{time_total}s\n" http://localhost:4300/AAPL/fundamental; done
```

한계: ISR HTML 캐시·OS 캐시 등 교란이 커서 FMP 절감을 직접 증명하지 못함. **본 변경의 호출/egress 절감은 prod FMP usage 대시보드로만 정량 확인 가능**(설계 §6). 로컬 검증의 본질은 "절감하면서 화면이 안 깨졌나"이며, 그건 §3·§4가 담당.

### 5.3 merge 정확성 단위 신뢰

봉 병합 동일성(`mergeBarsByTime`)·짧은 lookback 가드는 단위 테스트가 커버:
```bash
cd /Users/y0ngha/Project/siglens-fmp-cache
yarn vitest run src/shared/api/market/__tests__/mergeBarsByTime.test.ts \
  src/shared/api/market/__tests__/CachedMarketDataProvider.test.ts \
  src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts
#  전부 green이면 split/merge/peer-raw 로직 정확. B-CHART는 실런타임 회귀만 잡으면 됨.
```

---

## 6. SEO 체크 (요약)

변경은 SEO 출력과 무관하나 회귀 가드로 명시 확인한다.

- **유효 심볼**(`/AAPL/fundamental`): `<title>`·description·canonical(`…/AAPL/fundamental`)·og/twitter 메타 존재. robots **noindex 아님**. JSON-LD WebPage·BreadcrumbList·FAQPage 3종(C-SEO-1~4, B-SEO-1).
- **무효/미존재 심볼**(`/ZZZZ/fundamental`): `NOINDEX_SYMBOL_METADATA` → robots **noindex**(C-SEO-5).
- **Peer 내부 링크**: peer 표의 각 티커가 `/{PEER}/fundamental` 링크로 HTML에 존재(크롤 가능) — 변경 2(raw peer 전환) 후에도 보존(C-SEO-6, C-PEER-2).

---

## 7. Pass/Fail 체크리스트 (실행자 기입)

### 환경
- [ ] 워크트리 독립 `yarn install` 완료, core `0.27.0` 핀 일치
- [ ] `FMP_API_KEY`·`DATABASE_URL` 설정 확인 / (선택) `UPSTASH_*` 또는 docker Redis
- [ ] `yarn build` EXIT=0, prerender 에러 0 (`/tmp/fmp-cache-build.log`)
- [ ] `yarn start -p 4300` 기동

### Method A — curl (총 18개)
- [ ] C-PEER-1 / C-PEER-2 / C-PEER-3 (peer 표 3컬럼·내부 링크)
- [ ] C-VAL-1 / C-VAL-2 (본 종목 밸류에이션, ETF 500 없음)
- [ ] C-CHART-1 / C-CHART-2 / C-CHART-3 / C-CHART-4 (차트 200, 무효 500 없음)
- [ ] C-SEO-1 / C-SEO-2 / C-SEO-3 / C-SEO-4 / C-SEO-5 / C-SEO-6 (title/canonical/JSON-LD/robots/peer 링크)
- [ ] C-REG-1 / C-REG-2 / C-REG-3 (overall/news/financials 회귀)

### Method B — Chrome (총 10개)
- [ ] B-PEER-1 / B-PEER-2 (3컬럼 렌더, peer 링크 네비)
- [ ] B-VAL-1 (본 종목 PER/PSR 숫자)
- [ ] B-CHART-1 / B-CHART-2 / B-CHART-3 (일봉 연속·최신 봉·가격 신선)
- [ ] B-ANALYSIS-1 (분석 peer per/psr 회귀 없음 — 가드)
- [ ] B-SEO-1 (head 메타+JSON-LD)
- [ ] B-CONSOLE-1 (콘솔 에러 0)
- [ ] B-REG-1 (overall 회귀)

### 캐싱 (선택, Redis 연결 시)
- [ ] §5.1 `bars:eodhist:*`·`bars:eodrecent:*`·`fundamental:peers-raw:*` 키 존재 + hist long-TTL + fundamental ~24h
- [ ] §5.3 `mergeBarsByTime`/`CachedMarketDataProvider`/`CachedFundamentalProvider` 단위 테스트 green

### 종료 (원복 필수, QA_ENV_SETUP §7)
- [ ] `.env.local`/`.env.production` 원복(메인 워크트리와 키셋 비교)
- [ ] prod 서버 종료(`lsof -ti :4300` → kill)
- [ ] (docker 사용 시) `yarn e2e:down`

### Exit Criteria
- [ ] curl 18 + Chrome 10 전부 PASS, 콘솔 에러 0, build EXIT=0
- [ ] §1.2 "동일해야 하는 동작" 모두 변경 전과 일치(peer 표 / 밸류에이션 / 차트 일봉 / 가격 신선 / SEO / 분석 peer)
- [ ] 회귀 가드(B-ANALYSIS-1, C-REG-*) PASS

# ISR 비용·SEO 최적화 R2 설계

> 작성 2026-06-15 · [`2026-06-06-isr-writes-optimization-design.md`](./2026-06-06-isr-writes-optimization-design.md)의 후속(R2)
> 관련: [`docs/architecture/ISR_REVALIDATE.md`](../../architecture/ISR_REVALIDATE.md),
> 메모리 `project_vercel_cost_breakdown`·`project_cloudflare_vercel_infra`·`project_isr_revalidate_tuned`

## 1. 배경

6/6 R1(비결정적 SSR 출력 제거)으로 ISR Write 급증은 잡혔으나, **현재도 ISR Write가 비용 1위로 ~$10/day(≈$300/월) 지속**된다. 트래픽은 사용자 확인상 **주로 봇 크롤러**다. 본 설계 착수 전 다음을 실측·확정했다.

### 1.1 측정 결과

1. **R1 수정 라우트는 결정적이다.** chart·fear-greed·`/market`은 6/6 quantize/핀으로 byte-identical 재생성(write 0). fundamental도 timestamp·dehydrate seed가 없어 사실상 0.
2. **`overall`은 떼낼 휘발성 필드가 없다.** `OverallAnalysisResponse`는 `headlineKo / technicalBulletsKo / fundamentalBulletsKo / newsBulletsKo / optionsBulletsKo / integratedConclusionKo / scenarios / riskFactorsKo / optionsOiStale?`뿐 — `generatedAt`·`requestId` 같은 메타가 전무. dehydrate/bars seed도 없이 prop으로만 전달. → chart식 "jitter 필드 제거"의 대상이 없다. overall write는 (a) 봇의 first-gen, (b) 실제 분석 변경 후 12h 만료 재크롤 시 1회(정당·미미)뿐.
3. **siglens.io가 현재 Cloudflare 프록시를 안 거친다(grey-cloud).** 헤더 실측: `server: Vercel`, `cf-ray` 없음, cf-* 전무(정적 자산 포함). DNS 실측: 네임서버는 Cloudflare(`*.ns.cloudflare.com`)지만 A 레코드가 Vercel IP(`216.198.79.1`·`64.29.17.1`, whois=Vercel)로 직결 = **레코드가 회색 구름(프록시 OFF)**. 6/6엔 주황 구름 + WAF 봇 차단이 활성이었다(`project_cloudflare_vercel_infra`). 그 사이 OFF로 바뀌어 **WAF·봇 차단이 전부 비활성**.
4. HTML 응답은 `Cache-Control: public, max-age=0, must-revalidate` + `Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch` → 중간 캐시가 HTML을 안전하게 캐싱하기 어려운 형태(§5.3).

### 1.2 비용 인과 결론

지배적 비용 = **봇이 광고된 롱테일 surface(한국 종목 전수 × 5라우트)를 크롤하며 만드는 first-gen ISR write** + **6/6 WAF 보호막이 꺼져 봇이 Vercel을 직격**. byte-identical 스킵은 first-gen에는 적용되지 않으므로, 레버는 (a) 광고 surface 축소, (b) 엣지 봇 차단 복구, (c) AI봇 robots 정책이다.

## 2. 목표 / 비목표

**목표**
- 봇 주도 first-gen ISR write를 줄인다(광고 surface 축소 + 엣지 봇 차단 복구 + robots 정책).
- **모든 종목의 discoverability(외부 검색 색인)와 SEO·사용자 신선도를 보존**한다.

**비목표**
- **#1(overall seed quantize)** — §1.1-2 측정으로 줄일 대상 없음이 확인되어 드롭.
- `revalidate` 값 변경(#572 유지), `@y0ngha/siglens-core` 변경.
- 반응형 sitemap 승격(별도 백로그 — §6).
- 롱테일 서브 라우트 `noindex`(페이지-티어 결합 회피 — §6).
- HTML Cache Rule(§5.3 footgun, WAF 효과 측정 후 별도 후속).

## 3. #2 — 롱테일 **라우트** 가지치기 (코드)

### 3.1 설계

`buildLongTailEntries`가 롱테일 종목당 **5라우트**(`/TICKER`, `/news`, `/fundamental`, `/overall`, `/fear-greed`)를 sitemap에 등재하던 것을, **`/TICKER` 메인 1라우트만** 등재하도록 축소한다. `buildPopularEntries`(popular)는 불변(서브 라우트·옵션 유지).

- 적용: `src/entities/sitemap-entry/lib/buildLongTailEntries.ts` — 반환 엔트리를 메인 URL 1개로 축소.
- 효과: 롱테일 sitemap-광고 surface 5→1(~80% 축소) → 검색봇 first-gen write 대폭 감소. 서브 4라우트의 thin/scaled-content 색인 리스크도 감소.

### 3.2 discoverability 보존 (사용자 우려 해소)

- **종목을 빼는 게 아니라 라우트를 줄이는 것**이다. 모든 종목의 메인 `/TICKER`는 그대로 sitemap에 있어 색인되므로, 사용자가 외부 검색엔진에서 그 종목을 검색하면 메인 페이지가 나타난다.
- 서브 라우트는 on-demand ISR로 **계속 존재**하고 내부 링크(`CrossLinkCards`)로 도달 가능 — 색인만 sitemap 미광고로 천천히/저우선순위가 될 뿐 페이지가 사라지지 않는다.
- 근거: sitemap은 발견 힌트지 색인 보증·조건이 아니다. 또한 SEO 자료상 raw-fact 롱테일 대량 색인은 약한 레버이자 scaled-content 리스크라, 서브 4라우트 미광고는 비용·리스크를 함께 줄인다.

## 4. #4 — robots.txt AI봇 하이브리드 (코드)

`src/app/robots.ts`에 AI 크롤러 규칙을 추가한다. **검색봇은 절대 차단하지 않는다**(Googlebot·Yeti·Bingbot·Daumoa 등).

- **전면 Disallow (순수 학습/스크레이퍼, 트래픽만 유발·SEO 가치 0)**:
  `GPTBot, Google-Extended, Applebot-Extended, Bytespider, CCBot, Meta-ExternalAgent, Amazonbot, anthropic-ai, cohere-ai, Diffbot, Omgilibot, ImagesiftBot`
- **crawlDelay 유지 (AI 검색·인용 트래픽 보존)**:
  `PerplexityBot, OAI-SearchBot` (+ 기존 `ClaudeBot`/`Claude-SearchBot` 60s 유지)
- 검색봇: 불변(`userAgent: '*'` allow `/`, `/api/` disallow 유지).

> ⚠️ Google-Extended는 Gemini/Vertex **학습** opt-out 토큰으로 검색 색인(Googlebot)과 무관하다. GoogleOther 계열(기존 Disallow 유지)과 혼동 금지. Googlebot/Googlebot-* 계열은 절대 Disallow에 넣지 않는다.

robots.txt는 **협조 봇에 대한 정중한 신호**이고, 비협조 봇은 §5의 WAF가 강제 차단한다(상호보완).

## 5. #3 — CF 주황 구름 재활성화 + WAF 복구 (사용자 적용 런북)

> CF 대시보드/DNS 변경은 사용자가 직접 수행한다(Claude는 계정 로그인·설정 변경 불가). 본 절은 정확한 런북이다.

### 5.1 사전 점검 (전환 전 필수)

1. 현재 grey-cloud가 **의도였는지** 확인(SSL/리다이렉트 루프 회피 목적이었을 수 있음).
2. CF SSL/TLS 모드를 **Full (Strict)** 로 설정(Vercel은 유효 인증서 제공). `Flexible`은 루프·혼합콘텐츠 유발.
3. A/CNAME 레코드를 **주황 구름(프록시 ON)** 으로 토글 후, `/`·`/AAPL`·`/AAPL/overall` 등에서 **리다이렉트 루프·SSL 오류·`cf-ray` 출현**을 실측 검증.

### 5.2 WAF 룰 (무료 플랜: custom 5개 한도 중 3개 사용)

| # | 이름 | 표현식(무료 플랜 문법) | 액션 |
|---|---|---|---|
| R1 | Block scanner paths | `http.request.uri.path contains ".php" or http.request.uri.path contains "/wp-" or http.request.uri.path contains "/.env" or http.request.uri.path contains "/.git"` | Block |
| R2 | Block abusive ASN | `ip.geoip.asnum in {132203 13220}` | Block |
| R3 | Challenge non-KR 비검증 봇 (핵심 레버) | `(ip.geoip.country ne "KR") and (not cf.client.bot) and (not lower(http.user_agent) contains "yeti") and (not lower(http.user_agent) contains "daum") and (not lower(http.user_agent) contains "claudebot") and (not lower(http.user_agent) contains "claude-searchbot") and (not lower(http.user_agent) contains "perplexitybot") and (not lower(http.user_agent) contains "oai-searchbot")` | Managed Challenge |

**핵심 = R3.** 검증 검색봇(Googlebot/Bingbot = `cf.client.bot`)·한국 검색봇(Yeti/Daum)·#4에서 살린 AI봇(Claude/Perplexity/OAI)은 예외로 통과시키고, **나머지 non-KR 비검증 봇(비협조 학습봇·비식별 데이터센터 스크레이퍼)은 Managed Challenge** → JS 챌린지를 못 풀어 페이지 렌더 불가 → **first-gen ISR write 0**. robots.txt를 무시하는 봇을 엣지에서 잡는 catch-all이다.

**6/6과의 차이**:
- **R2에서 `216.73.216.0/24`(ClaudeBot AWS 범위) 제외** — 사용자가 ClaudeBot 하드 Block을 이미 해제하고 robots `crawlDelay`로 완화. (6/6의 23k/day는 crawlDelay 미적용 시절 수치 — #4가 60s 적용하므로 협조 시 자율 throttle.)
- R3에 Claude/Perplexity/OAI **UA 예외 추가**(접근 유지). Challenge라 UA spoofing 리스크는 낮다(허용 오류뿐).

> ⚠️ **적용 시 CF Security Analytics(24h)로 top-offender IP/ASN을 재확인**하고 R2의 ASN을 현행화한다(IP/ASN은 시간에 따라 변함). 132203·13220은 6/6 식별값이다.

### 5.3 HTML Cache Rule — 보류 (근거)

App Router는 같은 URL에서 **완전 HTML**(초기 진입·크롤러)과 **RSC 페이로드**(클라 navigation/prefetch)를 요청 헤더(`RSC`, `Next-Router-State-Tree` 등)로 분기해 응답하며, 그래서 `Vary: rsc, next-router-*`를 보낸다. CF는 기본적으로 `Accept-Encoding` 외 Vary를 캐싱에 반영하지 않으므로, 순진한 "Cache Everything"은 **한 변형을 모두에게 제공**해 브라우저가 RSC 페이로드를 받는 등 **페이지가 깨질 수 있다**. 안전하게 하려면 `RSC` 헤더 부재 시(완전 HTML)만 캐싱하도록 cache-key/eligibility를 커스터마이즈해야 하는데, 무료 플랜에선 제한적이다. 비용 직격은 R3(WAF)가 수행하므로, **HTML 엣지 캐싱은 WAF 효과를 측정한 뒤 필요 시 별도 후속**으로 정밀 설계한다(footgun 대비 한계이득=주로 Fast Data Transfer 절감).

## 6. 트레이드오프 / 의식적 보류

- **#2 서브 라우트 미광고**: 무명 종목의 서브 페이지가 SERP에 늦게/덜 색인될 수 있으나, 메인 페이지로 종목 자체는 발견 가능하고 서브는 thin이라 어차피 약한 레버 + scaled-content 리스크 감소. **반응형 승격**(GSC impression/pageview 임계 시 서브 라우트 승격)은 우려를 추가 보완하나 본 범위 밖(백로그).
- **noindex 미적용**: 4개 서브 라우트 `generateMetadata`에 티어 판정을 넣으면 페이지-티어 결합이 생겨 보류. 후속 시 `proxy.ts`에서 `X-Robots-Tag`로 1곳 처리(백로그).
- **R3가 AI봇 일부를 살림**: Claude/Perplexity/OAI 예외로 비용 절감은 소폭 양보하되 LLM 인용 가시성 보존. robots `crawlDelay`가 자율 throttle.

## 7. 테스트 전략

- **#2**: `buildLongTailEntries`가 종목당 메인 1라우트만 생성하는지(서브 4라우트 부재) 단위 테스트. `buildPopularEntries`는 불변(기존 테스트 유지).
- **#4**: `robots.test.ts` 확장 — Disallow/crawlDelay 그룹을 exact-array로 단언, 기존 "검색봇 절대 미차단" 가드 유지, Google-Extended는 포함·Googlebot 계열은 미포함 단언.
- **#3**: 코드 변경 없음(런북). 적용 후 실측 검증(§8).

## 8. 검증

- **코드(#2·#4)**: `yarn test` 통과 + `yarn build` 후 `/sitemap-longtail-1.xml`에 종목당 메인 1 URL만 있는지, `/robots.txt`에 AI봇 규칙이 의도대로 렌더되는지 실측.
- **인프라(#3)**: 주황 구름 전환 후 `cf-ray` 출현 + 루프/SSL 무오류 확인. 며칠 뒤 **Vercel ISR Write 일별 추세 하락** + CF Security Analytics에서 R3 Challenge 이벤트 증가로 최종 확인.

## 9. 영향 파일

| 파일 | 변경 |
|---|---|
| `src/entities/sitemap-entry/lib/buildLongTailEntries.ts` | 롱테일 엔트리 5라우트 → 메인 1라우트 |
| `src/entities/sitemap-entry/**/__tests__` | 롱테일 1라우트 단위 테스트 |
| `src/app/robots.ts` | AI봇 Disallow/crawlDelay 그룹 추가 |
| `src/app/__tests__/robots.test.ts` | AI봇 규칙 exact-array 단언 |
| `docs/architecture/CDN_CACHING.md` (신규) | CF 주황 구름 재활성화 + WAF 런북(§5) |

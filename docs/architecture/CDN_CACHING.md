# CDN(Cloudflare) 캐싱·봇 보호 런북

> 적용 주체: 사용자(CF 대시보드). 코드 쪽 대응은 이 레포에 있고, 엣지 룰은 대시보드에서 적용한다.
> 관련 메모리: `project_cloudflare_vercel_infra`. 실측 도구: [`scripts/probe-cdn-cache.sh`](../../scripts/probe-cdn-cache.sh).

## 0. 현재 상태 (2026-08-12 실측 — 응답 헤더)

- apex `siglens.io`는 **orange(프록시됨)** — `server: cloudflare` + `cf-ray` 확인. 오리진은 AWS(Vercel 이관 완료).
- HTML은 엣지에 캐시된다: `/`·`/AAPL` 재요청 시 `cf-cache-status: HIT` + `age` 증가.
- `/_next/static/*`는 확장자 기본 캐싱으로 `HIT` (`cache-control: public, max-age=31536000, immutable`).
- **RSC 요청은 항상 `DYNAMIC`** — §3의 HTML 룰이 `rsc` 요청 헤더를 매칭 제외 조건으로 쓰기 때문. 의도된 설계였다.
- 존: account `2462030a7138ffe4be726f78046fd6d7` · zone `siglens.io` (free plan).

---

## 1. 히트율이 1~10%인 이유 (2026-08-12 진단)

대시보드 히트율은 **요청 수 기준**이다. HTML 캐싱 자체는 정상 동작하는데도 비율이 한 자릿수인 것은,
**캐시 대상이 아닌 요청이 전체 요청 수를 지배**하기 때문이다. 큰 것부터:

### (1) RSC prefetch 폭주 — 가장 큰 원인

App Router의 `<Link>`는 기본값(`prefetch={null}` = auto)에서 **뷰포트에 들어온 링크의 RSC 페이로드를
즉시 당겨온다**. 그리고 그 요청은 §3 룰에서 캐시 우회(`DYNAMIC`)다. 즉 **prefetch 1건 = 캐시 미스 1건 + 오리진 요청 1건**.

페이로드 크기 실측(`curl -H 'RSC: 1' -H 'Next-Router-Prefetch: 1'`, 비압축 = 오리진 egress 기준):

| 라우트 | RSC 페이로드 | 라우트 | RSC 페이로드 |
|---|---:|---|---:|
| `/AAPL` | 1.71 MB | `/AAPL/options` | 1.02 MB |
| `/AAPL/news` | 2.67 MB | `/AAPL/congress` | 1.02 MB |
| `/AAPL/fear-greed` | 1.71 MB | `/AAPL/overall` | 0.91 MB |
| `/AAPL/fundamental` | 0.93 MB | `/AAPL/financials` | 0.92 MB |

- 종목 페이지 한 번 열면 `SymbolTabs`(형제 탭 6~8개) + `CrossLinkCards`(같은 탭 집합 재노출)가
  **페이지뷰당 ~10MB의 RSC를 오리진에서 끌어온다**. 클릭은 많아야 한 번이다.
- 랜딩(`/`)은 내부 링크가 95개다. 스크롤만 해도 그 수만큼 1.7MB짜리 페이로드를 예약한다.
- 오리진은 `next.config.ts`에서 `compress: false`(엣지 brotli에 위임)라, 오리진→엣지 구간은 위 비압축 크기 그대로다.

#### ⚠️ `_rsc` 해시는 진입 페이지마다 다르다 — prefetch는 캐시를 데우지 못한다

**2026-08-13 실측으로 밝혀진 결정적 사실.** prefetch 요청 URL에 붙는 `_rsc=<hash>`는
`computeCacheBustingSearchParam(prefetch, segment-prefetch, **router-state-tree**, next-url)`로
계산된다. 라우터 상태 트리가 인자에 들어가므로 **같은 목적지라도 사용자가 어느 페이지에 있느냐에
따라 값이 달라진다**:

```
/news 로 가는 prefetch 요청 URL
  /      에서 진입 → /news?_rsc=1r34m
  /AAPL  에서 진입 → /news?_rsc=3gi0o
  /market에서 진입 → /news?_rsc=umnn7
  /news  에서 진입 → /news?_rsc=wymdp
```

CDN 캐시 키는 URL이다. 따라서 **prefetch가 캐시를 데우는 게 아니라, 재사용되지 않을 캐시
엔트리를 사용자마다 새로 만든다**. 저장은 되지만 다음 사용자는 다른 키를 요청하므로 항상 MISS다.
무료 플랜은 캐시 키에서 쿼리 파라미터를 제거할 수 없어(Enterprise 전용) **엣지에서 고칠 방법이 없다 —
prefetch를 끄는 것이 유일한 해법**이다.

실측된 피해(2026-08-13, 9시간, 5xx 제외 실사용자 GET):

| 경로 | 요청 | miss | 히트율 | 비고 |
|---|---:|---:|---:|---|
| `/news` | 67 | 63 | **1%** | 헤더 네비 대상 |
| `/economy` | 30 | 27 | **0%** | 헤더 네비 대상 |
| `/market` | 37 | 32 | **3%** | 헤더 네비 대상 |
| `/` | 74 | 29 | **38%** | 직접 방문(HTML) 비중이 커서 유일하게 높다 |

**코드 대응**:
- 1차(v0.52.5): 무거운 심볼 라우트 링크 — `SymbolTabs`, `CrossLinkCards`, `CategoryCardGrid`,
  `SignalStockCard`, `IndexCard`, `PeersTable`, `MarketNewsCard`, `SymbolSearchPanel`,
  `PositionHoldingCard`, `OptionsEmptyState`.
- 2차(이 PR): **전역 네비게이션** — `Header`(로고), `HeaderNav`, `HeaderNavStatic`,
  `HeaderMobileMenu`, `Footer`, `NewsCategoryTabs`, `CategoryCard`, 랜딩의 `HERO_QUICK_LINKS`와
  `/backtesting` CTA. 1차에서 "가벼운 라우트라 R2가 받아준다"고 남겨둔 판단이 위 실측으로
  뒤집혔다 — 파편화 때문에 R2는 이들을 구제하지 못한다.

  전역 헤더의 인증 CTA(`HeaderUserMenu`의 로그인·회원가입)와 동의 화면의 `/privacy`·`/terms`
  링크(`ConsentCheckboxGroup`)도 포함한다 — 처음엔 "전환 행동이라 prefetch 이득이 크다"고
  예외로 두려 했으나 실측이 반대였다: `/login` 히트율 22.2%(miss 54), `/signup` 44.0%(miss 38).
  게스트의 모든 페이지뷰에 렌더되므로 NAV_ITEMS와 같은 범주다.

**유지하는 예외**: `/share/[id]`의 CTA 하나. 공유 링크로 유입된 방문자의 단일 주요 행동이고,
전역 렌더가 아니라 그 페이지에서만 1회 렌더된다(파편화 기여가 사실상 없다).
에러 바운더리(`error.tsx`·`not-found.tsx`·`global-error.tsx`)의 `/` 링크도 그대로 둔다 —
에러 시에만 렌더되므로 트래픽이 무시할 수준이다.

**이 PR의 검증**(Playwright, 진입 4곳 `/`·`/AAPL`·`/market`·`/news`, 각각 로드 + 끝까지 스크롤):

| | 총 RSC 요청 | 목표 페이지로 간 prefetch |
|---|---:|---|
| master (프로덕션) | 125건 | `/market`·`/news`·`/economy`·`/privacy`·`/terms` 각 진입점마다 3~5건씩 |
| 이 PR (로컬 prod 빌드) | **0건** | **없음** |

전역 링크를 모두 정리한 결과 초기 로드 단계의 RSC prefetch가 완전히 사라졌다. 라우트 이동은
클릭 시점 fetch로 정상 동작하며, 그 요청은 §3 R2가 캐시 대상으로 받는다.

**실측 효과**(Playwright, `/AAPL` 1회 조회 + 끝까지 스크롤 + 탭 1회 클릭):

| | 초기 로드 심볼 RSC | 탭 클릭 후 발생 |
|---|---:|---:|
| master (프로덕션) | 8건 (형제 탭 전부) | 27건 |
| 이 PR (로컬 prod 빌드) | **0건** | **1건** |

탭 클릭 내비게이션은 양쪽 모두 정상(같은 경로 도달, 본문 3438자 동일).

> ⚠️ Next 16에서 `prefetch={false}`는 뷰포트 prefetch뿐 아니라 **hover prefetch도 끈다**
> (`link.js`: `prefetchEnabled = prefetchProp !== false`). 클릭 시점에 RSC를 받아오므로
> §3의 RSC 캐시 룰이 함께 적용돼야 체감 속도를 회복한다.

### (2) Server Action POST — 프로토콜상 캐시 불가

클라이언트 데이터 훅이 전부 Server Action(현재 URL로 가는 POST)이다: `useBars`, `useAssetInfo`,
`useCurrentUser`(내비게이션마다 1회), `useUserTier`, `useSectorSignals`, 각 탭의 분석 트리거 등.
POST는 CDN이 캐시하지 않으므로 페이지뷰마다 여러 건의 "미스"로 계상된다. **구조적 비용이라 이 PR에서는 건드리지 않는다.**

### (3) 롱테일 × 콜로 파편화

종목 수천 개 × 탭 8개 = URL 롱테일. 엣지 TTL이 2시간이고 Tiered Cache가 꺼져 있으면
**각 콜로가 독립적으로 콜드 미스**를 낸다. 실측에서도 같은 URL이 LAX에서는 HIT, SJC에서는 MISS였다.

### (4) 크롤러 트래픽

봇은 HTML만 받고 JS/정적 자산을 안 받는다. 즉 봇 요청은 히트율 분모에 롱테일 미스만 더한다.

### (5) OG/트위터 이미지가 캐시 불가 헤더로 나갔다

`/[symbol]/opengraph-image`·`twitter-image`가 **히트율 0%**였다(2026-08-13, 221요청 전량 miss).

원인은 `next/og`의 `ImageResponse`다 — 응답에
`cache-control: public, max-age=0, must-revalidate`를 **하드코딩된 기본값**으로 붙인다
(`next/dist/server/og/image-response.js`). 라우트에 선언한 `export const revalidate = 2592000`은
Next 쪽 재생성 주기일 뿐 이 헤더에 반영되지 않아, CDN에는 "매번 오리진에 재검증하라"는 지시가
전달됐다. §3 R1의 엣지 TTL이 `respect_origin`이므로 이 헤더를 그대로 존중해 캐시가 되지 않았다.

같은 파일에서 `options.headers`가 기본값을 덮어쓰므로, `OG_IMAGE_CACHE_CONTROL`
(`shared/lib/og.ts`)을 명시해 해결했다: `public, max-age=0, s-maxage=604800,
stale-while-revalidate=86400`. 브라우저는 종전대로 매번 재검증하고, CDN만 7일 보관한다.

⚠️ **배포로는 이 URL의 엣지 캐시가 무효화되지 않는다**(경로가 그대로다). OG 템플릿을 바꾸고
즉시 반영해야 하면 CF Purge를 쓴다. 7일로 제한한 이유가 이것이다.

`/share/[id]/opengraph-image`는 예외로 원래 헤더를 유지한다 — 공유 만료 여부에 따라 그림이
바뀌므로 엣지에 며칠씩 남으면 만료된 공유가 정상 카드로 계속 노출된다.

---

## 2. 개선 레버 (우선순위)

| # | 레버 | 적용 주체 | 기대 효과 |
|---|---|---|---|
| L1 | 무거운 링크 `prefetch={false}` | 코드(v0.52.5) | 심볼 라우트 RSC를 조회당 8건 → 0건, 내비게이션당 27건 → 1건 (실측, §1) |
| L1b | 전역 네비 `prefetch={false}` | 코드(이 PR) | `_rsc` 파편화로 재사용 0인 캐시 엔트리 생성을 중단 — `/news`·`/market`·`/economy` 대상 (§1) |
| L2 | RSC 응답 엣지 캐싱(§3 R2) | CF 대시보드 | 남은 RSC 요청이 `DYNAMIC` → `HIT`. L1의 체감 속도 회복 |
| L3 | Tiered Cache(Smart) 켜기 | CF 대시보드 | 롱테일 콜드 미스 감소 — 하위 콜로가 상위 콜로에서 채움 |
| L4 | 엣지 TTL을 blanket 2h override → **origin `cache-control` 존중**으로 | CF 대시보드 | 라우트별 `s-maxage`(1h~24h)를 그대로 사용 + 인증 셸 오버캐싱 제거 |
| L5 | RSC 페이로드 자체 축소 | 백로그 | 1.7MB의 대부분이 `IndicatorResult` 직렬화. 클라 경계에서 화이트리스트 trim |
| L6 | 메타데이터 이미지 캐싱 | 코드(이 PR) | OG/트위터 이미지 히트율 **0% → 캐시 가능**. 아래 (5) 참조 |

---

## 3. Cache Rule 세트 (무료 플랜, 2개 사용)

App Router는 같은 URL에서 완전 HTML과 RSC 페이로드를 요청 헤더(`RSC`)로 분기하고 `Vary: rsc, next-router-*`를 보낸다.
**무료 플랜은 캐시 키에 헤더를 넣지 못한다** — 그래서 "Cache Everything" 한 방은 RSC 페이로드를 브라우저에
서빙해 페이지를 깨뜨린다. 대신 **룰 매칭 조건에는 요청 헤더를 쓸 수 있으므로**, 아래처럼 HTML과 RSC를
서로 다른 URL 공간(`_rsc` 파라미터 유무)으로 갈라 각각 캐시한다.

> 핵심 불변식: **`?_rsc=` 가 붙은 URL은 RSC 전용 캐시 공간이다.** 그 키에 HTML이 한 번이라도
> 저장되면 진짜 prefetch가 HTML을 받아 클라이언트 내비게이션이 깨진다.

⚠️ **이 불변식은 엣지에서만 지킬 수 있다 — origin(미들웨어)에서는 불가능하다.** 처음엔
`src/proxy.ts`에서 "`_rsc`가 있는데 `RSC` 헤더가 없으면 307로 파라미터를 떼는" 가드를 넣으려 했는데,
로컬 prod 빌드 실측 결과 **발화하지 않았다**. Next가 미들웨어 진입 전에 양쪽을 다 지워버리기 때문이다
(`next/dist/server/web/adapter.js`):

- L153 `stripInternalSearchParams(normalizeURL)` — `_rsc`를 URL에서 제거한 뒤 `NextRequest`를 만든다.
- L139~147 — `FLIGHT_HEADERS`(`RSC` 포함)를 미들웨어용으로 요청 헤더에서 **삭제**한다.

즉 미들웨어는 `_rsc`도 `RSC` 헤더도 볼 수 없다(실측: `/aapl?_rsc=probe` → 301 `Location: /AAPL`,
`_rsc`가 이미 사라진 상태). 따라서 **R1의 `_rsc=` 제외 조건이 유일한 방어선**이다. §3 적용 순서를
반드시 지킬 것.

### R1 — Cache HTML documents (non-RSC) · **수정 필요**

```
(http.request.method eq "GET"
 and not len(http.request.headers["rsc"]) > 0
 and not starts_with(http.request.uri.path, "/api")
 and not http.request.uri.query contains "_rsc=")
```

- `len(http.request.headers["rsc"]) > 0`은 **현재 배포돼 동작 중인 표현식**이다(대시보드 빌더가
  생성한 형태). `len()`은 String·Bytes뿐 아니라 Array도 받아 원소 수를 돌려주고,
  `http.request.headers["rsc"]`는 Array<String>이라 헤더 존재 검사로 성립한다. 실측으로도
  HTML은 캐시되고 RSC 요청만 `DYNAMIC`으로 빠진다 — 즉 룰이 정상 평가되고 있다. 건드리지 말 것.
- 마지막 줄이 **이번에 추가하는 조건**이다. 지금은 이 조건이 없어서 `?_rsc=`가 붙은 비-RSC 요청의
  **HTML 응답이 RSC 캐시 키에 저장되고 있다**(실측: `/AAPL?_rsc=abc12` → `text/html` + `MISS` = 저장 시도).
  R2를 켜기 전에 반드시 먼저 넣어야 한다.
- 설정: 캐시 적합성 = Eligible · 에지 TTL = **"Use cache-control header if present, use default
  Cloudflare caching behavior if not"**(L4) · 브라우저 TTL = Respect origin (`max-age=0` → 매 방문
  revalidate) · SWR ON · 강한 ETag ON · 원본 오류 패스스루 ON.
- **에지 TTL을 blanket override(기존 2h)에서 origin 존중으로 바꾸는 이유**: 라우트마다 ISR 주기가
  달라 `s-maxage`가 1h(`/market`)~24h(`/`, `/[symbol]/fundamental`)로 이미 다르다
  ([`ISR_REVALIDATE.md`](./ISR_REVALIDATE.md)). blanket 2h는 긴 쪽을 짧게 깎아 롱테일 재사용을 막고,
  동시에 `s-maxage`가 없는 응답(인증 셸 등)까지 2시간 강제 캐싱한다. origin 존중이 양쪽을 한 번에 해결한다.

### R2 — Cache RSC payloads · **신규**

```
(http.request.method eq "GET"
 and len(http.request.headers["rsc"]) > 0
 and http.request.uri.query contains "_rsc="
 and not starts_with(http.request.uri.path, "/api"))
```

- 설정: R1과 동일(캐시 적합성 = Eligible · 에지 TTL = origin `cache-control` 존중 · 브라우저 TTL =
  Respect origin · SWR ON). RSC 응답도 HTML과 같은 `s-maxage`를 달고 나온다(실측: `/AAPL` RSC →
  `cache-control: s-maxage=21600, stale-while-revalidate=…`).
- 캐시 키가 URL만으로 충분한 이유: `_rsc` 값은 Next가
  `computeCacheBustingSearchParam(prefetch, segment-prefetch, router-state-tree, next-url)`로 계산한 해시다
  (`next/dist/client/components/router-reducer/set-cache-busting-search-param.js`).
  **RSC 변종(variant)이 값에 이미 인코딩돼 있어** 헤더를 키에 넣지 않아도 변종이 섞이지 않는다.
- `RSC` 헤더가 없는 요청은 이 룰에 매칭되지 않고 R1에서도 `_rsc=` 조건으로 제외되므로 **어느 룰로도 저장되지 않는다**.

### 적용 순서 (중요)

1. **R1에 `_rsc=` 제외 조건 추가 → 저장**
2. **Caching → Purge Everything** (기존에 `?_rsc=` 키로 저장된 HTML을 반드시 날린다)
3. R2 생성 → 저장
4. §6 검증

문제가 생기면 R2 비활성화 + Purge Everything으로 즉시 원복된다.

---

## 4. Tiered Cache (L3)

Caching → Tiered Cache → **Smart Topology 켜기**. 무료 플랜에서 사용 가능하다
(Generic Global/Regional/Custom만 Enterprise 전용).

롱테일 URL이 많은 사이트에서 콜로별 콜드 미스를 줄이는 가장 큰 레버다. 하위 콜로가 오리진 대신
상위 콜로에서 채우므로, 히트율뿐 아니라 **오리진 요청 수와 egress**가 같이 줄어든다.

---

## 5. WAF 룰 (무료 플랜: custom 5개 한도)

| # | 이름 | 표현식 | 액션 |
|---|---|---|---|
| W1 | Block scanner paths | `http.request.uri.path contains ".php" or http.request.uri.path contains "/wp-" or http.request.uri.path contains "/.env" or http.request.uri.path contains "/.git"` | Block |
| W2 | Block abusive ASN | `ip.geoip.asnum in {132203 13220}` | Block |
| W3 | Challenge non-KR 비검증 봇 (핵심 레버) | `(ip.geoip.country ne "KR") and (not cf.client.bot) and (not starts_with(http.request.uri, "/api"))` | Managed Challenge |

- **W3가 핵심 레버**: 검증 검색봇(`cf.client.bot`=Googlebot/Bingbot)·한국 검색봇(geo KR=Yeti/Daum)·
  CF-verified AI봇은 통과, 나머지 non-KR 비검증 봇은 Managed Challenge → JS를 못 풀어 렌더 불가.
  `/api` 제외는 비-KR 사용자의 앱 API 호출이 챌린지되는 걸 막는 올바른 조건이다.
- **UA 예외 미적용 결정(2026-06-15)**: `cf.client.bot`이 ClaudeBot·Claude-SearchBot·OAI-SearchBot·GPTBot을
  이미 verified로 통과시킨다. PerplexityBot은 CF가 stealth crawling으로 de-list해 챌린지되지만,
  CF가 악성으로 분류한 것이라 그대로 둔다.
- ⚠️ W2 ASN(132203·13220)은 2026-06-06 식별값 — Security Analytics(24h)로 현행화할 것.

---

## 6. 검증

```bash
scripts/probe-cdn-cache.sh                 # 프로덕션
scripts/probe-cdn-cache.sh https://…       # 다른 오리진
```

기대값(§3 적용 후):

| 클래스 | 1차 | 2차 | 의미 |
|---|---|---|---|
| HTML (landing/symbol/tab) | MISS 또는 HIT | **HIT** | R1 정상 |
| RSC (prefetch/navigation) | MISS | **HIT** | R2 정상 — 적용 전에는 `DYNAMIC DYNAMIC` |
| RSC키 오염(헤더 없음) | **DYNAMIC** | **DYNAMIC** | R1의 `_rsc=` 제외 조건 정상. `MISS`/`HIT`이 나오면 HTML이 RSC 키에 저장되고 있다는 뜻 → 즉시 R2 비활성화 + Purge |
| API | DYNAMIC | DYNAMIC | 의도된 우회 |
| static chunk | HIT | HIT | 확장자 기본 캐싱 |

**RSC 우회 회귀 확인(필수)**: 브라우저에서 `/AAPL` → 탭 클릭 → 정상 렌더 + `text/x-component` 수신.
HTML이 오면 R1의 `_rsc=` 제외 조건이 빠진 것이다 → R2 비활성화 + Purge Everything.

며칠 뒤: CF Analytics의 캐시 히트율 상승 + 오리진 요청 수/egress 하락을 함께 본다.
히트율만 보면 (2)의 Server Action POST 비중 때문에 상한이 막혀 있으니, **오리진 요청 수 감소를 주 지표로 삼는다**.

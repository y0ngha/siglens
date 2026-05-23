# siglens.io Performance Baseline

> **목적**: 성능 개선 작업의 **Before** 시점 측정값을 한 곳에 고정해 두기 위한 문서. 개선이 끝나면 "After" 컬럼을 채워 회귀/효과를 비교한다.
> **베이스라인 측정일**: 2026-05-23
> **대상 URL**: https://siglens.io/ (랜딩 / 홈)
> **베이스라인 commit**: c575f54f (`chore: core-web-vitals skill add`)
> **인프라**: Vercel(sfo1::iad1) + Cloudflare(LAX edge), Next.js (turbopack)
> **측정 도구**:
> - **PSI v5** (Lighthouse 11, Moto G Power 시뮬레이션) — 원격 (Google 서버에서 실행)
> - **로컬 Lighthouse v13.0.2** (`lighthouse/260523-before/{mobile,desktop}.json`) — 사용자 직접 측정
> - **Chrome DevTools** (Mac M-series, 1366×723 / 414×896) — 실측 (throttling 없음)

---

## 0. Executive Summary

### 점수 비교 (PSI v5 vs 로컬 Lighthouse v13.0.2)

| 영역 | Mobile (PSI) | Mobile (로컬) | Desktop (PSI) | Desktop (로컬) | 판정 |
|---|---|---|---|---|---|
| **Performance** | 67 | **64** | 88 | **95** | 🔴 Mobile 시급 |
| Accessibility | 97 | 94 | 97 | 94 | 🟡 contrast/target-size |
| Best Practices | 100 | **81** | 100 | 100 | 🟡 bf-cache/deprecation |
| SEO | 92 | **100** | 92 | **100** | 🟡 robots.txt (PSI만 flag) |

### 🚨 단일 최대 병목: **PretendardVariable woff2 = 2,057,688 bytes (~2 MB)**

| 증거 | 값 |
|---|---|
| 폰트 파일 raw 크기 | **2,057,688 bytes** (curl `Content-Length` 확인) |
| Content-Encoding | 없음 (woff2는 자체 압축이라 재압축 안 함) |
| 같은 페이지 다른 폰트들 (subset 처리됨) | 30 KB, 29 KB woff2 |
| Cache-Control | `public, max-age=31536000, immutable` (양호) |
| 모바일 LCP element render delay | **13,686 ms** (로컬) / 3,108 ms (PSI) |
| Mobile LCP 최종 | **20.4 s** (로컬, Slow 4G + CPU 4x) / 13.0 s (PSI) |

→ **텍스트 LCP가 폰트 로드를 기다림 → 느린 4G에서 2 MB woff2 다운로드가 LCP의 80%+ 차지.**
→ Pretendard 변수 폰트를 **subset** (한글+Latin 필수 글리프만) 또는 **static weight 분리** 적용하면 2 MB → 100~300 KB로 감소 가능.

---

## 1. Core Web Vitals — Lab 측정값

### Mobile (Slow 4G + CPU 4x slowdown 시뮬레이션)
| 지표 | PSI Before | 로컬 Before | After | Good | 등급 |
|---|---|---|---|---|---|
| **LCP** | 13.0 s | **20.4 s** | — | ≤ 2.5 | 🔴 Poor |
| **FCP** | 1.5 s | 1.7 s | — | ≤ 1.8 | 🟢 Good (경계) |
| **SI** | 6.2 s | **25.4 s** | — | ≤ 3.4 | 🔴 Poor |
| **TBT** | 40 ms | 50 ms | — | ≤ 200 | 🟢 Good |
| **TTI** | 13.3 s | **20.8 s** | — | ≤ 3.8 | 🔴 Poor |
| **CLS** | 0.08 | **0** | — | ≤ 0.1 | 🟢 Good |
| **TTFB** | 430 ms | 140 ms | — | ≤ 800 | 🟢 Good |

> 로컬 측정 차이: 로컬 환경의 mac은 PSI 서버보다 host CPU 부하·메모리 압박이 다르고, 같은 4× throttle도 baseline CPU 성능 차이로 실효 throttle이 다름. 그러나 **두 측정 모두 LCP가 Poor**라는 결론은 일치.

### Desktop (no throttling)
| 지표 | PSI Before | 로컬 Before | After | Good | 등급 |
|---|---|---|---|---|---|
| **LCP** | 2.3 s | **1.4 s** | — | ≤ 2.5 | 🟢 Good |
| **FCP** | 0.4 s | 0.8 s | — | ≤ 1.8 | 🟢 Good |
| **SI** | 1.1 s | 1.1 s | — | ≤ 3.4 | 🟢 Good (일치) |
| **TBT** | 50 ms | **0 ms** | — | ≤ 200 | 🟢 Good |
| **TTI** | 2.3 s | 1.4 s | — | ≤ 3.8 | 🟢 Good |
| **CLS** | 0.003 | 0 | — | ≤ 0.1 | 🟢 Good |
| **TTFB** | 600 ms | 290 ms | — | ≤ 800 | 🟢 Good |

### Chrome 실측 (Mac M-series, throttling 없음, 참고용)
| 뷰포트 | LCP | FCP | CLS | Load |
|---|---|---|---|---|
| Desktop 1366×723 | 1412 ms (H1) | 1412 ms | 0.001 | 2156 ms |
| Mobile 414×896 | 328 ms (P) | 328 ms | 0 | 1846 ms |

**해석**: 실제 빠른 회선·CPU에서는 빠르지만, PSI의 Moto G Power 시뮬레이션이 element render delay 3.1s × CPU 4x 스로틀링 = 13s LCP를 만들어냄. 중저가 Android 사용자에게는 그대로 13초 체감.

---

## 2. Core Web Vitals — Field (CrUX)

| 지표 | URL-level | Origin-level |
|---|---|---|
| 모든 metric | **no-data** | **no-data** |

→ 트래픽이 CrUX 임계값(28일 윈도우, 통계적 유의미) 미달. **자체 RUM 도입 권장**:
- Vercel Speed Insights는 안 켤 것 (사용자 결정)
- 대안: `web-vitals` npm 패키지 + `navigator.sendBeacon`으로 직접 수집 (LCP/INP/CLS만이라도)

---

## 3. LCP 요소 진단 (가장 중요한 단일 신호)

| 환경 | LCP element | text snippet |
|---|---|---|
| **PSI Mobile** | `<p class="text-secondary-400 mx-auto mt-5 max-w-sm text-base">` | "티커를 입력하면 보조지표 25종 기반 차트 흐름..." |
| Chrome Mobile (414w) | 동일 P | 동일 |
| PSI Desktop | (data 없음) | — |
| Chrome Desktop (1366w) | `<h1>` | "복잡한 미국 주식 분석을 읽기 좋게 정리합니다" |

**LCP Breakdown (Mobile, 두 측정 비교)**:
| Subpart | PSI | 로컬 |
|---|---|---|
| Time to First Byte | 1,124 ms | 146 ms |
| **Element render delay** | **3,108 ms** | **13,686 ms** |
| 최종 LCP | 13.0 s | 20.4 s |

→ 텍스트 LCP라 폰트·hydration·layout 비용이 그대로 LCP에 누적. 의도된 hero 이미지가 없어 LCP를 "큰 문단"이 차지함.
→ **Element render delay의 대부분 = PretendardVariable 2 MB 폰트 다운로드 대기 시간** (Slow 4G 1.6 Mbps에서 2 MB = ~10초).

---

## 4. 실패 audit 목록 (PSI + 로컬 Lighthouse 합본)

### 두 측정 모두에서 실패한 항목 (진짜 우선순위)
| audit ID | PSI Mobile | 로컬 Mobile | 로컬 Desktop | 영향 |
|---|---|---|---|---|
| `largest-contentful-paint` | 0 | 0 | 0.85 | LCP |
| `lcp-breakdown-insight` | 0 | 0 | (n/a) | LCP |
| `unused-javascript` | 0 | 0.5 | 0 | LCP/TBT |
| `color-contrast` (10건) | 0 | 0 | 0 | A11y |
| `cache-insight` | 0.5 | 0 | 0.5 | TTFB |
| `legacy-javascript-insight` | 0.5 | 0 | 0.5 | TBT |
| `interactive` (TTI) | 0.12 | 0.02 | 0.99 | TTI |
| `speed-index` | 0.43 | 0 | 0.94 | SI |

### 로컬에서만 잡힌 NEW 항목 (PSI 누락)
| audit ID | 로컬 Mobile | 로컬 Desktop | 영향 |
|---|---|---|---|
| **`bf-cache`** | **0** | **0** | BP — `cache-control: no-store` 때문에 back/forward cache 불가 |
| **`deprecations`** | **0** | (1) | BP — Cloudflare challenge script가 deprecated SharedStorage/StorageType.persistent/Fledge 사용 (외부 의존, 우리 제어 밖) |
| **`target-size`** | **0** | **0** | A11y — 최근 검색 ticker `<a>` 27×16 px, `×` 삭제 버튼 **6×12 px** (필요: 24×24) |
| **`network-dependency-tree-insight`** | 0 | 0 | manifest.webmanifest 체인 13.8s |
| **`total-byte-weight`** | (mobile은 다른 점수) | **0.5** | **2,849 KiB** — 그중 **PretendardVariable.woff2 = 2,010 KiB** |
| `label-content-name-mismatch` | (n/a) | 0 | A11y — `<a aria-label="Siglens 홈">SIGLENS</a>` 텍스트 불일치 |

### PSI에서만 잡힌 항목 (로컬 누락)
| audit ID | PSI | 로컬 | 비고 |
|---|---|---|---|
| `robots-txt` | 0 | 1 (pass) | Lighthouse 13.0.2에서 Cloudflare `Content-Signal` directive 더 이상 invalid로 안 봄. **SEO 92 vs 100 차이의 원인** |
| `server-response-time` | 0 (Desktop) | (pass) | PSI는 100ms 초과면 0점. 로컬은 다른 임계값 |
| `image-delivery-insight` (icon96) | 0.5 | 0.5 (desktop만) | 96×96 PNG → 24px 표시 (~7 KB 절감) |
| `document-latency-insight` | 0 (Desktop) | (pass) | (위와 같은 응답 시간 원인) |

→ **로컬 측정이 PSI보다 더 가혹한 audits를 잡음** (target-size, bf-cache, deprecations). 로컬 결과를 기준으로 개선하면 PSI는 자연히 따라옴.

---

## 5. 자산 / 네트워크 베이스라인

| 항목 | Before | After | 비고 |
|---|---|---|---|
| HTML size (압축) | 643 KB | — | curl/Chrome 둘 다 일치 |
| Inline RSC payload | **459 KB** (HTML의 71%) | — | `self.__next_f.push` 164 블록 |
| Total transfer (Lighthouse) | **2.45 MB** (mobile) / 2.46 MB (desktop) | — | 압축 후 전송 총량 |
| Resource count | 27 (Chrome), 45 (after late load) | — | — |
| JS chunks (수) | 20개 | — | turbopack 분할 |
| CSS files | 1 (`04d_iqesqdvy5.css`) | — | 15.3 KB br |
| Images | 1 (`icon96.png`, 96×96, PNG) | — | 24×24로 렌더, 7.5 KB 낭비 |
| Fonts (preload) | 3 woff2 | — | next/font self-host — 양호 |
| External 3rd-party | 0개 | — | 양호 |
| `<meta viewport>` | OK (`viewport-fit=cover`) | — | 양호 |

### 5-1. JS chunk Top 3 (br 전송)
| 청크 | 크기 | unused | legacy 폴리필 |
|---|---|---|---|
| `08k4i79~z7fdf.js` | 70 KB | 27 KB (39%) | 14 KB (Array.at 등) |
| `05nmpzrzrka_~.js` | 53 KB | 33 KB (61%) | — |
| `03~yq9q893hmn.js` | 41 KB | — | — |

---

## 6. 캐시 / CDN

| 항목 | Before | After | 비고 |
|---|---|---|---|
| HTML `cache-control` | `private, no-cache, no-store, max-age=0, must-revalidate` | — | **PPR 미적용** |
| HTML `x-vercel-cache` | MISS (매 요청) | — | — |
| HTML 서버 응답 시간 (PSI 측정) | 427 ms (mobile) / 600 ms (desktop) | — | desktop은 PSI 임계값(<100ms)에 못 미쳐 0점 |
| 정적 자산 `cache-control` | `public, max-age=31536000, immutable` | — | 양호 |
| 정적 자산 압축 | brotli | — | 양호 |
| HSTS | `max-age=63072000; includeSubDomains; preload` | — | 양호 |
| Cloudflare HTML cache | DYNAMIC (미캐시) | — | Vercel ISR/PPR 적용 여부에 의존 |
| `cache-insight` audit | 0.5 (개선 여지) | — | — |

---

## 7. Tailwind 디자인 토큰 정적 분석

| 항목 | Before | After | 비고 |
|---|---|---|---|
| `text-xs` (12px) | **502회** | — | 본문 가독성·SEO 위험 |
| `text-sm` (14px) | 102회 | — | — |
| `text-base` (16px) | 4회 | — | 너무 적음 |
| `sm:` (640+) | 173회 | — | — |
| `md:` (768+) | **9회** | — | 태블릿 break 비어 있음 |
| `lg:` (1024+) | 46회 | — | — |
| `grid-cols-3` | 10회 | — | — |
| `overflow-x-*` | 0회 | — | 가로 스크롤 위험 없음 — 양호 |
| 터치 타깃 `h-11`/`h-12` | 다수 | — | WCAG 충족 |

---

## 8. 접근성·SEO 개별 항목

| 항목 | Before | 조치 후 예상 |
|---|---|---|
| Color contrast 위반 (Mobile) | **6+건** (대표: `text-primary-600/40` = #1d3b7c on #172032, 1.52 비율, 30px) | 100% Accessibility 가능 |
| label-content-name-mismatch (Desktop) | 1건 (header logo `<a aria-label="Siglens 홈">SIGLENS</a>`) | aria-label에 "SIGLENS" 포함 → 통과 |
| robots.txt invalid | "Content-Signal: search=yes,ai-train=no" (Cloudflare Managed 라인 29) | Cloudflare 설정에서 directive 제거 또는 Lighthouse 무시 |

---

## 9. 개선 액션 플랜 (우선순위 순)

> 각 항목 완료 후 baseline의 "After" 컬럼을 다시 측정해 채워 넣고, 예상치와 실측치를 비교한다.

### 🔥 P0 — Mobile LCP 13~20s → < 4s
| # | 액션 | 예상 효과 | 난이도 |
|---|---|---|---|
| 1 | **PretendardVariable woff2를 Korean+Latin subset으로 교체** (2 MB → 100~300 KB) — `next/font/local`에 한글 자모(가-힣) + 라틴 subset만 포함, 또는 `pyftsubset`으로 사전 처리 | Mobile LCP **−10~15 s** | M |
| 2 | **`<link rel="preload">`에서 Pretendard 제거** (또는 subset 폰트만 preload) — 현재 2 MB preload가 critical path 점유 | LCP **−5~10 s** (subset 효과와 곱셈) | XS |
| 3 | **hero에 의도된 LCP 이미지/일러스트 추가** + `next/image priority` + `fetchpriority="high"` + AVIF — 텍스트 LCP에서 이미지 LCP로 이전하면 폰트 의존도 제거 | Mobile LCP −5 s | M |

### ⚡ P1 — TTFB / payload / hydration
> **⚠️ PPR 금지**: `cacheComponents: true` 재활성화는 **이슈 #439** ("Couldn't find all resumable slots") 재발 위험으로 보류. `[symbol]` 다이나믹 라우트 5종이 client fallback으로 떨어져 SEO metadata가 head에 안 박힌다. upstream root cause 해결 전까지 `cacheComponents` 미사용. — 대신 옵션 A+B 조합으로 TTFB 잡는다.

| # | 액션 | 예상 효과 | 난이도 |
|---|---|---|---|
| 4 | **A. root layout의 `cookies()`를 별도 `<Suspense>` 경계로 격리** — `src/app/layout.tsx:137`의 `cookies()`가 모든 라우트를 dynamic으로 강제 중. cookie 사용 컴포넌트만 분리하면 root 셸이 정적화 가능. **모든 라우트 TTFB 개선의 기반** | TTFB 430 → 50~100 ms, **bf-cache 통과** | M |
| 5 | **B. 랜딩 `?q=` 리다이렉트를 middleware로 이전 + `export const revalidate = 3600`** — 랜딩 `page.tsx`의 `searchParams: Promise<{q?}>` 핸들링을 `src/middleware.ts`로 옮겨 랜딩 자체는 ISR 정적 페이지로 전환 | `x-vercel-cache: HIT`, 랜딩 TTFB 추가 개선 | M |
| 6 | **RSC payload 슬림화**: hero 아래 컴포넌트 `<Suspense>` + `dynamic()` 분리 — 459 KB → ≤ 150 KB | LCP −400~700 ms, TBT/INP | M |
| 7 | **legacy-javascript 폴리필 제거**: `browserslist`를 modern targets로 좁혀 Array.at/flat/flatMap/Object.fromEntries/hasOwn 제거 | JS −14 KB, TBT | S |
| 8 | **`05nmpzrzrka_~.js` (53 KB, 61% unused) lazy 분리** (`@next/bundle-analyzer`) | TBT, TTI | M |

> A+B 순서 의존성: A 먼저 → B. `cookies()`가 root layout에 남아 있는 동안에는 B의 `revalidate`가 무력화된다 (root가 dynamic 강제하므로 child가 정적이어도 셸이 캐시 못 됨).
> **이슈 #439 별도 트랙**: PPR (`cacheComponents: true`) 복귀는 이 베이스라인의 P1 범위에 없다. upstream Next.js bug 가능성을 별도로 깊이 파고, root cause 해결 + 안전한 fix가 마련된 뒤에 별도 PR로 진행. 그 사이 mobile LCP 개선은 P0 (폰트 subset) + P1 (옵션 A+B) 조합만으로도 13~20s → 3~5s까지 가능.

### 🎨 P2 — A11y / SEO quick wins
| # | 액션 | 예상 효과 | 난이도 |
|---|---|---|---|
| 9 | **target-size 위반 수정** (최근 검색 ticker 영역) — `<a>` 27×16 → 24×24 이상, `×` 삭제 버튼 6×12 → padding/touch area 확장 (`p-2` 등) | A11y `target-size` 0 → 1 | S |
| 10 | **color-contrast 10건 수정** — `text-primary-600/40` (1.52 비율 → 알파 `/60+`나 색상 변경), `text-secondary-500` on dark BG, `text-primary-500` on header | A11y 94 → 100 | S |
| 11 | **header logo aria-label 정합화** — `aria-label="Siglens 홈"` → `aria-label="SIGLENS 홈"` (또는 가시 텍스트 노출) | label-content-name-mismatch 통과 | XS |
| 12 | **`icon96.png` → SVG 또는 24px AVIF** — 24×24 표시인데 96×96 PNG 전송 중 (~7 KB 낭비) | image-delivery audit 통과 | XS |
| 13 | **robots.txt의 Cloudflare `Content-Signal` directive 제거** (Lighthouse 13에서는 통과하지만 PSI는 여전히 fail) — Cloudflare Managed Content 설정 끄기 | PSI SEO 92 → 100 | S |
| 14 | **본문 폰트 14~16px 상향** (`text-xs` 502 → `text-sm`/`text-base`) | 모바일 가독성, font-size audit | S |
| 15 | **`md:` 브레이크포인트 보강** (현재 9회 vs sm: 173회) | 태블릿/큰 모바일 가로 UX | M |

### 📊 P3 — Observability
| # | 액션 | 예상 효과 | 난이도 |
|---|---|---|---|
| 16 | **자체 RUM 도입** (`web-vitals` + `navigator.sendBeacon` 자체 엔드포인트) — Vercel SI 미사용 결정에 따른 대안 | 실사용자 P75 LCP/INP/CLS, CrUX 데이터 부족 보완 | M |

**우선순위 권고**:
- **#1 + #2 묶음이 가장 큰 ROI** — 2 MB 폰트 한 번에 잡으면 mobile LCP가 절반 이하로 떨어짐 (PPR 없이도).
- **#4 → #5 순서로 A+B 구현** — `cookies()` 격리(#4)가 먼저 끝나야 ISR(#5)이 효과를 본다.
- **#11, #12, #13은 단일 PR로 묶어서 quick win** — 5분 작업으로 A11y/SEO 점수 5~8점 상승.

---

## 10. 재측정 절차 (After 측정 시 동일하게 반복)

```bash
# 1) PSI mobile + desktop
KEY=$(grep "^PAGE_SPEED_INSIGHT_API_KEY=" .env.local | sed 's/^PAGE_SPEED_INSIGHT_API_KEY=//' | tr -d "'\"")
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://siglens.io&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo&key=$KEY" > /tmp/psi_mobile.json
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://siglens.io&strategy=desktop&category=performance&category=accessibility&category=best-practices&category=seo&key=$KEY" > /tmp/psi_desktop.json

# 2) 핵심 수치 추출
jq -f /tmp/psi.jq /tmp/psi_mobile.json
jq -f /tmp/psi.jq /tmp/psi_desktop.json

# 3) Chrome 실측 (mcp__claude-in-chrome__javascript_tool로 LCP/FCP/CLS PerformanceObserver)

# 4) curl로 캐시 헤더 확인 (x-vercel-cache가 HIT인지)
curl -sI https://siglens.io/ | grep -iE "cache|vercel|cf-cache"

# 5) 이 문서의 "After" 컬럼에 모든 수치 기입 → commit
```

---

## 11. 변경 이력
| 날짜 | 변경 | 측정자 |
|---|---|---|
| 2026-05-23 | 초기 baseline (PSI quota 소진, 정적 분석 기반) | Claude Code (5-agent parallel) |
| 2026-05-23 | PSI API key 등록 후 실수치로 전면 갱신 + Chrome DevTools 실측 추가 | Claude Code |
| 2026-05-23 | **로컬 Lighthouse v13.0.2 측정 (`lighthouse/260523-before/{mobile,desktop}.json`) 통합** — Pretendard 2 MB 폰트가 진짜 LCP 병목임을 식별, target-size/bf-cache/deprecations 신규 발견 | 사용자 측정 + Claude Code |

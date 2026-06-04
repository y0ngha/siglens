# Test Cases — v0.15.0 → current HEAD verification

> 작성: 2026-06-04 · 짝 Spec: `docs/superpowers/specs/2026-06-04-v015-to-current-verification-spec.md`
> 범위: `v0.15.0..HEAD`(218 commits) 전체 + `v0.17.0..HEAD`(67 commits) 배포 안정성 부분집합(R 섹션)
> 실행 전제: 프로덕션 빌드(`yarn build`) + `yarn start`(기본 `http://localhost:3000`). docker postgres + redis(env-shadow)는 §Spec 6.

## 사용법
- `$B` = base URL(기본 `http://localhost:3000`; 프로덕션 검증 시 실도메인).
- 우선순위 **P0**=배포 차단 · **P1**=중요 · **P2**=nice.
- ID 접두사: **C**=curl, **B**=browser(Chrome DevTools), **S**=SEO 전용, **D**=DB-dependent, **R**=배포 안정성(v0.17.0..HEAD).
- "warm" 캐시 케이스는 같은 URL을 **2번 연속** 요청하고 2번째 응답을 본다.
- ⚠️ E2E 환경 사실: FMP 키 없거나 미시드 종목 → degrade(200+noindex). `AAPL`만 시드 가정. invalid-format ticker → ISR에서 HTTP **200** + not-found 본문.

전체 테스트 케이스 수: **80** (curl 35 · browser 22 · SEO 12 · DB 6 · deploy-stability 19; 일부 ID는 area-cross 카운트 — 합계는 섹션별 소계 기준).

---

## A. curl — 상태 코드 & 라우트 가용성 (C1–C10)

| ID | P | 대상 | 명령 | 기대 / 합격 기준 |
|----|---|------|------|------------------|
| C1 | P0 | home | `curl -sS -o /dev/null -w '%{http_code}\n' $B/` | `200` |
| C2 | P0 | chart | `curl -sS -o /dev/null -w '%{http_code}\n' $B/AAPL` | `200` |
| C3 | P0 | 5 siblings | `for p in overall fundamental news options fear-greed; do curl -sS -o /dev/null -w "$p %{http_code}\n" $B/AAPL/$p; done` | 전부 `200` |
| C4 | P0 | degrade 종목 | `curl -sS -o /dev/null -w '%{http_code}\n' $B/MSFT` | `200` (500/404 아님) |
| C5 | P0 | invalid ticker | `curl -sS -o /dev/null -w '%{http_code}\n' $B/INVALIDTICKER1` | `200` + (C18에서 not-found 본문 확인) |
| C6 | P1 | 소문자 redirect | `curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' $B/aapl` | `301` → `…/AAPL` |
| C7 | P1 | 보조 페이지 | `for p in market backtesting terms privacy; do curl -sS -o /dev/null -w "$p %{http_code}\n" $B/$p; done` | 전부 `200` (terms/privacy는 DB seed 전제 — D1) |
| C8 | P1 | auth 페이지 | `for p in login signup reset-password forgot-password; do curl -sS -o /dev/null -w "$p %{http_code}\n" $B/$p; done` | 전부 `200` |
| C9 | P0 | not-found | `curl -sS -o /dev/null -w '%{http_code}\n' $B/this-route-does-not-exist` | `404` |
| C10 | P2 | account(미인증) | `curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' $B/account` | `200`/redirect (proxy 역가드) — 콘솔/네트워크로 동작 확인은 B17 |

## B-area curl — 메타/SEO 라우트 & 헤더 (C11–C22)

| ID | P | 대상 | 명령 | 기대 / 합격 기준 |
|----|---|------|------|------------------|
| C11 | P0 | robots.txt | `curl -sS $B/robots.txt` | `200`, `text/plain`, `Disallow: /api/`, 패러사이트봇(AhrefsBot/SemrushBot/MJ12bot/DotBot/BLEXBot/DataForSeoBot) 각 `Disallow: /`, `Sitemap: …/sitemap.xml` 라인. 인증 페이지(`/login` 등) **Disallow 없음** |
| C12 | P0 | sitemap index | `curl -sS -D- $B/sitemap.xml \| head -40` | `200`, `Content-Type: application/xml; charset=utf-8`, `<sitemapindex>`, `sitemap-static.xml`·`sitemap-popular.xml` 참조 |
| C13 | P1 | sub-sitemaps | `for s in static popular longtail-1; do curl -sS -o /dev/null -w "$s %{http_code} %{content_type}\n" $B/sitemap-$s.xml; done` | static/popular `200 application/xml`; longtail-1은 데이터 있으면 200, 없으면 404 graceful |
| C14 | P1 | manifest | `curl -sS -D- $B/manifest.webmanifest -o /dev/null` | `200`, content-type `manifest+json` 계열 |
| C15 | P1 | OG images | `for p in "" /overall /fundamental /news /options /fear-greed; do curl -sS -o /dev/null -w "$p %{http_code} %{content_type}\n" $B/AAPL$p/opengraph-image; done` | 전부 `200 image/png` |
| C16 | P1 | twitter image | `curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' $B/AAPL/news/twitter-image` | `200 image/png` |
| C17 | P2 | 보안 헤더 | `curl -sS -D- -o /dev/null $B/AAPL` | `x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy: strict-origin-when-cross-origin`, `strict-transport-security: max-age=63072000; includeSubDomains; preload` |
| C18 | P0 | invalid 본문 | `curl -sS $B/INVALIDTICKER1 \| grep -i "not.found\|404\|찾을 수"` | not-found 본문 마커 존재(HTTP 200이지만 본문은 not-found) |
| C19 | P2 | api disallow 실재 | `curl -sS -o /dev/null -w '%{http_code}\n' $B/api/sitemap` | `200`(rewrite 소스는 동작) — robots는 색인 정책일 뿐 |

## C-area curl — ISR 캐싱 헤더 (C20–C26)

| ID | P | 대상 | 명령 | 기대 / 합격 기준 |
|----|---|------|------|------------------|
| C20 | P0 | chart warm cache | `curl -sS -D- -o /dev/null $B/AAPL; echo ---; curl -sS -D- -o /dev/null $B/AAPL \| grep -i 'x-nextjs-cache\|cache-control'` | 2번째 `x-nextjs-cache: HIT` + `cache-control` `s-maxage=3600` 계열 |
| C21 | P0 | siblings warm cache | overall/fundamental/news/options/fear-greed 각 2회 요청 후 헤더 | 각 2번째 `x-nextjs-cache: HIT` |
| C22 | P1 | degrade warm cache | `/MSFT` 2회 요청 | 2번째 `HIT`(degrade 결과도 ISR 캐시되되 noindex) |
| C23 | P0 | DYNAMIC_SERVER_USAGE | `yarn start` 콘솔 로그 grep `DYNAMIC_SERVER_USAGE` (C20–C22 수행 중) | **0건** (축0/축1 위반 없음) |
| C24 | P1 | OG static cache | `curl -sS -D- -o /dev/null $B/AAPL/opengraph-image \| grep -i cache-control` | 장기 캐시(30d/`s-maxage=2592000` 계열, force-static) |
| C25 | P1 | home cache | `/` 2회 요청 헤더 | `x-nextjs-cache: HIT` 또는 정적 서빙 + `revalidate` 반영 |
| C26 | P2 | sitemap cache | `curl -sS -D- -o /dev/null $B/sitemap.xml \| grep -i cache-control` | `public, max-age=3600, stale-while-revalidate=3600` |

## D-area curl — SEO HTML 마커 (C27–C35) — SEO 케이스와 교차(§D-SEO)

| ID | P | 대상 | 명령 | 기대 / 합격 기준 |
|----|---|------|------|------------------|
| C27 | P0 | canonical self | `curl -sS $B/AAPL \| grep -o '<link rel="canonical"[^>]*>'` | self·절대 URL·대문자 `…/AAPL` |
| C28 | P0 | canonical 부재(degrade) | `curl -sS $B/MSFT \| grep -c '<link rel="canonical"'` | `0` (home `SITE_URL` 미상속) |
| C29 | P0 | canonical 부재(invalid) | `curl -sS $B/INVALIDTICKER1 \| grep -c '<link rel="canonical"'` | `0` |
| C30 | P0 | robots meta valid | `curl -sS $B/AAPL \| grep -o '<meta name="robots"[^>]*>'` | `index,follow` 포함(noindex 없음) |
| C31 | P0 | robots meta degrade | `curl -sS $B/MSFT \| grep -o '<meta name="robots"[^>]*>'; curl -sS $B/INVALIDTICKER1 \| grep -o '<meta name="robots"[^>]*>'` | 둘 다 `noindex` 포함 |
| C32 | P0 | single h1 | `for u in $B/AAPL $B/AAPL/fundamental $B/AAPL/news $B/AAPL/overall $B/AAPL/options $B/AAPL/fear-greed; do echo -n "$u "; curl -sS $u \| grep -o '<h1' \| wc -l; done` | 각 정확히 `1` |
| C33 | P1 | JSON-LD | `curl -sS $B/AAPL \| grep -o 'application/ld+json'` 후 본문에서 `"@type":"WebPage"`·`"BreadcrumbList"`·`"FAQPage"` 존재 확인 | 3종 SSR HTML 내 존재, 유효 JSON |
| C34 | P0 | placeholder 누출 | `for u in $B/AAPL $B/AAPL/fundamental $B/AAPL/news; do curl -sS $u \| grep -c '\[SYMBOL\]'; done` | 전부 `0` |
| C35 | P1 | title 구체성 | `curl -sS $B/AAPL/fundamental \| grep -o '<title>[^<]*</title>'` | 종목·섹션 반영 + `| Siglens` 템플릿 |

---

## E. SEO 전용 (S1–S12)

| ID | P | 영역 | 방법 | 기대 / 합격 기준 |
|----|---|------|------|------------------|
| S1 | P0 | metadata 완전성(home) | `curl -sS $B/ \| grep -o '<meta[^>]*og:[^>]*>'` | og:type/siteName/title/url/locale + twitter card, canonical=`SITE_URL` |
| S2 | P0 | canonical/og:url 일치(auth) | `curl -sS $B/login \| grep -o '<link rel="canonical"[^>]*>\|og:url[^>]*'` | canonical=`…/login`, og:url=`…/login`(SITE_URL 미상속), robots `noindex,follow` |
| S3 | P0 | noindex(account/auth) | `for u in login signup reset-password forgot-password account; do curl -sS $B/$u \| grep -o '<meta name="robots"[^>]*noindex[^>]*>'; done` | 각 `noindex` 존재 |
| S4 | P0 | invalid → noindex+canonical 부재 | C29+C31 합산 | soft-404가 index+canonical 동시 미발생(둘 다 noindex·canonical 0) |
| S5 | P1 | BreadcrumbList 정합 | `curl -sS $B/AAPL/fundamental` JSON-LD 파싱 | 3단계 `[Siglens, AAPL, 펀더멘털 분석]`(Siglens auto-prepend), chart는 2단계 |
| S6 | P1 | Corporation about | `curl -sS $B/AAPL` WebPage JSON-LD | stock 분류 시 `about` Corporation 노드 존재; ETF/Index는 생략(검증: 한 ETF 티커로 about 부재) |
| S7 | P1 | Article(news) | `curl -sS $B/AAPL/news` | Article JSON-LD 존재(있다면) 유효 |
| S8 | P0 | robots.txt 정책 | C11 확장 | API disallow + 패러사이트봇 차단 + 인증페이지 미차단(noindex로 처리) 동시 성립 |
| S9 | P0 | sitemap 유효성 | `curl -sS $B/sitemap.xml \| xmllint --noout - && echo OK` | well-formed XML, sitemapindex |
| S10 | P1 | structured data 검증 | 각 라우트 JSON-LD를 Schema.org validator 또는 `python -c json.loads`로 파싱 | 파싱 오류 0, required 필드(@context/@type) 존재 |
| S11 | P2 | CWV 스모크(LCP) | Chrome DevTools Performance/Lighthouse `$B/AAPL` | LCP 합리적(폰트 self-host로 text LCP 개선), CLS≈0(size-adjust 폰트) |
| S12 | P2 | CWV 스모크(CLS) | Chrome DevTools Layout Shift `$B/AAPL/fundamental` | skeleton→data 교체 시 CLS 점프 없음(Suspense fallback 높이 예약) |

---

## F. Chrome DevTools — 렌더 & 인터랙션 (B1–B22)

각 케이스: 페이지 로드 → **Console에 에러 0** 확인 → 명시 동작 관찰. UX 회귀는 v0.15.0 대비 감시.

| ID | P | 영역 | 동작 | 관찰 / 합격 기준 |
|----|---|------|------|------------------|
| B1 | P0 | chart 렌더 | `$B/AAPL` 로드 | 차트 + AI 분석 패널 렌더, blank flash·CLS 없음, 콘솔 0에러 |
| B2 | P0 | overall 렌더 | `$B/AAPL/overall` | 종합 결론 렌더, FactLayer SSR 텍스트 → 인터랙티브 교체 |
| B3 | P0 | fundamental 렌더 | `$B/AAPL/fundamental` | 프로필/밸류에이션/peers/수익성/성장/건전성/미래방향 섹션, skeleton→data |
| B4 | P0 | news 렌더 | `$B/AAPL/news` | 뉴스 카드 + AI 요약, 클라 분석 트리거 동작 |
| B5 | P0 | options 렌더 | `$B/AAPL/options` | 옵션 스냅샷 렌더(hasOptions 분기) |
| B6 | P0 | fear-greed 렌더 | `$B/AAPL/fear-greed` | 공포·탐욕 지수 + 히스토리컬 차트 |
| B7 | P0 | 검색 | home 검색창에 `TSLA` 입력→선택 | `/TSLA`로 soft-nav, 결과 렌더 |
| B8 | P0 | 탭 전환 | `/AAPL`에서 SymbolTabs로 6 탭 순회 | soft-nav, 헤더/breadcrumb 안정, 풀리로드·헤더 깜빡임 없음, 활성탭 정확 |
| B9 | P1 | 분석 트리거 | chart에서 재분석/타임프레임 변경 | useAnalysis 트리거, 로딩→결과, job cancel 정상 |
| B10 | P1 | 타임프레임 딥링크 | `$B/AAPL?tf=1D` 직접 로드 | 클라가 tf 읽어 해당 bars fetch, h1·차트 정상 |
| B11 | P0 | 게스트 헤더 | 쿠키 없이 임의 라우트 로드 | 로그인/회원가입 표시, authed avatar flash **없음**, skeleton stuck 없음 |
| B12 | P0 | hydration | 6 라우트 각 로드 | React hydration mismatch 경고 0(client-island 헤더 + CSR-bailout subtree) |
| B13 | P1 | degrade UI | `$B/MSFT` 로드 | degrade 안내 렌더(에러 화면 아님), 콘솔 에러 없음 |
| B14 | P1 | degrade fundamental | `$B/MSFT/fundamental` 로드 | `FundamentalDegraded` 렌더(200), full-crash 아님 |
| B15 | P1 | network 워터폴 | `$B/AAPL` Network 탭 | FMP/redis 호출 합리적, 중복 fetch 없음, 4xx/5xx XHR 없음 |
| B16 | P1 | auth flip(login) | login 폼 제출(시드 유저)→리다이렉트 | navigation refetch로 헤더 authed 전환(stuck 아님) — E2E `account-*.spec` 병행 |
| B17 | P1 | auth flip(logout) | authed 상태에서 logout | 헤더 guest 전환, 보호 동작 정상 |
| B18 | P2 | OAuth | OAuth start→consent→finalize(E2E fake) | consent 페이지 렌더, finalize 후 authed |
| B19 | P2 | market 부분실패 | `$B/market` (일부 quote 0 상황) | `MarketDataErrorNotice` 안내, 패널 정상 |
| B20 | P2 | backtesting | `$B/backtesting` | 백테스팅 UI 렌더, 콘솔 0에러 |
| B21 | P2 | PWA | manifest/install 배너 | PwaBanner 동작, manifest 로드 |
| B22 | P2 | 모바일 뷰포트 | DevTools device emulation으로 `/AAPL` | 모바일 bottom-sheet/탭 정상(Radix aria-hidden 이슈 없음) |

---

## G. DB-dependent (D1–D6) — docker postgres seed 필요

> 기존 E2E 인프라(docker postgres + `.env.e2e` + `E2E_TEST=1` + fake email/oauth) 재사용 권장.

| ID | P | 영역 | seed | 방법 | 기대 / 합격 기준 |
|----|---|------|------|------|------------------|
| D1 | P0 | terms/privacy 빌드 | active `terms`(tos/privacy) row | 빌드 전 seed; `curl -sS $B/terms`·`$B/privacy` | `200` + 약관 본문(빌드타임 DB 조회 — 미seed 시 **빌드 실패**) |
| D2 | P0 | 공지 노출 | `notices` 1 active row(window 현재 포함, path_pattern `null` 또는 `/AAPL/*`) | 해당 경로 로드(Chrome) | 모달 노출, title/body 렌더 |
| D3 | P1 | 공지 graceful | notices 미설정/장애 | 임의 라우트 로드 | 빈 큐, **페이지 정상**(에러 0) — R3와 교차 |
| D4 | P1 | 공지 path 타게팅 | path_pattern=`/AAPL/*` row | `/AAPL`(노출) vs `/TSLA`(미노출) 비교 | 경로 매칭만 노출 |
| D5 | P1 | auth 플로우 | users/sessions/verification | login/signup(email code)/reset(token) — E2E fake email | 각 플로우 완료, 세션 발급 |
| D6 | P2 | account CRUD | authed user + api_key | `/account` api-key 추가/삭제, `/account/delete` | CRUD 동작(authed storageState) |

---

## H. 배포 안정성 — v0.17.0..HEAD 전용 (R1–R19)

> 이번 over-deploy(현재 HEAD over 0.17.0)가 **깨면 안 되는** 표면. 67 commits 부분집합. 최우선.

### R1–R6 · 공지 팝업 (#559)
| ID | P | 방법 | 기대 / 합격 기준 |
|----|---|------|------------------|
| R1 | P0 | curl: `curl -sS $B/AAPL \| grep -ci notice-popup\|noticepopup` | SSR HTML에 **공지 마크업 부재**(`ssr:false` client-only) → 검색 인덱싱·hydration race 영향 0 |
| R2 | P0 | Chrome: 활성 공지 seed(D2) 후 `/AAPL` 로드 | hydration 완료 **후** 모달 마운트, 콘솔 0에러, streaming race 없음 |
| R3 | P0 | Chrome: notices DB 장애/미설정 상태로 임의 라우트 로드 | 페이지 **정상 렌더**(공지 실패가 페이지를 깨지 않음), `console.warn` 1줄 허용 |
| R4 | P1 | Chrome: 모달에서 "다시 보지 않기"→새로고침 | localStorage 영구 저장, 재노출 안 됨 |
| R5 | P1 | Chrome: 모달 Esc/배경 클릭/닫기→새로고침 | 임시 dismiss(다음 방문 재노출), focus-trap·Esc a11y 동작 |
| R6 | P2 | Chrome: link_url에 `javascript:`/비http(s) seed | 링크 렌더 거부(safeUrl 가드) — XSS 차단 |

### R7–R11 · Auth full-static (#557)
| ID | P | 방법 | 기대 / 합격 기준 |
|----|---|------|------------------|
| R7 | P0 | 빌드 output 확인 | `/login` `/signup` `/reset-password`가 `○`(static) — `ƒ`(dynamic) 아님 |
| R8 | P0 | curl: `curl -sS -D- -o /dev/null $B/login \| grep -i x-nextjs-cache` | 정적 서빙(HIT/prerender), 쿠키·DB 의존 누출 없음 |
| R9 | P0 | Chrome: `$B/login?next=/AAPL` 로드 후 제출 | `?next` searchParams를 CSR(`LoginContent`)이 읽어 폼 동작, redirect target 반영 |
| R10 | P1 | Chrome: `/reset-password?token=xxx` 로드 | token searchParams CSR 처리, AuthFormSkeleton fallback→폼 |
| R11 | P1 | Chrome: `/signup?code=xxx`(oauth) | 쿼리 의존부 정상 렌더 |

### R12–R16 · FMP fundamental 캐시 (#560)
| ID | P | 방법 | 기대 / 합격 기준 |
|----|---|------|------------------|
| R12 | P0 | curl: `/AAPL/fundamental` 2회 warm | 2번째 `x-nextjs-cache: HIT`, FMP 재호출 없음(Network/로그) |
| R13 | P0 | Chrome: FMP 장애 주입 후 `/<sym>/fundamental` 재시도 | 장애 시 N/A degrade, **다음 요청 재시도 성공**(poison 캐싱 없음) |
| R14 | P1 | curl: 빈 200 종목(존재 안 함, well-formed) | null 캐싱으로 long-tail 재호출 차단(2번째 빠른 응답), noindex |
| R15 | P1 | Chrome: `/AAPL/fundamental` peers 표 | PER/PSR 채워짐(#538), peer ≤ 10개 |
| R16 | P2 | curl: 대소문자 키 | `/aapl/fundamental`(→301 /AAPL) 캐시 키 대문자 정규화로 일관 HIT |

### R17–R19 · Market summary 부분실패(#556) + 기타
| ID | P | 방법 | 기대 / 합격 기준 |
|----|---|------|------------------|
| R17 | P1 | Chrome: 일부 quote 0 상황 `/market` | `hasMissingQuotes` true → 안내 배너, 패널 정상 |
| R18 | P1 | Chrome: 전 quote 정상 `/market` | false-positive 안내 **없음**, 캐시 가드가 정상 데이터만 캐싱 |
| R19 | P2 | curl: skills/chat 회귀 | `/AAPL` h1 sr-only "보조지표 N종" 카운트 렌더(skill 로더 dedupe), dashboard bearish badge 라벨 표시 |

---

## I. 회귀 스모크 — v0.16 실패 모드 재발 방지 (G1–G4) — P0

| ID | 방법 | 기대 / 합격 기준 |
|----|------|------------------|
| G1 | `grep -rn "cookies()\|headers()" src/app/layout.tsx src/app/_components/` | root layout/공유 셸에서 직접 호출 **0**(클라이언트화 유지, 축 0) |
| G2 | C23(로그 `DYNAMIC_SERVER_USAGE` 0) + C20–C22(`x-nextjs-cache: HIT`) | ISR 정적화 유지(축 1) — cold-gen 500 재발 없음 |
| G3 | C28/C29/C31(degrade·invalid canonical 부재 + noindex) | soft-404 robots 충돌 없음 |
| G4 | `grep -rn "export const revalidate\|export const dynamic" src/app/**/page.tsx` | route segment config가 **리터럴**(상수/식 추출 아님) — Next 정적 분석 가능 |

---

## J. 실행 순서 권장
1. **빌드** (env §Spec 6.2 확인) → 빌드 output에서 R7(auth ○) + 종목 라우트 SSG 표시 확인.
2. **DB seed** (D1 terms 필수, D2 notices) → `yarn start`.
3. **curl 배치** C1–C35, S1–S10 → 표 채움.
4. **회귀 스모크** G1–G4 (정적 grep + 런타임 헤더/로그).
5. **Chrome** B1–B22, S11–S12(CWV).
6. **배포 안정성** R1–R19 (가장 마지막에 집중 검증, P0부터).
7. 실패 1건이라도 P0면 **배포 차단**, 보고.

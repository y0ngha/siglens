# 배포 전 실증 검증 Spec & Test Case (v0.15.0 → 현재)

> 작성: 2026-06-03 · 대상 master: `859cbbe9` (v0.16.0 코드 + 137 커밋 후속 + 하드닝 #552/#553)
> 마지막 정상 배포 = **v0.15.0** · **v0.16.0**은 배포 후 실패(롤백)

## 1. 목적 & 범위

현재 deployable master를 **프로덕션처럼 빌드·기동**해, 변경사항과 핵심 기능이 ① curl ② Chrome 양쪽에서 정상 동작하고 SEO·UX 회귀가 없는지 실증한다.

**변경 범위:**
1. **[symbol] 6라우트 ISR/SEO 전면 전환** — chart/overall/fear-greed/options/fundamental/news. `generateStaticParams=[]` + `revalidate=3600`(on-demand ISR), FactLayer/분석 SSR, `unstable_cache` 정적화, `getAssetInfoResilient` degrade.
2. **Axis-0 인증 클라이언트화 (#547)** — 루트 레이아웃 헤더가 client island. redirect 기반 인증(login/signup/logout/oauth/delete) 후 헤더가 게스트/인증 상태로 동기화.
3. **배포 전 하드닝 (#552)** — `[symbol]/error.tsx`(전 라우트 throw 봉쇄), `getProfileResilient`+`FundamentalDegraded`(fundamental FMP 장애 → 200+noindex), `NOINDEX_SYMBOL_METADATA`(degraded/invalid `canonical:null`), options `.catch` 로깅.
4. **h1 중복 제거 (#553)** — fear-greed/chart heading의 ticker 중복.

## 2. 방법

프로덕션 빌드(`yarn build`) + `yarn start`. 빌드는 **env-shadow**(e2e DB+redis 기동, `dotenv -e .env.e2e -o` + `next_env_shadow_args`로 `.env.local` 키 shadow). 워크트리 node_modules는 symlink 금지 — `cp -al` 하드링크(잔여 `node_modules/node_modules` 제거).

- **① curl**: status code / 응답 헤더(`x-nextjs-cache`·robots·content-type·보안) / HTML(canonical·h1·JSON-LD·noindex).
- **② Chrome** (claude-in-chrome): 실제 렌더 / 콘솔(하이드레이션 0에러) / 헤더 게스트상태 / 탭 전환 안정성 / UX 회귀(0.15.0 대비).

E2E 환경 사실: FMP 키 없음 → 비시드 well-formed ticker(`/MSFT`)는 asset 레벨 degrade(200+noindex); `AAPL`만 시드. `FakeFundamentalDataProvider`가 임의 ticker에 profile 반환(throw 안 함) → `/MSFT/fundamental`은 full 렌더+noindex. invalid-format ticker → `notFound()`(ISR에선 HTTP **200** + not-found 본문).

## 3. Test Case — ① curl (C1–C26)

우선순위: **P0** 배포 차단 · **P1** 중요 · **P2** nice.

| ID | 영역 | 대상 | 기대 | P | 결과 |
|----|------|------|------|---|------|
| C1–C3 | status | `/`, 6×`/AAPL[/*]` | 200 | P0 | ✅ |
| C4 | degrade status | `/MSFT` | 200 (500/404 아님) | P0 | ✅ |
| C5 | invalid | `/INVALIDTICKER1` | HTTP 200 + not-found 본문 | P0 | ✅ |
| C6 | redirect | `/aapl` | 301 → `/AAPL` | P1 | ✅ |
| C7 | meta routes | robots.txt / sitemap.xml / manifest | 200 + content-type | P0 | ✅ |
| C8 | OG images | 6× `…/opengraph-image` | 200 image/png | P1 | ✅ |
| C9–C10 | canonical | `/AAPL`+5 siblings | self·절대·대문자 | P0 | ✅ |
| **M1** | **canonical 부재** | `/MSFT`, `/INVALIDTICKER1` | **canonical 태그 없음**(home 미상속) | P0 | ✅ |
| C11/C13/C14 | robots meta | AAPL `index,follow` / MSFT·invalid `noindex,nofollow` | — | P0 | ✅ |
| C15 | single h1 | 전 라우트 | 정확히 1개 | P0 | ✅ |
| C16/C17 | JSON-LD | WebPage·BreadcrumbList·FAQPage·Corporation·Article | SSR HTML 내 유효 | P1 | ✅ |
| C18 | placeholder | 전 라우트 | `[SYMBOL]` 누출 0 | P0 | ✅ |
| C19 | title | 라우트별 | 구체·정확 | P1 | ✅ |
| C20–C22 | ISR cache | warm `/AAPL`·siblings·`/MSFT` | `x-nextjs-cache: HIT` + `s-maxage=3600` | P0 | ✅ |
| C23 | degraded fundamental | `/MSFT/fundamental` | 200 + noindex + full 렌더(500/error 아님) | P0 | ✅ |
| C25/C26 | 보안·robots | `/AAPL` 헤더, robots.txt 룰 | nosniff·DENY·HSTS·Referrer / 패러사이트봇 차단 | P2 | ✅ |

## 4. Test Case — ② Chrome (B1–B19, 핵심 발췌)

| ID | 영역 | 기대 | UX 회귀 감시(vs 0.15.0) | 결과 |
|----|------|------|--------------------------|------|
| B1–B6 | 6라우트 렌더 | 차트/AI/펀더멘털/옵션/공포탐욕/뉴스 렌더, 콘솔 0에러 | blank flash·CLS·skeleton stuck | ✅ |
| B8 | 탭 전환 | soft-nav + 헤더/breadcrumb 안정 | 풀리로드·헤더 깜빡임·활성탭 오류 | ✅ |
| B11 | 게스트 헤더 | 로그인/회원가입 표시, authed flash 없음 | authed avatar flash·skeleton stuck·헤더 부재 | ✅ |
| B12–B14 | auth flip (#547) | login/signup→authed, logout→guest | **redirect 후 헤더 stuck**(v0.16 실패 축) | E2E¹ |
| B19 | 하이드레이션 | 전 라우트 mismatch 0 | client-island 헤더·CSR-bailout subtree | ✅ |

¹ auth flip은 `account-logout.spec.ts`/`account-auth-smoke.spec.ts` E2E(CI 통과)가 커버. curl `/login`(쿠키 없음) → 200+폼 정상.

## 5. 검증 결과 요약

- **curl C1–C26 전부 GREEN.** 특히 **M1(degraded/invalid canonical 부재)**, **degraded 200(500 아님)**, **`x-nextjs-cache: HIT`**, single h1, JSON-LD, 보안헤더 실측 확인.
- **Chrome 6라우트 전부 정상** — 게스트 헤더 정확, **탭 전환 헤더 안정(axis-0)**, **하이드레이션 0에러**.
- **UX 회귀 미발견.** 발견된 마이너 1건(fear-greed h1 `(AAPL)` 중복 — v0.15.0과 동일, 회귀 아님) → **#553에서 수정**.

## 6. ⚠️ 배포 시 필수 env (안 되면 빌드 실패 — 코드 무관, 4-agent 안정성 감사 발견)

1. **`SIGLENS_GITHUB_TOKEN`** (read:packages) — `@y0ngha/siglens-core`(GitHub Packages) 설치. 없으면 `yarn install` 403. **CI(ci.yml)는 빌드 안 함 → 못 잡음**.
2. **`DATABASE_URL` + `terms` 테이블(active `tos`/`privacy`)** — `/terms`·`/privacy`가 **빌드 타임** DB 조회(try/catch 없음). v0.15.0부터의 전제.
3. **`NEXT_PUBLIC_SITE_URL`** — 빌드 타임 인라인(canonical/OG/JSON-LD/sitemap). 프로덕션 도메인으로 설정.

## 7. 결론

**배포 안전.** v0.16.0을 깬 실패 모드(루트 레이아웃 `cookies()` + ISR 미정적화 → cold-gen 500)는 master에서 근본 해결됐고, curl+Chrome 실증으로 런타임·SEO·UX 회귀 없음을 확인했다. 위 §6 env 3건만 배포 환경에서 확인할 것.

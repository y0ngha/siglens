# ISR 비용·SEO 최적화 R2 — 배포 전 안정성 감사 Spec & Test Cases

> 작성 2026-06-15 (Opus 4.8) · 대상 변경: PR #591 (`perf/isr-cost-seo-r2`, master 머지)
> 설계 근거: [`../superpowers/specs/2026-06-15-isr-cost-seo-r2-design.md`](../superpowers/specs/2026-06-15-isr-cost-seo-r2-design.md)
> 목적: E2E/유닛이 커버하지만, **프로덕션처럼 빌드·실행했을 때** 동작·SEO·캐싱/ISR에 문제가 없는지 실증한다.

## 1. 변경 범위 (이번 세션)

| ID | 변경 | 파일 |
|---|---|---|
| #2 | 롱테일 sitemap을 종목당 **메인 `/TICKER` 1라우트만** 광고(서브 4라우트 미광고). `LONGTAIL_ENTRIES_PER_TICKER` 5→1, `LONGTAIL_TICKERS_PER_PAGE` 2000→10000 | `entities/sitemap-entry/lib/buildLongTailEntries.ts`, `model.ts`, `app/api/sitemap/route.ts` |
| #4 | robots.txt AI봇 하이브리드: 학습봇 12종 전면 Disallow, 검색봇(Perplexity/OAI) crawlDelay, **crawl-delay 그룹(Anthropic·AI_SEARCH)에 `/api/` disallow 명시**, `AI_CRAWLER_CRAWL_DELAY_SECONDS` export | `app/robots.ts` |
| #3 | CF 주황구름+WAF 런북 (문서, 런타임 영향 없음) | `docs/architecture/CDN_CACHING.md` |

**불변이어야 하는 것(회귀 금지)**: popular sitemap(서브 라우트·옵션 유지), 검색봇(Googlebot/Yeti/Bingbot/Daumoa) 미차단, 종목 페이지·서브 페이지 렌더, ISR 캐싱(`x-nextjs-cache` HIT), SEO 메타데이터/JSON-LD, FactLayer SSR.

## 2. 실증 환경

```bash
# 워크트리(= 머지된 코드) 또는 master 체크아웃에서
E2E_TEST 미설정(순수 prod). yarn build && yarn start (포트 4200 기본 아님 — start 포트 확인)
```
- 프로덕션 빌드(`yarn build`) + `yarn start`로 실행 후, 두 방법 병행:
  - **방법 A — curl**: 응답 본문·Status·헤더(`x-nextjs-cache`, `x-nextjs-prerender`, `cache-control`, `content-type`) 검증.
  - **방법 B — Chrome 도구**: 실제 렌더·JSON-LD·메타·콘솔 에러 확인.

## 3. Test Cases — 방법 A (curl)

| TC | 요청 | 기대 |
|---|---|---|
| A1 | `GET /robots.txt` | 200. `User-agent: GPTBot`(외 11종) + `Disallow: /`. `User-agent: PerplexityBot/OAI-SearchBot` + `Allow: /` + `Disallow: /api/` + `Crawl-delay: 60`. `User-agent: ClaudeBot` 그룹에도 `Disallow: /api/`. **`Googlebot`/`Yeti`/`Bingbot`/`Daumoa`는 `Disallow: /` 그룹에 없음.** `Sitemap: https://siglens.io/sitemap.xml` |
| A2 | `GET /sitemap.xml` | 200, `application/xml`. `<sitemapindex>`에 static·popular·longtail-{n} 포함 |
| A3 | `GET /sitemap-longtail-1.xml` | 200. 각 `<url>`이 **`/TICKER` 메인만**(`/overall`·`/news`·`/fundamental`·`/fear-greed` 없음). URL 수 ≤ 10000 |
| A4 | `GET /sitemap-popular.xml` | 200. 종목당 서브 라우트(+옵션 종목은 options) **유지**(회귀 없음) |
| A5 | `GET /AAPL` ×2 (동일 윈도우) | 200. 1차 `x-nextjs-cache: MISS|STALE`, 2차 `HIT`. `x-nextjs-prerender: 1`. 두 응답 본문 **byte-identical**(결정성) |
| A6 | `GET /AAPL/overall`, `/AAPL/fundamental`, `/AAPL/news`, `/AAPL/fear-greed` | 각 200 — sitemap 미광고여도 on-demand ISR로 정상 렌더(회귀 없음) |
| A7 | `GET /AAPL` HTML | FactLayer 텍스트(현재가/RSI 등) + canonical(`<link rel=canonical>` 대문자 티커) + JSON-LD 스크립트 존재 |
| A8 | `GET /` , `GET /market` | 각 200, 정상 렌더(핵심 페이지 회귀 없음) |
| A9 | `GET /aapl` (소문자) | 301 → `/AAPL` (proxy 정규화 회귀 없음) |

## 4. Test Cases — 방법 B (Chrome)

| TC | 페이지 | 기대 |
|---|---|---|
| B1 | `/AAPL` | 차트·FactLayer 렌더, 콘솔 에러 0(치명적), 하이드레이션 정상 |
| B2 | `/AAPL` view-source / DOM | JSON-LD(WebPage/FAQ/Breadcrumb 등) 파싱 가능, 메타(title/description/og) 정상 |
| B3 | `/AAPL/overall` | 서브 페이지 정상 진입·렌더(미광고지만 동작) |
| B4 | `/robots.txt`, `/sitemap-longtail-1.xml` | 브라우저에서 직접 열어 A1·A3 재확인 |
| B5 | 네트워크 헤더 | `/AAPL` 문서 응답의 `x-nextjs-cache`/`cache-control` 확인(A5 교차검증) |

## 5. 통과 기준

- **전체 TC PASS** + 프로덕션 빌드 성공 + 콘솔 치명적 에러 0.
- 회귀 0: popular sitemap·검색봇·서브 페이지·핵심 페이지·ISR 캐싱·SEO 메타 모두 정상.
- 실패 1건이라도 있으면 배포 보류 → 원인 분석 후 수정.

## 6. 병행 감사 (fresh-context Opus 5종)

1. **코드 감사**(review-agent) — 머지된 diff 정확성·컨벤션·레이어.
2. **배포 안정성 감사**(general) — 빌드·런타임·config·회귀 리스크.
3. **배포 readiness 감사**(general) — "지금 배포한다면" 관점의 리스크(롤백·모니터링·환경).
4. **SEO 감사**(general, `seo-audit` 스킬) — 현재 SEO 상태(메타·구조화데이터·sitemap·robots·인덱싱).
5. **테스트 커버리지 감사**(general) — 커버리지 90%+ 및 worst/edge/integration/e2e 충실도.

각 에이전트는 **이번 세션 맥락을 모르는 fresh context**로 독립 판단한다(범위=PR #591 변경 + 핵심 기능).

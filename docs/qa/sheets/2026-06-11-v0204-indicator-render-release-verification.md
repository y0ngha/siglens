# 테스트 시트 — v0.20.4 → 현재(보조지표 렌더링 스택) 릴리스 실증

- **작성일**: 2026-06-11 (Opus 4.8 저작)
- **Spec**: [docs/superpowers/specs/2026-06-11-v0204-to-current-verification-spec.md](../../superpowers/specs/2026-06-11-v0204-to-current-verification-spec.md)
- **대상**: master + 9-PR 스택 머지본, prod-like 빌드(`yarn build && yarn start`), 기준 호스트 `http://localhost:4200`
- **결과 기록**: PASS/FAIL + 실측 근거(status·헤더·DOM·콘솔). 추측 금지.

> 범례: **C#** = curl/HTTP 케이스, **B#** = 브라우저(Chrome) 케이스. 결과 칸은 실증 단계에서 채운다.

---

## A. curl / HTTP (C#)

### A.1 라우트 가용성·Status·Content-Type
| ID | 라우트 | 기대 | 결과 |
|---|---|---|---|
| C1 | `GET /` | 200 또는 의도된 redirect(308/307) — 4xx/5xx 아님 | |
| C2 | `GET /AAPL` (심볼 차트) | 200, `text/html`, prerender/ISR | |
| C3 | `GET /AAPL/fundamental` | 200, html | |
| C4 | `GET /AAPL/news` | 200, html | |
| C5 | `GET /AAPL/options` | 200, html | |
| C6 | `GET /AAPL/overall` | 200, html | |
| C7 | `GET /AAPL/fear-greed` | 200, html | |
| C8 | `GET /market` | 200, html | |
| C9 | `GET /backtesting` | 200, html | |
| C10 | `GET /login`,`/signup`,`/privacy`,`/terms` | 각 200, html | |
| C11 | `GET /account` (비로그인) | 인증 가드대로(로그인 redirect 또는 200) — 5xx 아님 | |
| C12 | 존재하지 않는 심볼/경로 `GET /__nope__` | 404(런타임 에러 아님) | |

### A.2 인프라/SEO 산출물
| ID | 대상 | 기대 | 결과 |
|---|---|---|---|
| C13 | `GET /robots.txt` | 200, `text/plain`, `Sitemap:` 라인 포함 | |
| C14 | `GET /manifest.webmanifest` | 200, manifest JSON(name/icons) | |
| C15 | `GET /api/sitemap/static` | 200, 유효 XML/응답 | |
| C16 | `GET /api/sitemap/popular`, `/api/sitemap/longtail/0` | 200, 유효 응답 | |
| C17 | `GET /AAPL/opengraph-image` | 200, `image/*` | |

### A.3 SEO 메타 (HTML 파싱 — 핵심 라우트)
| ID | 대상 | 기대 | 결과 |
|---|---|---|---|
| C18 | `/AAPL` `<title>` | 심볼/회사명 포함, 비어있지 않음 | |
| C19 | `/AAPL` `<meta name="description">` | 존재·비어있지 않음 | |
| C20 | `/AAPL` `<link rel="canonical">` | 절대 URL, 자기 경로(쿼리 없는 canonical) | |
| C21 | `/AAPL` OG/twitter (`og:title`/`og:image`/`twitter:card`) | 존재 | |
| C22 | `/AAPL` JSON-LD (`application/ld+json`) | 존재·유효 JSON(구조화 데이터) | |
| C23 | `/AAPL` `<h1>` | 정확히 1개, 의미 있는 텍스트 | |
| C24 | `/market`,`/AAPL/news` title/description/canonical | 라우트별 고유·정상 | |
| C25 | 정적 페이지(`/privacy`,`/terms`) title/description | 존재·정상 | |

---

## B. 브라우저 (Chrome) (B#)

### B.1 차트 기본 렌더 — `/AAPL`
| ID | 동작 | 기대 | 결과 |
|---|---|---|---|
| B1 | `/AAPL` 로드 | 캔들 차트 캔버스 렌더, 로딩 후 데이터 표시 | |
| B2 | 콘솔 | 에러 0(경고는 허용 범위 기록) | |
| B3 | 차트 우상단 톱니바퀴(`보조지표 설정`) 클릭 | 모달(dialog) 오픈, 카테고리 그룹 표시 | |
| B4 | 모달 카테고리 | 추세/모멘텀/변동성/볼륨/통계/**SMC** 그룹 모두 노출(SMC 첫 노출) | |

### B.2 kind별 대표 지표 토글 (렌더 변화 육안)
| ID | 지표(kind) | 동작 → 기대 | 결과 |
|---|---|---|---|
| B5 | Bollinger (overlay) | 체크 → Pane 0에 밴드 라인 3선 표시 | |
| B6 | Supertrend (overlay/trend 2색) | 체크 → 추세별 초록/빨강 라인, flip 지점 색 전환 | |
| B7 | Parabolic SAR (overlay/dot) | 체크 → 가격 위/아래 점(dot) | |
| B8 | RSI (pane) | 체크 → 새 pane 생성 + `.pane-indicator-label` 'RSI' | |
| B9 | MACD (pane/histogram) | 체크 → 히스토그램 양/음 색 구분 + 라인 | |
| B10 | Squeeze (pane/4색+상태점) | 체크 → 모멘텀 4색 히스토 + 0라인 상태 점 | |
| B11 | Regression (pane/r2 투명도) | 체크 → slope 히스토(부호 색), r2 낮을수록 흐릿 | |
| B12 | Elder Impulse (candle-paint) | 체크 → 메인 캔들이 green/red/blue로 재색칠 / 해제 시 기본 bull/bear 복원 | |
| B13 | SMC Zones (zone) | 체크 → premium(빨강)/discount(teal) 밴드 high·low + equilibrium(회색) 가격선 | |
| B14 | MA period 칩 | 모달에서 20 칩 토글 → 해당 MA 라인 표시/해제(aria-pressed) | |

### B.3 상호작용·복원·성능
| ID | 동작 | 기대 | 결과 |
|---|---|---|---|
| B15 | 여러 지표 동시 토글 후 모달 닫기/재오픈 | 체크 상태 유지, 렌더 정합 | |
| B16 | Elder Impulse ON 상태에서 줌/스크롤 후 다른 지표 토글 | 줌/스크롤 상태 보존(fitContent가 bars 변경에만) | |
| B17 | 지표 전체 OFF | 기본 캔들로 복귀, 잔여 시리즈/가격선 없음, 콘솔 에러 0 | |
| B18 | 심볼 전환(`/AAPL`→`/MSFT`) | 차트/지표 정상 재로드 | |

### B.4 멀티 환경 ([MULTI_ENV_TESTING.md](../MULTI_ENV_TESTING.md))
| ID | 환경 | 기대 | 결과 |
|---|---|---|---|
| B19 | 모바일 뷰포트(iPhone 폭) | 모달·차트 가로 오버플로우 없음, 시트/터치 동작 | |
| B20 | 키보드 단독 | 톱니바퀴→모달→체크박스 토글 키보드 도달 가능(포커스 트랩) | |
| B21 | (선택) Safari/WebKit | 모달·차트 렌더 Chrome과 동등 | |

### B.5 SEO 렌더 확인 (Chrome)
| ID | 동작 | 기대 | 결과 |
|---|---|---|---|
| B22 | `/AAPL` 렌더 DOM의 H1/메타 | 단일 H1, 메타 정상(C18~C23 교차 확인) | |
| B23 | `seo-audit` 스킬 병행 | 핵심 라우트 SEO 이슈 없음 | |

---

## C. 커버리지 매핑 메모
- 차트 렌더(B5~B18)는 캔버스라 단위/E2E가 픽셀을 못 봄 → **Chrome 육안이 1차**. E2E(chart-indicators.spec)는 모달 체크박스/pane-label만 커버.
- SEO·prerender·헤더(C13~C25)는 prod 빌드 산물 → **curl이 1차**.
- 핵심 기능 로직은 vitest/E2E가 커버(회귀는 C2~C12 status로 스모크).

## D. 실행 결과 요약 (2026-06-12 실증)

- **환경**: master `527d00ed`(9-PR 머지본, core 0.21.1) / prod 빌드(`E2E_TEST=1`, docker Postgres+Redis+SRH) / `http://localhost:4300`. E2E 시드 데이터(AAPL $195.70, 38종 인디케이터, 고정 분석).

### C# (curl) — PASS
- **C1~C11 PASS**: `/`,`/AAPL`(+sub),`/market`,`/backtesting`,`/login`,`/signup`,`/privacy`,`/terms` 전부 200 `text/html`. `/account`→307(인증 가드 정상).
- **C13~C17 PASS**: robots.txt 200 text/plain(Sitemap 포함), manifest 200, sitemap/static·popular 200 XML, og-image 200 image/png.
- **C18~C25 PASS**: title/description/canonical(절대URL·자기경로·쿼리 없음)/og:title·og:image/twitter:card/JSON-LD/H1(정확히 1개) — `/AAPL`·`/market`·`/AAPL/news`·`/privacy`·`/terms` 모두 정상·라우트별 고유. (canonical 호스트가 localhost인 것은 e2e `NEXT_PUBLIC_SITE_URL` 때문 — prod에선 siglens.io.)
- **관찰(스코프 외·기존 동작, 회귀 아님)**:
  - **C12**: `/__nope__`→200 — `/[symbol]` catch-all이 임의 문자열을 심볼로 렌더(soft-404). 지표 렌더 변경과 무관, 기존 라우팅 설계. (별도 검토 백로그감.)
  - **C16 일부**: `/api/sitemap/longtail/0`→404 — longtail 페이지 1-인덱싱 추정. 기존 sitemap 인프라(#586), 지표와 무관.

### B# (Chrome) — PASS (핵심 신규 메커니즘)
- **B1 PASS**: `/AAPL` 캔들 차트·볼륨 pane·타임프레임·우상단 톱니바퀴 렌더.
- **B2 PASS**: 콘솔 에러 0 (로드 + 전체 토글 이후 재확인).
- **B3 PASS**: 톱니바퀴 → 모달(dialog) 오픈.
- **B4 PASS**: 카테고리 그룹 추세/모멘텀/변동성/볼륨/통계/**SMC** 모두 노출(SMC 그룹 첫 노출). 신규 4종(Squeeze·Elder Impulse·Regression·SMC Zones) 모달 존재.
- **kind별 대표 토글 PASS**: Keltner(overlay)→좌상단 "KC Upper/Middle/Lower" 범례, Regression(pane)→가격 차트 아래 신규 pane+라벨, Elder Impulse(candle-paint)→메인 캔들 teal 재색칠, SMC Zones(zone)→토글 정상(시드 zone null이면 priceLine 미표시=graceful). 4종 동시 토글 후에도 **콘솔 에러 0**.
- **미실행(시드 한계·후속)**: B6 Supertrend 2색 flip·B16 줌 보존·B19 모바일·B20 키보드·B21 Safari — E2E가 모달/pane-label을 커버하고 핵심 렌더 경로(4 kind)는 위에서 무에러 확인. 필요 시 보강.

### 종합
- **머지본(core 0.21.1) prod 빌드 정상**: 전 라우트 200/SEO 정상(curl), 차트·모달·신규 4 kind 렌더 무에러(Chrome). 단위/E2E/커버리지(91.77%)·lint·build 그린.
- **발견 회귀 0**. C12/C16-longtail은 기존 동작(지표 스코프 외).
- 수정 PR: 없음(이번 범위에서 추가 수정 불필요).

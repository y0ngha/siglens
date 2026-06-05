# market ISR — 테스트 시트

- 날짜: 2026-06-04
- 대상: `/market` ISR 전환 (PR siglens#563)
- 절차: `docs/qa/TEST_SHEET_AUTHORING.md` (변경면→케이스→커버리지→실측)
- 환경: `docs/qa/QA_ENV_SETUP.md`(docker), `docs/qa/MULTI_ENV_TESTING.md`(4조합)

## 변경면 (change surface)

| # | 변경 | 입력/상태 | 부수효과 |
|---|---|---|---|
| S1 | ISR 전환 (`revalidate=3600`, 정적 prefetch, searchParams 제거) | 라우트 렌더 | Next data cache, `x-nextjs-cache` |
| S2 | 가격 패널 (`useMarketSummary` → `getMarketSummaryClientAction`) | redis summary | 지수4 + 섹터11 카드 |
| S3 | 섹터 신호 (`useSectorSignals(tf)`, `useSectorSignalState`) | tf/sector URL | tf 전환 시 클라 fetch, sector 탭 클라 필터 |
| S4 | briefing (`useMarketBriefing`, peek seed) | peek seed + submit | 마운트 트리거, BriefingCard |
| S5 | E2E seam (force-partial 쿠키) | `e2e_force_market_partial` | "데이터 일부 실패" 안내 |
| S6 | SEO 축2 (`SectorFactsSummary` 서버컴포넌트) | default tf 신호 | SSR 크롤 텍스트 |

## 케이스

### 수동 (curl) — ISR/SEO [Phase 7 실증 완료]

| ID | 케이스 | 기대값 | 결과 |
|---|---|---|---|
| C1 | `/market` 2회 curl `x-nextjs-cache` | 2회차 `HIT` (실제 1·2회 모두 HIT, build prerender) | ✅ PASS |
| C2 | build/runtime `DYNAMIC_SERVER_USAGE` | 0건 (양쪽) | ✅ PASS |
| C3 | build output `/market` | `○ (Static)` 1h revalidate | ✅ PASS |
| C4 | SSR HTML `SectorFactsSummary` 텍스트 | 섹터 신호 크롤 텍스트 존재 | ✅ PASS |
| C5 | SEO: title/meta/JSON-LD(4)/h1/canonical(/market)/noindex | 정상, noindex 없음 | ✅ PASS |
| C6 | `?timeframe=1Week` curl | SSR은 default tf `SectorFactsSummary` 텍스트 | ✅ PASS |

### 브라우저/E2E (B#) — 클라 인터랙티브 [이번 QA 대상]

| ID | 케이스 | 기대값 | 커버리지 | 결과 |
|---|---|---|---|---|
| B1 | 가격 패널 렌더 (hydration 후) | 지수 4(^GSPC/^DJI/^IXIC/^VIX) + 섹터 11(XLK…) 카드 | E2E + chrome | |
| B2 | 섹터 탭 전환 | sector 변경 → 해당 섹터 신호로 quadrant 갱신, URL `?sector=` (default는 param 제거) | E2E + chrome | |
| B3 | timeframe 전환 | tf 변경 → `useSectorSignals` 클라 fetch, URL `?timeframe=` 갱신, 신호 갱신 | E2E + chrome | |
| B4 | briefing 영역 | peek seed cached 즉시 표시 또는 마운트 후 submit→loading→표시 (봇이면 BotBlockedNotice) | E2E + chrome | |
| B5 | force-partial 안내 (`e2e_force_market_partial` 쿠키) | "데이터 일부 로드 실패" 안내 결정적 렌더 | E2E (기존 market 스펙) | |
| B6 | 딥링크 `?sector=XLK&timeframe=1Week` | 마운트 시 해당 sector·tf로 상태 복원 (탭 활성 + 신호) | E2E + chrome | |

### 멀티환경 (MULTI_ENV 4조합)

| ID | 케이스 | 기대값 | 결과 |
|---|---|---|---|
| B7 | 모바일 뷰포트 (Pixel 7 / iPhone 14) | 가로 오버플로우 없음(`scrollWidth ≤ clientWidth`), 카드/탭 터치 가능 | |
| B8 | Safari WebKit (Desktop + iPhone 14) | 렌더·tf 전환·탭 동작 정상 (Blink와 동등) | |

## 커버리지 매핑

- **C1–C6**: 수동 curl (Phase 7 실증 — 완료)
- **B1–B6**: 기존 market Playwright 스펙 로컬 실행 + Playwright chromium(=Chrome 엔진) 동작/스크린샷 + claude-in-chrome 보조
- **B7–B8**: Playwright chromium(Pixel 7) + webkit(Desktop Safari, iPhone 14)

## 실측 결과 (2026-06-04 실증)

**환경:** Playwright(chromium+webkit × desktop/mobile) + claude-in-chrome(실제 브라우저 띄움) + curl. docker(Postgres+Redis+SRH) + core 로컬 빌드본.

| ID | 결과 | 근거(실측) |
|---|---|---|
| C1–C6 | ✅ PASS | Phase 7 curl: `x-nextjs-cache: HIT`, build/runtime `DYNAMIC_SERVER_USAGE` 0, SSR SEO(title/meta/JSON-LD 4/h1/canonical /market/noindex 없음) |
| B1 | ✅ PASS | Playwright 4env + chrome: 지수4(GSPC/DJI/IXIC/VIX) + 섹터11(XLK…XLC) 렌더 |
| B2 | ✅ PASS | chrome: 금융 탭 클릭 → URL `?sector=XLF` + 신호 06종(JPM/BAC/WFC/BLK/V/MA) 클라 갱신 |
| B3 | ✅ PASS | chrome+Playwright: tf 전환 → URL `?timeframe=1Hour`, 1시간 selector 활성, sector-signals server action POST |
| B4 | ✅ PASS | chrome: "AI 브리핑 생성 중…" loading(`useMarketBriefing` 마운트 트리거). 완성은 worker LLM 필요(E2E 환경 한계, 의도된 동작) |
| B5 | ✅ PASS | 기존 `market.spec.ts` + Playwright 4env: `e2e_force_market_partial` 쿠키 → "데이터 일부 로드 실패" 안내 결정적 렌더 + dismiss |
| B6 | ⚠️ FAIL→수정→✅ PASS | Playwright 최초 FAIL(딥링크 미복원 **회귀**: `useSectorSignalState`가 `useSearchParams` 마운트 미독) → `945d028f` 수정(lazy init 복원) → chrome 재검증: `?sector=XLV&timeframe=1Hour` → 헬스케어 탭 + 1시간 정확 복원 |
| B7 | ✅ PASS | Playwright Pixel7/iPhone14: `scrollWidth ≤ clientWidth`(가로 오버플로우 없음), 탭 `overflow-x-auto` 내부 스크롤 |
| B8 | ✅ PASS | Playwright webkit(Desktop Safari + iPhone14): 렌더·tf 전환·탭 동작 Blink 동등 |
| 콘솔 | ✅ 에러 0 | chrome `read_console_messages` (hydration/error 없음) |

**종합: 전 케이스 PASS.** B6은 ISR 전환 회귀를 QA가 잡아 수정·재검증 완료. ISR/SSR/SEO(curl) + 클라 인터랙티브(Playwright 4env + claude-in-chrome 실측) 모두 검증.

# Spec — v0.21.0 → 현재(HEAD) 변경사항 검수

> 작성일: 2026-06-19
> 범위: `v0.21.0`(release) → `HEAD`(=v0.22.0 이후, PR #596~#603 머지 누적)
> 목적: 새로 추가된 4개 페이지군의 네비게이션·SEO·배포 안정성·테스트 커버리지 검수
> 검수 방식: (A) prod-like 빌드 + 개발/프로덕션 서버 실행 → curl + Chrome 실증, (B) 5개 fresh-context 감사 에이전트(Opus 4.8) 병렬

---

## 0. 변경 범위 (Change Surface)

### 0.1 신규 페이지 라우트 (5개)

| 라우트 | 설명 | ISR `revalidate` | degrade 정책 |
|---|---|---|---|
| `/news` | 마켓 뉴스 허브 인덱스 (5개 카테고리 카드) | 24h (86400) | — |
| `/news/[category]` | 카테고리별 뉴스 + AI 다이제스트 | 12h (43200) | 빈 데이터 = noindex |
| `/economy` | 미국 경제·거시 흐름 (지표 그리드 + 캘린더 + 브리핑) | 24h (86400) | 빈 스냅샷 = EconomyDegraded |
| `/[symbol]/congress` | 의원(상·하원) 거래 공시 + AI 동향 | ISR | 0건=색인/장애=noindex |
| `/[symbol]/financials` | 재무제표(손익·재무상태·현금흐름) 탭 | ISR | — |

### 0.2 신규 entities / widgets / providers

- **entities**: `market-news`, `economy`, `congress-trades`, `financials-statements`, `analysis`(확장)
- **widgets**: `news-hub`, `market-news`, `economy`, `congress`, `financials`, `overall`(확장), `layout`(확장)
- **shared/api providers**: `EconomyProvider`/`FmpEconomyProvider`/`FakeEconomyProvider`, `CongressTradesProvider`(+Cached/Fake), `FinancialStatementsProvider`(+Cached/Fake)
- **sitemap/robots**: congress·news·economy 라우트 항목 추가, AI봇 하이브리드 정책

### 0.3 네비게이션 현황 (현 상태 사실 기록)

- **글로벌 헤더 네비** (`src/widgets/layout/Header.tsx` `NAV_ITEMS`):
  - `/market`(시장 분석), `/news`(마켓 뉴스) **2개만 존재**
  - 데스크탑: `HeaderNav`(active=usePathname), PPR fallback `HeaderNavStatic`
  - 모바일: `HeaderMobileMenu`(햄버거 드로어, focus-trap/escape/body-scroll-lock)
  - ⚠️ **`/economy` 누락** — 신규 top-level 페이지인데 헤더 진입 경로 없음
- **심볼 탭** (`src/widgets/symbol-page/utils/symbolTabsConfig.ts` `TABS`):
  - chart·news·fundamental·**financials**·**congress**·options·fear-greed·overall → financials·congress 등록 완료 ✓
  - `CrossLinkCards.tsx`에도 financials·congress 교차 링크 존재 ✓
- **뉴스 카테고리 간 이동** (`/news/[category]`):
  - 페이지 본문: h1 + `MarketNewsDigest` + `MarketNewsList`/`MarketNewsDegraded`
  - breadcrumb는 **JSON-LD(구조화 데이터)만** 존재, **가시적 카테고리 탭/네비 없음**
  - ⚠️ 한 카테고리 페이지에서 다른 카테고리로 가려면 `/news` 허브로 되돌아가야 함

---

## 1. 검수 항목 (User Requirements)

| # | 항목 | 판정 기준 | 조치 |
|---|---|---|---|
| 1 | 신규 페이지 헤더 네비 동작 (모바일 포함) | 모든 신규 top-level 페이지가 헤더에서 접근 가능 + active 표시 + 모바일 드로어 동작 | **`/economy` 헤더 네비 추가** (데스크탑+모바일) |
| 2 | 마켓 뉴스 내 다른 뉴스 접근 경로 | 카테고리 페이지에서 다른 카테고리/허브로 가시적 이동 경로 존재 | **카테고리 네비(탭/칩 또는 가시 breadcrumb) 추가** |
| 3 | SEO | metadata/canonical/JSON-LD/sitemap/robots/OG 무결성, noindex 일관성 | `seo-audit` 감사 + 실증(curl 메타 추출) |
| 4 | 재테스트 (전수) | vitest 전 스위트 GREEN, prod-like 빌드 성공, E2E GREEN | 빌드+테스트 전수 재실행 |
| 5 | 배포 안정성 감사 | ISR cold-gen 500 없음, env/캐시/직렬화 경계 무결, 회귀 없음 | 2개 독립 감사 에이전트 |
| 6 | 메인(홈) 화면에서 신규 페이지 라우팅 적절성 | 홈에서 신규 페이지로의 발견·유도 동선이 적절한가 | 현황 검토 + 필요 시 CTA 추가 |

### 1.1 요구사항 #6 — 홈 화면 라우팅 현황 (사실 기록)

- 홈(`src/app/page.tsx`) 가시적 링크: `/market`("오늘 주목할 종목"), `/backtesting`("백테스팅 결과 보기") 2개뿐.
- FAQ 본문에 `/TSLA/news`, `/AAPL/fundamental` 등 **텍스트 언급**은 있으나 클릭 가능한 링크 아님.
- `/news`·`/economy`로의 **가시적 홈 CTA 없음** → 헤더 nav(economy 추가 후)·푸터로만 발견 가능.
- 심볼 신규 탭(`congress`/`financials`)은 `SymbolTabs` + `CrossLinkCards`로 연결됨 ✓ (홈 → 심볼 검색/카테고리 경유).
- 판정: 헤더 nav가 전역 발견을 보장하나, 홈 콘텐츠 내 유도 동선 추가 여부는 감사 결과로 결정.

---

## 2. 검수 절차

### Phase A — 변경 범위 Spec (본 문서) + Test Case 생성 (Opus 4.8)
- 본 spec 확정 후 Opus 4.8 에이전트가 검수용 Test Case 문서 생성

### Phase B — 네비게이션 갭 수정 (요구사항 #1, #2)
1. `/economy` → `NAV_ITEMS` 추가 (데스크탑 `HeaderNav`/`HeaderNavStatic` + 모바일 `HeaderMobileMenu` 자동 반영)
2. `/news/[category]` 카테고리 간 이동 UI 추가 (디자인 결정 필요 → 사용자 확인)
3. 관련 테스트(Header.test, HeaderMobileMenu.test, 네비 통합 테스트) 갱신

### Phase C — 실증 (Opus 4.8 단일 에이전트)
1. prod-like 빌드(`yarn build`, exit code 직접 캡처) → 서버 실행
2. **curl 실증**: 각 라우트 status code, canonical, robots meta, JSON-LD, sitemap 항목
3. **Chrome 실증**: 헤더 네비(데스크탑+모바일 viewport), 뉴스 카테고리 이동, 페이지 렌더링, 콘솔 에러
4. Test Case 시트 따라 PASS/FAIL 기록

### Phase D — 5개 fresh-context 감사 에이전트 (Opus 4.8 병렬)
1. `review-agent` — 코드 품질 감사
2. 일반 agent — 배포 안정성 감사 (정적)
3. 일반 agent — "지금 배포한다고 가정" 배포 안정성 감사
4. 일반 agent — `seo-audit` 스킬 기반 SEO 감사
5. 일반 agent — 테스트 커버리지 90%+ & worst/edge/integration/e2e 감사

> 모든 감사 에이전트는 **현재 세션 컨텍스트를 모르는 fresh context**로 진입.

---

## 3. 합격 기준 (Definition of Done)

- [ ] `/economy` 데스크탑 헤더 + 모바일 드로어에서 접근 가능, active 표시 정확
- [ ] 뉴스 카테고리 페이지에서 다른 카테고리/허브로 가시적 이동 가능
- [ ] 5개 신규 라우트 모두 200 OK (curl), 콘솔 에러 0 (Chrome)
- [ ] canonical/robots/JSON-LD/sitemap 무결성 확인, noindex 일관성(빈 데이터 경로)
- [ ] vitest 전 스위트 GREEN + prod-like 빌드 성공
- [ ] 5개 감사 에이전트 Blocker 0 (또는 모두 처리/false-positive 반려)
- [ ] 회귀 없음 (회귀 발견 시 사용자 보고 후 수정)

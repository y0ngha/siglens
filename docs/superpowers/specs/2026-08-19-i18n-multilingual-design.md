# 다국어(i18n) 지원 설계 — ko / en / ja / zh

> 작성일 2026-08-19 · 브랜치 `feat/i18n-multilingual`
> 기본 언어 **한국어(ko)**, 추가 **영어(en) · 일본어(ja) · 중국어 간체(zh)**.

---

## 0. 요약 (결정 사항)

| 항목 | 결정 | 근거 |
|---|---|---|
| 라이브러리 | **next-intl 4.13.x** | Next 16 App Router 네이티브, RSC 우선(server-only ~457B), ICU MessageFormat, 타입 세이프 키. peer `next: ^16.0.0` 명시 |
| URL 전략 | `[locale]` 세그먼트 + `localePrefix: 'as-needed'` — **ko는 접두사 없음** | 이미 순위를 가진 기존 URL(`/AAPL`)이 1바이트도 안 바뀐다. 2026-07 크롤 수요 붕괴 이력이 있는 사이트에서 전 URL 이동은 금지 |
| 언어 자동 감지 | **끈다** (`localeDetection: false`) | Accept-Language 리다이렉트는 (1) CDN 캐시 키를 오염시키고 (2) 미국 IP·`en` 헤더로 크롤하는 Googlebot을 한국어 canonical에서 이탈시킨다 |
| 메시지 저장소 | `messages/{locale}.json` (최상위 키 = 네임스페이스), ko가 source-of-truth | 카탈로그는 codemod가 통째로 생성하는 산출물이라 손편집이 없다 → 병합 충돌 논거가 성립하지 않고, 파일 하나면 동적 import가 단순하다. **클라이언트 전송량은 파일 구조가 아니라 `pickMessages`로 통제** |
| 추출 방식 | Babel AST 파싱 + **텍스트 스플라이싱 codemod** | `@babel/generator` 미설치 + 전면 리포맷 회피. 최소 diff |
| 번역 생성 | 기존 LLM 프로바이더 + 용어집 주입 | 신규 SaaS 의존 0. 54,080자 × 3언어 = 1회 수 달러 |
| 번역 신뢰도 | 7종 자동 게이트 + 역번역 채점 + 민감 네임스페이스 인간 승인 | 아래 §5 |
| AI 분석 다국어 | **core 무변경 · 후처리 번역 레이어** | core는 프롬프트/캐시키 소유(SCOPE.md). 로케일 프롬프트는 분석 비용 4배 + 교차 레포 릴리스. 상세 §6 |
| SEO | 자기참조 canonical + `alternates.languages` + sitemap `xhtml:link` + **로컬라이즈 완료 게이트** | thin 번역 페이지 색인은 2026-07 재현. 준비된 로케일만 index |
| DB 콘텐츠 | 기존 테이블에 `locale` 컬럼 **추가(DEFAULT 'ko')** | 기존 행 무변경 이관 |

---

## 1. 현황 실측 (설계 근거)

`tmp/i18n/scan.mjs` (Babel AST, 주석 제외, 테스트 제외) 결과:

```
파싱 실패:            0 파일
사용자 대면 한국어:  367 파일
문자열 출현:       2,945 (JSXText 767 · StringLiteral 1,788 · Template 390)
고유 문자열:       2,297
고유 문자 총합:   54,080
```

> `grep '[가-힣]'` 기준 27,556 라인 중 **대부분이 JSDoc 주석**이라 번역 대상이 아니다.
> 실제 번역 규모는 소설 한 편 분량(54KB)이며, 기계번역 1회 비용은 수 달러 수준이다.

레이어별 상위 분포:

```
332  src/shared/lib        (라벨·에러메시지·seo.ts 1,482줄)
320  src/shared/config     (내비·카테고리 라벨)
175  src/views/symbol
169  src/app/[symbol]
136  src/widgets/analysis
131  src/widgets/fundamental
129  src/widgets/options
 90  src/widgets/dashboard
...  (전체 86개 슬라이스)
```

---

## 2. 라우트 인벤토리 (전수)

`tmp/i18n/routes.mjs`가 `src/app`을 걸어 생성한다. **CI에서 이 목록과 로케일 커버리지 테스트를 대조한다** — 새 라우트가 i18n 없이 들어오는 것을 막는 장치다.

### 2.1 페이지 32개 (모두 로케일 대상)

| # | 라우트 | ko | en | ja | zh | 비고 |
|---|---|---|---|---|---|---|
| 1 | `/` | ✅ | `/en` | `/ja` | `/zh` | 랜딩. `?q=` 검색 리다이렉트 로케일 보존 필요 |
| 2 | `/[symbol]` | ✅ | `/en/[symbol]` | … | … | 차트+AI 분석. 색인 게이트 대상 |
| 3 | `/[symbol]/congress` | ✅ | … | … | … | |
| 4 | `/[symbol]/fear-greed` | ✅ | … | … | … | |
| 5 | `/[symbol]/financials` | ✅ | … | … | … | ETF는 기존 noindex 유지 |
| 6 | `/[symbol]/fundamental` | ✅ | … | … | … | |
| 7 | `/[symbol]/news` | ✅ | … | … | … | |
| 8 | `/[symbol]/options` | ✅ | … | … | … | |
| 9 | `/[symbol]/overall` | ✅ | … | … | … | |
| 10 | `/[symbol]/position` | ✅ | … | … | … | |
| 11 | `/account` | ✅ | … | … | … | noindex(인증) |
| 12 | `/account/delete` | ✅ | … | … | … | noindex |
| 13 | `/backtesting` | ✅ | … | … | … | |
| 14 | `/economy` | ✅ | … | … | … | |
| 15 | `/economy/kr` | ✅ | … | … | … | |
| 16 | `/fear-greed` | ✅ | … | … | … | |
| 17 | `/fear-greed/kr` | ✅ | … | … | … | |
| 18 | `/forgot-password` | ✅ | … | … | … | noindex |
| 19 | `/login` | ✅ | … | … | … | noindex |
| 20 | `/market` | ✅ | … | … | … | |
| 21 | `/market/kr` | ✅ | … | … | … | |
| 22 | `/news` | ✅ | … | … | … | 3지역 상위 허브 |
| 23 | `/news/[category]` | ✅ | … | … | … | slug 6종: `general` `stock` `crypto` `forex` `articles` `kr` |
| 24 | `/news/us` | ✅ | … | … | … | |
| 25 | `/onboarding` | ✅ | … | … | … | noindex |
| 26 | `/portfolio` | ✅ | … | … | … | noindex |
| 27 | `/privacy` | ✅ | … | … | … | DB `terms` 테이블 콘텐츠 |
| 28 | `/reset-password` | ✅ | … | … | … | noindex |
| 29 | `/share/[id]` | ✅ | … | … | … | noindex. 공유 스냅샷은 **생성 시 로케일 고정** |
| 30 | `/signup` | ✅ | … | … | … | noindex |
| 31 | `/signup/oauth/consent` | ✅ | … | … | … | noindex |
| 32 | `/terms` | ✅ | … | … | … | DB `terms` 테이블 콘텐츠 |

`/news/[category]` 6 slug 전개를 포함하면 **정적 로케일 URL 37개 × 4 = 148개**,
여기에 `[symbol]` 계열(POPULAR_TICKERS 371종 × 최대 9 서브라우트)이 곱해진다.

### 2.2 Route Handler 14개 (로케일 비대상 — 단, 3개는 변경 필요)

| 라우트 | i18n 영향 |
|---|---|
| `/api/analysis/stream` | **있음** — SSE 응답에 로케일 전달, 번역 레이어 경유 |
| `/api/sitemap` (+ `/static` `/popular` `/crypto` `/longtail/[page]` `/removal/[kind]`) | **있음** — `xhtml:link` alternates 추가 |
| `/api/cron/seo-prewarm` | **있음** — 프리웜 로케일 화이트리스트 |
| `/api/auth/*`, `/api/health`, `/api/ready`, `/api/cron/kr-tickers`, `/api/sse-probe` | 없음 |

> API 라우트는 next-intl proxy matcher에서 **반드시 제외**한다. 포함되면 `/api/...`가
> `/ko/api/...`로 리라이트되어 전부 404가 된다.

### 2.3 Special 5개

`not-found.tsx` · `error.tsx` · `global-error.tsx` · `robots.ts` · `manifest.ts`

- `not-found` / `error`: 로케일 세그먼트 **밖**에서도 발생 가능 → ko 폴백 문구를 하드코딩 유지하고, `[locale]` 내부용 `not-found`를 별도로 둔다.
- `global-error`: React 트리 최상단이라 `NextIntlClientProvider` 바깥 → **번역 불가**, ko + en 병기 정적 문구.
- `manifest.ts`: `name`/`description`이 한국어. 로케일별 manifest는 PWA 사양상 1개만 링크되므로 **ko 고정**(설치 배너 언어는 v1 범위 밖).
- `robots.ts`: 변경 없음.

### 2.4 모달 · 시트 · 드로어 25개 (전부 로케일 대상)

```
features/analysis-nudge/ui/AnalysisSignupNudgeModal.tsx
features/premium-gate/ui/PremiumModelGateModal.tsx
features/pwa-install/ui/IosInstallModal.tsx
features/pwa-install/ui/PwaBanner.tsx
features/symbol-model/model/SymbolModelContext.tsx
shared/ui/GearIcon.tsx
shared/ui/PopoverSurface.tsx
views/symbol/ChartContent.tsx
views/symbol/MobileAnalysisSheet.tsx          ← vaul. 모바일 필수 경로
views/symbol/SymbolLayoutHeader.tsx
views/symbol/SymbolPageClient.tsx
widgets/chart/StockChart.tsx
widgets/chart/ui/IndicatorSettingsModal.tsx
widgets/chat/ChatPanel.tsx
widgets/chat/UserApiKeyRequiredModal.tsx
widgets/financials/FinancialsStatements.tsx
widgets/financials/financialsTooltips.tsx
widgets/financials/sections/BalanceSheetSection.tsx
widgets/financials/sections/IncomeStatementSection.tsx
widgets/layout/HeaderMobileMenu.tsx           ← 언어 스위처가 들어갈 곳
widgets/notice-popup/ui/NoticePopup.tsx       ← DB 콘텐츠
widgets/share/ui/ShareButton.tsx
widgets/share/ui/SharePreparingModal.tsx
widgets/share/ui/ShareSheet.tsx
widgets/share/ui/ShareTriggerDialog.tsx
```

> 모달은 라우트가 아니라 **소속 페이지의 로케일을 상속**한다. 별도 URL이 없으므로
> SEO 대상이 아니지만 메시지 추출 대상이며, `NextIntlClientProvider` 하위에
> 마운트되는지 확인해야 한다(`PwaBanner`·`NoticePopupLoader`는 root layout 직속이라
> 프로바이더 위치 조정 필요).

### 2.5 DB 저장 콘텐츠 (코드 밖 번역 대상)

| 테이블 | 한국어 필드 | 처리 |
|---|---|---|
| `terms` | `body` (약관·개인정보처리방침 마크다운) | `locale` 컬럼 추가, uq `(kind, version, locale)`. **인간 번역 필수** |
| `notices` | `title` `body` `linkLabel` | `locale` 컬럼 추가, ko 폴백 |
| `profileDescriptionTranslations` | `descriptionKo` | PK를 `(symbol, locale)`로. **en은 FMP 원문 영어를 그대로 사용**(재번역 금지) |
| `economicIndicatorTranslations` | `koreanName` | PK에 `locale` 추가 |
| `news` / `marketNews` | AI 생성 한국어 요약 | 후처리 번역 레이어(§6) |
| `economicCalendar` | 이벤트 한국어 | 후처리 번역 레이어 |
| `seoAnalysisSnapshots` | 프리웜된 분석 본문 | 로케일별 스냅샷, 프리웜 화이트리스트로 통제 |
| `sharedAnalyses` | 공유 스냅샷 본문 | **생성 시 로케일 고정** + `contentHash` 페이로드에 locale 포함 — 아래 주의 |
| `assetTranslations` | `koreanName` | ja/zh 종목명은 v1 범위 밖 — `name`(영문) 폴백 |

> ⚠️ **`sharedAnalyses`의 dedupe 충돌**: `shared_analyses_content_uq`는
> `contentHash` **단독** unique이고(`src/shared/db/schema.ts:613`),
> `create()`는 `onConflictDoUpdate({ target: contentHash, set: { expiresAt } })`로
> 기존 행을 재사용한다(`src/entities/shared-analysis/api.ts:71`).
> `contentHash(kind, symbol, result, chartBars)`에는 로케일이 없다
> (`lib/contentHash.ts:14`). 따라서 `locale` 컬럼만 추가하면 **영어 사용자가 만든
> 공유 링크가 먼저 저장된 한국어 행의 id를 돌려받고**, `onConflictDoUpdate`는
> `expiresAt`만 갱신하므로 로케일도 고쳐지지 않는다 — 조용히 남의 언어 스냅샷을
> 공유하게 된다.
> **해결**: `contentHash` 페이로드에 `locale`을 넣는다(unique 제약을
> `(contentHash, locale)`로 넓히는 것보다 낫다 — 기존 인덱스·쿼리를 건드리지 않고,
> 로케일이 다르면 해시가 달라져 자연히 다른 행이 된다). 기존 행은 ko로 생성된
> 해시라 무효화되지만, 공유 링크는 `id`로 조회하므로 **기존 링크는 그대로 살아있다**
> (새 해시는 새 공유 생성 시에만 쓰인다).

---

## 3. 라이브러리 선정

### 3.1 후보 비교

| | next-intl 4.13 | Paraglide JS | react-i18next |
|---|---|---|---|
| Next 16 App Router | 네이티브, peer `^16.0.0` | 어댑터 | 커뮤니티 |
| RSC 지원 | 1급 (server-only ~457B) | 컴파일타임(런타임 0) | 클라이언트 중심 |
| 번들(클라 메시지 포함) | ~4KB + 사용 네임스페이스 | 최소(메시지별 트리셰이킹) | 큼 |
| ICU MessageFormat | ✅ | 제한적 | 플러그인 |
| 타입 세이프 키 | ✅ | ✅(함수) | 부분 |
| 기존 `proxy.ts` 합성 | `createMiddleware` 조합 가능 | 별도 훅 필요 | 수동 |

### 3.2 결정: **next-intl**

- 이 앱은 **RSC 렌더가 지배적**이다. Paraglide의 강점(클라이언트 메시지 트리셰이킹)은
  서버에서 렌더되는 문자열에는 이득이 없고, next-intl의 server-only 비용은 이미 ~457B다.
- `src/proxy.ts`가 티커 케이스 정규화·검색 리다이렉트·인증 가드를 **이미** 하고 있어,
  로케일 미들웨어를 **직접 합성**할 수 있어야 한다. next-intl은 `createMiddleware`가
  `NextResponse`를 반환하므로 기존 로직과 순서 조립이 자유롭다.
- ICU 복수형·성별·`{count}` 포맷이 필요하다(예: "N개 신호", 일본어/중국어는 복수형 없음).
- 번들 민감도: 2026-08 first-load JS −38% 작업의 성과를 되돌리지 않기 위해
  **네임스페이스 단위 로딩**을 강제한다(§4.3).

> ⚠️ Next **16.2.12** 사용 중이다. `next/root-params`는 16.3+ 기능이므로
> **legacy `setRequestLocale(locale)` 경로를 쓴다**. 이걸 빠뜨리면 모든 로케일 페이지가
> dynamic으로 떨어져 ISR이 통째로 꺼진다 — 이 레포에서 가장 비싼 실수다.

---

## 4. 아키텍처

### 4.1 디렉터리

```
messages/
  ko.json  en.json  ja.json  zh.json   최상위 키 = 네임스페이스(FSD 슬라이스). ko가 정본
  glossary.json                        잠금 용어(로케일별)
  _meta/
    hashes.json                        ko 메시지 콘텐츠 해시 → 스테일 감지
    review/{locale}.json               역번역 점수 미달 항목(인간 검토 대기)
src/shared/i18n/
  locales.ts            Locale 타입 · 표기명 · hreflang/og/Intl 태그 · localePath/splitLocalePath
  routing.ts            defineRouting({ localePrefix:'as-needed', localeDetection:false })
  navigation.ts         createNavigation(routing) → Link/useRouter/usePathname/redirect
  request.ts            getRequestConfig
  loadMessages.ts       카탈로그 로드 + pickMessages(클라 전송량 통제)
  clientNamespaces.ts   루트 프로바이더 네임스페이스 + withChrome()
src/shared/lib/seoAlternates.ts   hreflang alternates + 자기참조 canonical
src/app/[locale]/…               기존 src/app 라우트 전부 이동
src/app/{api,robots.ts,manifest.ts,global-error.tsx,globals.css,fonts}/  로케일 비대상 잔류
scripts/i18n/
  extract.mjs      추출 codemod
  translate.mjs    LLM 번역
  verify.mjs       7종 QA 게이트
  routes.mjs       라우트 인벤토리(테스트가 소비)
```

### 4.2 라우팅

```ts
// src/shared/i18n/routing.ts
export const LOCALES = ['ko', 'en', 'ja', 'zh'] as const;
export const routing = defineRouting({
    locales: LOCALES,
    defaultLocale: 'ko',
    localePrefix: 'as-needed',   // ko = 접두사 없음 → 기존 URL 불변
    localeDetection: false,      // Accept-Language 자동 리다이렉트 금지
});
```

**`localeDetection: false`인 이유**

1. 자동 리다이렉트는 `Vary: Accept-Language`를 유발하거나 쿠키 분기를 만들어
   Cloudflare 캐시 키를 오염시킨다. 이 레포는 CF 히트율을 13.8%→36.7%로 끌어올린
   작업 이력이 있고, `Vary` 때문에 URL 퍼지가 안 먹는 문제도 겪었다.
2. Googlebot은 미국 IP·`Accept-Language: en`으로 크롤한다. 자동 리다이렉트를 켜면
   한국어 canonical에서 크롤러가 이탈해 **기존 색인이 무너진다**.
3. 사용자 선택은 헤더 스위처에서 명시적으로 이뤄지고 `NEXT_LOCALE` 쿠키에 저장된다.
   쿠키는 **스위처가 발급한 경우에만** 리다이렉트 근거로 쓴다(신규 크롤 요청에는 없음).

### 4.3 `proxy.ts` 합성 (가장 위험한 지점)

기존 `proxy.ts`는 세 가지를 한다: `?q=` 검색 리다이렉트 · 티커 대문자 정규화 · 인증 가드.
여기에 로케일이 얹히면 다음 순서여야 한다.

```
1) /api, /_next, 정적 자산  → 즉시 통과 (matcher 제외)
2) pathname에서 로케일 접두사 분리 → { locale, rest }
3) 기존 로직을 rest 기준으로 수행 (리다이렉트 URL은 locale 접두사를 다시 붙여 발급)
4) next-intl createMiddleware로 위임
```

**필수 회귀 방지**: `RESERVED_FIRST_SEGMENTS`에 `'en' | 'ja' | 'zh'`를 추가한다.
누락하면 `isAdmissibleSymbolShape('en')`이 참이라 `/en`이 `/EN` 티커로 301된다 —
빌드에서는 정상으로 보이고 런타임에서만 깨지는, 이 파일 JSDoc이 이미 경고한 함정이다.
`src/app/__tests__/proxy.test.ts`가 디렉터리 목록과 대조하므로 **로케일 목록도 대조에 포함**한다.

### 4.4 메시지 네임스페이스

- 네임스페이스 = FSD 슬라이스 경로. 예 `widgets.analysis`, `app.symbol`, `shared.lib`.
- 키 = `<파일 basename>.<의미 슬러그>`. 예 `widgets.analysis` 안의 `AnalysisPanel.emptyState`.
- 서버 렌더는 전체 카탈로그를 봐도 비용이 없다(번들에 안 실린다).
  **클라이언트로 나가는 양만** `pickMessages`로 통제한다 — 2,297키 전체를 보내면
  first-load JS 회귀다.
- 루트 레이아웃은 `ROOT_CLIENT_NAMESPACES`(헤더·푸터·전역 모달)만 주입한다.
  페이지가 더 필요하면 `withChrome('widgets.analysis', …)`로 **루트 것을 포함해**
  자체 프로바이더를 만든다 — 중첩 `NextIntlClientProvider`는 부모 `messages`를
  상속하지 않고 **교체**하므로, 루트 네임스페이스를 빼면 그 페이지 안의 헤더 문구만
  키 문자열로 노출된다.

### 4.5 포맷팅

- 숫자·날짜·상대시간은 `useFormatter()`(Intl 래퍼)로 통일.
- **통화는 UI 로케일을 따르지 않는다.** 종목의 자산군이 통화를 정한다(KRX=₩, US=$).
  UI를 en으로 바꿨다고 삼성전자 가격이 달러가 되면 안 된다 — 2026-08 3자산군 개편에서
  실제로 발생했던 결함(`₩→$`)의 재현 경로다. `priceFormat.ts`에 로케일 인자를
  **추가하지 않는다**(포맷 구분자만 로케일을 따른다).
- 기존 `formatKoreanDateTime.ts` 등 ko 전용 포맷터는 로케일 인자를 받는 범용으로 승격.

---

## 5. 번역 파이프라인과 신뢰도 검증

### 5.1 추출 (`yarn i18n:extract [--apply] [--only <경로>]`)

Babel로 파싱 → 한국어를 담은 `StringLiteral` / `JSXText` / `TemplateLiteral`을 찾아
**원본 텍스트를 start/end 오프셋으로 치환**한다(제너레이터 미사용 → 포맷 보존, 최소 diff).
치환은 오프셋 역순으로 적용해 앞선 치환이 뒤 오프셋을 밀지 않게 한다.

**키 규칙**: `<네임스페이스>.<파일 basename>.<ko 원문 sha1 6자>`.
순번 키(`Footer.1`)는 문자열이 하나 삽입되면 뒤가 전부 밀려 카탈로그 diff가 통째로
뒤집힌다. 해시는 원문이 같으면 항상 같은 키라 재추출이 멱등이다.

> ⚠️ **카탈로그는 반드시 중첩 JSON이어야 한다.** next-intl은 네임스페이스와 키를
> 항상 `.`로 쪼개 객체를 타고 내려가므로 `{"widgets.layout": {...}}` 같은 평면 키는
> 절대 매칭되지 않는다 — 첫 빌드에서 `MISSING_MESSAGE: widgets.layout`으로 드러났다.
> `pickMessages`도 같은 규칙으로 서브트리를 되쌓는다.

**자동 치환은 안전한 컨텍스트에서만** 한다. 나머지는 사유와 함께
`messages/_meta/skips.json`에 적재된다(실측):

| 사유 | 건수 | 왜 자동화하지 않는가 |
|---|---|---|
| 자동 치환 가능 | **1,151** | — |
| `non-component-module` | 1,129 | `.ts` 상수·유틸. 소비자 쪽 리팩터가 필요하다 |
| `module-scope-or-helper` | 550 | 모듈 스코프 상수·헬퍼 함수. 훅을 부를 자리가 없다 |
| `template-needs-icu-review` | 99 | 표현식 슬롯을 ICU 인자로 바꾸면 문장 구조가 달라진다 |
| `module-specifier` | 11 | import 경로·타입 리터럴. 번역 대상이 아니다 |

번역자 바인딩은 컴포넌트의 async 여부로 갈린다. `useTranslations`는 **서버
컴포넌트에서도 동작하므로**(next-intl `react-server` 진입점) 동기 컴포넌트는
클라이언트/서버 구분 없이 같은 훅을 쓴다. `getTranslations`는 훅을 부를 수 없는
async 컴포넌트에서만 필요하다.

제외 규칙(자동): `__tests__` / `*.test.*` / `*.spec.*` / `__integration__` /
`src/app/api/` / `test-utils`. 주석은 파서가 문자열로 보지 않으므로 자동 제외된다.
core로 넘어가는 프롬프트 문자열(`AI_SYSTEM_PROMPT` 등)은 core 소유라 대상이 아니다.

### 5.2 번역 (`yarn i18n:translate --locale en`)

- 기존 LLM 프로바이더 SDK 재사용(신규 SaaS 의존 0).
- 프롬프트에 **용어집(`messages/glossary.json`)과 도메인 컨텍스트**를 주입한다.
  용어집 예:

  ```json
  {
    "공포·탐욕 지수": { "en": "Fear & Greed Index", "ja": "恐怖・強欲指数", "zh": "恐惧与贪婪指数" },
    "이동평균":       { "en": "Moving Average",     "ja": "移動平均線",     "zh": "移动平均线" },
    "종합 결론":       { "en": "Overall Conclusion",  "ja": "総合結論",       "zh": "综合结论" },
    "손절":           { "en": "Stop Loss",          "ja": "損切り",         "zh": "止损" }
  }
  ```
- ICU 플레이스홀더(`{count}`, `{symbol}`)는 **번역 금지 토큰**으로 명시.
- 변경분만 번역: `messages/_meta/hashes.json`의 ko 해시가 바뀐 키만 재번역.

### 5.3 검증 게이트 (`yarn i18n:verify` — CI 필수)

| # | 게이트 | 잡는 결함 |
|---|---|---|
| 1 | **키 패리티** | ko에 있는 키가 타 로케일에 없음 / 고아 키 |
| 2 | **플레이스홀더 패리티** | `{count}` 누락·오타 → 런타임 크래시 |
| 3 | **용어집 준수** | 잠금 용어가 다른 말로 번역됨 |
| 4 | **한글 잔존 검사** | 비-ko 카탈로그에 한글 → 미번역 통과 |
| 5 | **스크립트 검사** | ja에 가나/한자 없음, zh에 가나 있음(일본어가 중국어 칸에 들어감), en이 비-ASCII 지배 |
| 6 | **길이 상식** | 원문 대비 0.4×–3× 이탈 → 잘림 또는 환각 장문 |
| 7 | **역번역 채점** | target→ko 역번역을 2차 모델이 1–5점 채점, **4점 미만은 `_meta/review/{locale}.json`으로 격리** |

게이트 1–6은 결정적(모델 호출 없음)이라 CI에서 항상 돈다.
게이트 7은 **변경된 키에 대해서만** 돌고, 결과는 커밋되는 파일이라 재실행 없이 리뷰 가능하다.

### 5.4 인간 승인 필수 네임스페이스

`scripts/i18n/review-required.json`에 등록된 네임스페이스는 자동 번역 결과가
`_meta/review`에 머물고, 사람이 승격하기 전까지 **해당 로케일 페이지가 색인되지 않는다**.

- `app.terms`, `app.privacy` (법률)
- `shared.lib.seo` (title/description/keywords — 순위에 직접 영향)
- `app.home` (랜딩 카피)

### 5.5 유지보수 루프

1. 개발자가 새 한국어 문자열을 **직접 코드에 쓴다** (기존 습관 유지).
2. pre-commit / CI가 `yarn i18n:lint`로 **미추출 한국어 리터럴을 차단**한다.
3. `yarn i18n:extract --apply --only <경로>`로 ko 카탈로그에 편입.
4. `yarn i18n:translate --locale en --review`로 3언어 채움 + 역번역 채점.
5. `yarn i18n:verify`가 게이트 통과를 강제한다.

**`i18n:lint`는 기준선(baseline) 방식**이다. 전면 마이그레이션은 여러 PR에 걸치는데
처음부터 0을 요구하면 게이트를 켤 수가 없고, 켜지 못하면 그사이 새 한국어가 계속
유입돼 마이그레이션이 영원히 끝나지 않는다. 기준선(`messages/_meta/lint-baseline.json`,
파일 단위 카운트)은 "지금보다 나빠지지 않는다"만 강제하고, 마이그레이션이 진행될수록
`--update`로 조여진다. 줄 번호가 아니라 파일 카운트인 이유는 무관한 편집마다
기준선이 흔들리지 않게 하기 위해서다.

> 이 게이트가 설계의 핵심이다. 없으면 6개월 뒤 카탈로그와 코드가 갈라지고
> 다시 367파일을 훑어야 한다.

---

## 6. AI 분석 다국어

### 6.1 제약 (조사 결과)

- `@y0ngha/siglens-core@0.48.0`의 public API에 **`locale`/`language` 파라미터가 존재하지 않는다.**
- 프롬프트가 한국어 출력을 **필드 이름 수준에서 고정**한다:
  `overallConclusionKo`, `riskFactorsKo`, `"All KO fields must be written in Korean (존댓말)"`.
- 분석 캐시 키·TTL은 core 소유이며 로케일을 모른다.
- `CLAUDE.md` / `SCOPE.md` §0: "AI 분석 프롬프트 문구/구조 변경 → core". **siglens에서 구현 금지.**

### 6.2 선택지

| | A. core에 locale 추가 | B. siglens 후처리 번역 |
|---|---|---|
| 분석 품질 | 최상(로케일 네이티브 생성) | 상(원문 품질 유지 + 번역) |
| LLM 비용 | **4×** (로케일당 완전 분석) | 1× + 조회된 로케일당 저가 번역 1회 |
| 캐시 | 4× (Redis 용량·스탬피드 위험) | 원본 1 + 번역 캐시(작음) |
| 변경 범위 | 프롬프트 15개 파일 + 정규화 + `PROMPT_TEMPLATE_VERSION` bump + 교차 레포 릴리스 | siglens 단독 |
| 스코프 가드 | 위반 아님(core PR) | 위반 아님(프레젠테이션 가공) |
| 롤백 | 어려움(warm 심볼은 TTL까지 잔존) | 캐시 삭제로 즉시 |

### 6.3 결정: **B (후처리 번역 레이어)** — 단, A는 백로그로 남긴다

```
entities/analysis-translation/
  lib/proseFields.ts          응답 타입별 산문 필드 화이트리스트 (순수)
  lib/translateAnalysis.ts    추출 → 주입된 translate 함수 호출 → 병합 (순수 오케스트레이션)
  api.ts                      LLM 프로바이더 호출 + Redis 캐시
                              (키: sha256(canonicalProse + locale))
```

> `entities/{slice}/lib/`는 **외부 I/O가 없는 순수 함수만** 담는다(레포 규약).
> 따라서 `translateAnalysis`는 프로바이더를 직접 호출하지 않고
> `(texts: string[]) => Promise<string[]>` 형태의 번역 함수를 주입받는다.
> 실제 SDK 호출과 캐시는 `api.ts`에 둔다. 이렇게 하면 산문 추출·병합 로직을
> 프로바이더 없이 단위 테스트할 수 있다.

동작:

1. 분석은 지금처럼 **한국어로 1회 생성**된다(core 무변경, 비용·품질 불변).
2. 비-ko 로케일 요청 시, 정규화된 응답 객체에서 **산문 필드만** 뽑아 번역한다.
   숫자·enum(`sentiment`, `riskLevel`)·가격·티커·`keyLevels`는 **손대지 않는다** —
   번역 모델이 숫자를 건드리는 사고를 구조적으로 차단한다.
3. 저가 모델(`deepseek-v4-flash` / `gemini-2.5-flash-lite`)로 배치 번역, 용어집 주입.
4. 결과를 `sha256(원문 산문) + locale`로 캐시 → 동일 분석은 로케일당 1회만 과금.
5. SSE 스트리밍(`/api/analysis/stream`): ko는 지금처럼 토큰 스트리밍,
   비-ko는 **완료 후 번역**이라 토큰이 흐르지 않는다. UI는 "번역 중" 상태를 표시한다.
   (문장 단위 스트리밍 번역은 v2 — 문맥 손실 대비 이득이 작다.)

   > ⚠️ **번역은 반드시 `heartbeatStream(work)`의 `work` 프로미스 *안*에서 실행한다.**
   > 이 스트림의 진짜 벽은 Cloudflare 125초가 아니라 **ALB idle 60초**다(2026-08-02
   > 프로덕션 실측: heartbeat 없으면 61.1초에 끊김, 25초 heartbeat면 286초 완주).
   > pro 모델 분석은 248초까지 측정됐고 여기에 번역 시간이 더 붙는다. 번역을
   > `heartbeatStream` 바깥에서 await한 뒤 스트림을 만들면 **첫 바이트 전 침묵**이
   > 그대로 60초 벽에 걸린다 — 현재 코드가 `HEARTBEAT_INTERVAL_MS`(25s)로 막고 있는
   > 바로 그 실패다(`src/app/api/analysis/stream/route.ts:675`, `:724`).

**챗봇**: `buildChatPrompt`는 core 소유라 수정하지 않는다. 대신 siglens가 보내는
**사용자 메시지 봉투에 로케일 힌트를 덧붙인다**(호출자의 메시지 본문이므로 core 프롬프트
변경이 아니다). LLM은 질문 언어를 따라가는 성질이 있어 실효가 높다.

> **사용자에게 보고할 사항**: "로케일 네이티브 프롬프트"가 품질 상한이지만
> `siglens-core` PR이 필요하고 분석 비용이 4배가 된다. 번역 품질 불만이 실제로
> 관측되면 그때 core로 승격한다.

> **스코프 경계 명문화 필요**: `SCOPE.md` §3 Step 5의 트리거 목록은
> "Anthropic / Gemini / OpenAI / DeepSeek SDK 호출 → core"라고만 적혀 있어,
> **분석 목적 호출**과 **이미 생성된 산문의 i18n 번역 목적 호출**을 문자 그대로는
> 구분하지 않는다. §1은 i18n을 siglens 소유로 명시하므로 본 설계의 해석이
> 정합적이지만, 이후 기여자가 재논쟁하지 않도록 `SCOPE.md`에 한 줄을 추가한다:
> "이미 생성된 산문을 사후 번역하는 LLM 호출은 프레젠테이션 가공이므로 siglens 소유."
> 이 문서는 core와 공유되는 파생본이라 **core 측 정본에도 같은 줄이 필요하다**.

### 6.4 프리웜·SEO 스냅샷

`/api/cron/seo-prewarm`은 로케일 화이트리스트를 받는다.

**닭-달걀 문제와 그 해소**: "사용자가 방문하면 그때 번역"에 의존하면 비-ko 심볼
페이지는 **영원히 색인되지 않는다**. 크롤러의 첫 방문에는 번역 스냅샷이 없으므로
§7.2 게이트가 noindex를 내고, 크롤러는 noindex 페이지를 재방문하지 않으며,
색인되지 않으니 유기 트래픽도 없다. 순환이 닫힌다.

해소는 두 겹이다.

1. **렌더 경로에서 동기 번역(on-demand ISR)** — 비-ko 심볼 페이지의 첫 렌더가
   ko 스냅샷을 발견하면 그 자리에서 저가 모델로 번역해 응답에 포함한다. 크롤러의
   **첫 방문에 이미 번역된 본문**이 나가므로 게이트를 통과한다. 예산 초과(타임아웃)
   시에만 noindex로 떨어뜨린다 — ISR cold-gen에서 `connection()`이 500을 내는
   제약이 있으므로 번역 실패는 **throw가 아니라 noindex 폴백**이어야 한다.
2. **프리웜 로테이션에 로케일 축 추가** — 커서를 `(symbol, locale)` 쌍으로 돌린다.
   ko 우선순위를 유지하되 비-ko도 순번을 받는다. v1 기본값은 `['ko', 'en']`이고
   ja/zh는 env 플래그로 켠다(ISR write 비용과 직결).

> 2026-08-18에 "프리웜 회전 순번 미도달"로 KR 대장주 3종의 스냅샷이 0행이었던
> 이력이 있다. 로케일 축을 추가하면 회전 주기가 4배가 되므로, 순번 미도달이
> 재현되지 않도록 **로케일별 커서를 분리**하고 진단 순서(DB행 → 마커 → 커서)를
> 그대로 적용한다.

---

## 7. SEO 설계

### 7.0 ⚠️ Next.js 메타데이터는 병합되지 않는다 (실증으로 잡힌 결함)

레이아웃에 `alternates.languages`를 선언해 두면 하위 페이지가 상속할 것 같지만,
**Next.js는 세그먼트 간 메타데이터를 최상위 키 단위로 교체한다.** 페이지가
`alternates: { canonical }`을 선언하는 순간 레이아웃의 `languages`가 통째로 사라진다.
이 레포는 인덱서블 페이지 전부가 자기 canonical을 선언하므로 **hreflang이 한 개도
나가지 않았다** — 빌드도 타입체크도 통과했고, 프로덕션 HTML을 직접 긁어서야 드러났다
(`curl … | grep -c hreflang` → `0`). `openGraph.locale`도 같은 이유로 전 페이지가
`ko_KR`에 고정돼 있었다.

**대응**

- `shared/lib/seoAlternates.ts`의 `localeAlternatesFrom(params, path)` /
  `localeAlternates(locale, path)` / `localeOpenGraph(locale)`를 **페이지마다** 쓴다.
- 레이아웃은 `alternates`를 아예 선언하지 않는다(선언해도 안 나가므로 착각만 만든다).
- `src/app/[locale]/__tests__/localeCoverage.test.ts`가 `src/app/[locale]` 아래
  전 페이지를 훑어 (1) `alternates` 리터럴 직접 선언 금지 (2) 로케일 헬퍼 사용
  (3) 정적 `export const metadata` 금지를 강제한다. 무조건 noindex인 페이지는 제외한다.

### 7.1 head 태그

각 로케일 페이지가 **자기 자신을 가리키는 canonical**을 발급한다(ko를 가리키면 hreflang이 무효).

```ts
alternates: {
    canonical: `${SITE_URL}${localePath(locale, path)}`,
    languages: {
        ko:          `${SITE_URL}${path}`,
        en:          `${SITE_URL}/en${path}`,
        ja:          `${SITE_URL}/ja${path}`,
        'zh-Hans':   `${SITE_URL}/zh${path}`,
        'x-default': `${SITE_URL}${path}`,   // ko
    },
},
openGraph: { locale: OG_LOCALE[locale], alternateLocale: [...나머지] },
```

- `<html lang>`은 `[locale]` 레이아웃에서 로케일별로 발급(현재 `lang="ko"` 하드코딩).
- hreflang은 **상호 참조**여야 한다 — en 페이지도 ko/ja/zh를 전부 선언한다.
- **준비된 로케일이 하나뿐이면 `languages` 키 자체를 내지 않는다.** 자기 자신만
  가리키는 hreflang은 정보가 0이면서 이미 색인된 전 페이지의 HTML을 바꾼다.
  `SYMBOL_INDEXABLE_LOCALES` / `STATIC_INDEXABLE_LOCALES`에 두 번째 로케일이
  추가되는 순간 전 페이지가 한꺼번에 hreflang을 얻는다.
- JSON-LD: `inLanguage`를 로케일로, `WebSite` SearchAction의 `urlTemplate`도 로케일 경로로.

  > **Phase 2 블로커로 명시 이월.** 현재 13개 JSON-LD 블록이 `inLanguage: 'ko'`와
  > ko 절대 URL(`@id`/`url`)을 하드코딩하고 있다. 일부는 모듈 상수라 함수로 바꿔야
  > 한다. **지금은 SEO 영향이 0이다** — `STATIC_INDEXABLE_LOCALES`/
  > `SYMBOL_INDEXABLE_LOCALES`가 ko 하나라 비-ko 페이지는 전부 noindex이고
  > 구조화 데이터가 수집되지 않는다. `STATIC_INDEXABLE_LOCALES`에 로케일을
  > 추가하기 **전에** 반드시 함께 처리한다 — 그때는 언어가 어긋난 구조화 데이터가
  > 실제로 색인된다.
  > 대상: `terms` · `privacy` · `page.tsx`(2) · `economy`(2) · `news`·`news/us`·
  > `news/[category]` · `[symbol]/news` · `MarketRouteBody` · `FearGreedRouteBody` ·
  > `shared/lib/seo.ts`의 `buildSymbolWebPageJsonLd`.
- **noindex 페이지에는 hreflang을 넣지 않는다**(로그인·계정 등).

### 7.2 색인 게이트 — thin 번역 방지

2026-07에 "봇에게 677자만 노출"로 노출이 붕괴한 이력이 있다. 미번역 상태의 `/ja/AAPL`이
한국어 본문을 그대로 담고 색인되면 같은 사고가 3개 언어로 재현된다.

`evaluateSymbolIndexability`에 입력을 추가한다:

```ts
{ symbol, assetInfo, degraded, hasSnapshot,
  locale,                    // 추가
  localizedContentReady }    // 추가: UI 카탈로그 완비 && (ko이거나 분석 번역 존재)
```

→ `locale !== 'ko' && !localizedContentReady` 이면 `{ indexable: false, reason: 'locale-not-ready' }`.

정적 페이지도 같은 원칙: 해당 네임스페이스가 `_meta/review`에 걸려 있으면 그 로케일은 noindex.

### 7.3 sitemap

로케일마다 URL 엔트리를 4배로 늘리지 않는다. 대신 **엔트리 하나에 `xhtml:link` alternates**를 붙인다 — Google이 권장하는 다국어 sitemap 형식이고 파일 크기가 선형으로 유지된다.

```xml
<url>
  <loc>https://…/AAPL</loc>
  <xhtml:link rel="alternate" hreflang="ko"        href="https://…/AAPL"/>
  <xhtml:link rel="alternate" hreflang="en"        href="https://…/en/AAPL"/>
  <xhtml:link rel="alternate" hreflang="ja"        href="https://…/ja/AAPL"/>
  <xhtml:link rel="alternate" hreflang="zh-Hans"   href="https://…/zh/AAPL"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="https://…/AAPL"/>
</url>
```

`src/entities/sitemap-entry/lib/xml.ts`에 `xmlns:xhtml` 네임스페이스와 alternates 직렬화를 추가한다.
**§7.2 게이트를 통과하지 못한 로케일은 alternates에서 제외**한다 — sitemap이 noindex URL을
광고하면 크롤 예산만 태운다(기존 `financials` ETF 처리와 같은 원칙).

### 7.4 CDN / ISR 영향

- 로케일이 **경로에 있으므로** CF 캐시 키가 자연히 분리된다. `Vary` 헤더를 추가하지 않는다
  (URL 퍼지가 안 먹게 되는 알려진 함정).
- `[locale]`에 `generateStaticParams`를 반드시 둔다 — 없으면 dynamic으로 떨어져 ISR이 꺼진다.
- **다만 4개를 전부 프리렌더하면 안 된다.** 정적 페이지 중 일부(`/market`, `/economy`)가
  빌드 중 FMP 시세를 종목별로 호출하는데, 로케일마다 반복하면 호출량이 4배가 되어
  **FMP가 429로 끊고 빌드가 통째로 실패한다** — 실측으로 확인했다
  (`Failed to build /[locale]/market/page: /en/market after 3 attempts`).
  기본은 ko만 프리렌더하고(`resolvePrerenderLocales`), 나머지는 `dynamicParams`
  기본값에 따라 첫 요청에 on-demand ISR로 생성한다. 크롤러의 첫 방문이 곧 생성
  트리거이므로 SEO 손실이 없다. 확장은 `PRERENDER_LOCALES=ko,en`으로 명시한다.
- `setRequestLocale(locale)`을 **모든 레이아웃과 페이지** 상단에서 호출한다(Next 16.2 = 16.3 미만).
  루트 레이아웃 한 곳만으로는 부족하다 — **실측으로 확인했다**: `backtesting/page.tsx`에
  `getTranslations`를 넣고 `setRequestLocale`을 빼면 빌드 route 표에서
  `● /[locale]/backtesting`이 **`ƒ`(dynamic)** 로 바뀐다. next-intl의 서버 API가 요청
  로케일을 못 찾으면 `headers()`로 폴백하기 때문이다. 빌드는 성공하고 테스트도
  통과하므로, 캐시 비용 청구서로만 드러난다.
  `src/app/[locale]/__tests__/localeCoverage.test.ts`가 전 서버 페이지에 대해 호출을 강제한다.
- 최악의 경우 ISR write가 4배다. v1은 프리웜을 ko+en으로 제한해 실사용 트래픽만큼만 증가시킨다.

---

## 8. 언어 스위처 UI

- **데스크톱**: 헤더 우측, 기존 `shared/ui/PopoverSurface` 재사용(신규 컴포넌트 최소화).
  트리거는 현재 언어 코드(`한국어` / `English` / `日本語` / `中文`).
- **모바일**: `HeaderMobileMenu` 드로어 하단에 섹션으로. 이 드로어는 vaul이 아니라
  `createPortal` + `useFocusTrap`/`useEscapeKey` 직접 구현이다
  (`src/widgets/layout/HeaderMobileMenu.tsx:12,15,38,141`). **Fragment↔Portal 구조를
  바꾸지 않는다** — 스왑은 remount라 focus trap이 죽는다(2026-08 PR #709 교훈).
  vaul을 쓰는 곳은 `views/symbol/MobileAnalysisSheet.tsx` 하나뿐이며 별개 경로다.
- 동작: 같은 경로를 새 로케일로 `replace` 이동(히스토리 오염 방지) + `NEXT_LOCALE` 쿠키 기록.
- a11y: 옵션 각각에 `lang` 속성(`<span lang="ja">日本語</span>`), 언어명은 **자국어 표기 고정**(번역하지 않음).
  `aria-current` 로 현재 언어 표시.

---

## 9. 테스트 전략

| 층 | 검증 |
|---|---|
| 단위 | `routing.ts` 로케일 경로 생성/역파싱, `localePath()` 왕복 |
| 단위 | `proxy` — `/en/aapl` → `/en/AAPL` 정규화, `/en`이 티커로 오인되지 않음, `?q=` 로케일 보존 |
| 단위 | `evaluateSymbolIndexability` 로케일 게이트 4케이스 |
| 단위 | sitemap `xhtml:link` 직렬화 + noindex 로케일 제외 |
| 단위 | `translateAnalysis` — 숫자/enum 필드 불변, 산문만 치환 |
| 통합 | 라우트 인벤토리(32 페이지) × 4 로케일 메타데이터 스냅샷 — **누락 라우트 즉시 실패** |
| 스크립트 | `i18n:verify` 게이트 1–6 자체 테스트 |
| E2E | 언어 스위처(데스크톱/모바일) 전환 후 경로·`<html lang>`·본문 언어 확인 |

---

## 10. 단계별 실행

| Phase | 내용 | 사용자 눈에 보이는 변화 |
|---|---|---|
| **0** | next-intl 도입, `[locale]` 이동, `proxy` 합성, `setRequestLocale`, 라우팅 테스트 | 없음(ko 그대로) |
| **1** | 추출 codemod + ko 카탈로그 + `i18n:lint` CI 게이트 | 없음 |
| **2** | 언어 스위처(데스크톱·모바일) + en 번역 + QA 게이트 + hreflang/sitemap | 영어 UI |
| **3** | AI 분석 후처리 번역 레이어 + 프리웜 로케일 축 | 영어 분석 + **en 심볼 페이지 색인 개시** |
| **4** | ja / zh 번역 + 색인 게이트 확장 | 일·중 지원 |
| **5** | DB 콘텐츠 로케일 컬럼(terms/notices/profile/indicator) | 약관·공지 다국어 |

> ⚠️ **Phase 2의 한계를 명시한다**: Phase 2가 끝나면 UI는 영어가 되지만
> `[symbol]/*`(371 티커 × 최대 9 서브라우트 — 이 사이트 색인 표면의 대부분)는
> **여전히 noindex**다. §7.2 게이트가 분석 번역을 요구하는데 그 레이어는 Phase 3에
> 온다. 그래서 원안(분석 번역을 Phase 4)에서 **Phase 3으로 앞당겼다** — 그러지
> 않으면 "영어 지원"이라 부르면서 정작 검색 유입이 생길 페이지가 전부 닫혀 있다.
> 정적/허브 페이지(37 URL)는 Phase 2에서 곧바로 색인 가능하다.

---

## 11. 알려진 위험과 대응

| 위험 | 대응 |
|---|---|
| `/en`이 티커로 오인돼 301 | `RESERVED_FIRST_SEGMENTS`에 로케일 추가 + proxy 테스트가 로케일 목록 대조 |
| `setRequestLocale` 누락 → 전 라우트 ISR 해제 | 라우트 인벤토리 통합 테스트가 정적 렌더 여부 단언 |
| `generateStaticParams`가 빈 배열 → 같은 ISR 해제 | `resolvePrerenderLocales`가 항상 최소 1개 반환, 테스트가 고정 |
| 전 로케일 프리렌더 → 빌드타임 외부 API 4배 → 429로 빌드 실패 | 기본 ko만 프리렌더, 나머지는 on-demand ISR (실측 확인) |
| 카탈로그 평면 키 → `MISSING_MESSAGE` | 카탈로그·`pickMessages` 모두 중첩 구조, 단위 테스트가 고정 |
| 페이지가 canonical을 명시해 로케일 자기참조가 깨짐 | `localeAlternatesFrom`에 canonical을 넘기지 않는다(degraded일 때만 `null`). 커버리지 테스트가 리터럴 `alternates` 선언을 금지 |
| 내비 활성 상태가 비-ko에서 전부 꺼짐 | `usePathname()`을 `splitLocalePath`로 벗겨 `NAV_TREE`의 무접두사 href와 비교 |
| codemod가 표현식 본문 컴포넌트에 `t`를 정의 없이 삽입 | `classify()`가 `BlockStatement`가 아니면 `applicable: false` |
| i18n 스크립트가 `.gitignore /scripts/**`에 걸려 커밋 안 됨 | `!/scripts/i18n/**` 예외 추가 |
| vitest가 `next-intl/server`를 client stub으로 해석 | `vitest.config.ts`에서 실제 `server.react-server.js`로 alias |
| 미번역 페이지 색인 → thin content 재현 | §7.2 로케일 준비 게이트 |
| 클라이언트 번들에 전체 카탈로그 주입 | 네임스페이스 pick 강제 + bundle 사이즈 회귀 테스트 |
| 통화가 UI 로케일을 따라감(₩→$) | `priceFormat`에 로케일 인자 미추가, 자산군이 통화 결정 |
| `global-error`가 프로바이더 밖 | ko+en 정적 문구 |
| 번역 모델이 숫자를 변형 | 산문 필드 화이트리스트만 번역, 구조 필드 불변 |
| 프리웜 4배로 ISR write 비용 폭증 | 프리웜 로케일 env 화이트리스트(v1: ko, en) |
| 공유 링크 내용이 나중에 언어가 바뀜 | `sharedAnalyses`에 생성 시 로케일 고정 |


---

## 12. 구현 현황 (2026-08-20 기준)

### 완료 — Phase 0 + SEO 배선

| 항목 | 상태 |
|---|---|
| next-intl 4.13.7 도입, `next.config.ts` 플러그인 | ✅ |
| 전 라우트 `src/app/[locale]/` 이동 (32 페이지 + 테스트) | ✅ |
| `shared/i18n/` — locales · routing · navigation · request · loadMessages · clientNamespaces | ✅ |
| `proxy.ts` 합성 (로케일 분리 → 기존 가드 → next-intl 위임) | ✅ |
| 로케일 예약 세그먼트 (`/en`·`/ko`가 티커로 오인되지 않음) | ✅ 테스트 고정 |
| `generateStaticParams` + `setRequestLocale` (ISR 유지) | ✅ 빌드에서 `●` 확인 |
| 언어 스위처 (데스크톱 헤더 + 모바일 드로어, 네이티브 `<select>`) | ✅ |
| 페이지별 hreflang · canonical · og:locale 헬퍼 + 전 페이지 적용 | ✅ |
| 종목 페이지 로케일 색인 게이트 (`SYMBOL_INDEXABLE_LOCALES`) | ✅ |
| sitemap `xhtml:link` alternates 직렬화 + 빌더 배선 | ✅ (로케일 1개라 현재 출력은 동일) |
| 추출 codemod · 번역 · 검증 · lint 스크립트 | ✅ |
| 용어집 27항목 | ✅ |

**게이트 결과**: `yarn typecheck` 통과 · `yarn lint` 경고 0 ·
`yarn test` 10,254 통과 / 0 실패 · `yarn build` EXIT=0 (`MISSING_MESSAGE` 0).
프로덕션 서버 실측: `/`·`/en`·`/ja`·`/zh` 200, `/ko` → `/` 307,
`<html lang>`·`og:locale` 로케일별 정확.

### 남은 작업

| Phase | 내용 |
|---|---|
| 1 | 2,750키 카탈로그 확정 — codemod `--apply`로 1,151건 자동 치환, 나머지 1,689건(`.ts` 상수·모듈 스코프·템플릿) 수동 이관 |
| 2 | en 번역 + QA 게이트 통과 → **JSON-LD 로케일화(위 블로커) 후** `STATIC_INDEXABLE_LOCALES`에 `en` 추가 |
| 3 | AI 분석 후처리 번역 레이어 → `SYMBOL_INDEXABLE_LOCALES`에 `en` 추가 |
| 4 | ja / zh |
| 5 | DB 콘텐츠 로케일 컬럼 |

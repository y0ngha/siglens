## Siglens — Layered → FSD 아키텍처 전환 설계 문서

- 작성일: 2026-05-24
- 작성자: y0ngha (with Claude)
- 상태: brainstorming 완료, plan 작성 대기
- 레퍼런스: `/Users/y0ngha/Project/whatap` (Vite SPA + FSD 6-layer)

---

## 1. 배경 & 목적

siglens는 현재 Layered Architecture(`app/`, `components/`, `domain/`, `infrastructure/`, `lib/`)를 운영 중이다. 도메인 영역이 16개, 인프라 영역이 20개, 컴포넌트 영역이 25개에 이르며 단일 레이어 안에 cross-domain 결합이 가시화되고 있다. 본 작업은 코드베이스를 **Feature-Sliced Design(FSD) 6-layer**로 재편하여:

- 도메인 단위로 응집도를 끌어올리고 (변경이 함께 일어나는 파일이 함께 위치)
- ESLint boundaries로 의존 방향을 정적 강제 (현재는 관습 의존)
- 슬라이스 단위 추가/삭제/이동의 비용을 낮춤

`@y0ngha/siglens-core` 외부 패키지 정책(`docs/SCOPE.md`)은 그대로 유지한다 — 분석 도메인은 core가 소유하고 siglens는 어댑터/UI/일반 백엔드만 보유한다는 분담은 FSD 전환과 직교한다.

---

## 2. 핵심 가정 (확정된 4가지 결정)

| # | 항목 | 결정 |
|---|---|---|
| 1 | 테스트 coverage 정책 (G1) | 전체 측정 대상 레이어 **90% threshold**. `coverageThreshold: 90`, `collectCoverageFrom`을 `src/entities/**`, `src/features/**/lib/**`, `src/features/**/api/**`, `src/shared/lib/**` 로 좁힘. UI(`widgets/`, `pages/`, `app/`) 측정 제외 (현 정책 유지) |
| 2 | 마이그레이션 중간 상태 (G6) | **Atomic move per PR**. 각 PR에서 파일 이동 + 모든 import 갱신 + 옛 경로 삭제 동시. 옛↔새 공존 0. PR을 영역 단위로 잘게 분할 |
| 3 | 기존 layer CLAUDE.md 처리 (G7) | **영역 이동 시 함께 교체**. Phase X가 옛 영역을 비울 때 옛 CLAUDE.md 삭제, 새 layer 채워질 때 새 CLAUDE.md 작성. Phase 0에서는 기존 6개를 건들지 않음 |
| 4 | Workflow/Sub-agent 갱신 (G2/G3) | **Phase 0에 path-agnostic 재설계**. `.github/workflows/claude-code-review.yml`과 `.claude/agents/*` 의 layer-name 의존 conditional doc loading을 일반화 |

---

## 3. 최종 디렉토리 구조

```
src/
├── app/              ← FSD app(composition root) + Next.js routing 통합
│   ├── layout.tsx, providers.tsx
│   ├── (routes)/     thin entry, @/pages/* 로 위임
│   │   ├── page.tsx, [symbol]/{layout,page,overall,fundamental,news,options,fear-greed}/...
│   │   ├── market/, account/, login/, signup/, backtesting/, forgot-password/, reset-password/
│   │   ├── privacy/, terms/, account/delete/, signup/oauth/consent/
│   └── api/          thin Route Handler, @/features/* 또는 @/entities/* 로 위임
│       ├── auth/[provider]/{start,callback}/route.ts
│       ├── jobs/cancel/route.ts
│       └── sitemap/{static,popular,longtail/[page]}/route.ts
│
├── proxy.ts          (Next.js 16 표준 위치; src/app/proxy.ts 미지원 — G12)
│
├── pages/            ← FSD pages 레이어 (실제 RSC composition)
│   landing, symbol, symbol-overall, symbol-fundamental, symbol-news, symbol-options,
│   symbol-fear-greed, market, account, account-delete, login, signup,
│   signup-oauth-consent, forgot-password, reset-password, backtesting,
│   legal-privacy, legal-terms
│
├── widgets/          ← Self-contained UI (총 24개)
│   site-header, site-footer, site-jsonld,
│   stock-chart, analysis-panel, chat-panel,
│   market-summary, sector-signal,
│   news-summary, fundamental-summary, options-chain, options-summary,
│   fear-greed-gauge, overall-analysis, backtest-case-list,
│   landing-hero, landing-stats-bar, landing-how-it-works,
│   landing-skills-showcase, landing-ticker-categories,
│   symbol-header, symbol-tabs, legal-shell, pwa-install-banner
│
├── features/         ← User interactions (총 20개)
│   auth-login, auth-signup, auth-email-verification, auth-password-reset,
│   auth-oauth, auth-oauth-consent, auth-logout, account-delete,
│   api-key-management, ticker-search, timeframe-select, analysis-trigger,
│   llm-model-select, indicator-tracking, symbol-chat, contact-form,
│   backtest-filter, pwa-install, premium-gate, sitemap-generation
│
├── entities/         ← Domain + API + Query hooks (총 23개)
│   user, session, oauth-account, api-key, user-tier,
│   ticker, bars, analysis, chat-message,
│   market-summary, sector-signal, fear-greed,
│   fundamental, news-article, earnings-report, options-chain,
│   llm-provider, skill, inquiry, email-token, backtest-case,
│   og-image, sitemap-entry
│
└── shared/           ← Framework-agnostic
    api/      (http.ts, queryClient.ts, singleFlight.ts, fmp/client.ts)
    db/       (client.ts, schema.ts, tokenEncryption.ts)
    email/    (dispatcher.ts — Resend/Noop)
    cache/    (redis.ts — Upstash)
    ui/       (DotSeparator, EyeIcon, InfoTooltip, MarkdownText, JsonLd, Tabs/, ErrorBoundary, Skeleton, Tooltip)
    lib/      (cn, classNames/, format/, time/, seo/, pwa/, a11y/, storage/, retry/, types/)
    hooks/    (useHydrated, useIsMobileViewport, useDialog, usePopoverToggle, useEscapeKey, useFocusTrap, usePointerTooltip, useCopyToClipboard, useQueryParamState, usePageHideCancel, usePageShowReload)
    config/   (constants.ts, env.ts, queryKeys.ts, pollingConfig.ts)
```

---

## 4. 의존 방향 (siglens 변형)

```
app  →  pages  →  widgets  →  features  →  entities  →  shared
                                                          ↑
                                          @y0ngha/siglens-core (외부, 모든 레이어 직접 import 가능)
```

### siglens 고유 규칙

1. **Next.js 라우팅 + composition root 통합**: `src/app/`은 Next.js App Router + FSD app 레이어 역할 합체. 실제 RSC 페이지 구성은 `src/pages/`에 위임.
2. **Server Action 위치**: `'use server'` 함수는 해당 entity가 자기 데이터 도메인을 소유한다는 원칙에 따라 `entities/<x>/actions.ts`에 둔다. 비-action 함수는 `entities/<x>/api.ts`로 분리.
3. **siglens-core 직접 import 예외**: 모든 레이어가 `@y0ngha/siglens-core`에서 분석 도메인을 직접 import할 수 있다. deep import(`@y0ngha/siglens-core/dist/...`) 금지.
4. **DB schema는 shared**: Drizzle 스키마는 여러 entity가 공유하므로 `shared/db/schema.ts`. 각 entity는 자기 테이블의 repository를 보유.
5. **Email dispatcher는 shared, 템플릿은 entity**: Resend/Noop dispatcher는 인프라성 유틸이라 shared, 템플릿(`passwordResetEmail`, `emailVerificationEmail`)은 `entities/email-token/templates/`.
6. **Server Action ESLint 예외**: `no-restricted-imports`에서 `@/entities/<x>/actions` 경로는 허용 (`'use server'` 파일은 client에서 import). `api/`, `lib/`, `hooks/`, `model/`는 internal path로 차단.

---

## 5. 현재 → FSD 매핑

### 5-1. `src/components/*` → widgets / features

| 현 위치 | 분류 | 목적지 |
|---|---|---|
| `components/layout/Header*, Footer, SiteJsonLd, HeaderUserMenu, ContactDialog` | widget | `widgets/site-header/`, `widgets/site-footer/`, `widgets/site-jsonld/` |
| `components/chart/*` | widget | `widgets/stock-chart/` |
| `components/analysis/*` | widget + feature | `widgets/analysis-panel/` + `features/analysis-trigger/` + `features/llm-model-select/` |
| `components/chat/*` | widget + feature | `widgets/chat-panel/` + `features/symbol-chat/` |
| `components/dashboard/*` | widget | `widgets/market-summary/`, `widgets/sector-signal/` |
| `components/fear-greed/*` | widget | `widgets/fear-greed-gauge/` |
| `components/fundamental/*` | widget | `widgets/fundamental-summary/` (sections colocate) |
| `components/home/*` | widget | `widgets/landing-*/` (hero/stats/howitworks/skills/tickers 분리) |
| `components/legal/*` | widget | `widgets/legal-shell/` |
| `components/news/*` | widget | `widgets/news-summary/` (sections colocate) |
| `components/options/*` | widget | `widgets/options-chain/`, `widgets/options-summary/` |
| `components/overall/*` | widget | `widgets/overall-analysis/` |
| `components/pwa/*` | feature | `features/pwa-install/` |
| `components/search/*` | feature | `features/ticker-search/` |
| `components/symbol-page/*` | widget + feature | `widgets/symbol-header/`, `widgets/symbol-tabs/` + `features/indicator-tracking/`, `features/llm-model-select/` |
| `components/auth/*` | feature | `features/auth-login/`, `features/auth-signup/`, `features/auth-password-reset/`, `features/auth-email-verification/`, `features/auth-oauth/`, `features/account-delete/` |
| `components/account/*` | feature | `features/api-key-management/` |
| `components/contact/*` | feature | `features/contact-form/` |
| `components/backtesting/*` | widget + feature | `widgets/backtest-case-list/` + `features/backtest-filter/` |
| `components/trendline/*` | shared | `shared/lib/chart/trendlineConstants.ts` |
| `components/ui/*` | shared | `shared/ui/` (단, PremiumModelGateModal은 `features/premium-gate/`) |
| `components/providers/ReactQueryProvider` | app | `src/app/providers.tsx`로 흡수 |
| `components/hooks/*` (form/dialog/device/data) | 분산 | 폼 hook → 각 auth feature `hooks/`; useCurrentUser → `entities/user/hooks/`; useDialog/usePopoverToggle/useEscapeKey/useFocusTrap/useOnClickOutside/usePointerTooltip → `shared/hooks/`; useIsMobileViewport/useHydrated/useCopyToClipboard/useQueryParamState → `shared/hooks/`; useLogout → `features/auth-logout/`; useModelGate → `features/premium-gate/` |

### 5-2. `src/domain/*` → entities + shared

| 현 위치 | 목적지 |
|---|---|
| `domain/auth/*` (validation, passwordRules, formTypes) | `entities/user/` 또는 각 auth feature `lib/`. sanitizeNextPath는 `features/auth-oauth/lib/` |
| `domain/analysis/{gate, staleThreshold}` | `entities/analysis/lib/` |
| `domain/backtest/*` | `entities/backtest-case/lib/` |
| `domain/chart/timeFormat` | `shared/lib/format/` |
| `domain/chat/{derivePageContextLabel, fallbackAnalysis}` | `entities/chat-message/lib/` |
| `domain/constants/*` (popular-tickers, dashboard-tickers, market, ticker, time) | `shared/config/constants.ts` 또는 entity별 분산 |
| `domain/contact/{validation, constants}` | `entities/inquiry/lib/` |
| `domain/fearGreed/classifier` | `entities/fear-greed/lib/` |
| `domain/llm/{types, apiKey, constants, providerDefaults}` | `entities/llm-provider/model.ts` + `api.ts` |
| `domain/market/session` | `shared/lib/time/marketSession.ts` |
| `domain/options/*` | `entities/options-chain/lib/` |
| `domain/seo/assetClassification` | `entities/ticker/lib/assetClassification.ts` |
| `domain/signals/*` | siglens-core import 우선. 로컬 잔여분만 `entities/analysis/lib/signalQuadrants.ts` |
| `domain/time/eastern` | `shared/lib/time/` |
| `domain/legal/` | 빈 폴더 제거 |

### 5-3. `src/infrastructure/*` → entities + shared

| 현 위치 | 목적지 |
|---|---|
| `infrastructure/ai/{anthropic, gemini, openai, router, parseJsonResponse, utils}` | `entities/llm-provider/api.ts` + `lib/` |
| `infrastructure/auth/use-cases/*` | `entities/user/api.ts` (register/login/logout/socialLogin/deleteAccount/findUserBySessionToken) + `entities/email-token/api.ts` (requestEmailVerification/verifyEmail/requestPasswordReset/confirmPasswordReset) |
| `infrastructure/auth/*Action.ts` | `features/auth-*/api/` 에서 entity api 호출 |
| `infrastructure/auth/db.ts` | `shared/db/client.ts` |
| `infrastructure/auth/oauth/*` | `entities/oauth-account/api.ts` (provider 어댑터) + `features/auth-oauth/lib/` (state issue/verify) |
| `infrastructure/auth/{applyAuthCookie, sessionCookieOptions, getCurrentUser}` | `entities/session/api.ts` |
| `infrastructure/chat/*` | `entities/chat-message/api.ts` |
| `infrastructure/contact/*` | `features/contact-form/api/` (action) + `entities/inquiry/api.ts` (use-case) |
| `infrastructure/dashboard/{marketSummary, sectorSignals}` | `entities/market-summary/api.ts`, `entities/sector-signal/api.ts` |
| `infrastructure/db/*` (schema, client, 8 repositories) | `shared/db/client.ts` + `shared/db/schema.ts` + 각 repository는 해당 entity api로 분산 |
| `infrastructure/email/*` | dispatcher → `shared/email/dispatcher.ts`. tokenStore → `entities/email-token/api.ts`. 템플릿 → `entities/email-token/templates/` |
| `infrastructure/fmp/*` | `shared/api/fmp/client.ts` + `entities/fundamental/api.ts`, `entities/news-article/api.ts` |
| `infrastructure/http/isBot` | `shared/api/http.ts` |
| `infrastructure/llm/*` | `features/api-key-management/api/` + `entities/api-key/api.ts` |
| `infrastructure/market/*` | `entities/analysis/api.ts` + `entities/bars/api.ts` + `entities/news-article/api.ts` |
| `infrastructure/og/*` | `entities/og-image/` |
| `infrastructure/options/*` | `entities/options-chain/api.ts` + `lib/` |
| `infrastructure/seo/getTodayIsoDay` | `shared/lib/seo/` |
| `infrastructure/sitemap/*` | `features/sitemap-generation/lib/` + `entities/sitemap-entry/` |
| `infrastructure/skills/*` | `entities/skill/api.ts` |
| `infrastructure/storage/recentSearches` | `entities/ticker/api/recentSearches.ts` |
| `infrastructure/ticker/*` | `entities/ticker/api.ts` + `lib/` |
| `infrastructure/tier/*` | `entities/user-tier/api.ts` |
| `infrastructure/utils/{dateKey, withRetry}` | `shared/lib/` |

### 5-4. `src/lib/*` → shared

거의 그대로 shared로 이동. 일부 도메인 의존성 있는 것만 entity로 분기:
- `lib/queryConfig.ts` → `shared/config/queryKeys.ts`
- `lib/auth/cookieNames` → `shared/config/cookies.ts`
- `lib/auth/tierLabel` → `entities/user-tier/lib/tierLabel.ts`
- `lib/fundamental/cacheTtl` → `entities/fundamental/lib/cacheTtl.ts`
- `lib/news/{cacheTtl, periodLabels}` → `entities/news-article/lib/`
- `lib/options/{marketHoursDisplay, optionsFormatters}` → `entities/options-chain/lib/`
- `lib/pwa/detectPwaEnvironment` → `features/pwa-install/lib/`
- 나머지(`cn, chartColors, cardStyles, priceFormat, fearGreedLabels, llmProviderLabels, pollingConfig, formatAnalyzedAt, skillStats, seo, og, adsense, sleep, storageKeys, rovingKeyboardNav, tooltipPosition, contact, contactErrorMessages, legal-toc, legal, cancelJobsApi, pwaEvents`) → `shared/lib/` 또는 `shared/config/`로 책임별 재분류

### 5-5. `src/app/*` → app + pages

| 현 위치 | 목적지 |
|---|---|
| `src/app/layout.tsx` | 유지 |
| `src/app/page.tsx` | `<LandingPage />` (from `@/pages/landing`) 렌더 |
| `src/app/[symbol]/{layout,page,overall,fundamental,news,options,fear-greed}.tsx` | 각각 `@/pages/symbol*` 로 위임 |
| `src/app/_components/AuthSessionHeader` | `widgets/site-header/` 또는 page level inline |
| `src/app/api/auth/[provider]/{start,callback}/route.ts` | thin → `@/features/auth-oauth/api/*Handler` |
| `src/app/api/jobs/cancel/route.ts` | thin → `@/entities/analysis/api/cancelJob` |
| `src/app/api/sitemap/*/route.ts` | thin → `@/features/sitemap-generation/api/*` |
| `src/app/{login,signup,forgot-password,reset-password,account,backtesting,market,privacy,terms}/page.tsx` | 각 `@/pages/<name>` 위임 |
| `src/proxy.ts` | 유지 (Next.js 16 표준 위치) |

---

## 6. 슬라이스 내부 구조 표준

### 6-1. widgets/

```
widgets/<name>/
├── ui/
│   ├── Component.tsx           메인 컴포넌트 (JSX-only)
│   └── components/             서브 컴포넌트
├── hooks/                      (선택) React hook
├── lib/                        (선택) 순수 함수
├── __tests__/                  (선택) colocated tests
└── index.ts                    public API
```

### 6-2. features/

```
features/<name>/
├── ui/
│   └── Component.tsx
├── model/                      (선택) Context + Provider + types
│   ├── <Name>Context.ts
│   ├── <Name>Provider.tsx
│   └── types.ts
├── hooks/
│   ├── use<Name>Form.ts
│   └── use<Name>Selector.ts
├── api/                        (siglens 고유) Server Action wrapper
│   └── <action>.ts             'use server' — entity actions를 호출
├── lib/                        (선택) pure helper
├── __tests__/
└── index.ts
```

### 6-3. entities/

```
entities/<name>/
├── model.ts                    types (먼저 정의)
├── api.ts                      비-action 함수 (server-only repository, AI provider 호출)
├── actions.ts                  'use server' action 함수 (client에서 invoke)
├── hooks/                      (선택) useXxxQuery / useXxxMutation
├── lib/                        (선택) 도메인 순수 함수
├── templates/                  (선택) email-token 같은 경우
├── __tests__/
└── index.ts
```

**Next.js Server Action 제약**: 한 파일 안에서 `'use server'` 디렉티브를 쓰면 그 파일의 모든 export가 Server Action이 된다. entity 내 `api.ts`(비-action)와 `actions.ts`(action) 파일을 강제 분리한다.

### 6-4. shared/

```
shared/
├── api/                        HTTP, query client, third-party API client wrapper
├── db/                         Drizzle client + schema + token encryption
├── email/                      Dispatcher
├── cache/                      Redis
├── ui/                         Primitive components
├── lib/                        Pure utilities
├── hooks/                      React-dependent generic hooks
└── config/                     constants, env, query keys, polling
```

### 6-5. 슬라이스 경계 명문화 (whatap 표준 + siglens 사례)

```
Layer dependency strict:
  app → pages → widgets → features → entities → shared

Cross-slice within same layer: forbidden
  - widgets/site-header ⊥ widgets/stock-chart
  - features/auth-login ⊥ features/auth-signup
  - entities/user ⊥ entities/session
  → route through higher layer

Public API only:
  - production: import from slice root (@/widgets/stock-chart, NOT @/widgets/stock-chart/ui/Chart)
  - tests: exempt from no-restricted-imports (whitebox tests)

siglens-core:
  - import from any layer
  - public surface only (NO @y0ngha/siglens-core/dist/* deep import)

Server Action 예외:
  - @/entities/<x>/actions importable from features/widgets/pages
  - @/entities/<x>/api server-only (no 'use server'), same-entity or app only
```

**siglens 적용 사례:**
- `widgets/site-header` → `@/features/ticker-search` public API (검색바 임베드)
- `widgets/chat-panel` → `@/features/symbol-chat` Context selector
- `widgets/analysis-panel` → `@/features/analysis-trigger` + `@/features/llm-model-select` 합성
- `widgets/fundamental-summary` → `@/features/premium-gate` hook + modal

---

## 7. 테스트 colocation + coverage 정책

### 7-1. Colocation 전환

현재 `src/__tests__/`는 source mirror 구조. FSD 전환과 함께 **슬라이스 내부 colocation**으로 변경:

```
widgets/stock-chart/
├── ui/Component.tsx
├── lib/projection.ts
└── __tests__/
    ├── Component.test.tsx
    └── projection.test.ts
```

근거:
- whatap도 colocated
- FF "변경이 함께 일어나는 파일은 같은 디렉토리에" (`docs/FF.md` §3-A)
- 슬라이스 통째 이동/삭제 시 테스트도 자동 follow

### 7-2. Coverage 정책 (G1)

```js
// jest.config.js (Phase 0)
coverageThreshold: {
    global: { branches: 90, functions: 90, lines: 90, statements: 90 },
},
collectCoverageFrom: [
    // 옛 + 새 둘 다 매칭 (atomic move 이후 자동으로 옛 디렉토리는 사라짐)
    'src/domain/**/*.ts',
    'src/infrastructure/**/*.ts',
    'src/entities/**/*.ts',
    'src/features/**/lib/**/*.ts',
    'src/features/**/api/**/*.ts',
    'src/shared/lib/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/types.ts',
],
testMatch: [
    // 옛 미러 + 새 colocate 둘 다 허용
    '<rootDir>/src/__tests__/**/*.+(test|spec).+(ts|tsx)',
    '<rootDir>/src/**/__tests__/**/*.+(test|spec).+(ts|tsx)',
],
```

- UI 레이어(`widgets/`, `pages/`, `app/`)는 측정 제외 (현 정책 유지)
- 90% threshold로 완화하여 비즈니스 로직에 억지 테스트 부담 감소
- husky `pre-push`의 `yarn test:quiet` 도 새 threshold로 통과 보장

---

## 8. ESLint Boundaries 도입

### 8-1. Phase 0 도입안

```js
// eslint.config.mjs 추가
import boundaries from 'eslint-plugin-boundaries';

{
  plugins: { boundaries },
  settings: {
    'boundaries/elements': [
      { type: 'app',           pattern: 'src/app/**' },
      { type: 'pages',         pattern: 'src/pages/*' },
      { type: 'widgets',       pattern: 'src/widgets/*' },
      { type: 'features',      pattern: 'src/features/*' },
      { type: 'entities',      pattern: 'src/entities/*' },
      { type: 'shared',        pattern: 'src/shared/**' },
      // 옛 layer 도 등록 (atomic move 진행 중 위반 0 유지)
      { type: 'legacy-app',    pattern: 'src/app/**' },
      { type: 'legacy-comp',   pattern: 'src/components/**' },
      { type: 'legacy-domain', pattern: 'src/domain/**' },
      { type: 'legacy-infra',  pattern: 'src/infrastructure/**' },
      { type: 'legacy-lib',    pattern: 'src/lib/**' },
    ],
  },
  rules: {
    'boundaries/element-types': ['error', {
      default: 'disallow',
      rules: [
        { from: 'app',      allow: ['pages','widgets','features','entities','shared','legacy-*'] },
        { from: 'pages',    allow: ['widgets','features','entities','shared','legacy-*'] },
        { from: 'widgets',  allow: ['features','entities','shared','legacy-*'] },
        { from: 'features', allow: ['entities','shared','legacy-*'] },
        { from: 'entities', allow: ['shared','legacy-*'] },
        { from: 'shared',   allow: ['shared'] },
        // 옛 layer 들끼리는 현 의존 그대로 허용 (Phase 진행 중 깨지지 않게)
        { from: 'legacy-*', allow: ['legacy-*', 'shared'] },
      ],
    }],
  },
}
```

Phase 9에서 옛 layer 항목 + legacy-* 규칙을 제거하여 최종 FSD 의존 잠금.

### 8-2. Slice internal path 차단

```js
'no-restricted-imports': ['error', {
  patterns: [
    '@/features/*/model/*',
    '@/features/*/hooks/*',
    '@/features/*/ui/*',
    '@/features/*/lib/*',
    '@/features/*/api/*',
    '@/widgets/*/ui/*',
    '@/widgets/*/hooks/*',
    '@/widgets/*/lib/*',
    '@/entities/*/api',          // 'use server' 아닌 server-only api는 차단
    '@/entities/*/model',
    '@/entities/*/lib/*',
    // 예외: @/entities/*/actions 는 client import 허용 (Next.js 'use server')
  ],
}]
```

- 테스트 파일은 `no-restricted-imports` 비활성 (whitebox 테스트)
- `@/entities/*/actions` 만 client에서 import 허용

---

## 9. 9 Phase 마이그레이션 전략

### Phase 0 — 준비 (확장됨, 2~3 PR)
- `eslint-plugin-boundaries` + 옛 + 새 layer 사전 등록 (위반 0 확인)
- `tsconfig.json` paths alias 확장: `@/widgets/*`, `@/features/*`, `@/entities/*`, `@/pages/*` (shared는 기존 `@/*` 매칭)
- `jest.config.js` 갱신: `coverageThreshold: 90` + `collectCoverageFrom` 확장 + `testMatch` 옛 미러 + colocate 둘 다 허용
- `no-restricted-imports` 설정 (Server Action actions 예외 포함)
- `.github/workflows/claude-code-review.yml` path-agnostic 재설계
- `.claude/agents/{review,mistake-managing,git,issue}-agent.md` 동일 갱신
- `docs/ISSUE_IMPL_FLOW.md`, `docs/PR_FIX_FLOW.md`의 "Modified layer" 표 path-agnostic 매핑
- 본 spec 머지 + `CLAUDE.md` 갱신(FSD 의존 규칙 + SCOPE.md 정책 둘 다)

### Phase 1 — shared 레이어 셋업 (3 PR)
- `src/lib/*` → `src/shared/` (책임별 재분류)
- `src/infrastructure/{http,utils}/*` → `src/shared/{api,lib}`
- `src/domain/{time/eastern, market/session, chart/timeFormat}` → `src/shared/lib/`
- `src/components/ui/*` → `src/shared/ui/` (PremiumModelGateModal 제외 — Phase 6)
- `src/components/hooks/*` 중 generic → `src/shared/hooks/`
- 영역 이동과 함께 `src/lib/CLAUDE.md` 삭제, `src/shared/CLAUDE.md` 작성
- 테스트 colocation 동시 적용 (해당 영역만)

### Phase 2 — entities (DB-bound, 4 PR)
- `infrastructure/db/{client, schema, tokenEncryption}` → `shared/db/`
- `drizzle.config.ts` 의 schema 경로 갱신 + `yarn db:generate` dry-run diff 0 검증 (G4)
- 8 repositories → 각 entity로 분산:
  - `userRepository` → `entities/user/api.ts`
  - `sessionRepository` → `entities/session/api.ts`
  - `oauthAccountRepository` → `entities/oauth-account/api.ts`
  - `userApiKeyRepository` → `entities/api-key/api.ts`
  - `tickerRepository` → `entities/ticker/api.ts`
  - `contactRepository` → `entities/inquiry/api.ts`
  - `usageLogRepository` → `entities/analysis/api/usageLog.ts`
  - `newsRepository`(earnings 포함) → `entities/earnings-report/api.ts` 또는 분리
- `infrastructure/email/*`: dispatcher → `shared/email/`, tokenStore → `entities/email-token/`, 템플릿 → `entities/email-token/templates/`
- `infrastructure/skills/*` → `entities/skill/api.ts`
- 영역 이동과 함께 `src/infrastructure/CLAUDE.md`의 해당 섹션 삭제 + entity별 CLAUDE.md 신규 작성

### Phase 3 — entities (data-fetch + AI, 5 PR)
- `infrastructure/ai/*` → `entities/llm-provider/`
- `infrastructure/llm/*` → `entities/api-key/` + `features/api-key-management/` 분리
- `infrastructure/market/*` → `entities/bars/`, `entities/analysis/`, `entities/news-article/`
- `infrastructure/fmp/*` → `shared/api/fmp/` + `entities/fundamental/`, `entities/news-article/`
- `infrastructure/options/*` → `entities/options-chain/`
- `infrastructure/ticker/*` → `entities/ticker/`
- `infrastructure/tier/*` → `entities/user-tier/`
- `infrastructure/dashboard/*` → `entities/market-summary/`, `entities/sector-signal/`
- `infrastructure/og/*` → `entities/og-image/`
- `infrastructure/sitemap/*` → `entities/sitemap-entry/` (모델만)
- `infrastructure/seo/*` → `shared/lib/seo/`

### Phase 4 — domain → entities lib (2 PR)
- `src/domain/*` 잔여(순수 함수)를 해당 entity의 `lib/`로 분산
- `domain/llm`, `domain/analysis`, `domain/backtest`, `domain/contact`, `domain/fearGreed`, `domain/options`, `domain/seo`, `domain/signals`, `domain/auth`, `domain/chat` 등 정리
- `domain/constants` → shared/config
- `src/domain/CLAUDE.md` 삭제

### Phase 5 — features (Auth, 4 PR)
- `src/components/auth/*` + `infrastructure/auth/*Action.ts` → 8개 feature 슬라이스로 분할:
  - `features/auth-login`, `features/auth-signup`, `features/auth-email-verification`, `features/auth-password-reset`, `features/auth-oauth`, `features/auth-oauth-consent`, `features/auth-logout`, `features/account-delete`
- `components/account/*` → `features/api-key-management/`
- `src/app/api/auth/*` route handlers thin wrapper로 정리 (실제 로직은 feature/api/)
- React Compiler 영향 검증 (G11)

### Phase 6 — features (그 외, 5 PR)
- `components/search/*` → `features/ticker-search/`
- `components/symbol-page/{SymbolPageContext, SymbolModelContext}` → `features/indicator-tracking/`, `features/llm-model-select/`
- `components/chat/SymbolChatContext` + 입력 폼 → `features/symbol-chat/`
- `components/analysis/{ModelSelector, 재분석 UI}` → `features/analysis-trigger/`, `features/llm-model-select/`
- `components/pwa/*` → `features/pwa-install/`
- `components/contact/*` → `features/contact-form/`
- `components/backtesting/{Tabs/필터}` → `features/backtest-filter/`
- `infrastructure/sitemap/*` → `features/sitemap-generation/`
- PremiumModelGateModal + useModelGate → `features/premium-gate/`
- Timeframe(URL ?tf=) → `features/timeframe-select/` (Context-less, hook only)

### Phase 7 — widgets (6 PR)
- 남은 모든 `src/components/*` 를 widgets로 이전
- 각 widget: `ui/` + (필요 시) `hooks/`, `lib/`, `index.ts`
- sections/utils colocate
- `src/components/CLAUDE.md` 삭제

### Phase 8 — pages + app (3 PR)
- `src/pages/` 생성, Next.js route → page composition 위임
- `src/app/{layout,providers}` 정리
- `src/app/api/*` route handlers thin wrapper로 통일
- `next.config.ts`의 `rewrites` 갱신 (Phase 8 route handler 위치와 atomic) (G5)
- `src/app/CLAUDE.md` 갱신 (FSD app + Next.js routing 통합 설명)
- `src/pages/CLAUDE.md` 신규 작성

### Phase 9 — 문서 + 정리 (2 PR)
- 옛 layer + `legacy-*` ESLint 규칙 제거 → 최종 FSD 의존 잠금
- jest.config.js의 옛 path 제거
- `docs/ARCHITECTURE.md` 전면 재작성 (FSD)
- `docs/CONVENTIONS.md` 부분 갱신
- `docs/MISTAKES.md` path-dependent 항목 정리
- `docs/AUTH.md`, `docs/ISSUE_IMPL_FLOW.md`, `docs/PR_FIX_FLOW.md` 경로 갱신
- `src/__tests__/` 디렉토리 제거 (전부 colocate된 후)
- `src/__tests__/CLAUDE.md` 삭제

---

## 10. 위험 매트릭스 (최종)

| 위험 | 처리 |
|---|---|
| husky pre-push의 `yarn test:quiet` 깨짐 | Phase 0에서 `coverageThreshold: 90` + `collectCoverageFrom` 옛 + 새 둘 다 매칭 → 마이그레이션 도중 항상 통과 |
| CI `claude-code-review.yml` false positive | Phase 0에서 path-agnostic 재설계로 차단 |
| review-agent stale path 참조 | Phase 0에서 함께 갱신 |
| Server Action `'use server'` 파일 단위 충돌 | entity 내 `api.ts`/`actions.ts` 분리 + ESLint `no-restricted-imports` 예외 |
| Drizzle migration history 꼬임 | Phase 2 schema 이동은 파일 move only, `yarn db:generate` dry-run 검증 |
| `next.config.ts` `rewrites` 깨짐 | Phase 8 route handler 이동과 atomic |
| React Compiler invalidation | Phase 5 첫 form hook 이동 시 실제 빌드 검증 |
| 마이그레이션 중 다른 작업 충돌 | 모든 PR base master, 마이그레이션 PR이 rebase 책임 |
| 거대 PR | Phase 별로 영역 단위 분할, Phase 1~9 총 ~36 PR로 분산 |
| ESLint boundary 위반으로 PR 머지 차단 | atomic move 원칙 + 옛/새 동시 등록으로 위반 0 유지 |
| Phase별 deps 주입 패턴 변화 | Phase 5에서 use-case deps 객체를 entity 내부 closure로 또는 app 레이어 wire-up |

---

## 11. 작업 사이즈 추정

| Phase | 예상 PR | 예상 변경 파일 |
|---|---|---|
| 0 (준비 확장됨) | 2~3 | 15 |
| 1 (shared) | 3 | 80 |
| 2 (entities DB) | 4 | 60 |
| 3 (entities data/AI) | 5 | 90 |
| 4 (domain → entities lib) | 2 | 40 |
| 5 (features auth) | 4 | 70 |
| 6 (features 기타) | 5 | 70 |
| 7 (widgets) | 6 | 200+ |
| 8 (pages + app) | 3 | 50 |
| 9 (docs + cleanup) | 2 | 30 |
| **합계** | **~36** | **~705** |

코드 로직 변경은 거의 없음(import path + 파일 이동 위주).

---

## 12. Commit / PR 정책 (G15)

- 마이그레이션 PR commit prefix: `refactor(arch):`
- release-it config 변경 불필요 (`refactor`는 기본 minor 포함 안 됨)
- CHANGELOG 노출 최소
- PR title: `refactor(arch): Phase N — <영역>`
- PR body에 본 spec 링크 + 영향 영역 명시

---

## 13. 갭 점검 결과 (G1~G18, 참고)

본 spec에서 해결된 갭:

| ID | 항목 | 처리 |
|---|---|---|
| G1 | 테스트 coverage 정책 | §2-1, §7-2: 90% threshold |
| G2/G3 | claude-code-review.yml + sub-agent path-dependent | §2-4, §9 Phase 0: path-agnostic 재설계 |
| G4 | drizzle.config.ts schema 경로 | §9 Phase 2: 파일 move only, generate dry-run 검증 |
| G5 | next.config.ts rewrites | §9 Phase 8: route handler 이동과 atomic |
| G6 | 마이그레이션 중간 상태 | §2-2, §8: Atomic move per PR + legacy-* ESLint 동시 등록 |
| G7 | 기존 layer CLAUDE.md 처리 | §2-3, §9 각 Phase: 영역 이동 시 함께 교체 |
| G8 | docs/MISTAKES.md path 의존 항목 | §9 Phase 9: 갱신 또는 ESLint로 흡수 후 삭제 |
| G9 | Server Action + ESLint boundary | §4 규칙 6, §8-2: actions만 예외 |
| G10 | 슬라이스 경계 회색지대 | §6-5: whatap 표준 + 4 사례 명문화 |
| G11 | React Compiler 영향 | §10: Phase 5에서 build 검증 |
| G12 | proxy.ts 위치 | §3, §10: `src/proxy.ts` 유지 |
| G13 | ISSUE_IMPL_FLOW/PR_FIX_FLOW | §9 Phase 0: G2/G3와 함께 갱신 |
| G14 | TODO.md / 다른 작업 충돌 | §10: 모든 PR base master, 마이그레이션 PR이 rebase 책임 |
| G15 | Conventional commit / CHANGELOG | §12: `refactor(arch):` |
| G16 | skills/ 디렉토리 | 영향 없음 (위치 동일) |
| G17 | vercel.json | 영향 없음 |
| G18 | worker/, scripts/, db/scripts/ | 영향 없음 |

---

## 14. 다음 단계

1. 본 spec을 사용자가 리뷰 → 수정 사항 반영
2. `writing-plans` 스킬로 전환해 Phase 0 실행 계획 작성
3. Phase 0 PR 시작 — ESLint boundaries, tsconfig alias, jest config, workflow/agent, CLAUDE.md, 본 spec 머지
4. 이후 Phase 1~9를 순차 진행

각 Phase 종료 시 본 spec의 §9 Phase N 섹션을 갱신하고 머지 상태를 표시한다.

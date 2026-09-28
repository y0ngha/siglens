# `shared/` — Framework-Agnostic Utilities

> FSD의 가장 하위 레이어. 어떤 레이어도 shared를 import 가능하지만, shared는 자기 자신만 import 가능.
> (예외: byokGate 등 일부 모듈이 entities를 참조 — ESLint 규칙에서 허용.)

## 하위 구조

| Path | Purpose |
|---|---|
| `shared/lib/` | 순수 유틸리티 함수: cn, chartColors, priceFormat, seo, seoAlternates(`buildHubMetadata` 포함), og, a11y, timeFormat, eastern, isoDate, intlFormatCache, singleFlight 등 (장 세션 판정은 `@y0ngha/siglens-core`로 단일화됨). 서버 런타임 헬퍼도 여기 둔다: backgroundTask(`fireAndForget`/drain)·afterWithDrain, enterLocale(`setRequestLocale` 래퍼)·localeFromRequestHeader, isNextRedirectError, auth/isAuthorizedCronRequest. 하위 폴더: `news/`(뉴스 enum 강제변환·hashUrlToId·detectTruncatedBody), `sse/`(parseSseFrames·runAnalysisStream), `replay/`, `auth/` |
| `shared/config/` | 설정 상수: queryKeys (QUERY_KEYS), cookieNames, market, ticker(`isAdmissibleSymbolShape`), time, popular-tickers·popular-options-tickers(`update-popular-tickers.ts` 생성) |
| `shared/ui/` | Primitive UI 컴포넌트: DotSeparator, EyeIcon, InfoTooltip, JsonLd, MarkdownText, tabs/ |
| `shared/hooks/` | React 의존 일반 hook: useDialog, useEscapeKey, useFocusTrap, useHydrated, useIsMobileViewport, useBodyScrollLock, useDescribeAuthError, useMarketFactorLabels 등. **hook이 아닌 모듈은 두지 않는다**(→ `shared/lib`) |
| `shared/db/` | Drizzle/Neon client, schema, token encryption, DB config/constants/types |
| `shared/email/` | Email dispatcher (Resend/Noop) + email types (EmailMessage, EmailDispatcher) |
| `shared/cache/` | Redis client (Upstash) |
| `shared/api/` | HTTP client: isBot (bot detection), `fmp/`(FMP fundamental client·normalizeFmpPublishedDate), `yahoo/`, `naver/`(네이버 검색 API `naverSearch`), `market/`, `economy/`, `dataGoKr/` |

## 의도적 예외 (shared → entities)

| from | to | 사유 |
|---|---|---|
| `shared/lib/byokGate.ts` | `entities/api-key`, `entities/user-tier`, `entities/user` | Tier 확인 + BYOK 검증 cross-cutting utility. 7개 entity action에서 호출되므로 entities 레이어로 이동하면 역방향 의존 발생. DI로 해소 가능하나 과설계 |

이 예외는 ESLint `from: 'shared', allow: ['shared', 'entities']`로 관리됨.

## 규칙

1. **도메인 어휘 금지.** shared는 Metric, Widget, Event 등 도메인 개념을 알지 못한다.
2. **순수 함수 + primitive 컴포넌트.** Side-effect 코드는 캡슐화.
3. **shared/lib/, shared/config/에 React import 금지.** shared/ui/와 shared/hooks/만 React 사용.
4. **3번째 사용 후 승격.** 1~2개 슬라이스에서만 쓰는 유틸은 해당 슬라이스에 둔다.
5. **shared 내부 cross-slice import 허용.** (예: shared/ui → shared/lib 가능)
6. **barrel(`index.ts`) 금지.** `shared/ui/tabs/TabsUnderline`처럼 정의 파일에서 직접 import한다(테스트·`vi.mock` 포함).

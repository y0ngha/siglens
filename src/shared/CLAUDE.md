# `shared/` — Framework-Agnostic Utilities

> FSD의 가장 하위 레이어. 어떤 레이어도 shared를 import 가능하지만, shared는 자기 자신만 import 가능.
> (참고: Phase 1 마이그레이션 중에는 일부 도메인 의존성이 남아있을 수 있으며, 이는 Phase 3에서 해소될 예정입니다.)

## 하위 구조

| Path | Purpose |
|---|---|
| `shared/lib/` | 순수 유틸리티 함수: cn, chartColors, priceFormat, seo, og, a11y 등 |
| `shared/config/` | 설정 상수: queryKeys (QUERY_KEYS), pollingConfig, cookieNames |
| `shared/ui/` | Primitive UI 컴포넌트: DotSeparator, EyeIcon, InfoTooltip, JsonLd, MarkdownText, tabs/ |
| `shared/hooks/` | React 의존 일반 hook: useDialog, useEscapeKey, useFocusTrap, useHydrated, useIsMobileViewport 등 |
| `shared/db/` | Drizzle/Neon client, schema, token encryption, DB config/constants/types |
| `shared/email/` | Email dispatcher (Resend/Noop) + email types (EmailMessage, EmailDispatcher) |
| `shared/cache/` | (Phase 3에서 추가 예정) Redis client |
| `shared/api/` | HTTP client: isBot (bot detection) |

## 규칙

1. **도메인 어휘 금지.** shared는 Metric, Widget, Event 등 도메인 개념을 알지 못한다. (현재 마이그레이션 과도기로, `fearGreedLabels.ts`, `llmProviderLabels.ts` 등 일부 도메인 관련 파일이 잔류 중. Phase 3에서 entities로 이동 예정.)
2. **순수 함수 + primitive 컴포넌트.** Side-effect 코드는 캡슐화.
3. **shared/lib/, shared/config/에 React import 금지.** shared/ui/와 shared/hooks/만 React 사용.
4. **3번째 사용 후 승격.** 1~2개 슬라이스에서만 쓰는 유틸은 해당 슬라이스에 둔다.
5. **shared 내부 cross-slice import 허용.** (예: shared/ui → shared/lib 가능)

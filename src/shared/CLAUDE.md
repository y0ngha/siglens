# `shared/` — Framework-Agnostic Utilities

> FSD의 가장 하위 레이어. 어떤 레이어도 shared를 import 가능하지만, shared는 자기 자신만 import 가능.

## 하위 구조

| Path | Purpose |
|---|---|
| `shared/lib/` | 순수 유틸리티 함수: cn, chartColors, priceFormat, seo, og, a11y 등 |
| `shared/config/` | 설정 상수: queryKeys (QUERY_KEYS), pollingConfig, cookieNames |
| `shared/ui/` | (Phase 1 PR C에서 추가 예정) Primitive UI 컴포넌트 |
| `shared/hooks/` | (Phase 1 PR C에서 추가 예정) React 의존 일반 hook |
| `shared/db/` | (Phase 2에서 추가 예정) Drizzle client + schema |
| `shared/email/` | (Phase 2에서 추가 예정) Email dispatcher |
| `shared/cache/` | (Phase 2에서 추가 예정) Redis client |
| `shared/api/` | (Phase 1 PR B에서 추가 예정) HTTP client, third-party API wrapper |

## 규칙

1. **도메인 어휘 금지.** shared는 Metric, Widget, Event 등 도메인 개념을 알지 못한다.
2. **순수 함수 + primitive 컴포넌트.** Side-effect 코드는 캡슐화.
3. **shared/lib/, shared/config/에 React import 금지.** shared/ui/와 shared/hooks/만 React 사용.
4. **3번째 사용 후 승격.** 1~2개 슬라이스에서만 쓰는 유틸은 해당 슬라이스에 둔다.
5. **shared 내부 cross-slice import 허용.** (예: shared/ui → shared/lib 가능)

# `entities/` — Domain Models, API, and Query Hooks

> Entity는 도메인 개념(user, session, ticker 등)을 소유한다. API(Server Action, DB repository), 도메인 순수 함수(lib/), 타입(model.ts)을 포함.

## 의존 방향

entities는 `shared/`만 import 가능. **상위 레이어(features, widgets, pages, app)를 import할 수 없다.**

## 의도적 예외 (cross-slice import)

FSD 정석으로는 같은 레이어 안의 다른 슬라이스끼리 import 금지이나, 다음 케이스는 의도적으로 허용:

| from | to | 사유 |
|---|---|---|
| `entities/session` | `entities/user` | getCurrentUser가 findUserBySessionToken 호출. session과 user는 인증 도메인에서 본질적으로 결합 |
| `entities/analysis/actions/*` | `entities/news-article`, `entities/earnings-report`, `entities/options-chain` | submitOverallAnalysisAction이 여러 entity 데이터를 조합하는 multi-entity orchestration. FSD에서는 features 레이어가 담당해야 하나, Next.js Server Action 구조상 entity에 위치 |
| `entities/news-article/actions/*` | `entities/analysis` | submitNewsAnalysisAction이 byokGate(shared/lib) 경유로 analysis 의존 |

이 예외들은 ESLint `boundaries/element-types`에서 `entities → entities` 허용으로 관리됨.

## 슬라이스 구조

```
entities/<name>/
├── model.ts          types (먼저 정의)
├── api.ts            비-action 함수 (server-only repository, API 호출)
├── actions.ts        'use server' Server Action barrel
├── actions/          개별 Server Action 파일
├── hooks/            (선택) useXxxQuery / useXxxMutation
├── lib/              (선택) 도메인 순수 함수
├── __tests__/        colocated tests
└── index.ts          public API barrel
```

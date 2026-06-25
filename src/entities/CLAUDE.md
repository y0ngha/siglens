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

## `'use server'` 규칙

### actions.ts barrel에 `'use server'` 선언 금지

`actions.ts` barrel 파일에 `'use server'`를 선언하면 **안 된다.**
Next.js 16 Turbopack은 `'use server'` 파일에서 async function 직접 export만 허용하며,
re-export 문(type export 포함)은 빌드 오류를 유발한다.

- **개별 action 파일**(예: `actions/submitAnalysisAction.ts`)에만 `'use server'`를 선언한다.
- **barrel**(`actions.ts`)은 `'use server'` 없이 re-export만 수행한다.
  개별 파일이 이미 `'use server'`를 선언하므로 server action 동작에 영향 없다.

### `'use server'` 파일에서 non-function export 금지

`'use server'` 파일은 async function만 export할 수 있다.
class, interface, type, 상수 등은 별도 파일로 분리하고 import한다.

```
// ❌ BAD — 'use server' 파일에서 class export
'use server';
export class MyError extends Error { ... }  // Turbopack 빌드 오류
export async function myAction() { ... }

// ✅ GOOD — class를 별도 파일로 분리
// myTypes.ts
export class MyError extends Error { ... }

// myAction.ts
'use server';
import { MyError } from './myTypes';
export async function myAction() { ... }
```

## barrel 제외 대상 (server-only 의존성)

`index.ts` barrel에서 server-only 의존성(`next/headers`, `server-only`, Node.js 전용 라이브러리 등)을
가진 모듈을 re-export하면, 해당 barrel을 import하는 client component 번들에 server-only 코드가 포함되어
빌드 오류가 발생한다.

**server-only 의존성이 있는 export는 barrel에서 제외**하고, 서버 소비자는 lib/ 경로에서 직접 import한다.

현재 barrel 제외 대상:

| 슬라이스 | 제외 export | 사유 |
|---|---|---|
| `options-chain` | `hasOptionsMarket`, `fetchOptionsSnapshot`, `optionsDataCache` 관련 | `yahoo-finance2` → `@deno/shim-deno`가 `child_process`, `dns` 등 Node.js 전용 모듈 요구 |
| `session` | `DrizzleSessionRepository`, `getCurrentUser`, `bcryptPasswordHasher`, `bcryptPasswordVerifier` | `api.ts` → `schema.ts` (`server-only`) / `next/headers` 의존 / bcrypt는 Node.js 전용 |
| `api-key` | `DrizzleUserApiKeyRepository`, `LlmApiKeyDecryptionFailedError` | `api.ts`가 drizzle/encryption import — `server-only` 보호 대상 |
| `inquiry` | `DrizzleContactRepository` | `api.ts`가 drizzle/schema import — `server-only` 보호 대상 |
| `news-article` | `DrizzleNewsRepository`, `getNewsList` | `api.ts`가 drizzle/DB client import, `import 'server-only'` 선언 |

## 슬라이스 구조

```
entities/<name>/
├── model.ts          types (먼저 정의)
├── api.ts            비-action 함수 (server-only repository, API 호출)
├── actions.ts        Server Action barrel (❗ 'use server' 선언 금지 — 개별 action 파일에서만 선언)
├── actions/          개별 Server Action 파일
├── hooks/            (선택) useXxxQuery / useXxxMutation
├── lib/              (선택) 도메인 순수 함수
├── __tests__/        colocated tests
└── index.ts          public API barrel
```

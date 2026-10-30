# `entities/` — Domain Models, API, and Query Hooks

> Entity는 도메인 개념(user, session, ticker 등)을 소유한다. API(Server Action, DB repository), 도메인 순수 함수(lib/), 타입(model.ts)을 포함.

## 의존 방향

entities는 `shared/`만 import 가능. **상위 레이어(features, widgets, pages, app)를 import할 수 없다.**

## 의도적 예외 (cross-slice import)

FSD 정석으로는 같은 레이어 안의 다른 슬라이스끼리 import 금지이나, 다음 케이스는 의도적으로 허용:

| from | to | 사유 |
|---|---|---|
| `entities/analysis/actions/*`, `entities/analysis/server/overallAnalysisRunner.ts` | `entities/news-article`, `entities/earnings-report`, `entities/options-chain` | submitOverallAnalysisAction이 여러 entity 데이터를 조합하는 multi-entity orchestration. FSD에서는 features 레이어가 담당해야 하나, Next.js Server Action 구조상 entity에 위치. 본문은 쿠키 액션과 공개 API가 공유하도록 `server/overallAnalysisRunner.ts`로 추출됐다(액션 파일은 `'use server'`라 non-action export를 둘 수 없다) |
| `entities/news-article/actions/*`, `entities/news-article/server/*` | `entities/analysis` | submitNewsAnalysisAction이 byokGate(shared/lib) 경유로 analysis 의존 |
| `entities/agent-suggestions/api.ts` | `entities/market-news/api/marketNewsRepository` (`DrizzleMarketNewsRepository`), `entities/llm-provider` | `getAgentSuggestions`이 카테고리 헤드라인(market-news)과 agent LLM provider(llm-provider)를 조합하는 multi-entity orchestration — `entities/analysis/actions/*` → `news-article` 예외와 동일한 사유. `market-news`는 `lib/categoryConfig`(`CATEGORY_CONFIG`)와 `api/marketNewsRepository`(`DrizzleMarketNewsRepository`) 양쪽 다 사용 |
| `entities/analysis` (`server/overallAnalysisRunner.ts`, `api.ts`의 `prewarmOverall`) | `entities/investor-flows/server/getOverallInvestorFlowsScorecard` | 종합 분석이 수급 점수표(`investorFlowsScorecard`)를 입력으로 받는다. 웹·공개 API·SEO 프리웜 세 경로가 같은 함수를 불러야 core의 inputHash(캐시 키)가 일치한다 — server-only deep import |
| `entities/investor-flows/server/getInvestorFlowsEvaluationOptions.ts` | `entities/bars/server/sessionBarsStaticCache` (`getSessionBarsStatic`) | 숏스퀴즈 점수(core `squeezeContext`)의 완결 일봉. 화면 점수표·AI 해석·에이전트 도구·종합 분석 프리웜이 같은 세션 키 봉을 읽어야 core 캐시 키·inputHash가 맞고, 6h 봉 캐시를 읽으면 12h 수급 탭이 clamp된다(`symbolTabRevalidateClamp`) — server-only 지연 import |
| `entities/sitemap-entry/server.ts` | `entities/market-news/api/marketNewsRepository` (`DrizzleMarketNewsRepository`), `entities/terms/api` (`DrizzleTermsRepository`) | `loadStaticSitemapInputs`이 sitemap `lastmod`를 채우려 뉴스 최신 게시일(market-news)과 활성 약관 발효일(terms)을 조합하는 multi-entity orchestration |
| `entities/analysis` (`server/overallAnalysisRunner.ts`, `api.ts`), `entities/news-article` (`server/newsAnalysisRunner.ts`, `api.ts`) | `entities/economy/api/loadNewsMacroCalendar` | 뉴스 분석과 종합 분석의 뉴스 축이 동일한 매크로 캘린더를 넘겨야 core의 뉴스 캐시 키가 두 경로에서 일치한다 — server-only deep import, `economy` barrel 제외 대상 |

이 예외들은 ESLint `boundaries/element-types`에서 `entities → entities` 허용으로 관리됨.

## `lib/` 순수성

<a id="EN-1"></a>

### EN-1 — `entities/{slice}/lib/`는 순수 함수만 둔다

- `lib/`에는 부수효과(외부 I/O — `fetch` 포함, `localStorage`, `Date.now()`)가 없는 순수 도메인 로직만 둔다.
  부수효과는 `api.ts`·`actions/`(entity) 또는 `shared/db`·`shared/api`(횡단)로 간다. 위젯 전용 부수효과(예: 팝업
  dismiss 저장)는 그 위젯의 `utils/`에 둔다.
- 도메인과 무관한 범용 유틸(React·도메인 의존 없음, 예: URL 프로토콜 검증)은 `widgets/*/utils`나 entity `lib/`가
  아니라 `shared/lib/`로 간다.
- 표시 전용 요소(한국어 라벨, CSS 클래스명, UI 설정 enum)는 entity `lib/`에 두지 않는다 — `shared/lib/`나 해당
  위젯 모듈로 간다. 도메인 규칙과 화면 어휘를 섞으면 entity가 UI 변경마다 흔들린다.
- ❌ `entities/notice/lib/noticeStorage.ts`(`localStorage.getItem`) ✅ `widgets/notice-popup/utils/noticeStorage.ts`
- **허용된 예외:** 저장소를 인자로 주입받아 부수효과를 호출자가 통제하는 파이프라인 단계(예:
  `lib/analyzeNewsCards.ts`, `lib/ingestNewsForSymbol.ts`)는 `lib/`에 둘 수 있다. 이 경우 파일 JSDoc에 왜 예외인지
  (인접 파이프라인 단계, 주입된 저장소, 호출자 공유)를 적는다. 새 예외를 만들지 말고 기존 지역 예외 패턴에 맞춘다.
  DB·FMP·캐시 무효화 같은 I/O 의존성은 `lib/` 안에서 만들지 않고 app 레이어에서 구성해 인자로 주입한다.

## `'use server'` 규칙

Server Action이 던지지 않고 결과를 반환하는 계약 등 오류 처리 규칙은 `SERVER.md#SA-1`을 따른다.

### action은 개별 파일에서 직접 import

`actions.ts` 같은 re-export 파일을 두지 않는다. 각 action은 `actions/<name>.ts`에서
`'use server'`를 선언하고, 소비자는 그 파일에서 직접 import한다.
Next.js 16 Turbopack은 `'use server'` 파일에서 async function 직접 export만 허용하며,
re-export 문(type export 포함)은 빌드 오류를 유발한다.

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

## import 규칙 (barrel 금지)

`index.ts` barrel은 금지다(`src/__tests__/guards/noBarrelFiles.test.ts`). 소비자는 심볼을 정의한 파일
(`api.ts`, `lib/<file>.ts`, `hooks/<file>.ts`, `model.ts` 등)에서 직접 import한다(테스트·`vi.mock` 포함).

server-only 모듈(`import 'server-only'`, `next/headers`, drizzle/DB client, Node 전용 라이브러리 등)은
서버 소비자(RSC, route handler, Server Action, 다른 server-only 모듈)만 import한다. client component의
import 그래프에 들어가면 빌드가 깨진다 — `src/shared/__tests__/noServerOnlyInClientBundle.test.ts`가
빌드 전에 잡는다.

# Architecture

## 개요

Layered Architecture를 기반으로 한다.
외부 의존성(Alpaca, AI, Skills 파일 I/O)만 인터페이스로 감싸고, 나머지는 순수 TypeScript 함수로 구성한다.

---

## 레이어 구조

```
┌─────────────────────────────────────────┐
│              app (Next.js)              │  RSC, Route Handler
├─────────────────────────────────────────┤
│            components (UI)             │  React Client Components
├─────────────────────────────────────────┤
│          infrastructure (외부)          │  Alpaca, AI Provider, Skills Loader
├─────────────────────────────────────────┤
│          lib (UI 유틸리티)              │  외부 패키지 래퍼 (clsx 등)
├─────────────────────────────────────────┤
│             domain (순수)              │  인디케이터, 캔들 패턴, 차트 패턴, 프롬프트
└─────────────────────────────────────────┘
```

---

## 의존성 방향 규칙

```
domain         ← 외부 import 없음 (단, @y0ngha/siglens-core는 예외 — 아래 참고)
                 순수 TypeScript 함수만 허용
                 technicalindicators 라이브러리도 금지
                 (계산 로직을 직접 구현)

infrastructure ← domain, lib import 가능 (lib는 순수 상수/유틸 한정)
                 외부 API (Alpaca, Claude) 호출 담당
                 Skills 파일 I/O 담당
                 Redis 캐시 관리 담당 (cache/)
                 인터페이스(types.ts)를 반드시 먼저 정의
                 lib import 예: OG image color/layout 상수 (lib/og.ts) —
                 infrastructure 인프라(infrastructure/og/buildSymbolOgImage.tsx)에서
                 이미지 생성 시 색상 상수만 가져와 사용

lib            ← 외부 UI 유틸리티를 wrapping하는 순수 함수 레이어
                 domain에 넣을 수 없는 외부 패키지만 허용 (clsx, tailwind-merge 등)
                 사이드 이펙트 없는 순수 함수 형태로만 작성
                 React Query 키 팩토리(QUERY_KEYS) 및 설정 상수 포함
                 domain 타입(Timeframe 등) import 허용 — 키 팩토리 타입 안전성 확보 목적
                 infrastructure에서 import 가능 (단, lib에는 사이드 이펙트가 없어야 함)

app            ← infrastructure, domain, lib import 가능
                 RSC에서 데이터 fetch 및 조합
                 Route Handler에서 클라이언트 요청 처리

components     ← domain, lib import 가능
                 컴포넌트 파일(.tsx): infrastructure 직접 import 금지
                 훅 파일(hooks/): infrastructure의 fetch 함수만 import 가능
                   → useQuery/useMutation의 queryFn/mutationFn 연결 또는 useActionState의 Server Action 연결 목적에 한함
                   → 타입 import는 @/domain/types 또는 @y0ngha/siglens-core에서 수행
                 'use client' 필수 표기
```

**`@y0ngha/siglens-core` 예외 — 모든 레이어에서 직접 import 가능**

`@y0ngha/siglens-core`는 외부 라이브러리가 아니라 **SigLens 도메인 로직 자체를 외주화한 패키지**다. 인디케이터 계산, 캔들 패턴 탐지, 시그널 로직, 도메인 타입 등 본 프로젝트의 domain 레이어 본체가 이 패키지에 들어 있다. 따라서 다음과 같이 취급한다:

- `domain`, `infrastructure`, `lib`, `app`, `components` **어느 레이어에서든 직접 import 가능**
- 얇은 re-export wrapper를 만들 필요 없음 — 의미 없는 보일러플레이트만 늘어남
- 단, 패키지가 노출하지 않는 내부 모듈을 deep import하는 것은 금지 (`@y0ngha/siglens-core/dist/...` 형태 X)
- siglens 로컬 도메인 코드(`src/domain/`)는 SigLens 앱 고유 로직(backtest, chat 모델 상수, 대시보드 섹터 그룹핑 등)만 보유

`technicalindicators` 같은 일반 외부 라이브러리는 종전 규칙 그대로 domain에서 금지된다.

**위반 예시 (절대 금지)**
```typescript
// ❌ domain에서 일반 외부 라이브러리 import
// src/domain/indicators/rsi.ts
import { RSI } from 'technicalindicators'; // 금지

// ❌ components에서 infrastructure import
// src/components/chart/StockChart.tsx
import { AlpacaProvider } from '@/infrastructure/market/alpaca'; // 금지

// ❌ domain에서 infrastructure import
// src/domain/analysis/prompt.ts
import { claudeClient } from '@/infrastructure/ai/claude'; // 금지

// ❌ siglens-core deep import
import { calculateBollinger } from '@y0ngha/siglens-core/dist/domain/indicators/bollinger'; // 금지
```

**허용 예시**
```typescript
// ✅ components에서 siglens-core 직접 import
import { detectCandlePatternEntries, RSI_OVERBOUGHT_LEVEL } from '@y0ngha/siglens-core';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
```

**타입 배치 규칙**

```
인디케이터 결과 타입(MACDResult, BollingerResult 등) → domain/types.ts
  ❌ 인디케이터 구현 파일(rsi.ts 등)에 정의 금지
  ✅ domain/types.ts에 정의 후 import하여 사용

타입/스키마는 소속 레이어에서 정의
  ❌ route 레이어 전용 필드(skillsDegraded)를 domain에 정의
  ✅ Record<keyof Interface, ...>로 컴파일 타임 동기화 강제
```

**Cross-layer 타입 — domain이 유일한 공유 지점**

`components/`와 `infrastructure/` 양쪽에서 동일한 타입을 import해야 하는 경우, 그 타입은 **반드시 `domain/types.ts`(또는 `domain/<subgroup>/types.ts`)에 위치**한다. 표면상 "presentation-adjacent"한 타입(예: `NewsDisplayItem`, `ContextSwitchMessage`)이라도 cross-layer 공유가 필요하면 domain이 정답이다.

이유: `infrastructure ← lib`로 순수 utility(상수·color token·React Query key factory 등) import는 허용되지만, **타입은 여전히 domain이 정답**이다. hook 파일은 `@/domain/types` 또는 `@y0ngha/siglens-core`에서만 타입을 import할 수 있어(위 hook 규칙), `lib/`에 cross-layer 타입을 두면 hook 측 사용처가 레이어 위반을 일으킨다. lib import는 "타입 단방향(domain→lib는 OK, lib→타입공유는 NO)" 원칙을 유지하기 위해 lib에는 **상수와 순수 함수만** 두고 타입은 두지 않는다.

```typescript
// ❌ presentation에 가까워 보여서 lib에 두면 infrastructure에서 import 불가
// src/lib/news/types.ts
export interface NewsDisplayItem { ... }

// src/infrastructure/db/newsRepository.ts
import type { NewsDisplayItem } from '@/lib/news/types'; // 위반 — lib에 cross-layer 타입을 두면 hook 측 import 경로가 깨짐

// ✅ cross-layer 공유 필요 → domain에 두고 양쪽이 import
// src/domain/types.ts
export interface NewsDisplayItem { ... }

// src/infrastructure/db/newsRepository.ts
import type { NewsDisplayItem } from '@/domain/types';

// src/components/news/sections/NewsList.tsx
import type { NewsDisplayItem } from '@/domain/types';
```

판단 순서:
1. 단일 레이어에서만 쓰이는 presentation 타입 → 그 레이어 안에 둔다 (`components/feature/types.ts`, `lib/feature/types.ts`)
2. cross-layer 공유가 필요한 타입 → **무조건 domain** (이름이 "Display"이든 "DTO"이든 무관)
3. `infrastructure` 내부에서만 쓰이는 raw response 타입 → `infrastructure/<adapter>/types.ts`에 두고 같은 디렉터리 내에서만 사용

**순환 의존성 금지**

```
모듈 간 순환 import 금지 (A → B → A)
  → 공유 상수/타입은 제3 파일로 분리하여 순환 해소
  ❌ module-a.ts imports module-b.ts, module-b.ts imports module-a.ts
  ✅ shared.ts에 공유 요소 분리 후 양쪽에서 import
```

---

## 폴더 구조

**중요: `domain/`, `infrastructure/`, `components/`, `__tests__/`는 `src/app/` 안에 있지 않다.**
Next.js의 `app/`은 라우팅 전용이며, 나머지 레이어는 `src/` 바로 아래에 위치한다.

```
# tree -d -L 4 -I "node_modules|.next|public"
.
├── docs
├── refs
├── skills
└── src
    ├── __tests__
    │   ├── components
    │   ├── domain
    │   ├── infrastructure
    │   ├── lib
    │   └── utils
    ├── app
    │   ├── [symbol]
    │   ├── account
    │   ├── api
    │   ├── backtesting
    │   ├── forgot-password
    │   ├── login
    │   ├── market
    │   ├── reset-password
    │   └── signup
    ├── components
    │   ├── analysis
    │   ├── auth
    │   ├── backtesting
    │   ├── chart
    │   ├── chat
    │   ├── contact
    │   ├── dashboard
    │   ├── home
    │   ├── hooks
    │   ├── layout
    │   ├── legal
    │   ├── providers
    │   ├── search
    │   ├── symbol-page
    │   ├── trendline
    │   └── ui
    ├── domain
    │   ├── auth
    │   ├── backtest
    │   ├── chart
    │   ├── constants
    │   ├── contact
    │   ├── llm
    │   ├── signals
    │   └── time
    ├── infrastructure
    │   ├── ai           # Gemini SDK adapter (callGeminiWithKeyFallback)
    │   ├── auth         # auth use-cases + adapters + OAuth flow + bcrypt
    │   ├── chat
    │   ├── contact
    │   ├── dashboard
    │   ├── db           # Drizzle schema + Neon client + repositories
    │   │                # (users/sessions/oauthAccounts/contact/userApiKey/
    │   │                #  ticker/usage/usageLog) + config + constants
    │   ├── email        # ResendEmailDispatcher + email token store
    │   ├── market
    │   ├── skills
    │   ├── storage
    │   ├── ticker       # FMP ticker API + Korean translator
    │   └── tier         # Tier CRUD use-cases (setUserTier/getUserTier)
    └── lib
        └── auth
```

> Phase 1~6 ejection 결과 siglens는 자체 Drizzle 스키마, Neon 클라이언트,
> 8개 repository(user/session/oauthAccount/contact/userApiKey/ticker/usage/
> usageLog)를 직접 보유한다. auth use-cases, OAuth 어댑터, ResendEmailDispatcher,
> bcrypt 해싱, BYOK 도메인, Tier CRUD, 한국어 티커 도메인, Gemini SDK 어댑터도
> 모두 siglens 로컬에 위치한다. siglens-core에서는 분석 use-case, 지표/신호/패턴,
> 프롬프트 빌더, Skills 로더, 시장 데이터 provider 인터페이스, 캐시 provider,
> Job 큐, 사용량 정책 함수(`checkAnalysisLimit`/`checkChatbotLimit`),
> `hashUsageIp`, AI 타입 계약, 추상 repository 인터페이스, enum union 타입만
> 보유한다.

> 컴포넌트 폴더 내 커스텀 훅은 `hooks/` 서브폴더에 위치한다 (`chart/hooks/`, `symbol-page/hooks/` 등).
> `components/hooks/`는 여러 컴포넌트 폴더에서 공통으로 사용하는 최상위 공유 훅 디렉토리다 (`useOnClickOutside` 등). 특정 기능 폴더에 한정되지 않는 범용 훅은 이곳에 위치한다.

### domain/signals/

Pure-function signal detectors for the `/market` page Panel C. Follows the same rules as `domain/indicators/`.

### components/dashboard/

React components for `/market` page and the homepage's market summary card. Contains Panel B (MarketSummaryPanel family) and Panel C (SectorSignalPanel family).

### infrastructure/dashboard/

Server-side data orchestration for the dashboard:
- `marketSummaryApi.ts` — indices/sectors/briefing fetch
- `sectorSignalsApi.ts` — batch stock bars + indicators + signal detection + Upstash cache (TTL 1h)

---

## 데이터 흐름

### 최초 진입

```
브라우저 → /AAPL
  → app/[symbol]/page.tsx (RSC)
    → QueryClient (per-request, server-only) 생성
    → queryClient.prefetchQuery(bars) → infrastructure/market/barsApi.ts → Market API
      → domain/indicators/* → RSI, MACD, 볼린저, DMI, VWAP, MA, EMA 계산
    → dehydrate(queryClient) → HydrationBoundary로 클라이언트에 전달
  → SymbolPageClient (HydrationBoundary 안)
    → useBars: hydrated 캐시에서 즉시 읽기 (불필요한 리페치 없음)
    → useAnalysis: 마운트 시 자동 AI 분석 트리거
```

> props 드릴링(`initialBars`, `initialAnalysis`) 방식은 사용하지 않는다. `queryClient.prefetchQuery()` + `dehydrate()` + `HydrationBoundary` 패턴으로 서버에서 클라이언트로 초기 데이터를 주입한다.

### 타임프레임 전환

```
사용자 클릭 → 클라이언트 상태 변경 (URL 변경 없음)
  → useBars 훅 → infrastructure/market/getBarsAction.ts (Server Action)
    → infrastructure/market/barsApi.ts → infrastructure/market/alpaca.ts → Alpaca API
    → domain/indicators/* → 인디케이터 재계산
  → 차트 데이터만 교체
```

> `getBarsAction`은 `infrastructure` 레이어에 위치한 Server Action으로, bars 데이터와 인디케이터를 함께 반환한다. 인디케이터 계산은 `infrastructure/market/barsApi.ts`에서 domain을 직접 호출한다. `infrastructure → domain` import 방향은 의존성 규칙상 허용된다.

### AI 재분석

```
재분석 버튼 클릭 (또는 자동 트리거)
  → useAnalysis 훅 → infrastructure/market/submitAnalysisAction.ts (Server Action)
    → infrastructure/cache/redis.ts → 캐시 조회 (캐시 히트 시 즉시 반환)
    → infrastructure/market/barsApi.ts → fetchBarsWithIndicators (서버 재구성)
      ↳ 'use cache' cacheLife('minutes') 캐시 히트 시 추가 API 호출 없음
      ↳ 캐시 미스 시 → FMP/Alpaca API 1회 호출 → domain/indicators/* 재계산
    → infrastructure/skills/loader.ts → Skills 파일 로드
    → domain/analysis/prompt.ts → 프롬프트 구성
    → Cloud Run worker (fire-and-forget via waitUntil)
  → useAnalysis 훅 → submitAnalysisAction → pollAnalysisAction (10초 간격 polling)
    → Redis에서 완료된 분석 결과 반환
  → AnalysisPanel 업데이트
```

> 클라이언트는 `{symbol, timeframe}` 프리미티브만 Server Action에 전달한다. bars/indicators 전체 페이로드를 전송하지 않으므로 Next.js 1MB 바디 제한을 초과하지 않는다.

---

## Next.js 특이사항

### middleware.ts 삭제 (Next.js 16 변경사항)

Next.js 16부터 `middleware.ts` 대신 `proxy.ts`를 사용한다.
현재 프로젝트에서 proxy 설정이 필요하면 `proxy.ts`로 작성한다.

### 캐싱 전략

**Next.js fetch 캐싱 (정적 데이터)**
```typescript
// RSC에서 fetch 캐싱
const data = await fetch(url, {
    next: { revalidate: 60 }, // 60초 캐시
});
```

**`'use cache'` 캐싱 (bars + indicators)**
- `fetchBarsWithIndicators`는 `'use cache'` + `cacheLife('minutes')` + `cacheTag(\`bars:{symbol}:{timeframe}\`)` 적용.
- 캐시 키: `(symbol, timeframe, fromDay)` — `fromDay`는 UTC 날짜 단위(`YYYY-MM-DD`)로 절삭되어 하루 내 안정적.
- 동일 `(symbol, timeframe)` 요청이 RSC 렌더·타임프레임 변경·Server Action 내부에서 연달아 발생해도 캐시 히트 → FMP/Alpaca 추가 호출 없음.

**Upstash Redis 캐싱 (AI 분석 결과)**
- AI 분석 결과는 타임프레임별 TTL로 Upstash Redis에 캐싱한다.
- 캐시 키: `analysis:{symbol}:{timeframe}` (예: `analysis:AAPL:1Day`)
- 타임프레임별 TTL: 1Min=300s, 5Min=900s, 15Min=1800s, 1Hour=3600s, 1Day=86400s
- 환경변수(`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) 미설정 시 캐시 없이 정상 동작 (graceful degradation)
- 구현: `infrastructure/cache/` (`types.ts`, `config.ts`, `redis.ts`)

### 'use cache' 지시어 (Next.js 16)

Next.js 16의 명시적 캐싱 모델을 활용한다.

```typescript
// 함수 단위 캐싱
async function fetchBars(symbol: string, timeframe: string) {
    'use cache';
    // ...
}
```

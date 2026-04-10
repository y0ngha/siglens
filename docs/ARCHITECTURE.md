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
domain         ← 외부 import 없음
                 순수 TypeScript 함수만 허용
                 technicalindicators 라이브러리도 금지
                 (계산 로직을 직접 구현)

infrastructure ← domain import 가능
                 외부 API (Alpaca, Claude) 호출 담당
                 Skills 파일 I/O 담당
                 Redis 캐시 관리 담당 (cache/)
                 인터페이스(types.ts)를 반드시 먼저 정의

lib            ← 외부 UI 유틸리티를 wrapping하는 순수 함수 레이어
                 domain에 넣을 수 없는 외부 패키지만 허용 (clsx, tailwind-merge 등)
                 사이드 이펙트 없는 순수 함수 형태로만 작성
                 React Query 키 팩토리(QUERY_KEYS) 및 설정 상수 포함
                 domain 타입(Timeframe 등) import 허용 — 키 팩토리 타입 안전성 확보 목적

app            ← infrastructure, domain, lib import 가능
                 RSC에서 데이터 fetch 및 조합
                 Route Handler에서 클라이언트 요청 처리

components     ← domain, lib import 가능
                 컴포넌트 파일(.tsx): infrastructure 직접 import 금지
                 훅 파일(hooks/): infrastructure의 fetch 함수만 import 가능
                   → useQuery/useMutation의 queryFn/mutationFn 연결 목적에 한함
                   → 타입 import는 @/domain/types에서 수행
                 'use client' 필수 표기
```

**위반 예시 (절대 금지)**
```typescript
// ❌ domain에서 외부 라이브러리 import
// src/domain/indicators/rsi.ts
import { RSI } from 'technicalindicators'; // 금지

// ❌ components에서 infrastructure import
// src/components/chart/StockChart.tsx
import { AlpacaProvider } from '@/infrastructure/market/alpaca'; // 금지

// ❌ domain에서 infrastructure import
// src/domain/analysis/prompt.ts
import { claudeClient } from '@/infrastructure/ai/claude'; // 금지
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
    │   ├── domain
    │   └── infrastructure
    ├── app
    │   ├── [symbol]
    │   └── api
    ├── components
    │   ├── analysis
    │   ├── chart
    │   │   └── hooks
    │   ├── search
    │   └── symbol-page
    │       └── hooks
    ├── domain
    │   ├── analysis
    │   ├── constants
    │   └── indicators
    ├── infrastructure
    │   ├── ai
    │   ├── cache
    │   ├── market
    │   ├── skills
    │   └── ticker
    └── lib
```

> 컴포넌트 폴더 내 커스텀 훅은 `hooks/` 서브폴더에 위치한다 (`chart/hooks/`, `symbol-page/hooks/` 등).

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
재분석 버튼 클릭
  → useAnalysis 훅 → infrastructure/market/analyzeAction.ts (Server Action)
    → infrastructure/cache/redis.ts → 캐시 조회 (캐시 히트 시 즉시 반환)
    → infrastructure/market/analysisApi.ts (캐시 미스 시)
      → infrastructure/skills/loader.ts → Skills 파일 로드 및 파싱
      → domain/analysis/prompt.ts → 프롬프트 구성 (Skills 포함)
      → infrastructure/ai/claude.ts → AI 분석
    → infrastructure/cache/redis.ts → 결과 캐시 저장 (waitUntil)
  → AnalysisPanel 업데이트
```

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
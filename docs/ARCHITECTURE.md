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
    │   ├── market
    │   └── skills
    └── lib
```

> 컴포넌트 폴더 내 커스텀 훅은 `hooks/` 서브폴더에 위치한다 (`chart/hooks/`, `symbol-page/hooks/` 등).

---

## 데이터 흐름

### 최초 진입

```
브라우저 → /AAPL
  → app/[symbol]/page.tsx (RSC)
    → infrastructure/market/alpaca.ts → Alpaca API (최근 500봉)
    → domain/indicators/* → RSI, MACD, 볼린저, DMI, VWAP, MA, EMA 계산
    → domain/analysis/prompt.ts → AI 프롬프트 구성
    → infrastructure/ai/claude.ts → AI 분석
  → StockChart (initialBars)
  → AnalysisPanel (initialAnalysis)
```

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
    → infrastructure/market/analysisApi.ts
      → infrastructure/skills/loader.ts → Skills 파일 로드 및 파싱
      → domain/analysis/prompt.ts → 프롬프트 구성 (Skills 포함)
      → infrastructure/ai/claude.ts → AI 분석
  → AnalysisPanel 업데이트
```

---

## Next.js 특이사항

### middleware.ts 삭제 (Next.js 16 변경사항)

Next.js 16부터 `middleware.ts` 대신 `proxy.ts`를 사용한다.
현재 프로젝트에서 proxy 설정이 필요하면 `proxy.ts`로 작성한다.

### 캐싱 전략

별도 DB 없이 Next.js fetch 캐싱만 사용한다.

```typescript
// RSC에서 fetch 캐싱
const data = await fetch(url, {
    next: { revalidate: 60 }, // 60초 캐시
});
```

### 'use cache' 지시어 (Next.js 16)

Next.js 16의 명시적 캐싱 모델을 활용한다.

```typescript
// 함수 단위 캐싱
async function fetchBars(symbol: string, timeframe: string) {
    'use cache';
    // ...
}
```
# Architecture

## 개요

Feature-Sliced Design (FSD) 6-layer 아키텍처를 기반으로 한다.
외부 의존성(FMP, yahoo-finance2, AI, Skills 파일 I/O)은 entity/shared 슬라이스 내부에서 캡슐화하고,
순수 로직은 shared/lib 또는 `@y0ngha/siglens-core`에 위치한다.

---

## 레이어 구조

```
┌─────────────────────────────────────────┐
│        app (Next.js App Router)         │  RSC, Route Handler — composition root
├─────────────────────────────────────────┤
│              pages (FSD)                │  (현재 미사용, 향후 확장 예약)
├─────────────────────────────────────────┤
│            widgets (UI 조합)            │  Client Components, 차트, 패널, 레이아웃
├─────────────────────────────────────────┤
│           features (유스케이스)           │  auth-*, contact-form, ticker-search 등
├─────────────────────────────────────────┤
│       entities (도메인 엔티티)            │  user, session, bars, analysis, ticker 등
├─────────────────────────────────────────┤
│        shared (공유 유틸리티)             │  lib, config, ui, hooks, db, email, api
└─────────────────────────────────────────┘
```

---

## 의존성 방향 규칙

```
shared         ← 자기 자신만 import 가능. entities import은 byokGate 등 예외적 허용.
                 shared/lib, shared/config에 React import 금지.

entities       ← shared import 가능. entities 간 cross-import 허용
                 (analysis → news-article, earnings-report 등 조합 필요).

features       ← entities, shared import 가능. features 간 cross-import 허용
                 (auth-signup → auth-email-verification 등).

widgets        ← features, entities, shared import 가능. widgets 간 cross-import 허용
                 (symbol-page가 chart/analysis/fear-greed 위젯 조합).

pages          ← widgets, features, entities, shared import 가능.

app            ← pages, widgets, features, entities, shared import 가능.
                 Next.js App Router composition root.
```

**`@y0ngha/siglens-core` 예외 — 모든 레이어에서 직접 import 가능**

`@y0ngha/siglens-core`는 외부 라이브러리가 아니라 **SigLens 도메인 로직 자체를 외주화한 패키지**다. 인디케이터 계산, 캔들 패턴 탐지, 시그널 로직, 도메인 타입 등 본 프로젝트의 domain 레이어 본체가 이 패키지에 들어 있다. 따라서 다음과 같이 취급한다:

- `shared`, `entities`, `features`, `widgets`, `pages`, `app` **어느 레이어에서든 직접 import 가능**
- 얇은 re-export wrapper를 만들 필요 없음 — 의미 없는 보일러플레이트만 늘어남
- 단, 패키지가 노출하지 않는 내부 모듈을 deep import하는 것은 금지 (`@y0ngha/siglens-core/dist/...` 형태 X)

`technicalindicators` 같은 일반 외부 라이브러리는 shared에서만 wrapping 가능.

**위반 예시 (절대 금지)**
```typescript
// ❌ widgets에서 entity internal path 직접 import
import { loginUser } from '@/entities/user/lib/loginUser'; // 금지 — barrel로만

// ❌ siglens-core deep import
import { calculateBollinger } from '@y0ngha/siglens-core/dist/domain/indicators/bollinger'; // 금지
```

**허용 예시**
```typescript
// ✅ widgets에서 siglens-core 직접 import
import { detectCandlePatternEntries, RSI_OVERBOUGHT_LEVEL } from '@y0ngha/siglens-core';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';

// ✅ features에서 entity barrel import
import { DrizzleUserRepository } from '@/entities/user';
```

**순환 의존성 금지**

```
모듈 간 순환 import 금지 (A → B → A)
  → 공유 상수/타입은 제3 파일로 분리하여 순환 해소
```

---

## 폴더 구조

```
.
├── docs
├── refs
├── skills
└── src
    ├── __tests__
    │   ├── fixtures/     # 공유 test fixture (jsonResponse 등)
    │   └── utils/        # 공유 test utility (makeFormData, readBlobText 등)
    ├── app               # Next.js App Router (composition root)
    │   ├── [symbol]
    │   ├── account
    │   ├── api
    │   ├── backtesting
    │   ├── forgot-password
    │   ├── login
    │   ├── market
    │   ├── reset-password
    │   └── signup
    ├── entities
    │   ├── agreement/    # 약관 동의 상태
    │   ├── analysis/     # AI 분석 submit/poll/cancel, 쿨다운, quadrants
    │   ├── api-key/      # BYOK API key CRUD
    │   ├── backtest-case/ # 백테스트 케이스
    │   ├── bars/         # 주가 데이터 fetch + indicators
    │   ├── chat-message/ # AI 채팅
    │   ├── earnings-report/ # 실적 데이터
    │   ├── email-token/  # 이메일 인증/비밀번호 토큰
    │   ├── inquiry/      # 문의(contact) 저장
    │   ├── llm-provider/ # AI provider 어댑터 (Anthropic, Gemini, OpenAI)
    │   ├── market-summary/ # 시장 요약
    │   ├── news-article/ # 뉴스 fetch + AI 분석
    │   ├── notice/       # 사이트 공지 팝업 (notices DB 테이블, matchPath, storage)
    │   ├── oauth-account/ # OAuth 계정 관리
    │   ├── og-image/     # OG 이미지 생성
    │   ├── options-chain/ # 옵션 체인 데이터
    │   ├── sector-signal/ # 섹터 시그널
    │   ├── session/      # 세션/인증 쿠키
    │   ├── sitemap-entry/ # 사이트맵 엔트리
    │   ├── skill/        # Skills 파일 로드 (.md 분석 룰)
    │   ├── terms/        # 약관 본문
    │   ├── ticker/       # 종목 검색/정보
    │   ├── user/         # 사용자 CRUD
    │   └── user-tier/    # 사용자 등급
    │
    │   (fear-greed는 entity가 아니라 widget이다 — widgets/ 참조)
    ├── features
    │   ├── auth-*/       # 인증 관련 features (login, signup, oauth, password-reset 등)
    │   ├── account-delete/
    │   ├── contact-form/
    │   ├── premium-gate/
    │   ├── pwa-install/
    │   ├── symbol-chat/
    │   └── ticker-search/
    ├── shared
    │   ├── api/          # HTTP client, bot detection
    │   ├── cache/        # Redis client
    │   ├── config/       # queryKeys, pollingConfig, cookieNames, market, time 상수
    │   ├── db/           # Drizzle/Neon client, schema, token encryption
    │   ├── email/        # Email dispatcher (Resend/Noop)
    │   ├── hooks/        # 범용 React hooks (useDialog, useEscapeKey 등)
    │   ├── lib/          # 순수 유틸리티 (cn, chartColors, priceFormat, seo 등)
    │   └── ui/           # Primitive UI 컴포넌트 (tabs, tooltip 등)
    └── widgets
        ├── analysis/
        ├── backtesting/
        ├── chart/
        ├── chat/
        ├── dashboard/
        ├── fear-greed/   # 공포탐욕지수 위젯
        ├── fundamental/
        ├── home/
        ├── layout/
        ├── legal/
        ├── news/
        ├── notice-popup/ # 긴급 공지 모달 (경로 매칭, localStorage dismiss, 우선순위)
        ├── options/
        ├── overall/
        └── symbol-page/
```

> 각 슬라이스(entity, feature, widget)는 `__tests__/` 서브폴더에 테스트를 colocate한다.
> 공유 테스트 fixture/utility만 `src/__tests__/fixtures/`, `src/__tests__/utils/`에 위치.

---

## 데이터 흐름

### 최초 진입

```
브라우저 → /AAPL
  → app/[symbol]/page.tsx (RSC)
    → QueryClient (per-request, server-only) 생성
    → queryClient.prefetchQuery(bars) → entities/bars getBarsAction
      → @y0ngha/siglens-core → RSI, MACD, 볼린저, DMI, VWAP, MA, EMA 계산
    → dehydrate(queryClient) → HydrationBoundary로 클라이언트에 전달
  → SymbolPageClient (HydrationBoundary 안)
    → useBars: hydrated 캐시에서 즉시 읽기 (불필요한 리페치 없음)
    → useAnalysis: 마운트 시 자동 AI 분석 트리거
```

> props 드릴링(`initialBars`, `initialAnalysis`) 방식은 사용하지 않는다. `queryClient.prefetchQuery()` + `dehydrate()` + `HydrationBoundary` 패턴으로 서버에서 클라이언트로 초기 데이터를 주입한다.

### 타임프레임 전환

```
사용자 클릭 → 클라이언트 상태 변경 (URL 변경 없음)
  → useBars 훅 → entities/bars/actions/getBarsAction (Server Action)
    → @y0ngha/siglens-core → 인디케이터 재계산
  → 차트 데이터만 교체
```

### AI 재분석

```
재분석 버튼 클릭 (또는 자동 트리거)
  → useAnalysis 훅 → entities/analysis/actions/submitAnalysisAction (Server Action)
    → Upstash Redis 캐시 조회 (캐시 히트 시 즉시 반환)
    → entities/bars → fetchBarsWithIndicators (서버 재구성)
    → entities/skill → Skills 파일 로드
    → @y0ngha/siglens-core → 프롬프트 구성
    → 내부 worker 처리 트리거 (fire-and-forget via Vercel `waitUntil` — @vercel/functions)
  → useAnalysis 훅 → pollAnalysisAction (10초 간격 polling)
    → Redis에서 완료된 분석 결과 반환
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

**cacheComponents (PPR) 비활성화 상태**
- 현재 `next.config.ts`에서 `cacheComponents`는 임시로 비활성화되어 있다 (`'use cache'` / `cacheLife` / `cacheTag` 미사용).
- 사유: PPR resumable slots 오류로 dynamic route의 metadata가 HTML head에 박히지 않고 streaming payload로만 노출되어 SEO bot 크롤러가 metadata를 읽지 못하는 회귀 발생.
- 재활성화 시 dynamic `generateMetadata`의 prerender 동작과 `'use cache'` 함수 배치 전략을 함께 재설계해야 한다 (관련 GitHub 이슈 참고).

**Upstash Redis 캐싱 (AI 분석 결과)**
- AI 분석 결과는 타임프레임별 TTL로 Upstash Redis에 캐싱한다.
- 캐시 키: `analysis:{symbol}:{timeframe}` (예: `analysis:AAPL:1Day`)
- 타임프레임별 TTL: 1Min=300s, 5Min=900s, 15Min=1800s, 1Hour=3600s, 1Day=86400s
- 환경변수(`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) 미설정 시 캐시 없이 정상 동작 (graceful degradation)

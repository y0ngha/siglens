# symbol 라우트 가시 h1 + variant canonical 정리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 6개 symbol 라우트에 페이지별 고유 가시 h1을 노출하고(SSR HTML), variant URL의 noindex+clean-canonical 충돌을 3곳에서 제거해 SEO 신호를 정리한다.

**Architecture:** (1) `SymbolPageHeading` 공통 RSC-safe 컴포넌트를 신설해 sibling 5개 페이지의 sr-only h1을 가시 h1으로 전환하고, 차트는 jail 제약 때문에 timeframe bar 행에 짧은 가시 h1 한 줄을 둔다(`SymbolPageClient`). sr-only 설명 p·h2와 breadcrumb span은 그대로 유지(페이지당 h1 정확히 1개). (2) 3개 `generateMetadata`에서 variant 기반 noindex를 제거하고 clean canonical만 남긴다.

**Tech Stack:** Next.js 16 App Router(RSC), React 19, vitest + @testing-library/react, Tailwind, `@/shared/lib/cn`. core(`@y0ngha/siglens-core`) 변경 없음 — siglens 단독.

**프로젝트 규칙 주의:**
- **커밋은 직접 하지 않는다.** 각 Task 끝의 commit 단계는 논리적 체크포인트이며, 실제 커밋/푸시는 구현·리뷰 완료 후 `git-agent`가 수행한다(CLAUDE.md). 구현 종료 시 `review-agent` 호출 필수.
- production 코드는 슬라이스 barrel만 import(`@/widgets/symbol-page`). FSD app→widgets 허용.
- 멀티라인 주석/JSDoc 허용(Documentation Policy Override). WHY 보존 권장.

**참조 스펙:** `docs/superpowers/specs/2026-05-29-seo-visible-h1-canonical-design.md`

---

## 파일 구조 (생성/수정)

| 파일 | 책임 | Task |
|---|---|---|
| `src/widgets/symbol-page/ui/SymbolPageHeading.tsx` (생성) | 6개 라우트 공통 가시 h1 (RSC-safe) | 1 |
| `src/widgets/symbol-page/index.ts` (수정) | `SymbolPageHeading` barrel export | 1 |
| `src/widgets/symbol-page/__tests__/SymbolPageHeading.test.tsx` (생성) | 컴포넌트 단위 테스트 | 1 |
| `src/app/[symbol]/news/page.tsx` (수정) | sr-only h1 → 가시 h1 | 2 |
| `src/app/[symbol]/fundamental/page.tsx` (수정) | sr-only h1 → 가시 h1 | 2 |
| `src/app/[symbol]/overall/page.tsx` (수정) | sr-only h1 → 가시 h1 (+ Task 4 noindex 제거) | 2,4 |
| `src/app/[symbol]/fear-greed/page.tsx` (수정) | sr-only h1 → 가시 h1 | 2 |
| `src/app/[symbol]/options/page.tsx` (수정) | section 내 h1 → 가시 h1 (밖으로) | 2 |
| `src/app/[symbol]/page.tsx` (수정) | sr-only h1 제거 + displayName prop (+ Task 4 noindex 제거) | 3,4 |
| `src/widgets/symbol-page/SymbolPageClient.tsx` (수정) | displayName prop + timeframe bar 가시 h1 | 3 |
| `src/widgets/symbol-page/__tests__/SymbolPageClient.heading.test.tsx` (생성) | 차트 h1 render 테스트 | 3 |
| `src/app/market/page.tsx` (수정) | variant noindex 제거 | 4 |
| `src/app/[symbol]/__tests__/page.test.ts` (수정) | tf noindex 회귀 테스트 뒤집기 | 4 |
| `src/app/market/__tests__/page.test.ts` (수정) | variant noindex 회귀 테스트 뒤집기 | 4 |
| `src/app/[symbol]/__tests__/symbol-metadata.test.ts` (수정) | overall variant noindex 제거 검증 추가 | 4 |

---

## Task 1: `SymbolPageHeading` 공통 가시 h1 컴포넌트

6개 라우트가 공유하는 가시 h1. RSC-safe 순수 presentational(`'use client'` 없음) — app layer RSC가 import해 SSR로 가시 텍스트를 내보낸다.

**Files:**
- Create: `src/widgets/symbol-page/ui/SymbolPageHeading.tsx`
- Modify: `src/widgets/symbol-page/index.ts`
- Test: `src/widgets/symbol-page/__tests__/SymbolPageHeading.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// src/widgets/symbol-page/__tests__/SymbolPageHeading.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SymbolPageHeading } from '../ui/SymbolPageHeading';

describe('SymbolPageHeading', () => {
    it('주어진 텍스트로 가시 h1을 렌더한다 (sr-only 아님)', () => {
        render(
            <SymbolPageHeading>애플, Apple Inc. (AAPL) 차트 분석</SymbolPageHeading>
        );
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toHaveTextContent('애플, Apple Inc. (AAPL) 차트 분석');
        expect(h1).not.toHaveClass('sr-only');
    });

    it('custom className을 병합한다', () => {
        render(<SymbolPageHeading className="px-6">제목</SymbolPageHeading>);
        expect(screen.getByRole('heading', { level: 1 })).toHaveClass('px-6');
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/widgets/symbol-page/__tests__/SymbolPageHeading.test.tsx`
Expected: FAIL — `SymbolPageHeading` 모듈 없음

- [ ] **Step 3: 컴포넌트 구현**

```tsx
// src/widgets/symbol-page/ui/SymbolPageHeading.tsx
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface SymbolPageHeadingProps {
    children: ReactNode;
    className?: string;
}

/**
 * symbol 라우트 6개(차트/뉴스/펀더멘털/옵션/종합/공포탐욕)가 공유하는 가시 h1.
 *
 * RSC-safe 순수 presentational 컴포넌트('use client' 없음)라 app layer의
 * page.tsx(RSC)가 직접 렌더해 SSR HTML에 가시 텍스트로 들어간다. 기존에는
 * 페이지별 h1이 sr-only였는데, 검색엔진이 가시 콘텐츠에 더 가중치를 두므로
 * ticker landing의 텍스트 신호를 살리기 위해 가시 h1으로 노출한다.
 *
 * layout breadcrumb(SymbolLayoutHeader)는 6개 페이지 공통이라 의도적으로
 * heading이 아닌 plain span으로 두므로, 페이지당 가시 h1은 이 컴포넌트 1개뿐이다.
 */
export function SymbolPageHeading({
    children,
    className,
}: SymbolPageHeadingProps) {
    return (
        <h1
            className={cn(
                'text-secondary-100 text-xl font-bold tracking-tight text-balance sm:text-2xl',
                className
            )}
        >
            {children}
        </h1>
    );
}
```

- [ ] **Step 4: barrel export 추가**

`src/widgets/symbol-page/index.ts`의 `CrossLinkCards` export 줄 아래에 추가:

```tsx
export { SymbolPageHeading } from './ui/SymbolPageHeading';
```

- [ ] **Step 5: 통과 확인**

Run: `yarn test src/widgets/symbol-page/__tests__/SymbolPageHeading.test.tsx`
Expected: PASS

- [ ] **Step 6: commit 체크포인트** (git-agent)

```
feat(symbol-page): add SymbolPageHeading visible h1 component
```

---

## Task 2: sibling 5개 페이지 가시 h1 전환

5개 페이지(`<main>` 자연 스크롤, jail이 `min-h`라 자유)의 sr-only h1을 `SymbolPageHeading`으로 교체한다. 각 페이지의 sr-only section(h2+p)과 가시 guidance section은 **변경하지 않는다**. 각 페이지는 이미 `displayName` 변수를 보유한다.

> 테스트 주의: 이 5개 page.tsx는 async RSC라 본문 render 테스트 인프라가 없다(기존에도 sibling page render 테스트 없음). 가시 h1 동작은 Task 1의 `SymbolPageHeading` 단위 테스트로 보장되고, 여기서는 컴포넌트 교체 + `yarn lint`(타입/import) + 기존 `symbol-metadata.test.ts`(canonical 회귀)로 검증한다.

**Files:**
- Modify: `src/app/[symbol]/news/page.tsx`
- Modify: `src/app/[symbol]/fundamental/page.tsx`
- Modify: `src/app/[symbol]/overall/page.tsx`
- Modify: `src/app/[symbol]/fear-greed/page.tsx`
- Modify: `src/app/[symbol]/options/page.tsx`

- [ ] **Step 1: news 페이지** — import 추가 후 `:271` 교체

import 블록(기존 import들 아래)에 추가:

```tsx
import { SymbolPageHeading } from '@/widgets/symbol-page';
```

`<h1 className="sr-only">{displayName} 최신 뉴스와 어닝 일정</h1>` (`:271`) 을:

```tsx
<SymbolPageHeading>
    {displayName} 최신 뉴스와 어닝 일정
</SymbolPageHeading>
```

- [ ] **Step 2: fundamental 페이지** — import 추가 후 `:351-353` 교체

```tsx
import { SymbolPageHeading } from '@/widgets/symbol-page';
```

```tsx
<h1 className="sr-only">
    {displayName} 재무지표와 애널리스트 의견
</h1>
```
→
```tsx
<SymbolPageHeading>
    {displayName} 재무지표와 애널리스트 의견
</SymbolPageHeading>
```

- [ ] **Step 3: overall 페이지** — import 추가 후 `:190-192` 교체

```tsx
import { SymbolPageHeading } from '@/widgets/symbol-page';
```

```tsx
<h1 className="sr-only">
    {displayName} 차트와 옵션 시장, 실적, 뉴스 종합 분석
</h1>
```
→
```tsx
<SymbolPageHeading>
    {displayName} 차트와 옵션 시장, 실적, 뉴스 종합 분석
</SymbolPageHeading>
```

- [ ] **Step 4: fear-greed 페이지** — import 추가 후 `:171-173` 교체

```tsx
import { SymbolPageHeading } from '@/widgets/symbol-page';
```

```tsx
<h1 className="sr-only">
    {displayName} ({ticker}) 공포 탐욕 지수와 단기 매수 분위기
</h1>
```
→
```tsx
<SymbolPageHeading>
    {displayName} ({ticker}) 공포 탐욕 지수와 단기 매수 분위기
</SymbolPageHeading>
```

- [ ] **Step 5: options 페이지** — import 추가 후 `:182-189` 재구성 (h1을 sr-only section 밖으로)

```tsx
import { SymbolPageHeading } from '@/widgets/symbol-page';
```

기존:
```tsx
<section className="sr-only">
    <h1>{displayName} 옵션 시장 분석</h1>
    <p>
        {displayName} 옵션 시장을 AI가 한국어로 해석합니다.
        만기별 Max Pain, Put/Call Ratio, ATM IV, Implied Move 등
        핵심 지표와 Strike별 Open Interest 분포를 함께 살펴볼 수
        있습니다.
    </p>
    {expirations.length > 0 ? (
        <p>
            현재 거래 가능한 만기일은 총 {expirations.length}
            개이며, 가장 가까운 만기는 {expirations[0]}입니다.
        </p>
    ) : null}
</section>
```
→
```tsx
<SymbolPageHeading>{displayName} 옵션 시장 분석</SymbolPageHeading>
<section className="sr-only">
    <p>
        {displayName} 옵션 시장을 AI가 한국어로 해석합니다.
        만기별 Max Pain, Put/Call Ratio, ATM IV, Implied Move 등
        핵심 지표와 Strike별 Open Interest 분포를 함께 살펴볼 수
        있습니다.
    </p>
    {expirations.length > 0 ? (
        <p>
            현재 거래 가능한 만기일은 총 {expirations.length}
            개이며, 가장 가까운 만기는 {expirations[0]}입니다.
        </p>
    ) : null}
</section>
```

- [ ] **Step 6: 타입·린트·기존 테스트 확인**

Run: `yarn lint && yarn test src/app/[symbol]/__tests__/symbol-metadata.test.ts`
Expected: PASS (canonical 회귀 가드 유지, import/타입 정상)

- [ ] **Step 7: commit 체크포인트** (git-agent)

```
feat(symbol): surface visible h1 on 5 sibling symbol routes
```

---

## Task 3: 차트 페이지 가시 h1 (timeframe bar)

차트는 jail(`h-[calc(...)]` + `overflow-hidden`, first-viewport 고정)이라 본문에 블록을 추가할 수 없다. `page.tsx`의 sr-only h1을 제거하고, `displayName`을 `SymbolPageClient`에 전달해 timeframe bar 행에 짧은 가시 h1 한 줄로 둔다. sr-only section의 p·h2는 유지.

**Files:**
- Modify: `src/app/[symbol]/page.tsx`
- Modify: `src/widgets/symbol-page/SymbolPageClient.tsx`
- Test: `src/widgets/symbol-page/__tests__/SymbolPageClient.heading.test.tsx`

- [ ] **Step 1: 실패 테스트 작성** — `SymbolPageClient`가 displayName을 가시 h1으로 렌더하는지

무거운 자식(ChartContent)과 훅을 mock하고 timeframe bar의 h1만 검증한다. mock 골격은 `SymbolPageClient`의 실제 import에 맞춘다(아래는 현재 import 기준).

```tsx
// src/widgets/symbol-page/__tests__/SymbolPageClient.heading.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FALLBACK_ANALYSIS } from '@/entities/chat-message';

// 차트/시트 등 무거운 자식은 stub — h1은 SymbolPageClient 자체가 렌더한다.
vi.mock('@/widgets/chart', () => ({
    ChartErrorFallback: () => null,
    ChartSkeleton: () => null,
    TimeframeSelector: () => null,
}));
vi.mock('../ChartContent', () => ({ ChartContent: () => null }));
vi.mock('../hooks/useAssetInfo', () => ({ useAssetInfo: () => undefined }));
vi.mock('../hooks/useMobileSheet', () => ({
    useMobileSheet: () => ({
        sheetSnap: 0,
        setSheetSnap: vi.fn(),
        mobileSheetContent: null,
        setMobileSheetContent: vi.fn(),
    }),
}));
vi.mock('../hooks/useTimeframeChange', () => ({
    useTimeframeChange: () => ({
        timeframe: '1D',
        timeframeChangeCount: 0,
        handleTimeframeChange: vi.fn(),
    }),
}));
vi.mock('@/shared/hooks/useHydrated', () => ({ useHydrated: () => false }));
vi.mock('@/shared/hooks/useIsMobileViewport', () => ({
    useIsMobileViewport: () => false,
}));
vi.mock('../SymbolPageContext', () => ({
    SymbolPageProvider: ({ children }: { children: React.ReactNode }) =>
        children,
    useSymbolPageContext: () => ({ indicatorCount: 13 }),
}));

import { SymbolPageClient } from '../SymbolPageClient';

describe('SymbolPageClient 가시 h1', () => {
    it('displayName을 timeframe bar의 가시 h1으로 렌더한다', () => {
        render(
            <SymbolPageClient
                symbol="aapl"
                companyName="Apple Inc."
                displayName="애플, Apple Inc. (AAPL)"
                initialAnalysis={FALLBACK_ANALYSIS}
                initialAnalysisFailed={true}
                indicatorCount={13}
            />
        );
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toHaveTextContent('애플, Apple Inc. (AAPL) 차트 분석');
        expect(h1).not.toHaveClass('sr-only');
    });
});
```

> 구현 주의: `SymbolPageClient`가 import하는 훅/컴포넌트가 위 mock 목록과 다르면(예: 추가 훅), 실패 메시지에 맞춰 mock을 보강한다. 참고 패턴: `src/app/[symbol]/__tests__/SymbolLayoutClient.test.tsx`.

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/widgets/symbol-page/__tests__/SymbolPageClient.heading.test.tsx`
Expected: FAIL — `displayName` prop 미지원 / h1 없음

- [ ] **Step 3: `SymbolPageClient` 구현**

`SymbolPageClientProps`에 `displayName` 추가:

```tsx
interface SymbolPageClientProps {
    symbol: string;
    companyName: string;
    displayName: string;
    initialAnalysis: AnalysisResponse;
    initialAnalysisFailed: boolean;
    indicatorCount: number;
}
```

구조분해에 `displayName` 추가:

```tsx
export function SymbolPageClient({
    symbol,
    companyName,
    displayName,
    initialAnalysis,
    initialAnalysisFailed,
    indicatorCount,
}: SymbolPageClientProps) {
```

timeframe bar 행(`:67-72`)을 교체 — `justify-end` → `justify-between`, 좌측에 가시 h1:

```tsx
{/* Chart-only timeframe controls live inside this overflow-hidden chart
    container so the layout header can stay free of useSearchParams
    (which would force PPR to mark the whole route as dynamic). */}
<div className="border-secondary-700 flex items-center justify-between gap-3 border-b px-4 py-2 sm:py-1.5">
    {/* 차트 페이지 가시 h1: jail(first-viewport 고정)이라 본문에 블록을
        추가할 수 없어 timeframe bar 행에 짧은 한 줄로 둔다. truncate로
        좁은 화면에서 TimeframeSelector와 한 줄 공존. SSR 렌더되어
        크롤러가 가시 텍스트로 읽는다. */}
    <h1 className="text-secondary-100 min-w-0 truncate text-sm font-semibold sm:text-base">
        {displayName} 차트 분석
    </h1>
    <TimeframeSelector
        value={timeframe}
        onChange={handleTimeframeChange}
    />
</div>
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/widgets/symbol-page/__tests__/SymbolPageClient.heading.test.tsx`
Expected: PASS

- [ ] **Step 5: `page.tsx` — sr-only h1 제거 + displayName 전달**

`src/app/[symbol]/page.tsx`의 sr-only section(`:218-239`)에서 **h1 줄(`:219`)만 제거**:

```tsx
<section className="sr-only">
    <p>
        {displayName}({ticker})의 기술적 분석 페이지입니다.
        보조지표 {skillCounts.indicators}종, 캔들 패턴{' '}
        {skillCounts.candlesticks}종, 차트 패턴{' '}
        {skillCounts.patterns}종을 활용해 추세, 진입 구간,
        지지선과 저항선을 분석합니다.
    </p>
    <p>
        {displayName} 주가를 RSI, MACD, 볼린저밴드 등 보조지표로
        해석하고, 도지나 해머, 장악형 같은 주요 캔들 패턴과 차트
        패턴을 자동으로 감지합니다. 주요 지지선과 저항선 레벨,
        매매 전략도 함께 확인할 수 있습니다.
    </p>
    <h2>AI와 대화로 분석 결과 확인</h2>
    <p>
        분석된 차트 데이터를 근거로 AI와 대화할 수 있습니다.
        추세 판단, 지표 의미, 진입 타이밍 등 궁금한 점을
        질문하면 {displayName}의 현재 상황에 맞춰 답변합니다.
    </p>
</section>
```

`SymbolPageClient` 호출(`:241-249`)에 `displayName` prop 추가:

```tsx
<SymbolPageClient
    symbol={symbol}
    companyName={assetInfo.name}
    displayName={displayName}
    initialAnalysis={FALLBACK_ANALYSIS}
    // SSR 단계에서 AI 분석을 의도적으로 생략하고 클라이언트로 위임한다.
    // 마운트 시 useAnalysis가 자동으로 재분석을 트리거하도록 true로 설정한다.
    initialAnalysisFailed={true}
    indicatorCount={skillCounts.indicators}
/>
```

> `displayName`은 `page.tsx:99`에서 이미 `buildDisplayName(assetInfo, ticker)`로 계산돼 있으므로 추가 계산 불필요.

- [ ] **Step 6: 전체 확인**

Run: `yarn lint && yarn test src/widgets/symbol-page src/app/[symbol]/__tests__`
Expected: PASS

- [ ] **Step 7: commit 체크포인트** (git-agent)

```
feat(symbol): surface visible chart h1 in timeframe bar, drop sr-only h1
```

---

## Task 4: variant noindex 제거 (이슈 2)

3개 `generateMetadata`에서 variant 기반 noindex 블록을 제거하고 clean canonical만 남긴다. 회귀 테스트 2곳을 먼저 뒤집어 RED를 만든 뒤 구현한다.

**Files:**
- Modify: `src/app/[symbol]/__tests__/page.test.ts`
- Modify: `src/app/market/__tests__/page.test.ts`
- Modify: `src/app/[symbol]/__tests__/symbol-metadata.test.ts`
- Modify: `src/app/[symbol]/page.tsx`
- Modify: `src/app/[symbol]/overall/page.tsx`
- Modify: `src/app/market/page.tsx`

- [ ] **Step 1: 회귀 테스트 뒤집기 — `[symbol]/page.test.ts`**

`:121-136`의 `adds noindex when tf query param is present` 블록을 교체:

```tsx
it('does not add noindex when tf query param is present (canonical consolidates)', async () => {
    mockGetAssetInfoCached.mockResolvedValue({
        name: 'Apple Inc.',
        koreanName: '애플',
        fmpSymbol: 'AAPL',
    } as never);

    const metadata = await generateMetadata({
        params: Promise.resolve({ symbol: 'aapl' }),
        searchParams: Promise.resolve({ tf: '1Hour' }),
    });

    // variant URL은 noindex 대신 clean canonical로 색인 통합 (SEO 신호 충돌 제거)
    expect(metadata.robots).toBeUndefined();
    expect(metadata.alternates?.canonical).toBe('https://siglens.io/AAPL');
});
```

(`:138-150`의 `does not add noindex when no tf param`은 그대로 유지.)

- [ ] **Step 2: 회귀 테스트 뒤집기 — `market/page.test.ts`**

`:73-81`의 `adds noindex for query variant pages` 블록을 교체:

```tsx
it('does not add noindex for query variant pages (canonical consolidates)', async () => {
    const metadata = await generateMetadata({
        searchParams: Promise.resolve({ sector: 'XLK' }),
    });

    // variant URL은 noindex 대신 clean canonical로 색인 통합
    expect(metadata.robots).toBeUndefined();
    expect(metadata.alternates?.canonical).toBe('https://siglens.io/market');
});
```

(`:83-89`의 `does not add noindex for canonical page`는 그대로 유지.)

- [ ] **Step 3: overall variant 검증 추가 — `symbol-metadata.test.ts`**

파일 끝의 마지막 `describe` 닫힘(`:313` 직전, 최상위 `describe` 안)에 새 describe를 추가한다. overall은 별도 page.test가 없으므로 여기서 검증한다:

```tsx
    describe('variant noindex 제거 — clean canonical 통합', () => {
        beforeEach(() => {
            mockGetAssetInfoCached.mockResolvedValue({
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            });
        });

        it('overall: tf variant여도 noindex 없음, canonical은 clean', async () => {
            const metadata = await generateOverallMetadata(
                makeParamsWithSearch('aapl', { tf: '1Hour' })
            );
            expect(metadata.robots).toBeUndefined();
            expect(metadata.alternates?.canonical).toBe(
                'https://siglens.io/AAPL/overall'
            );
        });
    });
```

- [ ] **Step 4: 실패 확인 (RED)**

Run: `yarn test src/app/[symbol]/__tests__/page.test.ts src/app/market/__tests__/page.test.ts src/app/[symbol]/__tests__/symbol-metadata.test.ts`
Expected: FAIL — 현재 코드는 아직 variant에 noindex를 붙이므로 `robots`가 `undefined`가 아님

- [ ] **Step 5: 구현 — `[symbol]/page.tsx`**

`generateMetadata`에서 variant noindex 제거. 현재 `:41`의 `const { tf } = await searchParams;`, `:57`의 `const hasTfVariant = tf !== undefined;`, `:79-81`의 robots 블록을 제거하고, `tf`를 더 안 쓰므로 `searchParams` 구조분해도 제거한다.

`generateMetadata` 시그니처의 구조분해를 `{ params, searchParams }` → `{ params }`로:

```tsx
export async function generateMetadata({
    params,
}: Props): Promise<Metadata> {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!VALID_TICKER_RE.test(ticker)) {
        return { robots: { index: false, follow: false } };
    }
    const assetInfo = await getAssetInfoCached(ticker);
    const displayName = assetInfo
        ? buildDisplayName(assetInfo, ticker)
        : ticker;
    const { title, fullTitle, description, url, keywords } =
        buildSymbolSeoContent(ticker, {
            displayName,
            koreanName: assetInfo?.koreanName,
        });

    return {
        title,
        description,
        keywords,
        alternates: {
            canonical: url,
        },
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: fullTitle,
            description,
            url,
            locale: 'ko_KR',
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
        },
    };
}
```

> 본문 `SymbolPage`는 여전히 `searchParams`로 `tf`를 읽으므로(`:87`) 본문은 변경하지 않는다. `Props` 인터페이스의 `searchParams`도 유지(본문이 사용).

- [ ] **Step 6: 구현 — `[symbol]/overall/page.tsx`**

동일하게 `generateMetadata`에서 `tf` 추출, `hasTfVariant`(`:?`), robots 블록(`:71-73`)을 제거하고 `searchParams` 구조분해를 제거한다. canonical(`url`)·openGraph·twitter는 유지.

> 구현 시 `overall/page.tsx`의 `generateMetadata`를 열어 `[symbol]/page.tsx`와 동일 형태로 정리한다(tf/hasTfVariant/robots 제거, canonical 유지). 본문 `OverallPage`가 `tf`를 쓰면 본문 `searchParams`는 유지.

- [ ] **Step 7: 구현 — `market/page.tsx`**

`generateMetadata`(`:62-102`)에서 `:65`의 `const params = await searchParams;`, `:66-67`의 `hasQueryVariant`, `:98-100`의 robots 블록을 제거하고, `searchParams`를 안 쓰므로 구조분해를 비운다. canonical 주석을 갱신:

```tsx
export async function generateMetadata(): Promise<Metadata> {
    return {
        title: MARKET_TITLE,
        description: MARKET_DESCRIPTION,
        keywords: MARKET_KEYWORDS,
        // variant URL(?sector=, ?timeframe=)은 noindex 대신 clean canonical(/market)로
        // 색인 통합한다 — canonical과 noindex를 동시에 거는 신호 충돌을 제거.
        alternates: { canonical: MARKET_URL },
        openGraph: {
            title: MARKET_FULL_TITLE,
            description: MARKET_DESCRIPTION,
            url: MARKET_URL,
            siteName: SITE_NAME,
            locale: 'ko_KR',
            type: 'website',
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: MARKET_FULL_TITLE,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: MARKET_FULL_TITLE,
            description: MARKET_DESCRIPTION,
            images: ['/og-image.png'],
        },
    };
}
```

> `GenerateMetadataProps` 인터페이스가 다른 곳에서 안 쓰이면 함께 제거. 본문 `MarketPage`/`MarketContent`는 `searchParams`를 계속 사용하므로 그대로 둔다.

- [ ] **Step 8: 통과 확인 (GREEN)**

Run: `yarn test src/app/[symbol]/__tests__/page.test.ts src/app/market/__tests__/page.test.ts src/app/[symbol]/__tests__/symbol-metadata.test.ts`
Expected: PASS

- [ ] **Step 9: commit 체크포인트** (git-agent)

```
fix(seo): drop variant noindex, rely on clean canonical (symbol/overall/market)
```

---

## Task 5: 전체 검증 & 리뷰 핸드오프

- [ ] **Step 1: 전체 lint + 관련 테스트**

Run: `yarn lint && yarn test src/widgets/symbol-page src/app/[symbol] src/app/market`
Expected: PASS

- [ ] **Step 2: 전체 테스트 스위트**

Run: `yarn test`
Expected: PASS (회귀 없음)

- [ ] **Step 3: review-agent 호출**

구현 완료 → `review-agent` 호출(CLAUDE.md Exit Signal Routing). approved까지 findings 수정 반복 후 git-agent 커밋/PR.

---

## Self-Review 결과

- **Spec 커버리지:** §3.1 SymbolPageHeading→Task1, §3.2 sibling 5개→Task2, §3.3 차트→Task3, §3.4 불변식(페이지당 h1 1개, breadcrumb span 유지, sr-only p·h2 유지)→Task2/3가 h1만 교체, §4 variant noindex 제거→Task4, §6 테스트→각 Task, §7 영향 파일→파일 구조 표 일치, §8 순서→Task1→5. 누락 없음.
- **Placeholder 스캔:** 신규 컴포넌트/테스트(Task1,3)는 완전 코드. sibling 5개(Task2)·overall/market generateMetadata(Task4 Step6,7)는 정확한 before/after edit. overall은 [symbol]과 동일 형태라 "동일 정리" 지시 + 명시 제거 대상 라인 제공(반복 회피 아님 — 동형 변환이라 형태 명시).
- **타입 일관성:** `SymbolPageHeading({children, className?})`, `SymbolPageClientProps.displayName: string`, 테스트의 prop(`displayName="애플, Apple Inc. (AAPL)"`)과 구현 h1(`{displayName} 차트 분석`) 일치. canonical 단언값(`https://siglens.io/AAPL`, `/AAPL/overall`, `/market`)은 기존 테스트 상수와 일치.
- **확인 필요(구현 시):** (1) `SymbolPageClient` 실제 import가 Task3 mock 목록과 일치하는지(불일치 시 mock 보강), (2) `overall/page.tsx` generateMetadata의 정확한 robots 라인 번호(스펙 `:71-73` 기준, 구현 시 파일 확인), (3) `market/page.tsx`의 `GenerateMetadataProps`/`SearchParams` 미사용 여부.

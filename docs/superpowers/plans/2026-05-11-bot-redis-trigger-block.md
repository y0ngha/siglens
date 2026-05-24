# Bot Redis Trigger Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [symbol] 페이지의 봇 트래픽이 Redis 워커를 트리거하지 않게 하면서 캐시 hit이면 그대로 노출, miss면 fallback UI를 표시한다.

**Architecture:** 두 레포 작업. 먼저 `@y0ngha/siglens-core` 의 5개 submit use-case 에 `skipEnqueueIfMiss?: boolean` 옵셔널 파라미터와 새 status `'miss_no_trigger'` 를 추가하고 publish. 이후 `siglens` 의 4개 Server Action 진입부에서 `next/server.userAgent(headers).isBot` 으로 판정해 해당 옵션을 core 에 전달한다. 클라이언트 훅과 UI 는 새 status 를 받아 공통 `BotBlockedNotice` 컴포넌트를 렌더한다.

**Tech Stack:** TypeScript, Next.js 15 (Server Action / RSC), `next/server.userAgent`, Jest, React Testing Library.

**Repo paths:**
- siglens: `/Users/y0ngha/Project/siglens`
- siglens-core: `/Users/y0ngha/Project/siglens-core`

**작업 순서 원칙:**
- Phase A (siglens-core) 머지·publish 완료 후 Phase B 시작.
- Phase A 끝에서만 `git-agent` 로 core PR 생성.
- Phase B 끝에서 `review-agent` → `mistake-managing-agent` → `git-agent` 흐름 (CLAUDE.md 규칙).

---

## Phase A — siglens-core 변경

> 작업 디렉토리: `/Users/y0ngha/Project/siglens-core`
> 각 task 는 TDD: 실패 테스트 작성 → 구현 → 통과 확인.

### Task A1: `submitAnalysis` 에 `skipEnqueueIfMiss` 옵션 추가

**Files:**
- Modify: `src/application/market/types.ts` (`SubmitAnalysisGatedResult` union)
- Modify: `src/application/market/submitAnalysis.ts:158-341`
- Test: `src/__tests__/application/market/submitAnalysis.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/__tests__/application/market/submitAnalysis.test.ts` 에 새 테스트 추가:

```typescript
describe('submitAnalysis - skipEnqueueIfMiss', () => {
  it('returns miss_no_trigger when cache miss and skipEnqueueIfMiss=true (no enqueue)', async () => {
    // arrange: 캐시 miss 환경, enqueue spy
    const enqueueSpy = jest.fn();
    // ... 기존 테스트가 사용하는 mock 패턴 동일하게 재사용

    const result = await submitAnalysis({
      symbol: 'AAPL',
      companyName: 'Apple',
      timeframe: '1D',
      skipEnqueueIfMiss: true,
    });

    expect(result.status).toBe('miss_no_trigger');
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('returns cached when cache hit even if skipEnqueueIfMiss=true', async () => {
    // arrange: 캐시 hit 환경
    const result = await submitAnalysis({
      symbol: 'AAPL',
      companyName: 'Apple',
      timeframe: '1D',
      skipEnqueueIfMiss: true,
    });

    expect(result.status).toBe('cached');
  });

  it('keeps existing behavior when skipEnqueueIfMiss is omitted', async () => {
    // arrange: 캐시 miss
    const result = await submitAnalysis({
      symbol: 'AAPL',
      companyName: 'Apple',
      timeframe: '1D',
    });

    expect(result.status).toBe('submitted');
  });
});
```

기존 `submitAnalysis.test.ts` 의 mock setup (cache provider mock, queue mock) 을 그대로 재사용하도록 작성한다.

- [ ] **Step 2: 실패 확인**

```bash
cd /Users/y0ngha/Project/siglens-core
yarn test src/__tests__/application/market/submitAnalysis.test.ts
```

Expected: 3개 신규 테스트 실패 (옵션 미지원).

- [ ] **Step 3: 타입 union 확장**

`src/application/market/types.ts:72-75` 의 `SubmitAnalysisGatedResult` 에 새 케이스 추가:

```typescript
export type SubmitAnalysisGatedResult =
  | { status: 'cached'; result: AnalysisResult }
  | { status: 'submitted'; jobId: string }
  | { status: 'miss_no_trigger' }
  | { status: 'error'; error: AnalysisError };
```

오버로드 시그니처가 있다면 입력 타입에 `skipEnqueueIfMiss?: boolean` 도 추가.

- [ ] **Step 4: 구현**

`src/application/market/submitAnalysis.ts:158-341` 의 입력 인터페이스에 `skipEnqueueIfMiss?: boolean` 추가. 캐시 hit 분기(라인 243-254)는 그대로. miss 분기(라인 260-341) 시작 부분에 가드:

```typescript
// cache miss 처리 시작 지점
if (input.skipEnqueueIfMiss) {
  return { status: 'miss_no_trigger' };
}
// 기존 enqueue 로직 그대로 진행
```

가드는 캐시 미스 판정이 끝난 직후, 그러나 rate limit / dependency 검사 및 enqueue 호출 전에 배치한다.

- [ ] **Step 5: 통과 확인**

```bash
yarn test src/__tests__/application/market/submitAnalysis.test.ts
```

Expected: 모든 테스트 PASS. 기존 테스트도 회귀 없이 통과.

---

### Task A2: `submitBriefing` 에 동일 옵션 추가

**Files:**
- Modify: `src/application/market/submitBriefing.ts:44-88`
- Modify: `src/application/market/types.ts` 또는 briefing 전용 types 파일 (반환 타입 정의 위치)
- Test: `src/__tests__/application/market/submitBriefing.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

A1 과 동일 패턴의 3개 테스트를 `submitBriefing.test.ts` 에 추가. (mock 패턴은 해당 파일의 기존 테스트 셋업 재사용.)

- [ ] **Step 2: 실패 확인**

```bash
yarn test src/__tests__/application/market/submitBriefing.test.ts
```

- [ ] **Step 3: 타입 union 확장**

`SubmitBriefingResult` (실제 타입 이름은 파일 상단에서 확인) 에 `| { status: 'miss_no_trigger' }` 추가. 입력 타입에 `skipEnqueueIfMiss?: boolean` 추가.

- [ ] **Step 4: 구현**

`submitBriefing.ts:44-88` 에서 캐시 miss 분기 직후, enqueue 직전에:

```typescript
if (input.skipEnqueueIfMiss) {
  return { status: 'miss_no_trigger' };
}
```

- [ ] **Step 5: 통과 확인**

```bash
yarn test src/__tests__/application/market/submitBriefing.test.ts
```

---

### Task A3: `submitFundamentalAnalysis` 에 동일 옵션 추가

**Files:**
- Modify: `src/application/fundamental/types.ts` (`SubmitFundamentalAnalysisResult`)
- Modify: `src/application/fundamental/submitFundamentalAnalysis.ts:166-269`
- Test: `src/__tests__/application/fundamental/submitFundamentalAnalysis.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

A1 과 동일 패턴 3개 테스트 추가. 단, fundamental 의 input 시그니처(`symbol`, `modelId` 등)에 맞춰 호출.

- [ ] **Step 2: 실패 확인**

```bash
yarn test src/__tests__/application/fundamental/submitFundamentalAnalysis.test.ts
```

- [ ] **Step 3: 타입 union 확장**

`SubmitFundamentalAnalysisResult` 에 `| { status: 'miss_no_trigger' }` 추가. 입력 타입에 `skipEnqueueIfMiss?: boolean`.

- [ ] **Step 4: 구현**

`submitFundamentalAnalysis.ts:166-269` 의 캐시 miss 분기 진입 직후 동일 가드:

```typescript
if (input.skipEnqueueIfMiss) {
  return { status: 'miss_no_trigger' };
}
```

- [ ] **Step 5: 통과 확인**

```bash
yarn test src/__tests__/application/fundamental/submitFundamentalAnalysis.test.ts
```

---

### Task A4: `submitNewsAnalysis` 에 동일 옵션 추가

**Files:**
- Modify: `src/application/news/types.ts` (`SubmitNewsAnalysisResult`)
- Modify: `src/application/news/submitNewsAnalysis.ts:92-213`
- Test: `src/__tests__/application/news/submitNewsAnalysis.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

A1 패턴 3개 테스트.

- [ ] **Step 2: 실패 확인**

```bash
yarn test src/__tests__/application/news/submitNewsAnalysis.test.ts
```

- [ ] **Step 3: 타입 union 확장**

`SubmitNewsAnalysisResult` 에 `| { status: 'miss_no_trigger' }` 추가. 입력에 `skipEnqueueIfMiss?: boolean`.

- [ ] **Step 4: 구현**

`submitNewsAnalysis.ts:92-213` 의 캐시 miss 분기 진입 직후 동일 가드:

```typescript
if (input.skipEnqueueIfMiss) {
  return { status: 'miss_no_trigger' };
}
```

- [ ] **Step 5: 통과 확인**

```bash
yarn test src/__tests__/application/news/submitNewsAnalysis.test.ts
```

---

### Task A5: `submitOverallAnalysis` 에 동일 옵션 추가

> 주의: 이 함수는 `'pending_dependencies'` status 가 있어서 dependency 검사 위치를 정확히 봐야 한다. 봇 차단은 **cache miss 판정 직후, dependency 검사 및 enqueue 전** 에 위치시킨다 — 봇에게는 dependency 상태 구분 없이 일관되게 `miss_no_trigger` 반환.

**Files:**
- Modify: `src/application/overall/types.ts` (`SubmitOverallAnalysisResult`)
- Modify: `src/application/overall/submitOverallAnalysis.ts:106-293`
- Test: `src/__tests__/application/overall/submitOverallAnalysis.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

A1 패턴 + 한 케이스 추가:

```typescript
it('returns miss_no_trigger when skipEnqueueIfMiss=true even if dependencies are pending', async () => {
  // arrange: pending_dependencies 시나리오 + cache miss
  const result = await submitOverallAnalysis({
    symbol: 'AAPL',
    companyName: 'Apple',
    timeframe: '1D',
    skipEnqueueIfMiss: true,
  });

  expect(result.status).toBe('miss_no_trigger');
});
```

- [ ] **Step 2: 실패 확인**

```bash
yarn test src/__tests__/application/overall/submitOverallAnalysis.test.ts
```

- [ ] **Step 3: 타입 union 확장**

`SubmitOverallAnalysisResult` 에 `| { status: 'miss_no_trigger' }` 추가. 입력에 `skipEnqueueIfMiss?: boolean`.

- [ ] **Step 4: 구현**

`submitOverallAnalysis.ts:106-293` 의 캐시 hit 분기 직후, dependency / limit 검사 및 enqueue 호출보다 앞선 지점에:

```typescript
if (input.skipEnqueueIfMiss) {
  return { status: 'miss_no_trigger' };
}
```

dependency 검사를 봇에게도 적용하지 말 것 — 봇은 캐시 hit 외에는 무조건 fallback.

- [ ] **Step 5: 통과 확인**

```bash
yarn test src/__tests__/application/overall/submitOverallAnalysis.test.ts
```

---

### Task A6: 전체 테스트·빌드·publish

- [ ] **Step 1: 전체 테스트**

```bash
cd /Users/y0ngha/Project/siglens-core
yarn test
```

Expected: 전체 PASS, 회귀 없음.

- [ ] **Step 2: 빌드**

```bash
yarn build
```

빌드 산출물에 새 status / 옵션 타입이 노출되는지 확인.

- [ ] **Step 3: public API 점검**

`src/index.ts:510-550` 의 export 가 새 타입(`'miss_no_trigger'` 가 포함된 union) 을 그대로 노출하는지 확인. 추가 export 가 필요하지 않으면 그대로 둔다. PUBLIC_API.md 인벤토리 갱신이 필요한지 확인 (시그니처 옵셔널 파라미터 추가는 보통 minor bump).

- [ ] **Step 4: 버전 bump**

`package.json` version `0.9.5` → `0.10.0` (옵셔널 파라미터 추가 = minor bump, semver).

- [ ] **Step 5: review-agent + git-agent 라우팅**

여기서 core 레포 작업이 끝난다. CLAUDE.md 규칙대로:
1. `review-agent` 호출 (영문 프롬프트). 변경 파일 목록 전달.
2. findings 처리 후 approved 면 `mistake-managing-agent`.
3. 마지막에 `git-agent` 호출 → core 레포에서 commit + PR 생성.

PR 머지 후 `npm publish` 또는 GitHub Packages 발행 절차에 따라 0.10.0 publish. (publish 명령은 core 레포의 README/release 워크플로우 확인.)

---

## Phase B — siglens 변경

> 작업 디렉토리: `/Users/y0ngha/Project/siglens`
> Phase A 의 0.10.0 publish 완료 후 시작.

### Task B1: `@y0ngha/siglens-core` 버전 업데이트

**Files:**
- Modify: `package.json:44`
- Modify: `yarn.lock` (자동 생성)

- [ ] **Step 1: 버전 수정**

`package.json:44` 의 `"@y0ngha/siglens-core": "0.9.5"` → `"@y0ngha/siglens-core": "0.10.0"`.

- [ ] **Step 2: 설치**

```bash
cd /Users/y0ngha/Project/siglens
yarn install
```

- [ ] **Step 3: 타입 확인**

```bash
yarn tsc --noEmit
```

Expected: 통과. (기존 호출부는 옵션을 사용하지 않으므로 깨질 일 없음.)

---

### Task B2: `lib/isBot.ts` 유틸 작성

**Files:**
- Create: `src/lib/isBot.ts`
- Create: `src/__tests__/lib/isBot.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/__tests__/lib/isBot.test.ts`:

```typescript
import { isBot } from '@/lib/isBot';

describe('isBot', () => {
  it('returns true for Googlebot UA', () => {
    const headers = new Headers({
      'user-agent':
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    });
    expect(isBot(headers)).toBe(true);
  });

  it('returns true for bingbot UA', () => {
    const headers = new Headers({
      'user-agent':
        'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    });
    expect(isBot(headers)).toBe(true);
  });

  it('returns false for a normal Chrome UA', () => {
    const headers = new Headers({
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    expect(isBot(headers)).toBe(false);
  });

  it('returns false for empty headers', () => {
    const headers = new Headers();
    expect(isBot(headers)).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
yarn test src/__tests__/lib/isBot.test.ts
```

Expected: 모듈 없음으로 실패.

- [ ] **Step 3: 구현**

`src/lib/isBot.ts`:

```typescript
import { userAgent } from 'next/server';

/**
 * Determines whether the incoming request is a bot/crawler.
 *
 * Uses Next.js' official `userAgent` helper, which Vercel maintains and
 * updates with each Next release. Wrapped to keep call sites simple and
 * to allow swapping the underlying detection later if needed.
 */
export function isBot(headers: Headers): boolean {
  const ua = userAgent({ headers });
  return Boolean(ua.isBot);
}
```

- [ ] **Step 4: 통과 확인**

```bash
yarn test src/__tests__/lib/isBot.test.ts
```

Expected: 4개 PASS.

---

### Task B3: `BotBlockedNotice` 공통 컴포넌트

**Files:**
- Create: `src/components/symbol-page/BotBlockedNotice.tsx`
- Create: `src/__tests__/components/symbol-page/BotBlockedNotice.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

`src/__tests__/components/symbol-page/BotBlockedNotice.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { BotBlockedNotice } from '@/components/symbol-page/BotBlockedNotice';

describe('BotBlockedNotice', () => {
  it('renders the bot-blocked message', () => {
    render(<BotBlockedNotice />);
    expect(
      screen.getByText(/자동화된 접근으로 판정되어/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/다른 브라우저로 접속하시거나 문의/),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
yarn test src/__tests__/components/symbol-page/BotBlockedNotice.test.tsx
```

- [ ] **Step 3: 구현**

`src/components/symbol-page/BotBlockedNotice.tsx`:

```typescript
import { cn } from '@/lib/cn';

interface BotBlockedNoticeProps {
  className?: string;
}

export function BotBlockedNotice({ className }: BotBlockedNoticeProps) {
  return (
    <div
      role="status"
      className={cn(
        'rounded-md border border-ui-muted bg-ui-subtle p-4 text-sm text-ui-muted-foreground',
        className,
      )}
    >
      <p className="font-medium">
        자동화된 접근으로 판정되어 분석 결과를 표시하지 않습니다.
      </p>
      <p className="mt-1">
        실제 사용자라면 다른 브라우저로 접속하시거나 문의해 주세요.
      </p>
    </div>
  );
}
```

Tailwind 토큰(`border-ui-muted`, `bg-ui-subtle` 등)은 프로젝트 디자인 시스템에 실제 정의된 토큰으로 교체. `docs/DESIGN.md` 또는 기존 fallback 컴포넌트(`FundamentalAiSummaryError.tsx`, `NewsAiSummaryError.tsx`) 의 토큰 사용 패턴 그대로 따른다.

- [ ] **Step 4: 통과 확인**

```bash
yarn test src/__tests__/components/symbol-page/BotBlockedNotice.test.tsx
```

---

### Task B4: Chart 분석 — Action 게이트 + 훅 + UI

**Files:**
- Modify: `src/infrastructure/market/submitAnalysisAction.ts:23-71`
- Modify: `src/components/symbol-page/hooks/useAnalysis.ts`
- Modify: `src/components/symbol-page/ChartContent.tsx:40-82`

- [ ] **Step 1: Server Action 에 isBot 게이트 추가**

`src/infrastructure/market/submitAnalysisAction.ts` 변경:

```typescript
'use server';

import { headers } from 'next/headers';
import { submitAnalysis } from '@y0ngha/siglens-core';
import { isBot } from '@/lib/isBot';
// ... 기존 import

export async function submitAnalysisAction(
  symbol: string,
  companyName: string,
  timeframe: Timeframe,
  force?: boolean,
  fmpSymbol?: string,
  modelId?: string,
): Promise<SubmitAnalysisActionResult> {
  const h = await headers();
  const bot = isBot(h);

  // ... 기존 setup 로직 (factories, cache provider 등)

  const result = await submitAnalysis({
    symbol,
    companyName,
    timeframe,
    force,
    fmpSymbol,
    modelId,
    skipEnqueueIfMiss: bot, // ← 추가
    // ... 기존 옵션
  });

  return result;
}
```

`SubmitAnalysisActionResult` 가 core 의 `SubmitAnalysisGatedResult` 를 그대로 노출하면 `'miss_no_trigger'` 가 자동 전파됨. siglens 측에서 별도 type alias 로 감싸고 있다면 그 alias 에도 케이스 추가.

- [ ] **Step 2: 훅 분기 추가**

`src/components/symbol-page/hooks/useAnalysis.ts` 의 status 처리 위치(submit 후 응답 처리 분기 — 기존 cached/submitted/error 분기 옆) 에 추가:

```typescript
if (submitData.status === 'miss_no_trigger') {
  setState({ phase: 'bot_blocked' });
  return;
}
```

훅이 노출하는 상태 타입에 `'bot_blocked'` 추가. 기존 polling 로직은 건드리지 않는다.

- [ ] **Step 3: ChartContent UI 분기**

`src/components/symbol-page/ChartContent.tsx:40-82` 의 status 분기에 추가:

```tsx
import { BotBlockedNotice } from '@/components/symbol-page/BotBlockedNotice';

// ... 기존 렌더 로직
if (analysisState.phase === 'bot_blocked') {
  return <BotBlockedNotice />;
}
```

기존 `AnalysisStatusBanner` / `ErrorBanner` 와 동일 위치에 분기 배치.

- [ ] **Step 4: 빌드·타입 체크**

```bash
yarn tsc --noEmit
yarn lint
```

Expected: 통과.

- [ ] **Step 5: 통합 테스트 (가능한 경우)**

`submitAnalysisAction` 의 기존 테스트가 있다면(없을 가능성도 있음), 봇 헤더 케이스 추가. `next/headers` mock 패턴은 프로젝트 내 다른 Server Action 테스트가 있으면 그 패턴 따름. 없으면 본 task 에서 새로 만들지 않고 isBot 유닛 + core 의 옵션 테스트로 커버 가정.

---

### Task B5: Fundamental 분석 — Action 게이트 + 훅 + UI

**Files:**
- Modify: `src/infrastructure/market/submitFundamentalAnalysisAction.ts:23-53`
- Modify: `src/components/fundamental/hooks/useFundamentalAnalysis.ts:28-69`
- Modify: `src/components/fundamental/FundamentalAiSummary.tsx`

- [ ] **Step 1: Server Action 게이트**

`src/infrastructure/market/submitFundamentalAnalysisAction.ts`:

```typescript
'use server';

import { headers } from 'next/headers';
import { submitFundamentalAnalysis } from '@y0ngha/siglens-core';
import { isBot } from '@/lib/isBot';

export async function submitFundamentalAnalysisAction(
  symbol: string,
  modelId: string,
): Promise<SubmitFundamentalAnalysisActionResult> {
  const h = await headers();
  const bot = isBot(h);

  const result = await submitFundamentalAnalysis({
    symbol,
    modelId,
    skipEnqueueIfMiss: bot,
  });

  return result;
}
```

- [ ] **Step 2: 훅 분기**

`src/components/fundamental/hooks/useFundamentalAnalysis.ts:36-50` 의 status 분기 옆에:

```typescript
if (data.status === 'miss_no_trigger') {
  setState({ kind: 'bot_blocked' });
  return;
}
```

훅이 노출하는 state union 에 `{ kind: 'bot_blocked' }` 추가.

- [ ] **Step 3: UI 분기**

`src/components/fundamental/FundamentalAiSummary.tsx` 에서 훅의 `kind === 'bot_blocked'` 케이스 처리:

```tsx
import { BotBlockedNotice } from '@/components/symbol-page/BotBlockedNotice';

// 기존 error fallback 옆에 분기
if (state.kind === 'bot_blocked') {
  return <BotBlockedNotice />;
}
```

기존 `FundamentalAiSummaryError` 의 위치 패턴 그대로 따른다.

- [ ] **Step 4: 타입 체크·린트**

```bash
yarn tsc --noEmit
yarn lint
```

---

### Task B6: News 분석 — Action 게이트 + 훅 + UI

**Files:**
- Modify: `src/infrastructure/market/submitNewsAnalysisAction.ts:31-73`
- Modify: `src/components/news/hooks/useNewsAnalysis.ts:25-76`
- Modify: `src/components/news/NewsAiSummary.tsx`

- [ ] **Step 1: Server Action 게이트**

`src/infrastructure/market/submitNewsAnalysisAction.ts`:

```typescript
'use server';

import { headers } from 'next/headers';
import { submitNewsAnalysis } from '@y0ngha/siglens-core';
import { isBot } from '@/lib/isBot';

export async function submitNewsAnalysisAction(
  symbol: string,
  companyName: string,
  modelId: string,
): Promise<SubmitNewsAnalysisActionResult> {
  const h = await headers();
  const bot = isBot(h);

  const result = await submitNewsAnalysis({
    symbol,
    companyName,
    modelId,
    skipEnqueueIfMiss: bot,
  });

  return result;
}
```

- [ ] **Step 2: 훅 분기**

`src/components/news/hooks/useNewsAnalysis.ts:39-54` 의 status 분기 옆에:

```typescript
if (data.status === 'miss_no_trigger') {
  setState({ kind: 'bot_blocked' });
  return;
}
```

훅 노출 union 에 `{ kind: 'bot_blocked' }` 추가.

- [ ] **Step 3: UI 분기**

`src/components/news/NewsAiSummary.tsx`:

```tsx
import { BotBlockedNotice } from '@/components/symbol-page/BotBlockedNotice';

if (state.kind === 'bot_blocked') {
  return <BotBlockedNotice />;
}
```

기존 `NewsAiSummaryError` 옆에 분기 배치.

- [ ] **Step 4: 타입 체크·린트**

```bash
yarn tsc --noEmit
yarn lint
```

---

### Task B7: Overall 분석 — Action 게이트 + 훅 + UI

> Overall 훅은 복잡한 상태머신(`idle/pending_dependencies/submitting/polling/done/error`). `bot_blocked` 도 동일 union 에 새 status 로 추가.

**Files:**
- Modify: `src/infrastructure/market/submitOverallAnalysisAction.ts:33-79`
- Modify: `src/components/overall/hooks/useOverallAnalysis.ts`
- Modify: `src/components/overall/OverallContent.tsx:30-80`

- [ ] **Step 1: Server Action 게이트**

`src/infrastructure/market/submitOverallAnalysisAction.ts`:

```typescript
'use server';

import { headers } from 'next/headers';
import { submitOverallAnalysis } from '@y0ngha/siglens-core';
import { isBot } from '@/lib/isBot';

export async function submitOverallAnalysisAction(
  symbol: string,
  companyName: string,
  timeframe: Timeframe,
  modelId: string,
): Promise<SubmitOverallAnalysisActionResult> {
  const h = await headers();
  const bot = isBot(h);

  const result = await submitOverallAnalysis({
    symbol,
    companyName,
    timeframe,
    modelId,
    skipEnqueueIfMiss: bot,
  });

  return result;
}
```

- [ ] **Step 2: 훅 분기**

`useOverallAnalysis.ts` 의 status union 에 `'bot_blocked'` 추가. submit 응답을 받는 분기에서:

```typescript
if (data.status === 'miss_no_trigger') {
  setState({ status: 'bot_blocked' });
  return;
}
```

`pending_dependencies` 처리보다 먼저 검사. 봇은 dependency 상태와 무관하게 즉시 bot_blocked.

- [ ] **Step 3: UI 분기**

`src/components/overall/OverallContent.tsx:30-80` 의 status switch 에 케이스 추가:

```tsx
import { BotBlockedNotice } from '@/components/symbol-page/BotBlockedNotice';

// state.status === 'bot_blocked' 케이스
if (state.status === 'bot_blocked') {
  return <BotBlockedNotice />;
}
```

기존 error 케이스와 동일 패턴.

- [ ] **Step 4: 타입 체크·린트**

```bash
yarn tsc --noEmit
yarn lint
```

---

### Task B8: 전체 검증 + 라우팅

- [ ] **Step 1: 전체 테스트·빌드**

```bash
cd /Users/y0ngha/Project/siglens
yarn lint
yarn tsc --noEmit
yarn test
yarn build
```

Expected: 모두 통과, 회귀 없음.

- [ ] **Step 2: 수동 검증 (로컬 dev 서버)**

```bash
yarn dev
```

검증 항목:
- 일반 브라우저로 `/AAPL` 접속 → 4개 탭 모두 평소대로 분석 트리거되거나 캐시 hit 표시.
- `curl -A "Googlebot/2.1" http://localhost:4200/AAPL` 로 봇 시뮬레이션 후 페이지 HTML 에 BotBlockedNotice 마크업 포함 확인 (Server Action 은 클라이언트 호출이지만 적어도 캐시 히트 케이스는 RSC 단에서 검증 가능). 필요하면 브라우저 devtools 의 "Network conditions → User agent" 로 직접 Googlebot UA 설정 후 재방문.
- 캐시가 비어있는 종목 + 봇 UA → fallback notice 표시.
- 캐시가 있는 종목 + 봇 UA → 평소 분석 결과 표시.

- [ ] **Step 3: review-agent 라우팅**

수정 파일 목록을 정리해 영문 프롬프트로 `review-agent` 호출. previous round findings 없음(round 1).

findings 처리는 CLAUDE.md 규칙대로 — required + recommended 모두 직접 수정, 회귀 발견 시 사용자에게 먼저 보고.

- [ ] **Step 4: mistake-managing-agent 라우팅**

`review-agent` approved 후 호출.

- [ ] **Step 5: git-agent 라우팅**

마지막 단계. siglens 측 PR 생성.

---

## 자체 점검 (plan 작성자용)

- ✅ Spec §2 목표 4개 모두 plan 안에 task 로 존재 (트리거 차단=Action 게이트, 캐시 hit 노출=core 옵션, fallback=BotBlockedNotice, 안내 문구 실효성=수정된 메시지).
- ✅ Spec §4 결정사항 모두 매핑됨 (옵션 vs 별도 함수, isBot, 4개 트리거, 공통 컴포넌트, 안내 문구).
- ✅ Spec §5 변경 파일 모두 task 로 분해.
- ✅ Placeholder 없음. 모든 step 에 구체 코드 / 명령 / 경로.
- ✅ 타입 일관성: `skipEnqueueIfMiss` 이름·`'miss_no_trigger'` status·`bot_blocked` UI state 명칭 전 task 동일.
- ✅ Scope 적정: 두 레포지만 한 spec, 명확한 순서 (A → B).

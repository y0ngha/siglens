# [symbol] ISR+SEO — Phase 0+1 (인프라 + 차트 page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 차트 `/[symbol]`을 ISR로 정상 활성화하고(런타임 500/DYNAMIC_SERVER_USAGE 제거), bars 기반 FactLayer를 SSR HTML에 박아 SEO를 보존한다.

**Architecture:** ⓪ **(최우선 전제) root layout의 `cookies()`를 클라이언트로 이전** — `AuthSessionHeader`(서버, `cookies()`+DB)를 `AuthSessionHeaderClient`(`'use client'`)로 교체해, PPR-off 상태에서 root layout이 전 라우트를 dynamic으로 강제하던 ISR 차단을 제거한다(PoC로 확정된 1차 원인). ① 동적 데이터(bars/assetInfo/peek)를 `unstable_cache` 정적화 헬퍼로 감싸 ISR static-safe하게 한다(**접근 A — PoC 7로 확정**). ② FactLayer(`TechnicalFactsSummary`)를 `[symbol]/page.tsx`의 Suspense fallback으로 끌어올려 default-tf 정적화 bars로 **서버 SSR** → 크롤러가 보는 SEO 텍스트가 되고, hydrate 시 인터랙티브 ChartContent로 교체된다(CSR bailout 우회).

**Tech Stack:** Next.js 16.2.0(App Router, ISR, `unstable_cache`), TypeScript, vitest, @upstash/redis, @tanstack/react-query

**전제:** PR #545(`getAssetInfoResilient`) 머지됨(master). 본 plan은 **master 기반으로 rebase 후** 진행(`git switch feat/symbol-isr-seo && git rebase master`). `cacheComponents`(PPR)는 비활성 유지(이슈 #439).

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `docs/superpowers/plans/poc-results.md` | Task 1 PoC 실측 기록(축 0 발견 + A 확정) | Create(완료) |
| `src/entities/session/hooks/useAuthHint.ts` | hydration 후 hint 쿠키(non-httpOnly) 존재 여부 읽는 클라 훅 | Create |
| `src/entities/session/hooks/__tests__/useAuthHint.test.ts` | useAuthHint 유닛 테스트 | Create |
| `src/app/_components/AuthSessionHeaderClient.tsx` | root layout 헤더를 클라에서 렌더(cookies 제거) | Create |
| `src/app/_components/__tests__/AuthSessionHeaderClient.test.tsx` | 헤더 클라 분기 테스트(Happy/Worst) | Create |
| `src/app/_components/AuthSessionHeader.tsx` | 서버 헤더(cookies()) — 제거 | Delete |
| `src/app/_components/__tests__/AuthSessionHeader.test.tsx` | 서버 헤더 테스트 — 제거 | Delete |
| `src/app/layout.tsx` | `AuthSessionHeader` → `AuthSessionHeaderClient`(Suspense 제거) | Modify |
| `src/entities/session/hooks/index.ts`(또는 barrel) | `useAuthHint` export | Modify |
| `src/entities/bars/lib/barsStaticCache.ts` | ISR static-safe bars 정적화 헬퍼(`getBarsStatic`) | Create |
| `src/entities/bars/__tests__/lib/barsStaticCache.test.ts` | 헬퍼 유닛 테스트 | Create |
| `src/app/[symbol]/page.tsx` | default-tf bars 정적화 + Suspense fallback을 FactLayer로 | Modify |
| `src/app/[symbol]/__tests__/page.factlayer.test.tsx` | FactLayer SSR integration 테스트 | Create |

---

## Task 1: bars 정적화 방식 PoC (실측 — spike) ✅ 완료

**결과(실측 확정):**

| PoC | 변경 | 결과 |
|---|---|---|
| 1 | `unstable_cache(getBarsAction)` (root layout 유지) | `ƒ` |
| 2 | `unstable_cache(순수 함수)` (root layout 유지) | `ƒ` |
| 3 | source-direct `fetch(next.revalidate)` (root layout 유지) | `ƒ` |
| 4 | 데이터 fetch 없는 빈 페이지 (root layout 유지) | `ƒ` — `/terms`(기존)도 `ƒ` |
| 5/6 | **root layout `cookies()` 제거** | `poc-isr`/`privacy`/`terms` 전부 `○`(ISR) |
| 7 | cookies 제거 + redis bars `unstable_cache` | `○` + `DYNAMIC_SERVER_USAGE` 0 |

**결론:**
- **축 0 발견**: root layout `cookies()`(AuthSessionHeader)가 1차 ISR 차단 원인. PPR-off에선 Suspense 안의 `cookies()`도 전 라우트를 dynamic으로 강제. → **Task 2(클라이언트화)** 로 제거.
- **접근 A 확정**: 축 0 선결 시 `unstable_cache`가 redis no-store fetch를 ISR static-safe하게 만든다(PoC 7). → Task 3 이후 헬퍼는 `unstable_cache` 기반. 대안 B(source-direct) 불필요.
- PoC 디렉터리(`poc-isr`)/임시 코드 정리 완료.

> 결과는 `docs/superpowers/plans/poc-results.md`에 기록됨. 이 Task는 재실행 불필요.

---

## Task 2: AuthSessionHeader 클라이언트화 (축 0 — ISR 차단 해제) ⭐

**목적:** root layout 렌더 트리에서 `cookies()`를 제거해 전 라우트를 static-eligible로 만든다. **모든 후속 Task의 전제.** 기존 `currentUserAction`(server action) + `useCurrentUser`(훅)를 재사용한다.

**Files:**
- Create: `src/entities/session/hooks/useAuthHint.ts`, `src/entities/session/hooks/__tests__/useAuthHint.test.ts`
- Create: `src/app/_components/AuthSessionHeaderClient.tsx`, `src/app/_components/__tests__/AuthSessionHeaderClient.test.tsx`
- Modify: `src/app/layout.tsx`, session hooks barrel(`src/entities/session/index.ts`)
- Delete: `src/app/_components/AuthSessionHeader.tsx`, `src/app/_components/__tests__/AuthSessionHeader.test.tsx`

- [ ] **Step 1: useAuthHint 실패 테스트 작성**

`src/entities/session/hooks/__tests__/useAuthHint.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useAuthHint } from '@/entities/session/hooks/useAuthHint';
import { AUTH_HINT_COOKIE_NAME } from '@/shared/config/cookieNames';

function clearCookies() {
    for (const c of document.cookie.split('; ')) {
        const name = c.split('=')[0];
        if (name) document.cookie = `${name}=; max-age=0; path=/`;
    }
}

afterEach(() => {
    cleanup();
    clearCookies();
});

describe('useAuthHint', () => {
    it('hydration 전(초기 render)에는 항상 false (SSR 셸 일관성)', () => {
        document.cookie = `${AUTH_HINT_COOKIE_NAME}=1; path=/`;
        const { result } = renderHook(() => useAuthHint());
        // 초기 동기 render에서는 useHydrated=false → false
        expect(result.current).toBe(false);
    });

    it('hydration 후 hint 쿠키 값이 있으면 true', async () => {
        document.cookie = `${AUTH_HINT_COOKIE_NAME}=1; path=/`;
        const { result } = renderHook(() => useAuthHint());
        await act(async () => {}); // effect flush → hydrated
        expect(result.current).toBe(true);
    });

    it('hydration 후 hint 쿠키 없으면 false', async () => {
        const { result } = renderHook(() => useAuthHint());
        await act(async () => {});
        expect(result.current).toBe(false);
    });

    it('hint 쿠키가 빈 값(siglens_auth=)이면 false (로그아웃으로 clear된 경우)', async () => {
        document.cookie = `${AUTH_HINT_COOKIE_NAME}=; path=/`;
        const { result } = renderHook(() => useAuthHint());
        await act(async () => {});
        expect(result.current).toBe(false);
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/entities/session/hooks/__tests__/useAuthHint.test.ts`
Expected: FAIL — `useAuthHint` 모듈 없음.

- [ ] **Step 3: useAuthHint 구현**

`src/entities/session/hooks/useAuthHint.ts`:
```ts
'use client';

import { useHydrated } from '@/shared/hooks/useHydrated';
import { AUTH_HINT_COOKIE_NAME } from '@/shared/config/cookieNames';

/**
 * hydration 이후 `document.cookie`에서 hint 쿠키(`siglens_auth`, non-httpOnly) 존재
 * 여부를 읽는다. SSR/첫 render에선 false를 반환해 정적 셸이 모든 방문자에게 동일하게
 * 캐시되도록 한다(hydration mismatch 방지). 값이 비어 있으면(로그아웃 clear) false.
 *
 * 실제 인증이 아니라 hydration 동안의 낙관적 skeleton 추정에만 쓰인다 — 진짜 상태는
 * useCurrentUser(currentUserAction → httpOnly 세션 + DB)가 확정한다.
 */
export function useAuthHint(): boolean {
    const isHydrated = useHydrated();
    if (!isHydrated) return false;
    const prefix = `${AUTH_HINT_COOKIE_NAME}=`;
    const entry = document.cookie
        .split('; ')
        .find(c => c.startsWith(prefix));
    return !!entry && entry.slice(prefix.length).length > 0;
}
```

- [ ] **Step 4: useAuthHint 테스트 통과 + barrel export**

`src/entities/session/index.ts`의 `useCurrentUser` export 옆에 추가:
```ts
export { useAuthHint } from './hooks/useAuthHint';
```
Run: `yarn test src/entities/session/hooks/__tests__/useAuthHint.test.ts`
Expected: PASS (4).

- [ ] **Step 5: AuthSessionHeaderClient 실패 테스트 작성**

`src/app/_components/__tests__/AuthSessionHeaderClient.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { AuthUserRecord } from '@/shared/lib/auth/types';

// Header(presentational)를 스파이로 대체해 전달 props를 검증한다.
const headerSpy = vi.fn();
vi.mock('@/widgets/layout/Header', () => ({
    Header: (props: unknown) => {
        headerSpy(props);
        return null;
    },
}));
vi.mock('@/entities/session', () => ({
    useCurrentUser: vi.fn(),
    useAuthHint: vi.fn(),
}));

import { AuthSessionHeaderClient } from '@/app/_components/AuthSessionHeaderClient';
import { useCurrentUser, useAuthHint } from '@/entities/session';

const mockCurrentUser = vi.mocked(useCurrentUser);
const mockAuthHint = vi.mocked(useAuthHint);

const user: AuthUserRecord = {
    id: 'u1',
    email: 'a@b.com',
    name: 'Alice',
    avatarUrl: null,
    tier: 'member',
    emailVerified: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
};

function lastHeaderProps() {
    return headerSpy.mock.calls.at(-1)?.[0] as {
        currentUser: unknown;
        loadingUserMenu?: boolean;
    };
}

describe('AuthSessionHeaderClient', () => {
    beforeEach(() => {
        headerSpy.mockClear();
        mockCurrentUser.mockReset();
        mockAuthHint.mockReset();
    });

    it('Happy: 로그인 사용자 → Header에 currentUser 전달', () => {
        mockAuthHint.mockReturnValue(true);
        mockCurrentUser.mockReturnValue({
            data: user,
            isPending: false,
        } as never);
        render(<AuthSessionHeaderClient />);
        expect(lastHeaderProps().currentUser).toMatchObject({
            email: 'a@b.com',
            tier: 'member',
        });
    });

    it('Happy: 게스트(쿼리 resolved null, hint 없음) → currentUser=null', () => {
        mockAuthHint.mockReturnValue(false);
        mockCurrentUser.mockReturnValue({
            data: null,
            isPending: false,
        } as never);
        render(<AuthSessionHeaderClient />);
        expect(lastHeaderProps().currentUser).toBeNull();
    });

    it('pending + hint 있음 → loadingUserMenu skeleton 추정', () => {
        mockAuthHint.mockReturnValue(true);
        mockCurrentUser.mockReturnValue({
            data: undefined,
            isPending: true,
        } as never);
        render(<AuthSessionHeaderClient />);
        expect(lastHeaderProps()).toMatchObject({
            currentUser: null,
            loadingUserMenu: true,
        });
    });

    it('Worst: hint 있지만 세션 만료(resolved null) → 게스트로 정정(권한 노출 없음)', () => {
        mockAuthHint.mockReturnValue(true);
        mockCurrentUser.mockReturnValue({
            data: null,
            isPending: false,
        } as never);
        render(<AuthSessionHeaderClient />);
        expect(lastHeaderProps().currentUser).toBeNull();
    });
});
```

- [ ] **Step 6: 테스트 실패 확인**

Run: `yarn test src/app/_components/__tests__/AuthSessionHeaderClient.test.tsx`
Expected: FAIL — `AuthSessionHeaderClient` 모듈 없음.

- [ ] **Step 7: AuthSessionHeaderClient 구현**

`src/app/_components/AuthSessionHeaderClient.tsx`:
```tsx
'use client';

import { Header } from '@/widgets/layout/Header';
import type { HeaderUserMenuUser } from '@/widgets/layout/HeaderUserMenu';
import { useCurrentUser, useAuthHint } from '@/entities/session';

/**
 * Root layout 헤더를 클라이언트에서 렌더한다.
 *
 * 서버 컴포넌트가 cookies()를 호출하면 (cacheComponents/PPR 비활성 상태에서)
 * Suspense 경계 안이라도 전 라우트가 dynamic으로 강제돼 ISR이 깨진다. 그래서
 * 인증 상태 조회를 클라이언트로 이전했다 — root layout 정적 셸에는 dynamic API가
 * 남지 않으므로 모든 라우트가 정적 캐시(ISR) 가능해진다.
 *
 * - hint 쿠키(siglens_auth='1', non-httpOnly)를 useAuthHint(document.cookie)로 읽어
 *   hydration 동안 낙관적 skeleton(loadingUserMenu)을 추정한다.
 * - 실제 auth 상태는 useCurrentUser()(currentUserAction → httpOnly 세션 + DB)가
 *   마운트 후 확정한다. cookies()는 클라가 트리거하는 server action 안에서만 실행되며
 *   static render 트리에는 없다.
 *
 * 보안: hint 쿠키는 값이 '1' 플래그뿐(PII 없음)이고 이미 non-httpOnly다. 권한 판단은
 * 전적으로 httpOnly 세션 + DB로만 이뤄지므로 클라가 hint를 읽어도 표면이 넓어지지 않는다.
 */
export function AuthSessionHeaderClient() {
    const hasHint = useAuthHint();
    const { data: user, isPending } = useCurrentUser();

    if (isPending) {
        // server action 확정 전: hint로 skeleton(로그인 추정) 또는 게스트 셸.
        return <Header currentUser={null} loadingUserMenu={hasHint} />;
    }

    const currentUser: HeaderUserMenuUser | null = user
        ? {
              email: user.email,
              name: user.name,
              tier: user.tier,
              avatarUrl: user.avatarUrl,
          }
        : null;
    return <Header currentUser={currentUser} />;
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `yarn test src/app/_components/__tests__/AuthSessionHeaderClient.test.tsx`
Expected: PASS (4).

- [ ] **Step 9: root layout 교체 + 기존 서버 헤더 제거**

`src/app/layout.tsx`:
- import 교체: `import { AuthSessionHeader } from '@/app/_components/AuthSessionHeader';` → `import { AuthSessionHeaderClient } from '@/app/_components/AuthSessionHeaderClient';`
- `Suspense` import가 layout에서 다른 곳(SiteJsonLd 등)에 안 쓰이면 제거. (line 56 floating chat은 [symbol]/layout이라 무관 — root layout의 Suspense 사용처만 확인.)
- 헤더 블록 교체:
```tsx
                    {/* 인증 헤더는 클라이언트에서 렌더된다(cookies()를 static render
                        트리에서 제거 → 전 라우트 ISR 가능). 상세는 AuthSessionHeaderClient JSDoc. */}
                    <AuthSessionHeaderClient />
```
(기존 `<Suspense fallback={<Header currentUser={null} loadingUserMenu />}><AuthSessionHeader /></Suspense>` 블록 전체를 위로 대체.)

그리고 제거:
```bash
git rm "src/app/_components/AuthSessionHeader.tsx" "src/app/_components/__tests__/AuthSessionHeader.test.tsx"
```

- [ ] **Step 10: typecheck + 빌드 실측 (축 0 검증 — 핵심)**

Run:
```bash
yarn typecheck 2>&1 | tail -5   # 0 errors
rm -rf .next && yarn build > /tmp/t2_build.log 2>&1; echo "BUILD=$?"
grep -E "Route \(app\)|○|●|ƒ" /tmp/t2_build.log | grep -E "/terms|/privacy|/\[symbol\]" 
```
Expected: `BUILD=0`. **정적 라우트(`/terms`, `/privacy`)가 `ƒ`가 아니라 `○`/정적**으로 표시 = root layout이 더 이상 전 라우트를 dynamic으로 강제하지 않음. (`[symbol]`은 Task 5까지 완료돼야 `●`가 됨 — 이 단계에선 데이터 정적화 미적용이라 아직 `ƒ`일 수 있음. 핵심은 **layout이 무고한 정적 페이지를 dynamic으로 만들지 않는 것**.)

- [ ] **Step 11: 커밋**
```bash
git add -A
git commit -m "feat(auth): client-side AuthSessionHeader — remove root layout cookies() to unblock ISR (axis 0)"
```

---

## Task 3: bars 정적화 헬퍼 `getBarsStatic` (TDD)

**Files:**
- Create: `src/entities/bars/lib/barsStaticCache.ts`
- Test: `src/entities/bars/__tests__/lib/barsStaticCache.test.ts`

> 접근 A(`unstable_cache`)는 PoC 7로 확정됨. 시그니처(`getBarsStatic(symbol, timeframe, fmpSymbol?): Promise<BarsData>`)를 유지해 호출부를 내부 구현에 무관하게 한다.

- [ ] **Step 1: 실패 테스트 작성**

`src/entities/bars/__tests__/lib/barsStaticCache.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BarsData } from '@y0ngha/siglens-core';

vi.mock('next/cache', () => ({
    unstable_cache: (fn: (...a: unknown[]) => unknown) => fn, // identity로 통과 검증
}));
vi.mock('@/entities/bars/actions', () => ({
    getBarsAction: vi.fn(),
}));

import { getBarsStatic } from '@/entities/bars/lib/barsStaticCache';
import { getBarsAction } from '@/entities/bars/actions';

const mockBars = vi.mocked(getBarsAction);

describe('getBarsStatic', () => {
    beforeEach(() => vi.clearAllMocks());

    it('delegates to getBarsAction with the same args and returns its data', async () => {
        const data = { bars: [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 }], indicators: {} } as unknown as BarsData;
        mockBars.mockResolvedValue(data);

        const result = await getBarsStatic('AAPL', '1Day', 'AAPL');

        expect(result).toBe(data);
        expect(mockBars).toHaveBeenCalledWith('AAPL', '1Day', 'AAPL');
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/entities/bars/__tests__/lib/barsStaticCache.test.ts`
Expected: FAIL — `getBarsStatic` 모듈 없음.

- [ ] **Step 3: 헬퍼 구현 (A: unstable_cache)**

`src/entities/bars/lib/barsStaticCache.ts`:
```ts
import { unstable_cache } from 'next/cache';
import type { BarsData, Timeframe } from '@y0ngha/siglens-core';
import { getBarsAction } from '@/entities/bars/actions';

/**
 * ISR static-safe bars fetch. `getBarsAction`(redis getOrSetCache + FMP)을 Next data
 * cache로 감싸 static generate가 no-store fetch에 막히지 않게 한다. 종목당 캐시이며
 * revalidate=1h로 주기 갱신한다. 호출부는 본 함수만 쓴다.
 *
 * 전제: 이 정적화는 root layout cookies() 제거(축 0)가 선결돼야 효과가 있다 — PoC에서
 * layout이 전 라우트를 dynamic으로 강제하면 unstable_cache 래핑도 무력했다(PoC 1 vs 7).
 */
export function getBarsStatic(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    return unstable_cache(
        () => getBarsAction(symbol, timeframe, fmpSymbol),
        ['bars-static', symbol, timeframe, fmpSymbol ?? ''],
        { revalidate: 3600, tags: [`symbol:${symbol}`] }
    )();
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/entities/bars/__tests__/lib/barsStaticCache.test.ts`
Expected: PASS (1).

- [ ] **Step 5: 커밋**
```bash
git add src/entities/bars/lib/barsStaticCache.ts src/entities/bars/__tests__/lib/barsStaticCache.test.ts
git commit -m "feat(bars): add getBarsStatic — ISR static-safe bars cache"
```

---

## Task 4: FactLayer를 Suspense fallback으로 SSR (차트 page)

**Files:**
- Modify: `src/app/[symbol]/page.tsx`

- [ ] **Step 1: default-tf bars 정적화 fetch 추가**

`page.tsx` body에서 `assetInfo` 확보 직후, default-tf bars를 정적화로 가져온다:
```ts
import { getBarsStatic } from '@/entities/bars/lib/barsStaticCache';
// ... assetInfo 확보(notFound 가드 통과) 후:
const factBars = await getBarsStatic(
    upper,
    DEFAULT_TIMEFRAME,
    assetInfo.fmpSymbol
).catch((e: unknown) => {
    console.error('[SymbolPage] getBarsStatic failed:', e);
    return null;
});
```
> 변수명은 page.tsx의 ticker 변수(현재 `upper`)에 맞춘다. `DEFAULT_TIMEFRAME`은 `@/shared/config/market`에서 import(이미 사용 중인지 확인 후 없으면 추가).

- [ ] **Step 2: Suspense fallback을 FactLayer로 교체**

기존 fallback(`aria-hidden` 빈 div)을, bars가 있으면 FactLayer로 교체한다. `TechnicalFactsSummary`는 서버 렌더 가능한 prop 컴포넌트다.
```tsx
import { TechnicalFactsSummary } from '@/widgets/symbol-page/TechnicalFactsSummary';
// ... Suspense:
<Suspense
    fallback={
        factBars && factBars.bars.length > 0 ? (
            <TechnicalFactsSummary
                symbol={upper}
                bars={factBars.bars}
                indicators={factBars.indicators}
            />
        ) : (
            <div
                className="bg-secondary-900 flex min-h-0 flex-1 flex-col overflow-hidden"
                aria-hidden="true"
            />
        )
    }
>
    <SymbolPageClient ... />
</Suspense>
```
> 크롤러(JS 미실행)는 fallback의 FactLayer 텍스트를 SSR HTML로 받는다. 사용자는 hydrate 시 인터랙티브 `SymbolPageClient`로 교체된다(default-tf FactLayer는 cold-miss fallback이므로 default-tf로 충분).

- [ ] **Step 3: typecheck + build**

Run: `yarn typecheck 2>&1 | tail -5` → 0 errors.
Run: `rm -rf .next && yarn build > /tmp/t4_build.log 2>&1; echo "BUILD=$?"` → `BUILD=0`.

- [ ] **Step 4: 커밋**
```bash
git add "src/app/[symbol]/page.tsx"
git commit -m "feat([symbol]): SSR FactLayer via Suspense fallback (default-tf static bars)"
```

---

## Task 5: assetInfo/peek/skillCounts 정적화 + ISR 무충돌화

**Files:**
- Modify: `src/app/[symbol]/page.tsx`, `src/app/[symbol]/layout.tsx`
- Create(필요 시): `src/entities/ticker/lib/getAssetInfoStatic.ts`(+test), peek 정적화 래퍼(+test)

- [ ] **Step 1: 남은 동적 호출을 정적화 경로로 통일**

`page.tsx`/`layout.tsx`의 동적 호출을 ISR static-safe하게 정리한다:
- bars prefetch queryFn: `getBarsAction` → `getBarsStatic`(Task 3)로 교체(layout·page 양쪽).
- `peekAnalysisCache`(redis): `unstable_cache` 래퍼(`getPeekStatic`, 시그니처 동일)로 정적화하거나 기존 `.catch(() => null)` degrade 유지. ISR static에서 redis throw가 페이지를 깨지 않도록 **정적화 또는 안전 degrade 보장**.
- **`getAssetInfoResilient` 정적화 — 필수(선택 아님), inner를 감쌀 것.** ⚠️ 정적 분석으로 확정: `getAssetInfoResilient`는 catch에서 **`DYNAMIC_SERVER_USAGE`를 rethrow**하고 인프라 실패 시 `connection()`을 호출한다(`getAssetInfoResilient.ts:53`). 내부 redis(`getAssetInfo`)가 정적화 안 되면 static gen 중 redis no-store fetch가 `DYNAMIC_SERVER_USAGE`를 throw → resilient가 그대로 rethrow → **라우트가 dynamic으로 떨어진다.** 따라서:
  - clean한 inner **`getAssetInfo`(lib)를 `unstable_cache`로 감싼 `getAssetInfoStatic`**을 도입(`getAssetInfo` 체인엔 dynamic API 없음 — 정적 분석 확인).
  - `getAssetInfoResilient`가 `getAssetInfoCached`(=`cache(getAssetInfoAction)`) 대신 `getAssetInfoStatic`을 호출하도록 변경. **`connection()`(catch 내)은 `unstable_cache` 밖에 그대로 둔다**(인프라 실패 시 degrade 렌더만 동적화하는 의도된 escape — `unstable_cache` 안에서 `connection()`은 throw).
  - 이 변경은 **전역**이다: `getAssetInfoResilient`를 6라우트 본문 + `generateMetadata` + `[symbol]/layout.tsx` chrome 전부가 호출하므로, Phase 1에서 한 번 정적화하면 Phase 2 라우트가 자동으로 assetInfo static-safe가 된다.

> `countSkillFiles`는 `fs.readdir`(빌드 산출물)이라 dynamic data가 아니므로 정적화 불필요(static generate 허용).
> 새 정적화 래퍼(`getAssetInfoStatic`/`getPeekStatic`)는 각각 Task 3 패턴의 유닛 테스트를 동반한다(identity-mock으로 delegate 검증).
> **정적 분석 결과(구현 전 확인 완료)**: bars/news/fundamental/options(lib)/ticker(`getAssetInfo`) 체인에 `cookies()`/`headers()`/`connection()` 없음 → `unstable_cache` 래핑 안전. options의 cookies/headers는 `optionsActions.ts`(클라 트리거 액션, E2E seam)에만 있고 SSR이 쓰는 `optionsDataCache.ts`(lib)와 분리됨. `[symbol]` 트리 전체에서 본문 dynamic API는 news `headers()` 1곳뿐(Phase 2에서 제거).

- [ ] **Step 2: 빌드 + 런타임 실측 (핵심 검증)**

Run:
```bash
rm -rf .next && yarn build > /tmp/t5_build.log 2>&1; echo "BUILD=$?"
grep -E "/\[symbol\]" /tmp/t5_build.log     # ● (SSG) 기대
yarn start > /tmp/t5_start.log 2>&1 &
until grep -q "Ready in\|Local:.*3000" /tmp/t5_start.log; do sleep 1; done
echo "HTTP: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/AAPL)"
echo "DYNAMIC_SERVER_USAGE: $(grep -c DYNAMIC_SERVER_USAGE /tmp/t5_start.log)"
curl -s http://localhost:3000/AAPL | grep -c "기술적 지표 요약"
curl -sI http://localhost:3000/AAPL | grep -i x-nextjs-cache
pkill -f "next start"
```
Expected: `HTTP: 200`, `DYNAMIC_SERVER_USAGE: 0`, `기술적 지표 요약` ≥ 1 (FactLayer SSR), `x-nextjs-cache` 존재.

- [ ] **Step 3: canonical 회귀 가드 통과 확인**

Run: `yarn test src/app/[symbol]/__tests__/symbol-metadata.test.ts`
Expected: PASS (canonical에 `[SYMBOL]` placeholder 없음).

- [ ] **Step 4: 커밋**
```bash
git add "src/app/[symbol]/page.tsx" "src/app/[symbol]/layout.tsx" src/entities
git commit -m "feat([symbol]): static-safe assetInfo/peek/bars for ISR (no DYNAMIC_SERVER_USAGE)"
```

---

## Task 6: 테스트 — Happy + Worst Case + Integration

**Files:**
- Create: `src/app/[symbol]/__tests__/page.factlayer.test.tsx`

- [ ] **Step 1: FactLayer SSR integration 테스트 (Happy + Worst)**

`src/app/[symbol]/__tests__/page.factlayer.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import { TechnicalFactsSummary } from '@/widgets/symbol-page/TechnicalFactsSummary';

// getBarsStatic / getAssetInfoResilient / peek 등은 mock (RSC 단위 검증)
vi.mock('@/entities/bars/lib/barsStaticCache', () => ({ getBarsStatic: vi.fn() }));
// ... (page.test.ts의 기존 mock 세트 재사용 — assetInfo/skill/seo/query/navigation)

import { default as SymbolPage } from '@/app/[symbol]/page';
import { getBarsStatic } from '@/entities/bars/lib/barsStaticCache';

const mockBarsStatic = vi.mocked(getBarsStatic);

describe('SymbolPage FactLayer SSR', () => {
    beforeEach(() => vi.clearAllMocks());

    it('Happy: bars 있으면 Suspense fallback에 TechnicalFactsSummary(SSR)를 렌더한다', async () => {
        mockBarsStatic.mockResolvedValue({
            bars: [{ time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 }],
            indicators: {},
        } as never);

        const tree = await SymbolPage({ params: Promise.resolve({ symbol: 'aapl' }) });
        const fact = findElementByType(tree, TechnicalFactsSummary);

        expect(fact).not.toBeNull();
    });

    it('Worst: bars 빈 결과면 FactLayer 대신 빈 fallback (크래시 없음, 페이지 정상)', async () => {
        mockBarsStatic.mockResolvedValue({ bars: [], indicators: {} } as never);

        const tree = await SymbolPage({ params: Promise.resolve({ symbol: 'aapl' }) });
        const fact = findElementByType(tree, TechnicalFactsSummary);

        expect(fact).toBeNull();
    });

    it('Worst: getBarsStatic 실패(throw)해도 페이지가 깨지지 않는다(null degrade)', async () => {
        mockBarsStatic.mockRejectedValue(new Error('bars infra down'));

        await expect(
            SymbolPage({ params: Promise.resolve({ symbol: 'aapl' }) })
        ).resolves.toBeTruthy();
    });
});
```
> mock 세트는 기존 `src/app/[symbol]/__tests__/page.test.ts`(또는 동등 파일)의 import/mock 블록을 참조해 동일하게 맞춘다. 실제 mock 대상은 구현 시점의 page.tsx import에 맞춰 채운다.

- [ ] **Step 2: 테스트 실행**

Run: `yarn test src/app/[symbol]/__tests__/page.factlayer.test.tsx`
Expected: PASS (3).

- [ ] **Step 3: 변경 파일 커버리지 확인 (90%+)**

Run: `yarn test-coverage 2>&1 | grep -E "barsStaticCache|useAuthHint|AuthSessionHeaderClient|page.tsx"`
Expected: 각 변경 파일 Stmts/Branch 90%+ (미달 시 worst-case 테스트 보강).

- [ ] **Step 4: 전체 테스트 회귀 확인**

Run: `yarn test > /tmp/t6_test.log 2>&1; echo "EXIT=$?"; tail -4 /tmp/t6_test.log`
Expected: `EXIT=0`, 전부 통과.

- [ ] **Step 5: 커밋**
```bash
git add "src/app/[symbol]/__tests__/page.factlayer.test.tsx"
git commit -m "test([symbol]): FactLayer SSR happy/worst-case integration"
```

---

## Task 7: E2E + 최종 실측

**Files:** (검증 — E2E 스펙 추가는 Phase 2~에서 6라우트 공통으로. Phase 1은 차트 page 실측 + 기존 E2E가 회귀 없는지 확인.)

- [ ] **Step 1: 차트 page + 축 0 최종 실측 (필수 통과 조건)**

Run:
```bash
rm -rf .next && yarn build > /tmp/final_build.log 2>&1; echo "BUILD=$?"
grep -E "/terms|/privacy|/\[symbol\]" /tmp/final_build.log   # 정적/ISR 표기 확인(ƒ 아님)
yarn start > /tmp/final.log 2>&1 &
until grep -q "Ready in\|Local:.*3000" /tmp/final.log; do sleep 1; done
echo "AAPL: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/AAPL)"
echo "DSU: $(grep -c DYNAMIC_SERVER_USAGE /tmp/final.log)"
echo "FactLayer: $(curl -s http://localhost:3000/AAPL | grep -c '기술적 지표 요약')"
pkill -f "next start"
```
Expected: `BUILD=0`, `AAPL: 200`, `DSU: 0`, `FactLayer: ≥1`, 정적 라우트 `ƒ` 아님.

- [ ] **Step 2: 기존 E2E 회귀 확인 (차트 + 인증 헤더)**

Run: `yarn e2e > /tmp/t7_e2e.log 2>&1; echo "E2E=$?"; grep -E "[0-9]+ passed|[0-9]+ failed" /tmp/t7_e2e.log | tail -2`
Expected: 차트 page 관련 스펙 + 로그인/게스트 헤더 스펙이 이전보다 악화되지 않음(이상적으로 500/DYNAMIC_SERVER_USAGE 사라져 개선). 잔여 실패는 Phase 2~(나머지 라우트)에서 처리됨을 기록.

- [ ] **Step 3: 커밋(없음) — Phase 1 완료**

Phase 1은 축 0(헤더 클라이언트화) + 차트 page ISR + FactLayer SSR을 완성한다. Phase 2~4(overall→fear-greed→options→fundamental→news + SEO감사 + 문서화)는 본 plan에서 확립한 패턴(정적화 헬퍼 + Suspense-fallback FactLayer)을 각 라우트에 적용하는 **`docs/superpowers/plans/2026-06-02-symbol-isr-seo-phase2-4.md`** 로 진행한다. (축 0은 전역이라 Phase 2에서 재작업 불필요.)

---

## Self-Review (작성자 체크 결과)

- **Spec coverage:** 축 0(Task 2, 헤더 클라이언트화) ✓ / 정적화(Task 1 PoC→3,5) ✓ / FactLayer SSR 분리(Task 4) ✓ / ISR 무충돌·500제거(Task 5 실측) ✓ / SEO 무손상 canonical(Task 5 Step 3) ✓ / Happy+Worst(Task 2,6) ✓ / integration(Task 6) ✓ / 90% 커버리지(Task 6 Step 3) ✓ / 실측(Task 2·5·7) ✓ / E2E(Task 7) ✓.
- **Placeholder scan:** Task 5 Step 1의 정적화 래퍼는 "실측으로 추가 래핑 필요 여부 판단" 조건부지만, 판정 기준(`DYNAMIC_SERVER_USAGE` 0)과 패턴(Task 3 identity-mock 유닛 테스트 동반)을 명시했다. 그 외 placeholder 없음.
- **Type consistency:** `getBarsStatic(symbol, timeframe, fmpSymbol?): Promise<BarsData>` — Task 3 정의와 Task 4·5 호출부 일치. `useAuthHint(): boolean`, `AuthSessionHeaderClient`가 `useCurrentUser`/`useAuthHint`(Task 2 정의) 소비. `AuthUserRecord`(id/email/name/avatarUrl/tier/...) → `HeaderUserMenuUser`(email/name/tier/avatarUrl) 매핑 일치.
- **순서/전제:** Task 2(축 0)가 모든 ISR 검증의 선결 전제 — Task 2 없이 Task 5 실측이 통과하지 못한다(PoC 1~4). 그래서 Task 2를 정적화/FactLayer보다 앞에 배치했다.
- **리스크:** 접근 A는 PoC 7로 확정(불확실성 해소). 잔여 리스크는 Task 5의 peek/assetInfo가 추가 래핑을 요구하는지인데, Task 5 Step 2 실측(`DYNAMIC_SERVER_USAGE` 0)으로 게이트한다.
```

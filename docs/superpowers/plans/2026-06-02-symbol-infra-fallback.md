# [symbol] 인프라 실패 graceful fallback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [symbol] 라우트가 FMP 인프라 일시 실패(getAssetInfo throw) 시 깨지지 않고 ticker fallback으로 정상 렌더하게 하되, 그 degrade 응답은 ISR 캐시에서 제외한다.

**Architecture:** `getAssetInfoCached`를 감싸는 `getAssetInfoResilient` 헬퍼를 추가한다. 헬퍼는 throw(인프라 실패)를 catch해 `{symbol, name: ticker}` fallback을 반환하고 `connection()`으로 해당 렌더를 동적화(캐시 회피)한다. null(실재하지 않는 종목)은 그대로 통과시켜 호출부의 `notFound()`가 동작하게 한다. [symbol] 7개 파일의 `getAssetInfoCached` 호출을 이 헬퍼로 교체한다 — drop-in replacement이므로 각 라우트의 null 처리 로직은 그대로 둔다.

**Tech Stack:** Next.js 16.2.0 (App Router, ISR), TypeScript, vitest, FSD(entities/ticker)

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/entities/ticker/lib/getAssetInfoResilient.ts` | throw→fallback, null→통과, fallback 시 캐시 회피 | Create |
| `src/entities/ticker/__tests__/lib/getAssetInfoResilient.test.ts` | 헬퍼 유닛 테스트 | Create |
| `src/entities/ticker/index.ts` | barrel: `getAssetInfoCached` export를 `getAssetInfoResilient`로 교체 | Modify |
| `src/app/[symbol]/layout.tsx` | 호출 교체 | Modify |
| `src/app/[symbol]/page.tsx` | import + 호출 2곳 교체 | Modify |
| `src/app/[symbol]/news/page.tsx` | import + 호출 2곳 교체 | Modify |
| `src/app/[symbol]/fundamental/page.tsx` | import + 호출 2곳 교체 | Modify |
| `src/app/[symbol]/options/page.tsx` | import + 호출 2곳 교체 | Modify |
| `src/app/[symbol]/overall/page.tsx` | import + 호출 2곳 교체 | Modify |
| `src/app/[symbol]/fear-greed/page.tsx` | import + 호출 2곳 교체 | Modify |

---

## Task 1: `getAssetInfoResilient` 헬퍼 (TDD)

**Files:**
- Create: `src/entities/ticker/lib/getAssetInfoResilient.ts`
- Test: `src/entities/ticker/__tests__/lib/getAssetInfoResilient.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/entities/ticker/__tests__/lib/getAssetInfoResilient.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AssetInfo } from '@/shared/lib/types';

// `connection()`은 렌더를 동적화하는 Next 16 dynamic API — 유닛에서는 호출 여부만 검증한다.
vi.mock('next/server', () => ({
    connection: vi.fn().mockResolvedValue(undefined),
}));
// 헬퍼가 감싸는 캐시 함수를 mock해 정상/throw/null 세 경로를 직접 제어한다.
vi.mock('@/entities/ticker/lib/getAssetInfoCached', () => ({
    getAssetInfoCached: vi.fn(),
}));

import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { getAssetInfoCached } from '@/entities/ticker/lib/getAssetInfoCached';
import { connection } from 'next/server';

const mockGet = vi.mocked(getAssetInfoCached);
const mockConnection = vi.mocked(connection);

describe('getAssetInfoResilient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('passes a successful AssetInfo through unchanged and does not opt out of caching', async () => {
        const info: AssetInfo = {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
        };
        mockGet.mockResolvedValue(info);

        const result = await getAssetInfoResilient('AAPL');

        expect(result).toBe(info);
        expect(mockConnection).not.toHaveBeenCalled();
    });

    it('passes null (non-existent ticker) through so the caller can notFound()', async () => {
        mockGet.mockResolvedValue(null);

        const result = await getAssetInfoResilient('ZZZZ');

        expect(result).toBeNull();
        expect(mockConnection).not.toHaveBeenCalled();
    });

    it('on infra failure (throw) returns a ticker fallback and opts the render out of the ISR cache', async () => {
        mockGet.mockRejectedValue(new Error('[fmpTickerApi] search-symbol fetch failed'));

        const result = await getAssetInfoResilient('IONQ');

        expect(result).toEqual({ symbol: 'IONQ', name: 'IONQ' });
        expect(mockConnection).toHaveBeenCalledOnce();
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/entities/ticker/__tests__/lib/getAssetInfoResilient.test.ts`
Expected: FAIL — `getAssetInfoResilient` 모듈이 없어 import 에러.

- [ ] **Step 3: 헬퍼 구현**

`src/entities/ticker/lib/getAssetInfoResilient.ts`:

```ts
import { connection } from 'next/server';
import type { AssetInfo } from '@/shared/lib/types';
import { getAssetInfoCached } from './getAssetInfoCached';

/**
 * `getAssetInfoCached`의 graceful 래퍼. `getAssetInfo`는 세 가지로 끝난다:
 *   - AssetInfo 반환 → 그대로 통과(정상, ISR 캐시 대상).
 *   - throw         → FMP 인프라 일시 실패(throwOnInfraFailure). 여기서 흡수해
 *                     `{symbol, name: ticker}` fallback으로 degrade하고, 이 degrade
 *                     응답이 ISR(revalidate=3600)로 굳지 않도록 `connection()`으로
 *                     해당 렌더만 동적화한다 — 인프라 복구 즉시 다음 요청부터 정상화.
 *   - null 반환     → FMP 200 + 빈 결과 = 실재하지 않는 종목. 그대로 null을 통과시켜
 *                     호출부의 `notFound()`(404)가 동작하게 한다.
 *
 * fallback 객체는 symbol/name만 채운다. fmpSymbol은 생략하는데, AssetInfo에서
 * 이미 optional("일반 주식은 undefined")이라 다운스트림(getBarsAction/peekAnalysisCache)이
 * symbol로 degrade하는 기존 정상 경로와 동일하다. koreanName 생략 시 표시명이 영문 ticker.
 */
export async function getAssetInfoResilient(
    ticker: string
): Promise<AssetInfo | null> {
    try {
        return await getAssetInfoCached(ticker);
    } catch (e) {
        console.error(
            '[getAssetInfoResilient] infra failure, ticker fallback:',
            e
        );
        await connection();
        return { symbol: ticker, name: ticker };
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/entities/ticker/__tests__/lib/getAssetInfoResilient.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/entities/ticker/lib/getAssetInfoResilient.ts src/entities/ticker/__tests__/lib/getAssetInfoResilient.test.ts
git commit -m "feat(ticker): add getAssetInfoResilient — infra-failure ticker fallback"
```

---

## Task 2: barrel 교체 + 7개 라우트 호출 교체

**Files:**
- Modify: `src/entities/ticker/index.ts:7`
- Modify: `src/app/[symbol]/layout.tsx:16,72`
- Modify: `src/app/[symbol]/page.tsx:16,56,96`
- Modify: `src/app/[symbol]/news/page.tsx:19,53,152`
- Modify: `src/app/[symbol]/fundamental/page.tsx:33,69,276`
- Modify: `src/app/[symbol]/options/page.tsx:9,55,98`
- Modify: `src/app/[symbol]/overall/page.tsx:13,52,92`
- Modify: `src/app/[symbol]/fear-greed/page.tsx:14,55,93`

- [ ] **Step 1: barrel export 교체**

`src/entities/ticker/index.ts` 의 `getAssetInfoCached` export 줄을 교체한다. `getAssetInfoCached`는 헬퍼 내부에서만 쓰이므로 barrel에서 노출하지 않는다.

```diff
- export { getAssetInfoCached } from './lib/getAssetInfoCached';
+ export { getAssetInfoResilient } from './lib/getAssetInfoResilient';
```

- [ ] **Step 2: 7개 라우트의 import + 호출을 교체**

각 파일에서 barrel import 식별자 `getAssetInfoCached` → `getAssetInfoResilient`, 그리고 모든 호출 `getAssetInfoCached(` → `getAssetInfoResilient(` 로 바꾼다. null 처리(`if (!assetInfo) notFound()`, `assetInfo ? ... : ticker`)는 **변경하지 않는다** — 헬퍼는 null을 그대로 통과시키므로 기존 로직이 유효하다.

`layout.tsx`는 barrel default-style import(`import { getAssetInfoCached } from '@/entities/ticker';`)이므로 식별자만 바꾼다:

```diff
- import { getAssetInfoCached } from '@/entities/ticker';
+ import { getAssetInfoResilient } from '@/entities/ticker';
...
-    const assetInfo = await getAssetInfoCached(ticker);
+    const assetInfo = await getAssetInfoResilient(ticker);
```

나머지 6개 page는 multi-line barrel import 블록 안의 `getAssetInfoCached,` 한 줄을 `getAssetInfoResilient,`로 바꾸고, 파일 내 모든 `getAssetInfoCached(` 호출(각 2곳)을 `getAssetInfoResilient(`로 바꾼다.

빠짐없이 바꾸려면 파일별로 다음을 실행해 잔여를 0으로 만든다:

```bash
grep -rn "getAssetInfoCached" "src/app/[symbol]/" --include="*.tsx"
```
Expected: (no output) — 모든 라우트가 헬퍼로 교체됨.

- [ ] **Step 3: 타입체크 + 빌드**

Run: `yarn typecheck`
Expected: 0 errors.

Run (직접 캡처 — 파이프 금지): `rm -rf .next && yarn build > /tmp/plan_build.log 2>&1; echo "EXIT=$?"`
Expected: `EXIT=0`, 로그에 `Compiled successfully` + `Generating static pages`.

- [ ] **Step 4: 전체 테스트 (회귀 없음 확인)**

Run: `yarn test`
Expected: 전부 통과(신규 3 포함).

- [ ] **Step 5: 커밋**

```bash
git add src/entities/ticker/index.ts "src/app/[symbol]"
git commit -m "fix([symbol]): route getAssetInfo through resilient fallback helper"
```

---

## Task 3: fallback 경로 실측 검증

**Files:** (검증 전용 — 코드 변경 없음. `connection()`이 ISR 라우트에서 동작하지 않으면 Task 1로 돌아가 `unstable_noStore`로 교체)

- [ ] **Step 1: dev 서버 기동**

Run: `yarn dev > /tmp/plan_dev.log 2>&1 &` 후 `until grep -q "Ready in" /tmp/plan_dev.log; do sleep 1; done`

- [ ] **Step 2: 정상 경로 회귀 없음 확인 (cache/DB hit 종목)**

Run: `for t in AAPL IONQ TSLA; do echo "$t: $(curl -s -o /dev/null -w '%{http_code}' --max-time 60 http://localhost:4200/$t)"; done`
Expected: 모두 `200`.

- [ ] **Step 3: fallback 경로 강제 — 임시 throw 주입으로 검증**

`getAssetInfoResilient.ts` 헬퍼 try 블록 첫 줄에 임시로 `if (ticker === 'TESTFB') throw new Error('forced infra failure');` 를 넣고 저장(HMR), 요청:

Run: `echo "TESTFB: $(curl -s -o /dev/null -w '%{http_code}' --max-time 60 http://localhost:4200/TESTFB)"`
Expected: `200` (notFound 404가 아니라 fallback 렌더). dev 로그에 `[getAssetInfoResilient] infra failure` 1줄.

검증 후 임시 throw 줄을 **반드시 제거**한다. 제거 확인:
```bash
grep -n "TESTFB\|forced infra" src/entities/ticker/lib/getAssetInfoResilient.ts || echo "임시 코드 제거됨"
```
Expected: `임시 코드 제거됨`.

- [ ] **Step 4: 실재하지 않는 종목은 404 유지 확인**

Run: `echo "ZZZZ: $(curl -s -o /dev/null -w '%{http_code}' --max-time 60 http://localhost:4200/ZZZZ)"`
Expected: `404` (getAssetInfo null → notFound). 단 이 결과는 FMP가 ZZZZ에 빈 결과를 반환할 때만 보장되므로, 200이 나오면 dev 로그에 fallback 로그가 없는지(=정상 null 경로인지)만 확인한다.

- [ ] **Step 5: dev 종료 + 커밋(없음)**

Run: `pkill -f "next dev"`
Task 3은 코드 변경이 없으므로 커밋하지 않는다(임시 throw는 Step 3에서 제거됨).

---

## Self-Review (작성자 체크 결과)

- **Spec coverage:** throwOnInfraFailure 유지(비목표) ✓ / 경계 catch+fallback(Task1) ✓ / null→notFound 유지(Task2 Step2) ✓ / fallback 캐시 회피 connection()(Task1) ✓ / 6라우트+generateMetadata 교체(Task2) — layout 포함 7파일 ✓ / 테스트(Task1) ✓ / fmpSymbol 호환(이미 optional, 본문 명시) ✓ / noStore·connection 실동작 검증(Task3 Step3) ✓.
- **Placeholder scan:** 없음. Task3는 실측이라 코드 step은 임시 throw(제거 step 포함)뿐.
- **Type consistency:** `getAssetInfoResilient(ticker: string): Promise<AssetInfo | null>` — Task1 정의와 Task2 호출부(기존 `getAssetInfoCached`와 동일 시그니처) 일치. fallback `{symbol, name}`은 AssetInfo의 required 필드만 채움(koreanName/fmpSymbol optional).

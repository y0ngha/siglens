# 종목 조회수 수집 + 비콘 상호작용 게이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 헤드리스 봇을 비콘 단계에서 거르고, 종목별 일자 조회수를 모아 인기 목록 스크립트(US·KR·크립토)의 추가 후보로 쓴다.

**Architecture:** 클라이언트 비콘은 첫 신뢰 입력(`pointerdown`/`keydown`/`wheel`) 뒤에만 나간다. 종목 비콘은 `POST /api/presence/symbol` → `symbol_views_daily`(date, symbol, views) upsert. 수동 실행 스크립트가 최근 7일 합계 ≥ 3인 종목 중 목록에 없는 것을 자산군별 5개까지 뽑아 시장 필터를 거쳐 기존 Trending 섹션·새 `kr-trending` 카테고리에 삽입한다.

**Tech Stack:** Next.js 16 route handler, Drizzle ORM + Neon, React 19 client component, vitest + RTL, tsx 스크립트, FMP stable API, yahoo-finance2 4.

**Spec:** `docs/superpowers/specs/2026-09-24-symbol-views-bot-gate-design.md`

---

## 실행 규칙 (모든 태스크 공통 — 먼저 읽을 것)

- 작업 디렉터리: `/Users/y0ngha/Project/siglens-wt/symbol-views` (브랜치 `feat/symbol-views`). 이 워크트리 밖 파일을 읽기 외 목적으로 건드리지 않는다.
- **금지:**
  - `yarn db:migrate` 및 운영 DB에 쓰는 어떤 명령도 실행하지 않는다. `.env.local` = 운영 Neon. `ALLOW_REMOTE_DB_WRITE` 설정 금지.
  - `.env.local` 내용을 출력하지 않는다 (`cat`·`sed`·`grep` 포함).
  - `yarn update-popular-tickers` / `yarn update-popular-cryptos` 실제 실행 금지 (config 파일을 다시 쓰고 FMP를 대량 호출한다). 스모크는 Task 12의 import 확인만.
  - git commit·push 금지 (CLAUDE.md — git-agent 담당). 각 태스크 끝은 "체크포인트"다.
  - 자기가 만들지 않은 파일 삭제·이동 금지. 파일 수정에 라인 번호 슬라이싱 금지 — 앵커 문자열 + 존재 assert.
- 테스트는 `yarn test <경로>`로만 (`npx vitest` 금지 — `--no-experimental-webstorage` 누락으로 localStorage 테스트가 거짓 실패).
- 태스크별 게이트: 해당 테스트 파일 + `yarn typecheck` + `yarn lint` (경고 **수**도 확인). 전체 스위트는 Task 13에서 1회.
- fetch 스파이는 항상 구현을 지정한다 (`vi.fn().mockResolvedValue(...)`). 구현 없는 스파이는 실제 호출을 내보낸다.
- `mock.calls[0]` 같은 인덱스 단언 금지 — 판별 인자로 `find`.

---

## 파일 구조

| 파일 | 작업 | 책임 |
|---|---|---|
| `src/shared/lib/onFirstInteraction.ts` | 생성 | 첫 신뢰 입력 게이트 |
| `src/shared/lib/__tests__/onFirstInteraction.test.ts` | 생성 | |
| `src/features/visitor-ping/ui/VisitorPing.tsx` | 수정 | 게이트 뒤로 이동 |
| `src/features/visitor-ping/__tests__/VisitorPing.test.tsx` | 수정 | 게이트 목 |
| `src/features/visitor-ping/ui/SymbolViewPing.tsx` | 생성 | 종목 비콘 |
| `src/features/visitor-ping/__tests__/SymbolViewPing.test.tsx` | 생성 | |
| `src/features/visitor-ping/index.ts` | 수정 | export 추가 |
| `src/shared/db/schema.ts` | 수정 | `symbolViewsDaily`, `visitorDays` 주석 |
| `drizzle/0037_symbol_views_daily.sql` + `drizzle/meta/*` | 생성(생성기) | 마이그레이션 |
| `src/entities/symbol-view/{types.ts,api.ts,index.ts}` | 생성 | repository |
| `src/entities/symbol-view/__tests__/api.test.ts` | 생성 | |
| `src/app/api/presence/symbol/route.ts` | 생성 | 수집 라우트 |
| `src/app/api/presence/symbol/__tests__/route.test.ts` | 생성 | |
| `src/app/[locale]/[symbol]/layout.tsx` | 수정 | `SymbolViewPing` 마운트 |
| `src/app/[locale]/[symbol]/__tests__/layout.test.tsx` | 수정 | 마운트 단언 |
| `src/shared/lib/types.ts` | 수정 | `CategoryId`에 `kr-trending` |
| `src/shared/config/popular-tickers.ts` | 수정 | `KR_CATEGORY_IDS` |
| `src/widgets/home/TickerCategories.tsx` | 수정 | 스타일 |
| `src/shared/config/tickerCategoryLabel.ts` | 수정 | 라벨·설명 키 |
| `messages/{ko,en,ja,zh}.json` | 수정 | 라벨·설명 |
| `src/shared/config/relatedSymbols.ts` | 수정 | `kr-trending` 제외 |
| `src/shared/config/__tests__/relatedSymbols.krTrending.test.ts` | 생성 | |
| `scripts/lib/visitCandidates.ts` | 생성 | 순수: 분류·선정·KR 기존 집합 |
| `scripts/lib/__tests__/visitCandidates.test.ts` | 생성 | |
| `scripts/lib/krTrendingInsert.ts` | 생성 | 순수: KR 텍스트 삽입 |
| `scripts/lib/__tests__/krTrendingInsert.test.ts` | 생성 | |
| `scripts/lib/visitSources.ts` | 생성 | I/O: DB 로더 |
| `update-popular-tickers.ts` | 수정 | US·KR 방문 후보 |
| `src/shared/db/__tests__/update-popular-tickers.test.ts` | 수정 | 판정 함수 테스트 |
| `scripts/update-popular-cryptos.ts` | 수정 | 크립토 방문 후보 |
| `scripts/__tests__/update-popular-cryptos.test.ts` | 수정 | 판정 함수 테스트 |
| `tsconfig.scripts.json` | 수정 | 새 scripts/lib 파일 등록 |
| `package.json` | 수정 | 두 스크립트 명령 |

---

### Task 1: 상호작용 게이트 `onFirstInteraction`

**Files:**
- Create: `src/shared/lib/onFirstInteraction.ts`
- Test: `src/shared/lib/__tests__/onFirstInteraction.test.ts`

jsdom의 `fireEvent`는 `isTrusted === false` 이벤트를 만든다 (unforgeable 속성이라 덮어쓸 수 없다). 그래서 신뢰 경로는 `addEventListener` 스파이로 핸들러를 꺼내 `{ isTrusted: true }` 객체로 직접 호출한다. 모듈 상태(`interacted`)가 테스트 간에 새므로 매 테스트 `vi.resetModules()` + 동적 import.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/shared/lib/__tests__/onFirstInteraction.test.ts
import { fireEvent } from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type MockInstance,
} from 'vitest';

type Listener = (event: Event) => void;

async function load() {
    vi.resetModules();
    return import('@/shared/lib/onFirstInteraction');
}

function listenerFor(spy: MockInstance, type: string): Listener {
    const call = spy.mock.calls.find(c => c[0] === type);
    if (!call) throw new Error(`no listener for ${type}`);
    return call[1] as Listener;
}

const trusted = { isTrusted: true } as Event;
const untrusted = { isTrusted: false } as Event;

describe('onFirstInteraction', () => {
    let addSpy: MockInstance;
    let removeSpy: MockInstance;

    beforeEach(() => {
        addSpy = vi.spyOn(window, 'addEventListener');
        removeSpy = vi.spyOn(window, 'removeEventListener');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('pointerdown·keydown·wheel을 capture·passive로 듣는다', async () => {
        const { onFirstInteraction } = await load();
        onFirstInteraction(() => {});
        for (const type of ['pointerdown', 'keydown', 'wheel']) {
            const call = addSpy.mock.calls.find(c => c[0] === type);
            expect(call?.[2]).toEqual({ capture: true, passive: true });
        }
        // scroll은 window.scrollTo로도 나므로 듣지 않는다.
        expect(addSpy.mock.calls.find(c => c[0] === 'scroll')).toBeUndefined();
    });

    it('신뢰 이벤트에서 콜백을 한 번 실행하고 리스너를 전부 뗀다', async () => {
        const { onFirstInteraction } = await load();
        const callback = vi.fn();
        onFirstInteraction(callback);

        listenerFor(addSpy, 'keydown')(trusted);
        listenerFor(addSpy, 'pointerdown')(trusted);

        expect(callback).toHaveBeenCalledTimes(1);
        for (const type of ['pointerdown', 'keydown', 'wheel']) {
            expect(
                removeSpy.mock.calls.find(c => c[0] === type)
            ).toBeDefined();
        }
    });

    it('합성 이벤트(isTrusted=false)는 무시한다', async () => {
        const { onFirstInteraction } = await load();
        const callback = vi.fn();
        onFirstInteraction(callback);

        listenerFor(addSpy, 'pointerdown')(untrusted);
        // 실제 jsdom 디스패치도 isTrusted=false다.
        fireEvent.pointerDown(window);
        fireEvent.keyDown(window, { key: 'a' });

        expect(callback).not.toHaveBeenCalled();
    });

    it('이미 입력이 있었으면 이후 호출은 즉시 실행한다 (SPA 이동)', async () => {
        const { onFirstInteraction } = await load();
        onFirstInteraction(() => {});
        listenerFor(addSpy, 'wheel')(trusted);

        const later = vi.fn();
        addSpy.mockClear();
        onFirstInteraction(later);

        expect(later).toHaveBeenCalledTimes(1);
        expect(addSpy).not.toHaveBeenCalled();
    });

    it('해제 함수를 부르면 입력이 와도 실행하지 않는다', async () => {
        const { onFirstInteraction } = await load();
        const callback = vi.fn();
        const detach = onFirstInteraction(callback);
        const handler = listenerFor(addSpy, 'pointerdown');

        detach();
        handler(trusted);

        expect(callback).not.toHaveBeenCalled();
    });
});
```

마지막 테스트 주의: 해제 후에도 꺼내 둔 핸들러를 직접 부르면 실행될 수 있다. 구현은 `detached` 플래그로 이를 막는다.

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/shared/lib/__tests__/onFirstInteraction.test.ts`
Expected: FAIL — `Failed to resolve import "@/shared/lib/onFirstInteraction"`

- [ ] **Step 3: 구현**

```ts
// src/shared/lib/onFirstInteraction.ts
/**
 * 첫 **신뢰 입력** 뒤에 콜백을 한 번 실행한다. 반환값은 대기 중 리스너 해제 함수.
 *
 * 방문 비콘을 이 뒤에 두는 이유: 2026-09 `visitor_days` 실측에서 KR 외 행의 대부분이
 * `navigator.webdriver`를 숨긴 헤드리스였다 — JS를 실행하고 정상 UA를 달아 기존 필터를
 * 전부 통과했지만, 페이지를 렌더만 하고 떠나 입력 이벤트를 만들지 않는다.
 *
 * - `scroll`은 듣지 않는다. 크롤러의 `window.scrollTo`로도 발생한다. `wheel`은 실제
 *   입력에서만 난다. 터치는 `pointerdown`이 덮는다.
 * - `isTrusted === false`(스크립트 `dispatchEvent`)는 무시한다.
 * - 한 번 입력이 인정되면 모듈 플래그가 남아 이후 호출은 즉시 실행된다 — SPA 내부 이동은
 *   그 자체가 클릭이므로 새 페이지에서 다시 기다릴 이유가 없다.
 *
 * 한계: CDP `Input.dispatch*`로 입력을 흉내 내는 봇은 통과한다.
 */
const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'wheel'] as const;
const LISTENER_OPTIONS = { capture: true, passive: true } as const;

let interacted = false;

export function onFirstInteraction(callback: () => void): () => void {
    if (interacted) {
        callback();
        return () => {};
    }

    let detached = false;
    const detach = (): void => {
        detached = true;
        for (const type of INTERACTION_EVENTS) {
            window.removeEventListener(type, handle, LISTENER_OPTIONS);
        }
    };
    function handle(event: Event): void {
        if (detached || !event.isTrusted) return;
        interacted = true;
        detach();
        callback();
    }

    for (const type of INTERACTION_EVENTS) {
        window.addEventListener(type, handle, LISTENER_OPTIONS);
    }
    return detach;
}
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/shared/lib/__tests__/onFirstInteraction.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 체크포인트** — `yarn typecheck && yarn lint`. 커밋하지 않는다.

---

### Task 2: `VisitorPing`을 게이트 뒤로

**Files:**
- Modify: `src/features/visitor-ping/ui/VisitorPing.tsx`
- Modify: `src/features/visitor-ping/__tests__/VisitorPing.test.tsx`
- Modify: `src/shared/db/schema.ts` (`visitorDays` JSDoc)

- [ ] **Step 1: 테스트에 게이트 목 추가 + 새 단언**

`VisitorPing.test.tsx` 상단 import 바로 아래에 추가:

```ts
/**
 * 게이트는 `onFirstInteraction` 자체 테스트가 검증한다. 여기선 "입력 전엔 안 보내고,
 * 입력 후엔 보낸다"만 본다 — jsdom 이벤트는 isTrusted=false라 실제 게이트를 못 연다.
 */
const interaction = vi.hoisted(() => ({
    pending: [] as Array<() => void>,
}));
vi.mock('@/shared/lib/onFirstInteraction', () => ({
    onFirstInteraction: (callback: () => void) => {
        interaction.pending.push(callback);
        return () => {
            interaction.pending = interaction.pending.filter(
                c => c !== callback
            );
        };
    },
}));
function fireInteraction(): void {
    const callbacks = interaction.pending;
    interaction.pending = [];
    act(() => {
        callbacks.forEach(c => c());
    });
}
```

`@testing-library/react` import에 `act` 추가. `beforeEach`에 `interaction.pending = [];` 추가.

기존 테스트 수정 — `render(<VisitorPing />)` 뒤에 `fireInteraction();` 를 넣는다 (fetch를 기대하는 모든 케이스: "첫 방문에 본문 없는 POST", "성공하면 오늘 날짜를 기록" 의 두 render 모두, "저장된 날짜가 오늘이 아니면", "응답이 실패하면" 등 파일 안의 fetch 기대 케이스 전부). "자동화 브라우저에서는 보내지 않는다"는 render 뒤 `fireInteraction()`을 넣고도 fetch 없음을 단언한다 (webdriver면 게이트를 등록조차 하지 않아야 한다).

새 테스트 추가:

```ts
    it('입력 전에는 보내지 않는다', () => {
        render(<VisitorPing />);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('언마운트하면 대기 중 게이트를 해제한다', () => {
        const { unmount } = render(<VisitorPing />);
        unmount();
        fireInteraction();
        expect(fetch).not.toHaveBeenCalled();
    });
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/features/visitor-ping/__tests__/VisitorPing.test.tsx`
Expected: FAIL — "입력 전에는 보내지 않는다"(현재는 마운트 즉시 전송), "언마운트하면…"

- [ ] **Step 3: 구현** — `VisitorPing.tsx`의 `export function VisitorPing` 전체를 아래로 교체 (상수·JSDoc 유지, JSDoc 끝에 한 줄 추가):

```tsx
import { onFirstInteraction } from '@/shared/lib/onFirstInteraction';

// (기존 STORAGE_KEY, BEACON_TIMEOUT_MS 유지)

function sendPresence(): void {
    const today = kstDateKey(new Date());

    let last: string | null = null;
    try {
        last = window.localStorage.getItem(STORAGE_KEY);
    } catch {
        // 사파리 프라이빗 모드 등 — 매번 보낸다. 서버가 중복을 흡수한다.
    }
    if (last === today) return;

    void fetch('/api/presence', {
        method: 'POST',
        keepalive: true,
        signal: AbortSignal.timeout(BEACON_TIMEOUT_MS),
    })
        .then(response => {
            // 실패는 기록하지 않는다. pepper 미설정 같은 배포 오류가
            // 다음 로드에서 다시 드러나야 한다.
            if (!response.ok) return;
            try {
                window.localStorage.setItem(STORAGE_KEY, today);
            } catch {
                // 위와 같다.
            }
        })
        .catch(() => {
            // 차단기·오프라인·타임아웃. 집계 하나 놓치는 편이 화면을 깨뜨리는 것보다 낫다.
        });
}

/**
 * (기존 JSDoc 본문 유지) +
 *
 * 전송은 첫 신뢰 입력 뒤에만 한다(`onFirstInteraction`). 렌더만 하고 떠나는 헤드리스가
 * 이 필터를 통과하고 있었다.
 */
export function VisitorPing(): null {
    useEffect(() => {
        // 사람 수를 세는 것이 목적이다. Playwright·Puppeteer는 사람이 아니다.
        if (navigator.webdriver) return;
        return onFirstInteraction(sendPresence);
    }, []);

    return null;
}
```

`schema.ts`의 `visitorDays` 위 JSDoc 끝(`*/` 직전)에 추가:

```ts
 *
 * ⚠️ `feat/symbol-views` 머지부터 비콘이 첫 신뢰 입력 뒤에만 나간다
 * (`shared/lib/onFirstInteraction`). 그 전 행에는 입력 없이 렌더만 한 헤드리스가
 * 섞여 있다(2026-09 실측 KR 외 1,237행 대부분) — 전환 전후 DAU는 직접 비교하지 않는다.
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/features/visitor-ping/__tests__/VisitorPing.test.tsx`
Expected: PASS

- [ ] **Step 5: 체크포인트** — `yarn typecheck && yarn lint`.

---

### Task 3: 테이블 `symbol_views_daily` + 마이그레이션

**Files:**
- Modify: `src/shared/db/schema.ts`
- Create (생성기): `drizzle/0037_symbol_views_daily.sql`, `drizzle/meta/0037_snapshot.json`, `drizzle/meta/_journal.json` 갱신

- [ ] **Step 1: 스키마 추가** — `schema.ts`에서 `export const oauthAccounts = pgTable(` 바로 위(= `visitorDays` 정의 끝 다음)에 삽입. `date`, `integer`, `varchar`, `primaryKey`는 이미 import돼 있다 (파일 상단 확인).

```ts
/**
 * 종목 페이지 일자 조회수 — 인기 목록 스크립트(`update-popular-tickers.ts`·
 * `scripts/update-popular-cryptos.ts`)의 **추가 후보** 신호.
 *
 * 개인 식별 정보를 담지 않는다(IP·UA·해시 없음) — 집계값만 있으므로 개인정보처리방침
 * 대상이 아니다. 중복 방지는 클라이언트(`SymbolViewPing`, 종목당 하루 1회)가 하고,
 * 봇 필터는 비콘 게이트(`onFirstInteraction`) + `isBot`이다.
 *
 * 인증 없는 비콘이라 반복 POST로 부풀릴 수 있다. 방어선은 스크립트의 시장 필터와
 * 사람의 diff 검토다.
 */
export const symbolViewsDaily = pgTable(
    'symbol_views_daily',
    {
        /** KST `YYYY-MM-DD`. */
        date: date('date').notNull(),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        views: integer('views').notNull().default(1),
    },
    table => [primaryKey({ columns: [table.date, table.symbol] })]
);
```

- [ ] **Step 2: 마이그레이션 생성** (DB에 접속하지 않는 diff 생성기)

Run: `yarn db:generate --name symbol_views_daily`
Expected: `drizzle/0037_symbol_views_daily.sql` 생성.

- [ ] **Step 3: 생성물 검사**

Run: `cat drizzle/0037_symbol_views_daily.sql`
Expected (공백 차이 허용):

```sql
CREATE TABLE "symbol_views_daily" (
	"date" date NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"views" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "symbol_views_daily_date_symbol_pk" PRIMARY KEY("date","symbol")
);
```

**이 테이블 외의 문장(ALTER 등)이 섞여 있으면 중단하고 보고한다** — 스키마 드리프트다.

Run: `git status --short drizzle/` → `0037_*.sql`, `meta/0037_snapshot.json` 신규, `meta/_journal.json` 수정만.

- [ ] **Step 4: 체크포인트** — `yarn typecheck`. `db:migrate` 실행 금지 (운영 적용은 사용자).

---

### Task 4: Entity `symbol-view`

**Files:**
- Create: `src/entities/symbol-view/types.ts`, `api.ts`, `index.ts`
- Test: `src/entities/symbol-view/__tests__/api.test.ts`

- [ ] **Step 1: 타입 작성**

```ts
// src/entities/symbol-view/types.ts
/** 한 종목의 구간 조회수 합계. */
export interface SymbolViewTally {
    readonly symbol: string;
    readonly views: number;
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

```ts
// src/entities/symbol-view/__tests__/api.test.ts
import { describe, expect, it, vi } from 'vitest';
import { DrizzleSymbolViewRepository } from '@/entities/symbol-view/api';
import { symbolViewsDaily } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';

describe('DrizzleSymbolViewRepository', () => {
    it('recordView는 (date, symbol) 충돌 시 views를 올리는 upsert를 건다', async () => {
        const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
        const values = vi.fn(() => ({ onConflictDoUpdate }));
        const insert = vi.fn(() => ({ values }));
        const db = { insert } as unknown as SiglensDatabase;

        await new DrizzleSymbolViewRepository(db).recordView(
            '2026-09-24',
            'AAPL'
        );

        expect(values).toHaveBeenCalledWith({
            date: '2026-09-24',
            symbol: 'AAPL',
        });
        expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
        const arg = onConflictDoUpdate.mock.calls.find(Boolean)?.[0] as {
            target: unknown[];
            set: Record<string, unknown>;
        };
        expect(arg.target).toEqual([
            symbolViewsDaily.date,
            symbolViewsDaily.symbol,
        ]);
        // 덮어쓰기(views: 1)가 아니라 SQL 증가식이어야 한다.
        expect(typeof arg.set.views).toBe('object');
    });

    it('pruneOlderThan은 삭제를 한 번 건다', async () => {
        const where = vi.fn().mockResolvedValue(undefined);
        const db = {
            delete: vi.fn(() => ({ where })),
        } as unknown as SiglensDatabase;
        await new DrizzleSymbolViewRepository(db).pruneOlderThan('2026-06-26');
        expect(where).toHaveBeenCalledTimes(1);
    });

    it('topViewed는 기간 필터 → 종목별 합계 → 임계값(HAVING) → 내림차순 체인을 탄다', async () => {
        const rows = [
            { symbol: 'NVDA', views: 9 },
            { symbol: 'AAPL', views: 4 },
        ];
        const orderBy = vi.fn().mockResolvedValue(rows);
        const having = vi.fn(() => ({ orderBy }));
        const groupBy = vi.fn(() => ({ having }));
        const where = vi.fn(() => ({ groupBy }));
        const from = vi.fn(() => ({ where }));
        const db = {
            select: vi.fn(() => ({ from })),
        } as unknown as SiglensDatabase;

        const result = await new DrizzleSymbolViewRepository(db).topViewed(
            '2026-09-17',
            3
        );

        expect(result).toEqual(rows);
        expect(groupBy).toHaveBeenCalledWith(symbolViewsDaily.symbol);
        expect(having).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 3: 실패 확인**

Run: `yarn test src/entities/symbol-view/__tests__/api.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: 구현**

```ts
// src/entities/symbol-view/api.ts
import 'server-only';

import { desc, gte, lt, sql } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { symbolViewsDaily } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import type { SymbolViewTally } from './types';

/** 종목 일자 조회수의 적재·정리·집계. 날짜는 전부 KST `YYYY-MM-DD`. */
export interface SymbolViewRepository {
    /** (date, symbol) upsert — 없으면 1, 있으면 +1. */
    recordView(date: string, symbol: string): Promise<void>;
    /** `cutoffDate` **이전** 행을 지운다. */
    pruneOlderThan(cutoffDate: string): Promise<void>;
    /** `fromDate` 이후 합계가 `minViews` 이상인 종목. 많은 순. */
    topViewed(fromDate: string, minViews: number): Promise<SymbolViewTally[]>;
}

export class DrizzleSymbolViewRepository implements SymbolViewRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async recordView(date: string, symbol: string): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(symbolViewsDaily)
                    .values({ date, symbol })
                    .onConflictDoUpdate({
                        target: [symbolViewsDaily.date, symbolViewsDaily.symbol],
                        set: { views: sql`${symbolViewsDaily.views} + 1` },
                    }),
            NEON_TRANSIENT_RETRY
        );
    }

    async pruneOlderThan(cutoffDate: string): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .delete(symbolViewsDaily)
                    .where(lt(symbolViewsDaily.date, cutoffDate)),
            NEON_TRANSIENT_RETRY
        );
    }

    async topViewed(
        fromDate: string,
        minViews: number
    ): Promise<SymbolViewTally[]> {
        // Neon HTTP는 bigint(sum 결과)를 문자열로 준다 — int로 캐스팅한다.
        const total = sql<number>`sum(${symbolViewsDaily.views})::int`;
        return this.db
            .select({ symbol: symbolViewsDaily.symbol, views: total })
            .from(symbolViewsDaily)
            .where(gte(symbolViewsDaily.date, fromDate))
            .groupBy(symbolViewsDaily.symbol)
            .having(sql`${total} >= ${minViews}`)
            .orderBy(desc(total));
    }
}
```

```ts
// src/entities/symbol-view/index.ts
/** `api.ts`가 `server-only`라 이 barrel 전체가 서버 전용이다. 비콘 컴포넌트는 URL만 안다. */
export {
    DrizzleSymbolViewRepository,
    type SymbolViewRepository,
} from './api';
export type { SymbolViewTally } from './types';
```

- [ ] **Step 5: 통과 확인**

Run: `yarn test src/entities/symbol-view/__tests__/api.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: 체크포인트** — `yarn typecheck && yarn lint`.

---

### Task 5: 라우트 `POST /api/presence/symbol`

**Files:**
- Create: `src/app/api/presence/symbol/route.ts`
- Test: `src/app/api/presence/symbol/__tests__/route.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/app/api/presence/symbol/__tests__/route.test.ts
import { constants } from 'node:http2';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_BAD_REQUEST } = constants;

const HUMAN_UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/140.0.0.0';
const BOT_UA =
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const recordView = vi.fn().mockResolvedValue(undefined);
const pruneOlderThan = vi.fn().mockResolvedValue(undefined);
let requestHeaders = new Headers();

vi.mock('next/headers', () => ({
    headers: () => Promise.resolve(requestHeaders),
}));

// `after()`만 갈아끼운다 — 통째로 대체하면 isBot이 쓰는 userAgent가 사라진다.
vi.mock('next/server', async importOriginal => {
    const actual = await importOriginal<typeof import('next/server')>();
    return {
        ...actual,
        after: (fn: () => unknown) => {
            void fn();
        },
    };
});

const getDatabaseClient = vi.fn(() => ({ db: {} }));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => getDatabaseClient(),
}));

vi.mock('@/entities/symbol-view', () => ({
    DrizzleSymbolViewRepository: class {
        recordView = recordView;
        pruneOlderThan = pruneOlderThan;
    },
}));

/** 라우트가 모듈 스코프에 마지막 prune 날짜를 들고 있어 매번 새로 import한다. */
async function importRoute() {
    vi.resetModules();
    return import('@/app/api/presence/symbol/route');
}

function post(body: unknown): Request {
    return new Request('https://siglens.io/api/presence/symbol', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

describe('POST /api/presence/symbol', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDatabaseClient.mockReturnValue({ db: {} });
        vi.stubEnv('NODE_ENV', 'production');
        requestHeaders = new Headers({ 'user-agent': HUMAN_UA });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('정상 요청은 대문자 심볼로 기록하고 204를 준다', async () => {
        const { POST } = await importRoute();
        const res = await POST(post({ symbol: 'aapl' }));

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(recordView).toHaveBeenCalledWith(
            expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            'AAPL'
        );
    });

    it.each(['005930.KS', 'BTCUSD', 'BRK.B'])(
        '%s 형상을 받는다',
        async symbol => {
            const { POST } = await importRoute();
            await POST(post({ symbol }));
            expect(recordView).toHaveBeenCalledWith(expect.any(String), symbol);
        }
    );

    it('봇은 기록하지 않는다', async () => {
        requestHeaders = new Headers({ 'user-agent': BOT_UA });
        const { POST } = await importRoute();
        const res = await POST(post({ symbol: 'AAPL' }));
        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(recordView).not.toHaveBeenCalled();
    });

    it('프로덕션이 아니면 기록하지 않는다', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        const { POST } = await importRoute();
        await POST(post({ symbol: 'AAPL' }));
        expect(recordView).not.toHaveBeenCalled();
    });

    it.each([
        ['깨진 JSON', '{'],
        ['심볼 없음', {}],
        ['문자열 아님', { symbol: 42 }],
        ['해외 거래소 접미사', { symbol: 'HVO.L' }],
        ['형상 불량', { symbol: '../../etc' }],
    ])('%s → 400', async (_label, body) => {
        const { POST } = await importRoute();
        const res = await POST(post(body));
        expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
        expect(recordView).not.toHaveBeenCalled();
    });

    it('DB 실패는 삼키고 204 — 정리도 건너뛴다', async () => {
        recordView.mockRejectedValueOnce(new Error('neon down'));
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const { POST } = await importRoute();
        const res = await POST(post({ symbol: 'AAPL' }));

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(pruneOlderThan).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('인스턴스당 하루 한 번 90일 이전 행을 정리한다', async () => {
        const { POST } = await importRoute();
        await POST(post({ symbol: 'AAPL' }));
        await POST(post({ symbol: 'NVDA' }));

        expect(pruneOlderThan).toHaveBeenCalledTimes(1);
        expect(pruneOlderThan).toHaveBeenCalledWith(
            expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
        );
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/app/api/presence/symbol/__tests__/route.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

```ts
// src/app/api/presence/symbol/route.ts
/**
 * 종목 조회수 수집점. `SymbolViewPing`이 종목당 하루 한 번, 첫 신뢰 입력 뒤에 부른다.
 *
 * 경로가 `presence` 하위인 이유: `analytics`·`track`·`collect`·`view` 계열 단어가 든
 * 경로는 EasyList 계열 차단 목록이 막는다.
 *
 * 형상만 맞는 존재하지 않는 심볼도 저장된다. 스크립트 임계값 아래에 머물고 스크립트가
 * FMP·DB로 다시 검증하므로 무해하다. 행 수 상한은 보존 기간이 정한다.
 */
import { constants } from 'node:http2';
import { after } from 'next/server';
import { headers } from 'next/headers';
import {
    DrizzleSymbolViewRepository,
    type SymbolViewRepository,
} from '@/entities/symbol-view';
import { isBot } from '@/shared/api/isBot';
import { isAdmissibleSymbolShape } from '@/shared/config/market';
import { getDatabaseClient } from '@/shared/db/client';
import { kstDateKey, kstDateKeyDaysBefore } from '@/shared/lib/etTimeUtils';

const { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_BAD_REQUEST } = constants;

export const dynamic = 'force-dynamic';

/** 스크립트는 7일만 읽는다. 나머지는 사후 검수용 여유. */
const RETENTION_DAYS = 90;

/** `/api/presence`와 같은 패턴 — 별도 cron 없이 인스턴스당 KST 하루 1회 정리. */
let lastPrunedDate: string | null = null;

function noContent(): Response {
    return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
}

async function readSymbol(request: Request): Promise<string | null> {
    try {
        const body: unknown = await request.json();
        if (typeof body !== 'object' || body === null) return null;
        const { symbol } = body as { symbol?: unknown };
        if (typeof symbol !== 'string') return null;
        const upper = symbol.toUpperCase();
        return isAdmissibleSymbolShape(upper) ? upper : null;
    } catch {
        return null;
    }
}

export async function POST(request: Request): Promise<Response> {
    if (isBot(await headers())) return noContent();
    if (process.env.NODE_ENV !== 'production') return noContent();

    const symbol = await readSymbol(request);
    if (symbol === null) {
        return new Response(null, { status: HTTP_STATUS_BAD_REQUEST });
    }

    const today = kstDateKey(new Date());

    // DB 클라이언트 생성까지 try 안에 둔다 — DATABASE_URL 부재로 던지면 프레임워크
    // 기본 500이 나가 "집계 실패는 화면을 깨뜨리지 않는다"가 뚫린다.
    let repo: SymbolViewRepository;
    try {
        const { db } = getDatabaseClient();
        repo = new DrizzleSymbolViewRepository(db);
        await repo.recordView(today, symbol);
    } catch (error) {
        console.error('[symbol-views] recordView failed:', error);
        // 정리도 건너뛴다 — lastPrunedDate를 소진하면 그날 남은 요청이 기회를 잃는다.
        return noContent();
    }

    if (lastPrunedDate !== today) {
        lastPrunedDate = today;
        after(async () => {
            try {
                await repo.pruneOlderThan(
                    kstDateKeyDaysBefore(today, RETENTION_DAYS)
                );
            } catch (error) {
                console.error('[symbol-views] prune failed:', error);
            }
        });
    }

    return noContent();
}
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/app/api/presence/symbol/__tests__/route.test.ts`
Expected: PASS

- [ ] **Step 5: 체크포인트** — `yarn typecheck && yarn lint`.

---

### Task 6: `SymbolViewPing` + 레이아웃 마운트

**Files:**
- Create: `src/features/visitor-ping/ui/SymbolViewPing.tsx`
- Modify: `src/features/visitor-ping/index.ts`
- Test: `src/features/visitor-ping/__tests__/SymbolViewPing.test.tsx`
- Modify: `src/app/[locale]/[symbol]/layout.tsx`
- Modify: `src/app/[locale]/[symbol]/__tests__/layout.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/features/visitor-ping/__tests__/SymbolViewPing.test.tsx
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SymbolViewPing } from '@/features/visitor-ping';
import { kstDateKey } from '@/shared/lib/etTimeUtils';

const STORAGE_KEY = 'siglens:symbol-views';
// 가짜 타이머 금지 — RTL waitFor 폴링이 멈춘다 (VisitorPing.test.tsx와 같은 이유).
const TODAY = kstDateKey(new Date());

const interaction = vi.hoisted(() => ({
    pending: [] as Array<() => void>,
}));
vi.mock('@/shared/lib/onFirstInteraction', () => ({
    onFirstInteraction: (callback: () => void) => {
        interaction.pending.push(callback);
        return () => {
            interaction.pending = interaction.pending.filter(
                c => c !== callback
            );
        };
    },
}));
function fireInteraction(): void {
    const callbacks = interaction.pending;
    interaction.pending = [];
    act(() => {
        callbacks.forEach(c => c());
    });
}

function storedSymbols(): unknown {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : JSON.parse(raw);
}

describe('SymbolViewPing', () => {
    beforeEach(() => {
        interaction.pending = [];
        window.localStorage.clear();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
        Object.defineProperty(navigator, 'webdriver', {
            value: false,
            configurable: true,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('입력 전에는 보내지 않는다', () => {
        render(<SymbolViewPing symbol="AAPL" />);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('입력 후 심볼을 JSON 본문으로 보내고 오늘 목록에 기록한다', async () => {
        render(<SymbolViewPing symbol="AAPL" />);
        fireInteraction();

        await waitFor(() => {
            expect(storedSymbols()).toEqual({
                date: TODAY,
                symbols: ['AAPL'],
            });
        });
        expect(fetch).toHaveBeenCalledWith(
            '/api/presence/symbol',
            expect.objectContaining({
                method: 'POST',
                keepalive: true,
                body: JSON.stringify({ symbol: 'AAPL' }),
                signal: expect.any(AbortSignal),
            })
        );
    });

    it('같은 날 같은 심볼은 다시 보내지 않는다', () => {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ date: TODAY, symbols: ['AAPL'] })
        );
        render(<SymbolViewPing symbol="AAPL" />);
        fireInteraction();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('같은 날 다른 심볼은 보내고 목록에 덧붙인다', async () => {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ date: TODAY, symbols: ['AAPL'] })
        );
        render(<SymbolViewPing symbol="NVDA" />);
        fireInteraction();
        await waitFor(() => {
            expect(storedSymbols()).toEqual({
                date: TODAY,
                symbols: ['AAPL', 'NVDA'],
            });
        });
    });

    it('날짜가 바뀌었으면 목록을 새로 시작한다', async () => {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ date: '2000-01-01', symbols: ['AAPL'] })
        );
        render(<SymbolViewPing symbol="AAPL" />);
        fireInteraction();
        await waitFor(() => {
            expect(storedSymbols()).toEqual({
                date: TODAY,
                symbols: ['AAPL'],
            });
        });
    });

    it('저장값이 깨져 있으면 무시하고 보낸다', async () => {
        window.localStorage.setItem(STORAGE_KEY, '{not json');
        render(<SymbolViewPing symbol="AAPL" />);
        fireInteraction();
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledTimes(1);
        });
    });

    it('응답이 실패하면 기록하지 않는다', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        render(<SymbolViewPing symbol="AAPL" />);
        fireInteraction();
        await waitFor(() => {
            expect(fetch).toHaveBeenCalled();
        });
        expect(storedSymbols()).toBeNull();
    });

    it('자동화 브라우저에서는 게이트조차 등록하지 않는다', () => {
        Object.defineProperty(navigator, 'webdriver', {
            value: true,
            configurable: true,
        });
        render(<SymbolViewPing symbol="AAPL" />);
        fireInteraction();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('심볼이 바뀌면 이전 게이트를 해제하고 새 심볼로 등록한다', async () => {
        const { rerender } = render(<SymbolViewPing symbol="AAPL" />);
        rerender(<SymbolViewPing symbol="NVDA" />);
        fireInteraction();
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledTimes(1);
        });
        expect(fetch).toHaveBeenCalledWith(
            '/api/presence/symbol',
            expect.objectContaining({
                body: JSON.stringify({ symbol: 'NVDA' }),
            })
        );
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/features/visitor-ping/__tests__/SymbolViewPing.test.tsx`
Expected: FAIL — `SymbolViewPing` is not exported

- [ ] **Step 3: 구현**

```tsx
// src/features/visitor-ping/ui/SymbolViewPing.tsx
'use client';

import { useEffect } from 'react';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { onFirstInteraction } from '@/shared/lib/onFirstInteraction';

/** 오늘(KST) 이미 보낸 심볼 목록. 날짜가 바뀌면 버린다. */
const STORAGE_KEY = 'siglens:symbol-views';

/** VisitorPing과 같은 이유로 짧게 — 화면에 영향 없는 요청이 커넥션을 붙잡지 않게. */
const BEACON_TIMEOUT_MS = 5000;

interface SentToday {
    date: string;
    symbols: string[];
}

function isSentToday(value: unknown): value is SentToday {
    if (typeof value !== 'object' || value === null) return false;
    const { date, symbols } = value as Partial<SentToday>;
    return typeof date === 'string' && Array.isArray(symbols);
}

function readSent(today: string): string[] {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === null) return [];
        const parsed: unknown = JSON.parse(raw);
        return isSentToday(parsed) && parsed.date === today
            ? parsed.symbols
            : [];
    } catch {
        // 프라이빗 모드·깨진 값 — 보낸다. 중복은 임계값이 흡수한다.
        return [];
    }
}

function sendView(symbol: string): void {
    const today = kstDateKey(new Date());
    if (readSent(today).includes(symbol)) return;

    void fetch('/api/presence/symbol', {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbol }),
        signal: AbortSignal.timeout(BEACON_TIMEOUT_MS),
    })
        .then(response => {
            if (!response.ok) return;
            try {
                // 쓰기 직전에 다시 읽는다 — 다른 탭이 그사이 덧붙였을 수 있다.
                const next: SentToday = {
                    date: today,
                    symbols: [...readSent(today), symbol],
                };
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
                // 기록 실패는 다음 로드에서 한 번 더 보내는 것으로 끝난다.
            }
        })
        .catch(() => {
            // 차단기·오프라인·타임아웃. 집계 하나 놓치는 편이 낫다.
        });
}

/**
 * 종목 페이지 조회를 종목당 하루 한 번 알린다. 인기 목록 스크립트의 추가 후보 신호다.
 *
 * `VisitorPing`과 같은 봇 필터를 쓴다: `navigator.webdriver` 차단 + 첫 신뢰 입력
 * 게이트(`onFirstInteraction`). `@/entities/symbol-view` barrel은 `server-only`라
 * import하지 않는다 — 이 컴포넌트는 URL만 안다.
 */
export function SymbolViewPing({ symbol }: { symbol: string }): null {
    useEffect(() => {
        if (navigator.webdriver) return;
        return onFirstInteraction(() => sendView(symbol));
    }, [symbol]);

    return null;
}
```

```ts
// src/features/visitor-ping/index.ts
export { SymbolViewPing } from './ui/SymbolViewPing';
export { VisitorPing } from './ui/VisitorPing';
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/features/visitor-ping/__tests__/SymbolViewPing.test.tsx`
Expected: PASS

- [ ] **Step 5: 레이아웃 테스트에 마운트 단언 추가** — `layout.test.tsx`의 다른 `vi.mock` 옆에 추가:

```ts
vi.mock('@/features/visitor-ping', () => ({
    SymbolViewPing: function SymbolViewPing() {
        return null;
    },
}));
```

파일 상단 import 구역(158행 `import { RelatedSymbols } ...` 근처)에 `import { SymbolViewPing } from '@/features/visitor-ping';` 추가. "jail의 자식이 아니라 형제로 렌더된다" 테스트가 있는 `describe` 블록 안에 추가:

```ts
    it('정규(대문자) 심볼로 조회수 비콘을 마운트한다', async () => {
        const tree = await SymbolLayout({
            children: null,
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });
        const providers = (tree as { props?: { children?: unknown } }).props
            ?.children;
        const siblings = (providers as { props?: { children?: unknown } })
            ?.props?.children;
        if (!Array.isArray(siblings)) {
            throw new Error('providers children is not an array');
        }
        const ping = siblings.find(
            child =>
                (child as { type?: unknown } | null)?.type === SymbolViewPing
        ) as { props: { symbol: string } } | undefined;

        expect(ping?.props.symbol).toBe('AAPL');
    });
```

Run: `yarn test "src/app/[locale]/[symbol]/__tests__/layout.test.tsx"`
Expected: FAIL — `ping` undefined

- [ ] **Step 6: 레이아웃 수정** — `layout.tsx` import 구역에 추가:

```ts
import { SymbolViewPing } from '@/features/visitor-ping';
```

`<RelatedSymbols symbol={ticker} />` 줄 바로 아래(같은 형제 레벨)에 추가:

```tsx
                {/* 조회수 비콘 — notFound() 판정 뒤라 실재 종목만 집계된다.
                    레이아웃은 같은 종목의 탭 이동에서 유지되므로 탭마다 재전송하지 않는다. */}
                <SymbolViewPing symbol={ticker} />
```

- [ ] **Step 7: 통과 확인**

Run: `yarn test "src/app/[locale]/[symbol]/__tests__/layout.test.tsx" src/features/visitor-ping`
Expected: PASS (기존 "형제로 렌더" 테스트 포함)

- [ ] **Step 8: 체크포인트** — `yarn typecheck && yarn lint`.

---

### Task 7: `kr-trending` 정적 준비 + 관련 종목 제외

**Files:**
- Modify: `src/shared/lib/types.ts`, `src/shared/config/popular-tickers.ts`, `src/widgets/home/TickerCategories.tsx`, `src/shared/config/tickerCategoryLabel.ts`, `messages/{ko,en,ja,zh}.json`, `src/shared/config/relatedSymbols.ts`
- Test: `src/shared/config/__tests__/relatedSymbols.krTrending.test.ts`

카테고리 **객체는 추가하지 않는다** (`popular-tickers.test.ts`가 `items.length > 0` 요구). 스크립트가 첫 KR 후보 때 만든다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/shared/config/__tests__/relatedSymbols.krTrending.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `kr-trending`은 업종이 아니라 수요 묶음이다. 테마 그룹에 들어가면 서로 무관한 종목이
 * "관련 종목"으로 연결된다. 아직 실제 config에는 이 카테고리가 없으므로(스크립트가 첫
 * 후보 때 생성) 목으로 주입해 검증한다.
 */
describe('relatedSymbols — kr-trending 제외', () => {
    afterEach(() => {
        vi.doUnmock('@/shared/config/popular-tickers');
        vi.resetModules();
    });

    it('kr-trending 항목끼리 테마 피어가 되지 않는다', async () => {
        vi.resetModules();
        vi.doMock('@/shared/config/popular-tickers', async () => {
            const actual = await vi.importActual<
                typeof import('@/shared/config/popular-tickers')
            >('@/shared/config/popular-tickers');
            return {
                ...actual,
                TICKER_CATEGORIES: [
                    ...actual.TICKER_CATEGORIES,
                    {
                        id: 'kr-trending',
                        label: '관심 급상승',
                        items: [
                            { symbol: '111110.KS', name: '가' },
                            { symbol: '222220.KQ', name: '나' },
                        ],
                    },
                ],
            };
        });
        const { themePeersOf } = await import(
            '@/shared/config/relatedSymbols'
        );

        expect(themePeersOf('111110.KS')).not.toContain('222220.KQ');
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/shared/config/__tests__/relatedSymbols.krTrending.test.ts`
Expected: FAIL — `222220.KQ`가 피어로 포함됨 (typecheck상 `'kr-trending'`이 `CategoryId`에 없어도 vitest는 실행된다)

- [ ] **Step 3: 구현**

`src/shared/lib/types.ts` — `| 'kr-kosdaq';` 를 교체:

```ts
    | 'kr-kosdaq'
    // 업종이 아니라 수요 묶음 — `update-popular-tickers.ts`가 방문 조회수로 채운다.
    // 객체는 첫 후보 때 스크립트가 생성하므로 config에 없을 수 있다.
    | 'kr-trending';
```

`src/shared/config/popular-tickers.ts` — `KR_CATEGORY_IDS` 집합의 `'kr-kosdaq',` 뒤에 한 줄:

```ts
    // 스크립트가 만들기 전까지 config에 없다 — `has` 판정만 하므로 무해.
    'kr-trending',
```

`src/widgets/home/TickerCategories.tsx` — `CATEGORY_STYLES`의 `'kr-kosdaq': {...},` 뒤에:

```ts
    'kr-trending': {
        borderColor: 'border-l-primary-400',
        textColor: 'text-primary-400',
    },
```

`src/shared/config/tickerCategoryLabel.ts` — 두 맵의 `코스닥:` 줄 뒤에 각각:

```ts
    '관심 급상승': 'tickerCategory.Trendinginterest',
```
```ts
    '관심 급상승': 'categoryDescription.Trendinginterest',
```

`src/shared/config/relatedSymbols.ts` — `THEME_GROUPS`의 `...TICKER_CATEGORIES.map(c => ({` 를 교체:

```ts
    // `kr-trending`은 업종이 아니라 수요 묶음이라 제외한다 — 넣으면 서로 무관한
    // 종목이 "관련 종목"으로 연결된다.
    ...TICKER_CATEGORIES.filter(c => c.id !== 'kr-trending').map(c => ({
```

메시지 4종 — JSON 재직렬화는 파일 포맷을 바꾸므로 **앵커 삽입**으로 한다. 새 키를
`"KOSDAQ"` 줄 **앞**에 넣으므로 뒤에 항목이 있든 없든 쉼표가 항상 맞다. 워크트리 루트에서:

```bash
python3 - <<'PY'
import re
VALUES = {
    'ko': ('관심 급상승', '이번 주 SigLens 방문자가 많이 찾은 한국 종목입니다.'),
    'en': ('Trending on SigLens', 'Korean stocks SigLens visitors looked up most this week.'),
    'ja': ('注目急上昇', '今週SigLensの訪問者がよく調べた韓国銘柄です。'),
    'zh': ('关注飙升', '本周SigLens访问者查看最多的韩国股票。'),
}
for locale, (label, desc) in VALUES.items():
    path = f'messages/{locale}.json'
    s = open(path, encoding='utf-8').read()
    for block, value in (('"tickerCategory": {', label), ('"categoryDescription": {', desc)):
        start = s.index(block)
        m = re.compile(r'\n(\s*)"KOSDAQ": ').search(s, start)
        assert m, (path, block)
        assert '"Trendinginterest"' not in s[start:m.start()], (path, block, 'already present')
        s = s[:m.start()] + f'\n{m.group(1)}"Trendinginterest": "{value}",' + s[m.start():]
    open(path, 'w', encoding='utf-8').write(s)
    print('ok', path)
PY
```

Run: `node -e "for (const l of ['ko','en','ja','zh']) { const m = require('./messages/'+l+'.json').widgets.home; console.log(l, m.tickerCategory.Trendinginterest, '|', m.categoryDescription.Trendinginterest) }"`
Expected: 4줄, 값 모두 존재.

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/shared/config/__tests__/relatedSymbols.krTrending.test.ts src/shared/config/__tests__/relatedSymbols.test.ts src/shared/config/__tests__/popular-tickers.test.ts src/widgets/home src/shared/i18n src/__tests__/guards`
Expected: PASS

- [ ] **Step 5: 체크포인트** — `yarn typecheck && yarn lint`.

---

### Task 8: 순수 후보 선정 `scripts/lib/visitCandidates.ts`

**Files:**
- Create: `scripts/lib/visitCandidates.ts`
- Test: `scripts/lib/__tests__/visitCandidates.test.ts`
- Modify: `tsconfig.scripts.json`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// scripts/lib/__tests__/visitCandidates.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    MAX_VISIT_CANDIDATES_PER_CLASS,
    classifyVisitSymbol,
    extractExistingKrTickers,
    selectVisitCandidates,
} from '../visitCandidates';

const CRYPTO = new Set(['BTCUSD', 'ETHUSD']);
const classify = (s: string) => classifyVisitSymbol(s, CRYPTO);

describe('classifyVisitSymbol', () => {
    it.each([
        ['005930.KS', 'kr'],
        ['058470.KQ', 'kr'],
        ['BTCUSD', 'crypto'],
        ['AAPL', 'us'],
        ['BRK.B', 'us'],
    ])('%s → %s', (symbol, expected) => {
        expect(classify(symbol)).toBe(expected);
    });
});

describe('selectVisitCandidates', () => {
    const tallies = [
        { symbol: 'NVDA', views: 20 },
        { symbol: 'BTCUSD', views: 15 },
        { symbol: '005930.KS', views: 12 },
        { symbol: 'AAPL', views: 10 },
        { symbol: 'PLTR', views: 3 },
    ];

    it('자산군이 맞고 기존 목록에 없는 것만, 조회수 순으로', () => {
        const result = selectVisitCandidates(
            tallies,
            'us',
            new Set(['AAPL']),
            classify
        );
        expect(result).toEqual([
            { symbol: 'NVDA', views: 20 },
            { symbol: 'PLTR', views: 3 },
        ]);
    });

    it('입력 순서와 무관하게 조회수 내림차순', () => {
        const result = selectVisitCandidates(
            [...tallies].reverse(),
            'us',
            new Set(),
            classify
        );
        expect(result.map(t => t.symbol)).toEqual(['NVDA', 'AAPL', 'PLTR']);
    });

    it(`자산군별 상한 ${MAX_VISIT_CANDIDATES_PER_CLASS}개`, () => {
        const many = Array.from({ length: 9 }, (_, i) => ({
            symbol: `T${String.fromCharCode(65 + i)}`,
            views: 100 - i,
        }));
        expect(
            selectVisitCandidates(many, 'us', new Set(), classify)
        ).toHaveLength(MAX_VISIT_CANDIDATES_PER_CLASS);
    });

    it('KR·크립토를 각각 분리해 고른다', () => {
        expect(
            selectVisitCandidates(tallies, 'kr', new Set(), classify)
        ).toEqual([{ symbol: '005930.KS', views: 12 }]);
        expect(
            selectVisitCandidates(tallies, 'crypto', new Set(), classify)
        ).toEqual([{ symbol: 'BTCUSD', views: 15 }]);
    });
});

describe('extractExistingKrTickers', () => {
    it('실제 popular-tickers.ts에서 KR 블록 심볼을 읽는다 (US 제외)', () => {
        const content = readFileSync(
            resolve(process.cwd(), 'src/shared/config/popular-tickers.ts'),
            'utf-8'
        );
        const kr = extractExistingKrTickers(content);
        expect(kr.has('005930.KS')).toBe(true);
        expect(kr.has('403870.KQ')).toBe(true);
        expect(kr.has('AAPL')).toBe(false);
    });

    it('POPULAR_TICKERS 선언 앞(카테고리 영역)의 KR 심볼은 세지 않는다', () => {
        const content = [
            "items: [{ symbol: '999990.KS', name: '카테고리만' }],",
            'export const POPULAR_TICKERS = [',
            "    '005930.KS', // 삼성전자",
            '] as const;',
        ].join('\n');
        expect([...extractExistingKrTickers(content)]).toEqual(['005930.KS']);
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test scripts/lib/__tests__/visitCandidates.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

```ts
// scripts/lib/visitCandidates.ts
/**
 * 인기 목록 스크립트의 **방문 기반 추가 후보** 선정 — 순수 함수만.
 *
 * `symbol_views_daily`의 최근 합계를 받아 자산군별로 "기존 목록에 없는 상위 N개"를
 * 고른다. 시장 필터(가격·시총 등)는 각 스크립트가 이 뒤에서 건다.
 */
import type { SymbolViewTally } from '@/entities/symbol-view/types';
import { KR_EXCHANGE_SUFFIX_RE } from '@/shared/config/ticker';

export type AssetClass = 'us' | 'kr' | 'crypto';

/** 스크립트가 읽는 구간. 거래량 후보의 주간 기준과 맞춘다. */
export const VISIT_LOOKBACK_DAYS = 7;

/**
 * 후보가 되는 최소 조회수(구간 합계, 종목당 하루 1회 중복 제거된 값).
 * 2026-09 실측 실사용자 DAU가 20~38명이라 작게 잡는다. 1~2는 크롤러 순회·우연 방문이
 * 대부분이다.
 */
export const MIN_WEEKLY_VIEWS = 3;

/** 실행 1회·자산군당 상한. 기존 거래량·시총 후보와 별도 할당이다. */
export const MAX_VISIT_CANDIDATES_PER_CLASS = 5;

const POPULAR_TICKERS_DECLARATION = 'export const POPULAR_TICKERS = [';

export function classifyVisitSymbol(
    symbol: string,
    cryptoSymbols: ReadonlySet<string>
): AssetClass {
    if (KR_EXCHANGE_SUFFIX_RE.test(symbol)) return 'kr';
    if (cryptoSymbols.has(symbol)) return 'crypto';
    return 'us';
}

export function selectVisitCandidates(
    tallies: readonly SymbolViewTally[],
    assetClass: AssetClass,
    existing: ReadonlySet<string>,
    classify: (symbol: string) => AssetClass
): SymbolViewTally[] {
    return tallies
        .filter(t => classify(t.symbol) === assetClass)
        .filter(t => !existing.has(t.symbol))
        .slice()
        .sort((a, b) => b.views - a.views)
        .slice(0, MAX_VISIT_CANDIDATES_PER_CLASS);
}

/**
 * `POPULAR_TICKERS` 안의 KR 심볼.
 *
 * `update-popular-tickers.ts`의 `extractExistingTickers`는 정규식이 `[A-Z]`로 시작해
 * `005930.KS`를 못 본다. 그걸 그대로 쓰면 이미 있는 KR 종목을 신규로 판정한다.
 */
export function extractExistingKrTickers(fileContent: string): Set<string> {
    const start = fileContent.indexOf(POPULAR_TICKERS_DECLARATION);
    if (start === -1) return new Set();
    const section = fileContent.slice(start);
    return new Set(
        [...section.matchAll(/['"](\d{6}\.K[SQ])['"]/g)].map(m => m[1]!)
    );
}
```

`tsconfig.scripts.json`의 `"files"` 배열에 알파벳 위치로 추가:

```json
        "scripts/lib/visitCandidates.ts",
```
```json
        "scripts/lib/__tests__/visitCandidates.test.ts",
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test scripts/lib/__tests__/visitCandidates.test.ts`
Expected: PASS

- [ ] **Step 5: 체크포인트** — `yarn typecheck && yarn lint`.

---

### Task 9: KR 텍스트 삽입 `scripts/lib/krTrendingInsert.ts`

**Files:**
- Create: `scripts/lib/krTrendingInsert.ts`
- Test: `scripts/lib/__tests__/krTrendingInsert.test.ts`
- Modify: `tsconfig.scripts.json`

- [ ] **Step 1: 실패하는 테스트 작성** — 손으로 만든 픽스처가 아니라 **실제 `popular-tickers.ts` 원문**에 적용한다.

```ts
// scripts/lib/__tests__/krTrendingInsert.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { insertKrTrendingItems } from '../krTrendingInsert';
import { extractExistingKrTickers } from '../visitCandidates';

const REAL = readFileSync(
    resolve(process.cwd(), 'src/shared/config/popular-tickers.ts'),
    'utf-8'
);

/** kr-trending 카테고리 블록의 심볼들. */
function trendingItems(content: string): string[] {
    const at = content.indexOf("id: 'kr-trending',");
    if (at === -1) return [];
    const end = content.indexOf('\n        ],', at);
    return [
        ...content.slice(at, end).matchAll(/symbol: '([^']+)'/g),
    ].map(m => m[1]!);
}

const ITEM_A = { symbol: '000100.KS', name: '유한양행' };
const ITEM_B = { symbol: '042700.KS', name: '한미반도체' };

describe('insertKrTrendingItems', () => {
    it('카테고리가 없으면 TICKER_CATEGORIES 끝에 만든다', () => {
        const out = insertKrTrendingItems(REAL, [ITEM_A]);
        expect(trendingItems(out)).toEqual(['000100.KS']);
        expect(out).toContain("label: '관심 급상승',");
        // 카테고리는 TICKER_CATEGORIES 배열 안, KR_CATEGORY_IDS 선언보다 앞이다.
        expect(out.indexOf("id: 'kr-trending',")).toBeLessThan(
            out.indexOf('export const KR_CATEGORY_IDS')
        );
    });

    it('POPULAR_TICKERS의 KR 블록 끝(US Trending 섹션 앞)에 넣는다', () => {
        const out = insertKrTrendingItems(REAL, [ITEM_A]);
        const lastKr = out.indexOf("'403870.KQ', // HPSP");
        const inserted = out.indexOf("'000100.KS', // 유한양행");
        const nextTrending = out.indexOf('// --- Trending', lastKr);
        expect(inserted).toBeGreaterThan(lastKr);
        expect(nextTrending === -1 || inserted < nextTrending).toBe(true);
    });

    it('KR 합집합 불변식 — 카테고리 KR 심볼 전체 = POPULAR_TICKERS KR 블록', () => {
        const out = insertKrTrendingItems(REAL, [ITEM_A, ITEM_B]);
        const categoryPart = out.slice(
            out.indexOf('export const TICKER_CATEGORIES'),
            out.indexOf('export const KR_CATEGORY_IDS')
        );
        const categoryKr = new Set(
            [...categoryPart.matchAll(/symbol: '(\d{6}\.K[SQ])'/g)].map(
                m => m[1]!
            )
        );
        expect([...categoryKr].sort()).toEqual(
            [...extractExistingKrTickers(out)].sort()
        );
    });

    it('카테고리가 이미 있으면 items 끝에 덧붙인다 (블록을 새로 만들지 않는다)', () => {
        const once = insertKrTrendingItems(REAL, [ITEM_A]);
        const twice = insertKrTrendingItems(once, [ITEM_B]);
        expect(trendingItems(twice)).toEqual(['000100.KS', '042700.KS']);
        expect(twice.split("id: 'kr-trending',")).toHaveLength(2);
    });

    it('이미 있는 심볼은 건너뛴다 (멱등)', () => {
        const once = insertKrTrendingItems(REAL, [ITEM_A]);
        expect(insertKrTrendingItems(once, [ITEM_A])).toBe(once);
        // 기존 KR 블록 종목도 마찬가지.
        expect(
            insertKrTrendingItems(REAL, [{ symbol: '005930.KS', name: '삼성전자' }])
        ).toBe(REAL);
    });

    it('이름의 작은따옴표를 이스케이프한다', () => {
        const out = insertKrTrendingItems(REAL, [
            { symbol: '000100.KS', name: "O'Brien" },
        ]);
        expect(out).toContain("name: 'O\\'Brien'");
    });

    it('앵커가 없으면 던진다', () => {
        expect(() =>
            insertKrTrendingItems('const x = 1;', [ITEM_A])
        ).toThrow(/TICKER_CATEGORIES/);
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test scripts/lib/__tests__/krTrendingInsert.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

```ts
// scripts/lib/krTrendingInsert.ts
/**
 * 방문 기반 KR 후보를 `popular-tickers.ts`에 넣는 텍스트 편집 — 순수 함수.
 *
 * KR 종목은 두 곳에 **같이** 들어가야 한다(`popular-tickers.test.ts` 합집합 불변식):
 *  1. `TICKER_CATEGORIES`의 `kr-trending` 카테고리 — 홈 그리드가 한국 종목 페이지로 가는
 *     유일한 크롤 가능 링크다.
 *  2. `POPULAR_TICKERS`의 KR 블록 — sitemap·색인 판정·프리웜의 입력.
 *
 * 카테고리 객체는 첫 후보 때 만든다. 빈 카테고리를 config에 미리 두면 `items.length > 0`
 * 검사가 깨진다. 라인 번호가 아니라 앵커 문자열로 위치를 찾고, 앵커가 없으면 던진다.
 */
import { extractExistingKrTickers } from './visitCandidates';

export interface KrTrendingItem {
    symbol: string;
    name: string;
}

export const KR_TRENDING_CATEGORY_ID = 'kr-trending';
export const KR_TRENDING_LABEL = '관심 급상승';

const CATEGORIES_DECLARATION =
    'export const TICKER_CATEGORIES: readonly TickerCategory[] = [';
const CATEGORIES_END = '\n];\n';
const CATEGORY_ITEMS_END = '\n        ],';
const POPULAR_DECLARATION = 'export const POPULAR_TICKERS = [';
const POPULAR_END = '] as const;';
const KR_POPULAR_LINE_RE = /^ {4}'\d{6}\.K[SQ]',.*$/gm;

function quote(value: string): string {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function insertIntoCategory(
    content: string,
    items: readonly KrTrendingItem[]
): string {
    const declAt = content.indexOf(CATEGORIES_DECLARATION);
    if (declAt === -1) {
        throw new Error('TICKER_CATEGORIES declaration not found');
    }
    const endAt = content.indexOf(CATEGORIES_END, declAt);
    if (endAt === -1) throw new Error('TICKER_CATEGORIES end not found');

    const itemLines = items
        .map(
            i =>
                `            { symbol: ${quote(i.symbol)}, name: ${quote(i.name)} },`
        )
        .join('\n');

    const idAt = content.indexOf(`id: '${KR_TRENDING_CATEGORY_ID}',`, declAt);
    if (idAt !== -1 && idAt < endAt) {
        const itemsEnd = content.indexOf(CATEGORY_ITEMS_END, idAt);
        if (itemsEnd === -1 || itemsEnd > endAt) {
            throw new Error('kr-trending items array end not found');
        }
        return `${content.slice(0, itemsEnd)}\n${itemLines}${content.slice(itemsEnd)}`;
    }

    const block = [
        '',
        '    {',
        `        id: '${KR_TRENDING_CATEGORY_ID}',`,
        `        label: '${KR_TRENDING_LABEL}',`,
        '        // update-popular-tickers.ts가 방문 조회수로 채운다. 업종이 아니라 수요',
        '        // 묶음이라 relatedSymbols 테마 그룹에서 제외된다.',
        '        items: [',
        itemLines,
        '        ],',
        '    },',
    ].join('\n');
    return `${content.slice(0, endAt)}${block}${content.slice(endAt)}`;
}

function insertIntoPopular(
    content: string,
    items: readonly KrTrendingItem[]
): string {
    const declAt = content.indexOf(POPULAR_DECLARATION);
    if (declAt === -1) {
        throw new Error('POPULAR_TICKERS declaration not found');
    }
    const endAt = content.indexOf(POPULAR_END, declAt);
    if (endAt === -1) throw new Error('POPULAR_TICKERS end not found');

    const matches = [
        ...content.slice(declAt, endAt).matchAll(KR_POPULAR_LINE_RE),
    ];
    const last = matches.at(-1);
    if (last?.index === undefined) {
        throw new Error('KR block not found in POPULAR_TICKERS');
    }
    // KR 블록 뒤에 US Trending 섹션이 이어지므로 배열 끝이 아니라 마지막 KR 줄 뒤다.
    const insertAt = declAt + last.index + last[0].length;
    const lines = items
        .map(i => `\n    ${quote(i.symbol)}, // ${i.name}`)
        .join('');
    return `${content.slice(0, insertAt)}${lines}${content.slice(insertAt)}`;
}

export function insertKrTrendingItems(
    content: string,
    items: readonly KrTrendingItem[]
): string {
    if (!content.includes(CATEGORIES_DECLARATION)) {
        throw new Error('TICKER_CATEGORIES declaration not found');
    }
    const existing = extractExistingKrTickers(content);
    const fresh = items.filter(
        (item, i) =>
            !existing.has(item.symbol) &&
            items.findIndex(other => other.symbol === item.symbol) === i
    );
    if (fresh.length === 0) return content;
    return insertIntoPopular(insertIntoCategory(content, fresh), fresh);
}
```

`tsconfig.scripts.json` `"files"`에 추가:

```json
        "scripts/lib/krTrendingInsert.ts",
```
```json
        "scripts/lib/__tests__/krTrendingInsert.test.ts",
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test scripts/lib/__tests__/krTrendingInsert.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 체크포인트** — `yarn typecheck && yarn lint`.

---

### Task 10: DB 로더 `scripts/lib/visitSources.ts` + 명령 변경

**Files:**
- Create: `scripts/lib/visitSources.ts`
- Modify: `tsconfig.scripts.json`, `package.json`

얇은 I/O라 단위 테스트 대신 Task 12의 실측 스모크로 검증한다(마이그레이션 적용 전 운영 DB엔 테이블이 없으므로 "경고 후 null" 경로가 실제로 확인된다).

- [ ] **Step 1: 구현**

```ts
// scripts/lib/visitSources.ts
/**
 * 방문 후보 선정에 필요한 DB 입력을 한 번에 읽는다 — SELECT만.
 *
 * 실패하면 경고만 찍고 `null`을 돌려준다. 방문 후보는 부가 신호라 DB가 안 되면(테이블
 * 미적용·네트워크) 스크립트의 주 기능(거래량·시총 후보)은 그대로 돌아야 한다.
 *
 * `server-only` 모듈을 끌어오므로 호출 스크립트는 `--conditions=react-server`로 실행한다
 * (package.json 참고).
 */
import { DrizzleSymbolViewRepository } from '@/entities/symbol-view/api';
import type { SymbolViewTally } from '@/entities/symbol-view/types';
import { DrizzleKoreanTickerRepository } from '@/entities/ticker/api';
import { getDatabaseClient } from '@/shared/db/client';
import { cryptoAssets } from '@/shared/db/schema';
import { kstDateKey, kstDateKeyDaysBefore } from '@/shared/lib/etTimeUtils';
import { MIN_WEEKLY_VIEWS, VISIT_LOOKBACK_DAYS } from './visitCandidates';

export interface VisitSources {
    readonly tallies: readonly SymbolViewTally[];
    /** 상장 중인 KR 종목 → 한글명 (`korean_tickers`, `delisted_at IS NULL`). */
    readonly krNames: ReadonlyMap<string, string>;
    /** `crypto_assets` 심볼 — 방문 심볼의 크립토 판별용. */
    readonly cryptoSymbols: ReadonlySet<string>;
}

export async function loadVisitSources(
    now: Date = new Date()
): Promise<VisitSources | null> {
    try {
        const { db } = getDatabaseClient();
        const fromDate = kstDateKeyDaysBefore(
            kstDateKey(now),
            VISIT_LOOKBACK_DAYS
        );
        const [tallies, krRows, cryptoRows] = await Promise.all([
            new DrizzleSymbolViewRepository(db).topViewed(
                fromDate,
                MIN_WEEKLY_VIEWS
            ),
            new DrizzleKoreanTickerRepository(db).findAll(),
            db.select({ symbol: cryptoAssets.symbol }).from(cryptoAssets),
        ]);
        return {
            tallies,
            krNames: new Map(krRows.map(r => [r.symbol, r.koreanName])),
            cryptoSymbols: new Set(cryptoRows.map(r => r.symbol)),
        };
    } catch (error) {
        console.warn(
            `[visit] 방문 후보를 건너뛴다 — DB 조회 실패: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
        return null;
    }
}
```

`tsconfig.scripts.json` `"files"`에 `"scripts/lib/visitSources.ts",` 추가.

`package.json` 두 줄 교체:

```json
        "update-popular-tickers": "NODE_OPTIONS=--conditions=react-server dotenv -e .env.local -- node_modules/.bin/tsx update-popular-tickers.ts",
        "update-popular-cryptos": "NODE_OPTIONS=--conditions=react-server dotenv -e .env.local -- node_modules/.bin/tsx scripts/update-popular-cryptos.ts",
```

- [ ] **Step 2: 체크포인트** — `yarn typecheck && yarn lint`.

---

### Task 11: US·KR 통합 — `update-popular-tickers.ts`

**Files:**
- Modify: `update-popular-tickers.ts`
- Modify: `src/shared/db/__tests__/update-popular-tickers.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — 기존 테스트 파일 import 목록에 `visitKrRejection, visitUsRejection`을 추가하고 파일 끝에:

```ts
describe('visitUsRejection', () => {
    const ok = {
        symbol: 'PLTR',
        price: 30,
        marketCap: 60_000_000_000,
        isEtf: false,
        isFund: false,
        isActivelyTrading: true,
        exchange: 'NASDAQ',
        companyName: 'Palantir',
    };

    it('조건을 모두 만족하면 null', () => {
        expect(visitUsRejection(ok, 5, false)).toBeNull();
    });

    it.each([
        ['프로필 없음', null, 5, false, 'no FMP profile'],
        ['거래 중단', { ...ok, isActivelyTrading: false }, 5, false, 'not actively trading'],
        ['크립토 거래소', { ...ok, exchange: 'CRYPTO' }, 5, false, 'exchange CRYPTO'],
        ['OTC', { ...ok, exchange: 'OTC' }, 5, false, 'exchange OTC'],
        ['펀드', { ...ok, isFund: true }, 5, false, 'fund'],
        ['ETF(플래그 없음)', { ...ok, isEtf: true }, 5, false, 'ETF (pass --include-etf)'],
        ['저가', { ...ok, price: 4.99 }, 5, false, 'price < $5'],
        ['소형', { ...ok, marketCap: 1_999_999_999 }, 5, false, 'market cap < $2B'],
        ['봉 없음', ok, null, false, 'no EOD bars'],
        ['급등락', ok, 20, false, 'max daily change ≥ 20%'],
    ])('%s → 탈락', (_label, profile, change, includeEtf, reason) => {
        expect(visitUsRejection(profile, change, includeEtf)).toBe(reason);
    });

    it('--include-etf면 ETF 통과', () => {
        expect(visitUsRejection({ ...ok, isEtf: true }, 5, true)).toBeNull();
    });
});

describe('visitKrRejection', () => {
    it('상장·시총 1조 이상이면 null', () => {
        expect(visitKrRejection('유한양행', 5_000_000_000_000)).toBeNull();
    });
    it('korean_tickers에 없거나 상장폐지 → 탈락', () => {
        expect(visitKrRejection(undefined, 5_000_000_000_000)).toBe(
            'not listed in korean_tickers'
        );
    });
    it('시총 조회 실패 → 탈락', () => {
        expect(visitKrRejection('유한양행', null)).toBe('no market cap');
    });
    it('1조 미만 → 탈락', () => {
        expect(visitKrRejection('소형주', 999_999_999_999)).toBe(
            'market cap < ₩1조'
        );
    });
});
```

(`it.each`의 `profile` 타입이 섞여 TS가 불평하면 표 위에 `const cases: Array<[string, FmpProfile | null, number | null, boolean, string]> = [...]`로 선언하고 `FmpProfile`을 import한다.)

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/shared/db/__tests__/update-popular-tickers.test.ts`
Expected: FAIL — `visitUsRejection` is not a function

- [ ] **Step 3: 상수·타입·판정 함수 추가** — `update-popular-tickers.ts`:

import 구역에 추가:

```ts
import { CANONICAL_KOREAN_NAMES } from '@/shared/config/canonical-korean-names';
import { insertKrTrendingItems, type KrTrendingItem } from './scripts/lib/krTrendingInsert';
import {
    classifyVisitSymbol,
    extractExistingKrTickers,
    selectVisitCandidates,
} from './scripts/lib/visitCandidates';
import { loadVisitSources, type VisitSources } from './scripts/lib/visitSources';
```

`// --- Constants ---` 구역 끝(`EXCLUDED_TICKERS` 정의 뒤)에:

```ts
/** 방문 후보(US)가 속해야 할 거래소. 크립토(`CRYPTO`)·OTC 잡주를 거른다. */
const VISIT_ALLOWED_EXCHANGES: ReadonlySet<string> = new Set([
    'NASDAQ',
    'NYSE',
    'AMEX',
]);

/**
 * 방문 후보(KR) 최소 시총(KRW). KR 후보는 곧 sitemap·색인 판정·프리웜 대상이 되므로
 * 소형주 롱테일 재개방을 막는다(US `SCREENER_MIN_MARKET_CAP` $2B ≈ 2.8조보다 낮게 —
 * 한국 대형주 풀이 작다).
 */
export const MIN_VISIT_KR_MARKET_CAP_KRW = 1_000_000_000_000;
```

`// --- Types ---` 구역에:

```ts
/** FMP stable `profile` 응답에서 쓰는 필드 (2026-09-24 실키 확인: SOXL). 없는 심볼은 `[]`. */
export interface FmpProfile {
    symbol: string;
    price: number | null;
    marketCap: number | null;
    isEtf: boolean;
    isFund: boolean;
    isActivelyTrading: boolean;
    exchange: string;
    companyName: string;
}
```

`// --- Core logic ---` 구역 끝(`filterAndRank` 뒤)에:

```ts
/** 방문 후보(US) 탈락 사유. 통과면 null. 순서 = 싸고 결정적인 검사 먼저. */
export function visitUsRejection(
    profile: FmpProfile | null,
    maxDailyChangePct: number | null,
    includeEtf: boolean
): string | null {
    if (profile === null) return 'no FMP profile';
    if (!profile.isActivelyTrading) return 'not actively trading';
    if (!VISIT_ALLOWED_EXCHANGES.has(profile.exchange)) {
        return `exchange ${profile.exchange}`;
    }
    if (profile.isFund) return 'fund';
    if (profile.isEtf && !includeEtf) return 'ETF (pass --include-etf)';
    if ((profile.price ?? 0) < MIN_PRICE) return `price < $${MIN_PRICE}`;
    if ((profile.marketCap ?? 0) < SCREENER_MIN_MARKET_CAP) {
        return 'market cap < $2B';
    }
    if (maxDailyChangePct === null) return 'no EOD bars';
    if (maxDailyChangePct >= MAX_DAILY_CHANGE_PCT) {
        return `max daily change ≥ ${MAX_DAILY_CHANGE_PCT}%`;
    }
    return null;
}

/** 방문 후보(KR) 탈락 사유. `name` undefined = 상장 목록에 없음. */
export function visitKrRejection(
    name: string | undefined,
    marketCapKrw: number | null
): string | null {
    if (name === undefined) return 'not listed in korean_tickers';
    if (marketCapKrw === null) return 'no market cap';
    if (marketCapKrw < MIN_VISIT_KR_MARKET_CAP_KRW) return 'market cap < ₩1조';
    return null;
}
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/shared/db/__tests__/update-popular-tickers.test.ts`
Expected: PASS

- [ ] **Step 5: I/O 헬퍼 추가** — `// --- FMP API ---` 구역 끝(`fetchEodBars` 뒤)에:

```ts
async function fetchProfile(
    apiKey: string,
    symbol: string
): Promise<FmpProfile | null> {
    const params = new URLSearchParams({ symbol, apikey: apiKey });
    const res = await fetch(`${FMP_BASE_URL}/profile?${params}`);
    if (!res.ok) {
        console.warn(`  profile fetch failed for ${symbol}: ${res.status}`);
        return null;
    }
    // FMP returns unvalidated JSON; unknown symbols come back as []
    const raw: unknown = await res.json();
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw[0] as FmpProfile;
}

interface YahooQuoteClient {
    quote(
        symbol: string,
        queryOptions?: unknown,
        moduleOptions?: { validateResult?: boolean }
    ): Promise<unknown>;
}

async function fetchKrMarketCap(
    client: YahooQuoteClient,
    symbol: string
): Promise<number | null> {
    try {
        const quote = (await client.quote(toYahooSymbol(symbol), undefined, {
            validateResult: false,
        })) as { marketCap?: unknown } | undefined;
        return typeof quote?.marketCap === 'number' ? quote.marketCap : null;
    } catch {
        return null;
    }
}

/** 방문 후보(US)를 검증해 통과 심볼만 돌려준다. 탈락 사유는 콘솔에 남긴다. */
async function collectVisitUsSymbols(
    apiKey: string,
    visit: VisitSources,
    existing: ReadonlySet<string>,
    includeEtf: boolean
): Promise<string[]> {
    const candidates = selectVisitCandidates(
        visit.tallies,
        'us',
        new Set([...existing, ...EXCLUDED_TICKERS]),
        s => classifyVisitSymbol(s, visit.cryptoSymbols)
    );
    const { from, to } = getLookbackDateRange();
    const passed: string[] = [];
    for (const { symbol, views } of candidates) {
        const profile = await fetchProfile(apiKey, symbol);
        await sleep(REQUEST_DELAY_MS);
        const bars =
            profile === null ? [] : await fetchEodBars(apiKey, symbol, from, to);
        const change = bars.length === 0 ? null : calculateMaxDailyChangePct(bars);
        const reason = visitUsRejection(profile, change, includeEtf);
        console.log(
            `  [visit:us] ${symbol.padEnd(8)} views=${views} → ${reason ?? 'PASS'}`
        );
        if (reason === null) passed.push(symbol);
    }
    return passed;
}

/** 방문 후보(KR)를 검증해 카테고리 항목으로 돌려준다. */
async function collectVisitKrItems(
    visit: VisitSources,
    existingKr: ReadonlySet<string>,
    client: YahooQuoteClient
): Promise<KrTrendingItem[]> {
    const candidates = selectVisitCandidates(
        visit.tallies,
        'kr',
        existingKr,
        s => classifyVisitSymbol(s, visit.cryptoSymbols)
    );
    const passed: KrTrendingItem[] = [];
    for (const { symbol, views } of candidates) {
        const listedName = visit.krNames.get(symbol);
        const marketCap =
            listedName === undefined
                ? null
                : await fetchKrMarketCap(client, symbol);
        const reason = visitKrRejection(listedName, marketCap);
        console.log(
            `  [visit:kr] ${symbol.padEnd(10)} views=${views} → ${reason ?? 'PASS'}`
        );
        if (reason === null && listedName !== undefined) {
            // 홈 카드 이름은 정규명을 따른다(canonical-korean-names.test.ts).
            passed.push({
                symbol,
                name: CANONICAL_KOREAN_NAMES.get(symbol) ?? listedName,
            });
        }
    }
    return passed;
}
```

- [ ] **Step 6: `main` 재구성** — `main()` 안의 `// 2. Fetch screener candidates` 줄부터 `const finalPopularTickers = [` 줄 **직전**까지를 아래로 교체 (앵커: 시작 `    // 2. Fetch screener candidates`, 끝 `    const finalPopularTickers = [`. 두 앵커 존재를 확인하고 교체한다):

```ts
    // 2. Load visit sources (부가 신호 — 실패해도 계속)
    const visit = await loadVisitSources();
    if (visit !== null) {
        console.log(
            `Visit tallies (≥ threshold, last 7d): ${visit.tallies.length}`
        );
    }

    // 3. Fetch screener candidates
    console.log('Fetching screener candidates...');
    const screenerResults = await fetchScreenerResults(apiKey, includeEtf);
    console.log(`Screener returned: ${screenerResults.length} candidates`);

    const newCandidates = screenerResults.filter(
        r => !existingTickers.has(r.symbol) && !EXCLUDED_TICKERS.has(r.symbol)
    );
    console.log(
        `New candidates (not in POPULAR_TICKERS): ${newCandidates.length}`
    );

    // 4. Volume candidates (기존 흐름)
    let volumeSymbols: string[] = [];
    if (newCandidates.length > 0) {
        const cappedCandidates = newCandidates.slice(0, EOD_FETCH_CAP);
        const { from, to } = getLookbackDateRange();
        console.log(
            `\nFetching EOD data for ${cappedCandidates.length} candidates (${from} ~ ${to})...`
        );

        const weeklyVolumes = await cappedCandidates.reduce(
            async (accPromise, candidate) => {
                const acc = await accPromise;
                const bars = await fetchEodBars(
                    apiKey,
                    candidate.symbol,
                    from,
                    to
                );
                await sleep(REQUEST_DELAY_MS);
                if (bars.length === 0) return acc;
                return [
                    ...acc,
                    {
                        symbol: candidate.symbol,
                        companyName: candidate.companyName,
                        weeklyVolume: calculateWeeklyVolume(bars),
                        price: candidate.price,
                        marketCap: candidate.marketCap,
                        maxDailyChangePct: calculateMaxDailyChangePct(bars),
                    },
                ];
            },
            Promise.resolve([] as TickerWeeklyVolume[])
        );

        console.log(`EOD data fetched for ${weeklyVolumes.length} tickers`);
        const topTickers = filterAndRank(weeklyVolumes);
        if (topTickers.length > 0) printResults(topTickers);
        volumeSymbols = topTickers.map(t => t.symbol);
    }

    // 5. Visit candidates (US·KR) — 거래량 후보와 별도 할당
    let visitUsSymbols: string[] = [];
    let visitKrItems: KrTrendingItem[] = [];
    if (visit !== null) {
        console.log('\nValidating visit candidates...');
        visitUsSymbols = await collectVisitUsSymbols(
            apiKey,
            visit,
            new Set([...existingTickers, ...volumeSymbols]),
            includeEtf
        );
        visitKrItems = await collectVisitKrItems(
            visit,
            extractExistingKrTickers(fileContent),
            new YahooFinance({ suppressNotices: ['yahooSurvey'] })
        );
    }

    // 6. Update file content
    const newSymbols = [...volumeSymbols, ...visitUsSymbols];
    let updatedPopularContent = fileContent;
    let addedSymbols: readonly string[] = [];

    if (newSymbols.length > 0) {
        const contentWithTrendingSection = insertTrendingSection(
            updatedPopularContent,
            newSymbols
        );
        addedSymbols =
            contentWithTrendingSection === updatedPopularContent
                ? []
                : newSymbols;
        updatedPopularContent = contentWithTrendingSection;
    }

    if (visitKrItems.length > 0) {
        const before = updatedPopularContent;
        updatedPopularContent = insertKrTrendingItems(
            updatedPopularContent,
            visitKrItems
        );
        if (updatedPopularContent !== before) {
            addedSymbols = [
                ...addedSymbols,
                ...visitKrItems.map(i => i.symbol),
            ];
        }
    }

    if (updatedPopularContent !== fileContent) {
        const finalDeduplication = deduplicatePopularTickerEntries(
            updatedPopularContent
        );
        updatedPopularContent = finalDeduplication.content;
        if (finalDeduplication.removedTickers.length > 0) {
            console.log(
                `Duplicate tickers removed after update: ${finalDeduplication.removedTickers.join(', ')}`
            );
        }
    } else {
        console.log('\nNo new tickers. Checking for file cleanup only.');
    }

    // 프리웜 유니버스 입력이 늘어난다(append-only) — 커밋 전에 사람이 보게 한다.
    console.log(
        `\nAdded — volume: ${volumeSymbols.length}, visit US: ${visitUsSymbols.length}, visit KR: ${visitKrItems.length}`
    );
```

그리고 `main` 끝의 결과 출력 직전(기존 `if (updatedPopularContent === originalFileContent) {` 앞)에:

```ts
    console.log(
        `POPULAR_TICKERS size: ${extractExistingTickers(originalFileContent).size + extractExistingKrTickers(originalFileContent).size} → ${finalPopularTickers.length + extractExistingKrTickers(updatedPopularContent).size}`
    );
```

(`finalPopularTickers`는 기존 코드 그대로 `extractExistingTickers(updatedPopularContent)` — US만 센다. 그래서 KR을 따로 더한다.)

- [ ] **Step 7: 기존 테스트 + 타입 확인**

Run: `yarn test src/shared/db/__tests__/update-popular-tickers.test.ts && yarn typecheck && yarn lint`
Expected: PASS, 타입 에러 0

이 테스트 파일은 스크립트를 import하므로 이제 `visitSources`(→ DB 클라이언트·`entities/ticker/api`)도
함께 로드된다. 로드 시점 부작용(env 요구 등)으로 import가 깨지면 테스트 파일 상단에
`vi.mock('../../../../scripts/lib/visitSources', () => ({ loadVisitSources: vi.fn().mockResolvedValue(null) }));`
를 추가한다. 스크립트 코드를 테스트에 맞춰 바꾸지 않는다. `scripts/__tests__/update-popular-cryptos.test.ts`도
같은 경우 `vi.mock('../lib/visitSources', ...)`.

- [ ] **Step 8: 체크포인트**

---

### Task 12: 크립토 통합 + 실측 스모크

**Files:**
- Modify: `scripts/update-popular-cryptos.ts`
- Modify: `scripts/__tests__/update-popular-cryptos.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — 테스트 파일 import에 `visitCryptoRejection` 추가, 끝에:

```ts
describe('visitCryptoRejection', () => {
    it('상장·비스테이블·시총 $1B 이상이면 null', () => {
        expect(visitCryptoRejection(true, 2_000_000_000)).toBeNull();
    });
    it('cryptocurrency-list에 없거나 스테이블코인 → 탈락', () => {
        expect(visitCryptoRejection(false, 2_000_000_000)).toBe(
            'not eligible (unlisted or stablecoin)'
        );
    });
    it('시총 없음 → 탈락', () => {
        expect(visitCryptoRejection(true, null)).toBe('no market cap');
    });
    it('$1B 미만 → 탈락', () => {
        expect(visitCryptoRejection(true, 999_999_999)).toBe(
            'market cap < $1B'
        );
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test scripts/__tests__/update-popular-cryptos.test.ts`
Expected: FAIL — `visitCryptoRejection` is not a function

- [ ] **Step 3: 구현** — `scripts/update-popular-cryptos.ts`:

import 구역에 추가:

```ts
import { classifyVisitSymbol, selectVisitCandidates } from './lib/visitCandidates';
import { loadVisitSources } from './lib/visitSources';
```

상수 구역(`REQUEST_DELAY_MS` 뒤)에:

```ts
/** 방문 후보 최소 시총 — 거래 가능한 코인만. 시총 상위 15 경로보다 느슨하다. */
export const MIN_VISIT_CRYPTO_MARKET_CAP = 1_000_000_000;
```

`rankByMarketCap` 함수 뒤에:

```ts
/** 방문 후보(크립토) 탈락 사유. 통과면 null. */
export function visitCryptoRejection(
    eligible: boolean,
    marketCap: number | null
): string | null {
    if (!eligible) return 'not eligible (unlisted or stablecoin)';
    if (marketCap === null || marketCap <= 0) return 'no market cap';
    if (marketCap < MIN_VISIT_CRYPTO_MARKET_CAP) return 'market cap < $1B';
    return null;
}
```

`main()`의 `const newSymbols = topSymbols.filter(s => !existingCryptos.has(s));` 줄 **뒤**에 삽입:

```ts
    // 방문 후보 — 시총 상위 경로와 별도 할당. DB 실패 시 건너뛴다.
    const visit = await loadVisitSources();
    const visitSymbols: string[] = [];
    if (visit !== null) {
        const candidates = selectVisitCandidates(
            visit.tallies,
            'crypto',
            new Set([...existingCryptos, ...newSymbols]),
            s => classifyVisitSymbol(s, visit.cryptoSymbols)
        );
        for (const { symbol, views } of candidates) {
            const eligible =
                filterValidCandidates([symbol], cryptoList).valid.length > 0;
            const quote = eligible
                ? await fetchSingleQuote(apiKey, symbol)
                : null;
            if (eligible) await sleep(REQUEST_DELAY_MS);
            const reason = visitCryptoRejection(
                eligible,
                quote?.marketCap ?? null
            );
            console.log(
                `  [visit:crypto] ${symbol.padEnd(10)} views=${views} → ${reason ?? 'PASS'}`
            );
            if (reason === null) visitSymbols.push(symbol);
        }
    }
    const symbolsToAdd = [...newSymbols, ...visitSymbols];
```

이후 `main()` 안에서 `newSymbols`를 참조하는 나머지 줄(`New symbols (...)` 로그 제외 — 그건 시총 경로 수를 그대로 보고)을 `symbolsToAdd`로 바꾼다: `if (newSymbols.length === 0)` → `if (symbolsToAdd.length === 0)`, `insertCryptoTrendingSection(initialDeduplication.content, newSymbols)` → `symbolsToAdd`, `? [] : newSymbols` → `? [] : symbolsToAdd`. 바꾼 뒤 확인:

Run: `grep -n "newSymbols" scripts/update-popular-cryptos.ts`
Expected: 정의 줄, `New symbols (...)` 로그 줄, `selectVisitCandidates`의 `existing` 집합, `symbolsToAdd` 정의 줄 — 4곳만.

`Done! Added ...` 로그 직전에 추가:

```ts
    console.log(
        `Added — market cap: ${newSymbols.length}, visit: ${visitSymbols.length}`
    );
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test scripts/__tests__/update-popular-cryptos.test.ts && yarn typecheck && yarn lint`
Expected: PASS

- [ ] **Step 5: 실측 스모크 (읽기 전용)** — 두 스크립트가 `react-server` 조건에서 import되는지, 로더가 실제 DB에서 어떻게 동작하는지. `main`은 `require.main === module` 가드라 import만으로 실행되지 않는다.

```bash
NODE_OPTIONS=--conditions=react-server node_modules/.bin/dotenv -e .env.local -- node_modules/.bin/tsx -e "
Promise.all([import('./update-popular-tickers.ts'), import('./scripts/update-popular-cryptos.ts')])
  .then(() => import('./scripts/lib/visitSources.ts'))
  .then(m => m.loadVisitSources())
  .then(v => console.log('visit:', v && { tallies: v.tallies.length, kr: v.krNames.size, crypto: v.cryptoSymbols.size }))
"
```

Expected (마이그레이션 운영 미적용 상태): `[visit] 방문 후보를 건너뛴다 — DB 조회 실패: ... relation "symbol_views_daily" does not exist` + `visit: null`. import 에러가 나면 중단하고 보고한다. (적용 후라면 `visit: { tallies: 0, kr: 2xxx, crypto: ... }`.)

- [ ] **Step 6: 체크포인트**

---

### Task 13: 전체 검증

- [ ] **Step 1: 전역 가드 + 관련 테스트**

Run: `yarn test src/__tests__/guards src/shared/i18n`
Expected: PASS

- [ ] **Step 2: 전체 스위트 1회** (로그 파일로, `head` 금지)

Run: `yarn test:quiet > /private/tmp/claude-501/-Users-y0ngha-Project-siglens/683a3aa5-9074-472d-9cdc-42b521c39ab0/scratchpad/full-suite.log 2>&1; echo "exit=$?"; tail -30 /private/tmp/claude-501/-Users-y0ngha-Project-siglens/683a3aa5-9074-472d-9cdc-42b521c39ab0/scratchpad/full-suite.log`
Expected: `exit=0`, 실패 0. 실패 시 실패 파일만 지정해 재실행하며 고친다.

- [ ] **Step 3: 타입·린트 (경고 수 포함)**

Run: `yarn typecheck; echo "tsc=$?"; yarn lint 2>&1 | tail -5`
Expected: `tsc=0`, lint 경고 수가 master 대비 증가 없음 (`git stash`로 비교하지 말고 master 체크아웃(`/Users/y0ngha/Project/siglens`)에서 `yarn lint 2>&1 | tail -3`으로 비교).

- [ ] **Step 4: 삭제 줄 점검** — 새 파일로 착각해 기존 테스트를 덮어쓴 사고 방지

Run: `git diff --numstat origin/master` 
Expected: 기존 테스트 파일(`VisitorPing.test.tsx`, `layout.test.tsx`, `update-popular-tickers.test.ts`, `update-popular-cryptos.test.ts`)의 삭제 줄 수가 작다(게이트 호출 삽입 수준). 수십 줄 삭제면 원인을 찾는다.

- [ ] **Step 5: 완료 보고** — 이후 CLAUDE.md 라우팅: review-agent → mistake-managing-agent → git-agent.

---

## 배포 후 (사용자 몫 — 계획 범위 밖, 참고)

1. `drizzle/0037_symbol_views_daily.sql` 운영 적용.
2. 배포 +3일: `visitor_days`에서 KR 외 데스크톱 Chrome 148~150 행 ≈ 0, KR 행 유지 확인.
3. 첫 `yarn update-popular-tickers` / `yarn update-popular-cryptos` 실행 결과(방문 후보 로그 + diff) 검토 후 커밋.

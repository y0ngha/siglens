# 공지사항 팝업 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 긴급 공지를 DB row 한 줄로 사이트(또는 특정 경로)에 중앙 모달로 띄우고, 사용자가 "다시 보지 않기"로 localStorage에 영구 dismiss 할 수 있는 기능을 추가한다.

**Architecture:** FSD 레이어. `entities/notice`가 DB 조회(repository) + server action + 경로 매칭/localStorage 순수 로직을 담당하고, `widgets/notice-popup`이 client 모달 UI를 담당한다. 활성 공지는 server action(`no-store`)으로 fetch하고, client에서 현재 경로 매칭 + dismiss 필터 후 우선순위 순으로 순차 표시한다.

**Tech Stack:** Next.js(App Router) · Drizzle ORM + Neon Postgres · React 19 client component · react-markdown(`MarkdownText`) · Vitest + @testing-library/react · Playwright(E2E)

**작업 위치:** 워크트리 `/Users/y0ngha/Project/siglens-notice-popup` (브랜치 `feat/notice-popup`). 모든 명령은 이 디렉토리에서 실행한다.

**설계 문서:** `docs/superpowers/specs/2026-06-03-notice-popup-design.md`

---

## File Structure

생성:
- `src/entities/notice/model/types.ts` — `NoticeRecord` 타입 (client-safe 순수 타입)
- `src/entities/notice/api.ts` — `NoticeRepository` 인터페이스 + `DrizzleNoticeRepository.findActive()`
- `src/entities/notice/lib/matchPath.ts` — 경로 매칭 순수함수
- `src/entities/notice/lib/noticeStorage.ts` — localStorage dismiss 읽기/쓰기
- `src/entities/notice/actions/getActiveNoticesAction.ts` — `'use server'` 활성 공지 조회
- `src/entities/notice/actions.ts` — actions barrel
- `src/entities/notice/index.ts` — public barrel (client-safe만)
- `src/entities/notice/__tests__/matchPath.test.ts`
- `src/entities/notice/__tests__/noticeStorage.test.ts`
- `src/entities/notice/__tests__/api.test.ts`
- `src/entities/notice/__tests__/getActiveNoticesAction.test.ts`
- `src/widgets/notice-popup/ui/NoticePopup.tsx` — client 모달
- `src/widgets/notice-popup/index.ts` — barrel
- `src/widgets/notice-popup/__tests__/NoticePopup.test.tsx`
- `e2e/notice-popup.spec.ts` — E2E (Task 9에서 harness 확인 후 확정)

수정:
- `src/shared/db/schema.ts` — `notices` 테이블 + 길이 상수 추가
- `src/app/layout.tsx` — `<NoticePopup />` 마운트
- `drizzle/000X_*.sql` — drizzle-kit generate 결과 (커밋)

### 커버리지 관여 파일 (90% 목표 대상)
vitest coverage는 `index.ts` / `types.ts` / `actions.ts` / `actions/index.ts`를 제외한다(`vitest.config.ts`의 `coverageConfig.exclude` 확인). 따라서 **테스트로 90%를 채워야 하는 파일**은: `api.ts`, `lib/matchPath.ts`, `lib/noticeStorage.ts`, `actions/getActiveNoticesAction.ts`, `ui/NoticePopup.tsx`.

---

## Task 1: `notices` 테이블 스키마 + 마이그레이션

**Files:**
- Modify: `src/shared/db/schema.ts`
- Create: `drizzle/000X_*.sql` (generate 산출물)

- [ ] **Step 1: 길이 상수 추가**

`src/shared/db/schema.ts`의 상수 블록(파일 상단, `const FMP_SYMBOL_MAX_LENGTH = 64;` 다음 줄)에 추가:

```typescript
const NOTICE_TITLE_MAX_LENGTH = 200;
```

- [ ] **Step 2: `notices` 테이블 정의 추가**

`src/shared/db/schema.ts` 맨 끝(`agreements` 테이블 정의 다음)에 추가. import는 이미 `boolean, index, integer, pgTable, text, timestamp, uuid, varchar`가 존재하므로 추가 import 불필요.

```typescript
/** 사이트 공지 팝업 — DB 직접 입력으로 운영. 활성 공지 =
 *  WHERE is_active AND (starts_at IS NULL OR starts_at <= NOW())
 *                  AND (ends_at   IS NULL OR ends_at   >= NOW())
 *  ORDER BY priority DESC, created_at DESC. */
export const notices = pgTable(
    'notices',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        title: varchar('title', { length: NOTICE_TITLE_MAX_LENGTH }).notNull(),
        body: text('body').notNull(),
        linkUrl: text('link_url'),
        linkLabel: text('link_label'),
        // null = 전역. 예: '/', '/symbol/*'. 매칭 규칙은 entities/notice/lib/matchPath.ts.
        pathPattern: text('path_pattern'),
        priority: integer('priority').notNull().default(0),
        isActive: boolean('is_active').notNull().default(true),
        startsAt: timestamp('starts_at', { withTimezone: true }),
        endsAt: timestamp('ends_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        index('notices_active_window_idx').on(
            table.isActive,
            table.startsAt,
            table.endsAt
        ),
    ]
);
```

- [ ] **Step 3: 마이그레이션 SQL 생성**

Run: `yarn drizzle-kit generate`
Expected: `drizzle/` 폴더에 새 `000X_*.sql` 파일 생성. 내용에 `CREATE TABLE "notices"` 와 `CREATE INDEX "notices_active_window_idx"` 포함.

- [ ] **Step 4: 생성된 SQL 확인**

Run: `git status --short drizzle/`
Expected: 새 `.sql` 파일 + `drizzle/meta/` 변경이 untracked/modified로 표시. 파일을 열어 `notices` 테이블 컬럼이 schema와 일치하는지 육안 확인.

- [ ] **Step 5: 타입체크**

Run: `yarn tsc --noEmit`
Expected: 에러 없음 (schema 변경이 타입에 반영됨).

- [ ] **Step 6: Commit**

```bash
git add src/shared/db/schema.ts drizzle/
git commit -m "feat: notices 테이블 스키마 및 마이그레이션 추가"
```

---

## Task 2: `matchPath` 경로 매칭 순수함수 (TDD)

**Files:**
- Create: `src/entities/notice/lib/matchPath.ts`
- Test: `src/entities/notice/__tests__/matchPath.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/entities/notice/__tests__/matchPath.test.ts`:

```typescript
import { matchPath } from '@/entities/notice/lib/matchPath';

describe('matchPath', () => {
    describe('전역 패턴', () => {
        it('pattern이 null이면 모든 경로에 매칭된다', () => {
            expect(matchPath(null, '/')).toBe(true);
            expect(matchPath(null, '/symbol/AAPL')).toBe(true);
        });

        it("pattern이 '/*'이면 모든 경로에 매칭된다", () => {
            expect(matchPath('/*', '/')).toBe(true);
            expect(matchPath('/*', '/market')).toBe(true);
        });
    });

    describe('정확 일치', () => {
        it('동일 경로에만 매칭된다', () => {
            expect(matchPath('/about', '/about')).toBe(true);
            expect(matchPath('/about', '/about/team')).toBe(false);
            expect(matchPath('/about', '/')).toBe(false);
        });
    });

    describe('접두 와일드카드', () => {
        it('접두 경로와 그 하위 경로에 매칭된다', () => {
            expect(matchPath('/symbol/*', '/symbol')).toBe(true);
            expect(matchPath('/symbol/*', '/symbol/AAPL')).toBe(true);
            expect(matchPath('/symbol/*', '/symbol/AAPL/news')).toBe(true);
        });

        it('접두가 부분 문자열로만 겹치는 경로에는 매칭되지 않는다', () => {
            // '/symbolize'는 '/symbol/*'에 매칭되면 안 된다
            expect(matchPath('/symbol/*', '/symbolize')).toBe(false);
            expect(matchPath('/symbol/*', '/market')).toBe(false);
        });
    });

    describe('worst case', () => {
        it('trailing slash는 정확 일치에서 다른 경로로 취급된다', () => {
            expect(matchPath('/about', '/about/')).toBe(false);
        });

        it('빈 문자열 pattern은 빈 경로에만 매칭된다', () => {
            expect(matchPath('', '')).toBe(true);
            expect(matchPath('', '/')).toBe(false);
        });
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run src/entities/notice/__tests__/matchPath.test.ts`
Expected: FAIL — "Cannot find module '@/entities/notice/lib/matchPath'"

- [ ] **Step 3: 최소 구현**

`src/entities/notice/lib/matchPath.ts`:

```typescript
/**
 * 공지의 path_pattern을 현재 pathname과 매칭한다. 지원 규칙은 3종:
 *  1. null 또는 '/*' → 전역(모든 경로)
 *  2. '/prefix/*'    → 접두 일치 ('/prefix' 자신과 '/prefix/...' 하위)
 *  3. 그 외          → 정확 일치
 * 정규식은 의도적으로 지원하지 않는다(설계 §2).
 */
export function matchPath(pattern: string | null, pathname: string): boolean {
    if (pattern === null || pattern === '/*') return true;

    if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2); // '/symbol/*' → '/symbol'
        return pathname === prefix || pathname.startsWith(`${prefix}/`);
    }

    return pathname === pattern;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn vitest run src/entities/notice/__tests__/matchPath.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Commit**

```bash
git add src/entities/notice/lib/matchPath.ts src/entities/notice/__tests__/matchPath.test.ts
git commit -m "feat: 공지 경로 매칭 순수함수 matchPath 추가"
```

---

## Task 3: `noticeStorage` localStorage dismiss 로직 (TDD)

**Files:**
- Create: `src/entities/notice/lib/noticeStorage.ts`
- Test: `src/entities/notice/__tests__/noticeStorage.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/entities/notice/__tests__/noticeStorage.test.ts` (DOM/localStorage 필요 → jsdom 환경 지정):

```typescript
// @vitest-environment jsdom
import {
    DISMISSED_NOTICES_STORAGE_KEY,
    loadDismissedNoticeIds,
    dismissNotice,
} from '@/entities/notice/lib/noticeStorage';

describe('noticeStorage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('loadDismissedNoticeIds', () => {
        it('저장된 값이 없으면 빈 배열을 반환한다', () => {
            expect(loadDismissedNoticeIds()).toEqual([]);
        });

        it('저장된 ID 배열을 반환한다', () => {
            localStorage.setItem(
                DISMISSED_NOTICES_STORAGE_KEY,
                JSON.stringify(['a', 'b'])
            );
            expect(loadDismissedNoticeIds()).toEqual(['a', 'b']);
        });

        it('JSON이 손상된 경우 빈 배열로 fallback한다', () => {
            localStorage.setItem(DISMISSED_NOTICES_STORAGE_KEY, '{not json');
            expect(loadDismissedNoticeIds()).toEqual([]);
        });

        it('배열이 아닌 값이 저장된 경우 빈 배열로 fallback한다', () => {
            localStorage.setItem(
                DISMISSED_NOTICES_STORAGE_KEY,
                JSON.stringify({ foo: 'bar' })
            );
            expect(loadDismissedNoticeIds()).toEqual([]);
        });

        it('문자열이 아닌 원소는 걸러낸다', () => {
            localStorage.setItem(
                DISMISSED_NOTICES_STORAGE_KEY,
                JSON.stringify(['a', 1, null, 'b'])
            );
            expect(loadDismissedNoticeIds()).toEqual(['a', 'b']);
        });
    });

    describe('dismissNotice', () => {
        it('새 ID를 추가 저장한다', () => {
            dismissNotice('x');
            expect(loadDismissedNoticeIds()).toEqual(['x']);
        });

        it('기존 ID에 누적한다', () => {
            dismissNotice('x');
            dismissNotice('y');
            expect(loadDismissedNoticeIds()).toEqual(['x', 'y']);
        });

        it('중복 ID는 다시 저장하지 않는다', () => {
            dismissNotice('x');
            dismissNotice('x');
            expect(loadDismissedNoticeIds()).toEqual(['x']);
        });

        it('setItem이 throw해도(quota 초과 등) 예외를 전파하지 않는다', () => {
            const spy = vi
                .spyOn(Storage.prototype, 'setItem')
                .mockImplementation(() => {
                    throw new Error('QuotaExceededError');
                });
            expect(() => dismissNotice('z')).not.toThrow();
            spy.mockRestore();
        });
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run src/entities/notice/__tests__/noticeStorage.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 최소 구현**

`src/entities/notice/lib/noticeStorage.ts`:

```typescript
/** "다시 보지 않기"한 공지 ID 목록을 담는 localStorage 키. */
export const DISMISSED_NOTICES_STORAGE_KEY = 'siglens_dismissed_notices';

/** 영구 dismiss된 공지 ID 목록을 반환한다. 손상/비정상 데이터는 빈 배열로 graceful fallback. */
export function loadDismissedNoticeIds(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(DISMISSED_NOTICES_STORAGE_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((id): id is string => typeof id === 'string');
    } catch {
        return [];
    }
}

/** 공지 ID를 dismiss 목록에 추가한다(중복 무시). 저장 실패(quota 등)는 조용히 무시. */
export function dismissNotice(id: string): void {
    if (typeof window === 'undefined') return;
    try {
        const current = loadDismissedNoticeIds();
        if (current.includes(id)) return;
        localStorage.setItem(
            DISMISSED_NOTICES_STORAGE_KEY,
            JSON.stringify([...current, id])
        );
    } catch {
        // 스토리지 용량 초과 등 무시
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn vitest run src/entities/notice/__tests__/noticeStorage.test.ts`
Expected: PASS

> 참고: SSR 분기(`typeof window === 'undefined'`)는 jsdom 환경에서 실행되지 않아 v8 커버리지에서 미커버 라인으로 남는다. 이는 기존 `chatStorage` 패턴과 동일하며, 두 함수의 나머지 라인이 모두 커버되므로 파일 단위 90%는 충족된다. 추가 커버가 필요하면 Task 8 검증 단계에서 `/* v8 ignore next */` 적용을 검토한다.

- [ ] **Step 5: Commit**

```bash
git add src/entities/notice/lib/noticeStorage.ts src/entities/notice/__tests__/noticeStorage.test.ts
git commit -m "feat: 공지 다시보지않기 localStorage 로직 추가"
```

---

## Task 4: `NoticeRecord` 타입 + `DrizzleNoticeRepository` (TDD)

**Files:**
- Create: `src/entities/notice/model/types.ts`
- Create: `src/entities/notice/api.ts`
- Test: `src/entities/notice/__tests__/api.test.ts`

- [ ] **Step 1: client-safe 타입 정의**

`src/entities/notice/model/types.ts`:

```typescript
/** 클라이언트로 전달되는 공지 표시용 레코드. is_active/starts_at/ends_at은
 *  서버 필터에만 쓰이므로 포함하지 않는다. priority는 서버에서 정렬을 끝내므로
 *  클라이언트는 배열 순서만 유지하면 된다. */
export interface NoticeRecord {
    id: string;
    title: string;
    body: string;
    linkUrl: string | null;
    linkLabel: string | null;
    pathPattern: string | null;
    createdAt: Date;
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`src/entities/notice/__tests__/api.test.ts` (terms/api.test.ts의 mock builder 패턴 차용):

```typescript
import { DrizzleNoticeRepository } from '@/entities/notice/api';
import type { SiglensDatabase } from '@/shared/db/types';

interface SelectedRow {
    id: string;
    title: string;
    body: string;
    linkUrl: string | null;
    linkLabel: string | null;
    pathPattern: string | null;
    createdAt: Date;
}

function makeMockDb(rows: SelectedRow[]): {
    db: SiglensDatabase;
    whereSpy: ReturnType<typeof vi.fn>;
    orderBySpy: ReturnType<typeof vi.fn>;
} {
    const orderBySpy = vi.fn().mockResolvedValue(rows);
    const whereSpy = vi.fn().mockReturnValue({ orderBy: orderBySpy });
    const builder = {
        from: () => builder,
        where: whereSpy,
    };
    const db = {
        select: () => builder,
    } as unknown as SiglensDatabase;
    return { db, whereSpy, orderBySpy };
}

describe('DrizzleNoticeRepository.findActive', () => {
    const baseRow: SelectedRow = {
        id: 'n1',
        title: '점검 안내',
        body: '## 점검',
        linkUrl: null,
        linkLabel: null,
        pathPattern: null,
        createdAt: new Date('2026-06-03T00:00:00+09:00'),
    };

    it('활성 공지 행들을 그대로 반환한다', async () => {
        const { db } = makeMockDb([baseRow]);
        const repo = new DrizzleNoticeRepository(db);

        const result = await repo.findActive();

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('n1');
        expect(result[0].title).toBe('점검 안내');
        expect(result[0].createdAt).toEqual(baseRow.createdAt);
    });

    it('활성 공지가 없으면 빈 배열을 반환한다', async () => {
        const { db } = makeMockDb([]);
        const repo = new DrizzleNoticeRepository(db);

        expect(await repo.findActive()).toEqual([]);
    });

    it('priority DESC, created_at DESC 순으로 정렬을 요청한다', async () => {
        const { db, orderBySpy } = makeMockDb([baseRow]);
        const repo = new DrizzleNoticeRepository(db);

        await repo.findActive();

        // orderBy가 두 개의 정렬 인자(priority, createdAt)로 호출됐는지 확인
        expect(orderBySpy).toHaveBeenCalledTimes(1);
        expect(orderBySpy.mock.calls[0]).toHaveLength(2);
    });

    it('where 절(활성 + 시간창)이 적용된다', async () => {
        const { db, whereSpy } = makeMockDb([baseRow]);
        const repo = new DrizzleNoticeRepository(db);

        await repo.findActive();

        expect(whereSpy).toHaveBeenCalledTimes(1);
        expect(whereSpy.mock.calls[0][0]).toBeDefined();
    });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `yarn vitest run src/entities/notice/__tests__/api.test.ts`
Expected: FAIL — module '@/entities/notice/api' not found

- [ ] **Step 4: repository 구현**

`src/entities/notice/api.ts`:

```typescript
import { and, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { notices } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { NoticeRecord } from './model/types';

/** 활성 공지 조회 repository. */
export interface NoticeRepository {
    /** 노출 조건(활성 + 시간창)을 만족하는 공지를 priority/최신순으로 반환. */
    findActive(): Promise<NoticeRecord[]>;
}

/** Drizzle ORM-backed 구현. */
export class DrizzleNoticeRepository implements NoticeRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async findActive(): Promise<NoticeRecord[]> {
        // findActive는 non-critical 경로(공지)라 withRetry를 쓰지 않는다.
        // 호출부(getActiveNoticesAction)가 실패를 빈 배열로 흡수한다.
        const rows = await this.db
            .select({
                id: notices.id,
                title: notices.title,
                body: notices.body,
                linkUrl: notices.linkUrl,
                linkLabel: notices.linkLabel,
                pathPattern: notices.pathPattern,
                createdAt: notices.createdAt,
            })
            .from(notices)
            .where(
                and(
                    eq(notices.isActive, true),
                    or(
                        isNull(notices.startsAt),
                        lte(notices.startsAt, sql`NOW()`)
                    ),
                    or(isNull(notices.endsAt), gte(notices.endsAt, sql`NOW()`))
                )
            )
            .orderBy(desc(notices.priority), desc(notices.createdAt));

        return rows;
    }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `yarn vitest run src/entities/notice/__tests__/api.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/entities/notice/model/types.ts src/entities/notice/api.ts src/entities/notice/__tests__/api.test.ts
git commit -m "feat: 공지 조회 repository(DrizzleNoticeRepository) 추가"
```

---

## Task 5: server action + barrels

**Files:**
- Create: `src/entities/notice/actions/getActiveNoticesAction.ts`
- Create: `src/entities/notice/actions.ts`
- Create: `src/entities/notice/index.ts`
- Test: `src/entities/notice/__tests__/getActiveNoticesAction.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/entities/notice/__tests__/getActiveNoticesAction.test.ts`:

```typescript
vi.mock('@/shared/db/client', () => ({
    tryGetDatabaseClient: vi.fn(),
}));

import { getActiveNoticesAction } from '@/entities/notice/actions/getActiveNoticesAction';
import { tryGetDatabaseClient } from '@/shared/db/client';
import type { SiglensDatabase } from '@/shared/db/types';

const mockedTryGet = vi.mocked(tryGetDatabaseClient);

function dbReturning(rows: unknown[]): SiglensDatabase {
    const builder = {
        from: () => builder,
        where: () => ({ orderBy: () => Promise.resolve(rows) }),
    };
    return { select: () => builder } as unknown as SiglensDatabase;
}

describe('getActiveNoticesAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('DB 클라이언트가 없으면 빈 배열을 반환한다', async () => {
        mockedTryGet.mockReturnValue(null);
        expect(await getActiveNoticesAction()).toEqual([]);
    });

    it('활성 공지 행을 반환한다', async () => {
        const row = {
            id: 'n1',
            title: '점검',
            body: 'b',
            linkUrl: null,
            linkLabel: null,
            pathPattern: null,
            createdAt: new Date('2026-06-03T00:00:00+09:00'),
        };
        mockedTryGet.mockReturnValue({
            db: dbReturning([row]),
            sql: {} as never,
        });

        const result = await getActiveNoticesAction();

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('n1');
    });

    it('조회 중 예외가 나면 빈 배열로 흡수한다', async () => {
        const throwingDb = {
            select: () => {
                throw new Error('db down');
            },
        } as unknown as SiglensDatabase;
        mockedTryGet.mockReturnValue({ db: throwingDb, sql: {} as never });
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(await getActiveNoticesAction()).toEqual([]);
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run src/entities/notice/__tests__/getActiveNoticesAction.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: server action 구현**

`src/entities/notice/actions/getActiveNoticesAction.ts`:

```typescript
'use server';

import { tryGetDatabaseClient } from '@/shared/db/client';
import { DrizzleNoticeRepository } from '../api';
import type { NoticeRecord } from '../model/types';

/**
 * 활성 공지 목록을 반환한다(우선순위/최신순). 공지는 부가 기능이므로 DB 미설정
 * 또는 조회 실패 시 빈 배열로 graceful degrade 한다. 긴급 반영을 위해 캐시하지
 * 않는다(server action은 기본 비캐시).
 */
export async function getActiveNoticesAction(): Promise<NoticeRecord[]> {
    try {
        const client = tryGetDatabaseClient();
        if (client === null) return [];
        const repo = new DrizzleNoticeRepository(client.db);
        return await repo.findActive();
    } catch (err) {
        console.error('[getActiveNoticesAction] unexpected error:', err);
        return [];
    }
}
```

- [ ] **Step 4: actions barrel 작성**

`src/entities/notice/actions.ts`:

```typescript
export { getActiveNoticesAction } from './actions/getActiveNoticesAction';
```

- [ ] **Step 5: public barrel 작성 (client-safe만 노출)**

`src/entities/notice/index.ts`:

```typescript
// 공지 슬라이스 public API.
// - DrizzleNoticeRepository(api.ts)는 server-only이므로 barrel에서 제외한다.
//   server consumer(server action)는 '../api'에서 직접 deep import 한다.
// - server action은 actions.ts barrel(@/entities/notice/actions)에서 import 한다.
export type { NoticeRecord } from './model/types';
export { matchPath } from './lib/matchPath';
export {
    DISMISSED_NOTICES_STORAGE_KEY,
    loadDismissedNoticeIds,
    dismissNotice,
} from './lib/noticeStorage';
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `yarn vitest run src/entities/notice/__tests__/getActiveNoticesAction.test.ts`
Expected: PASS

- [ ] **Step 7: 타입체크**

Run: `yarn tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 8: Commit**

```bash
git add src/entities/notice/actions/ src/entities/notice/actions.ts src/entities/notice/index.ts src/entities/notice/__tests__/getActiveNoticesAction.test.ts
git commit -m "feat: 활성 공지 server action 및 notice 슬라이스 barrel 추가"
```

---

## Task 6: `NoticePopup` 모달 컴포넌트 (TDD)

**Files:**
- Create: `src/widgets/notice-popup/ui/NoticePopup.tsx`
- Create: `src/widgets/notice-popup/index.ts`
- Test: `src/widgets/notice-popup/__tests__/NoticePopup.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/widgets/notice-popup/__tests__/NoticePopup.test.tsx`:

```typescript
// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { NoticePopup } from '@/widgets/notice-popup/ui/NoticePopup';
import { getActiveNoticesAction } from '@/entities/notice/actions';
import { DISMISSED_NOTICES_STORAGE_KEY } from '@/entities/notice';
import type { NoticeRecord } from '@/entities/notice';

vi.mock('next/navigation', () => ({
    usePathname: () => '/',
}));

vi.mock('@/entities/notice/actions', () => ({
    getActiveNoticesAction: vi.fn(),
}));

const mockedAction = vi.mocked(getActiveNoticesAction);

function notice(overrides: Partial<NoticeRecord> = {}): NoticeRecord {
    return {
        id: 'n1',
        title: '긴급 점검 안내',
        body: '**오늘 23시** 점검 예정입니다.',
        linkUrl: null,
        linkLabel: null,
        pathPattern: null,
        createdAt: new Date('2026-06-03T00:00:00+09:00'),
        ...overrides,
    };
}

describe('NoticePopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('활성 공지가 없으면 아무것도 렌더하지 않는다', async () => {
        mockedAction.mockResolvedValue([]);
        const { container } = render(<NoticePopup />);
        await waitFor(() => expect(mockedAction).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it('공지의 제목·본문(마크다운)·작성일을 렌더한다', async () => {
        mockedAction.mockResolvedValue([notice()]);
        render(<NoticePopup />);

        expect(await screen.findByText('긴급 점검 안내')).toBeInTheDocument();
        // 마크다운 strong 렌더 확인
        expect(screen.getByText('오늘 23시')).toBeInTheDocument();
        expect(screen.getByText('2026.06.03 작성')).toBeInTheDocument();
    });

    it('linkUrl이 있으면 링크를 렌더하고, label이 없으면 url을 표시한다', async () => {
        mockedAction.mockResolvedValue([
            notice({ linkUrl: 'https://siglens.io/blog', linkLabel: null }),
        ]);
        render(<NoticePopup />);

        const link = await screen.findByRole('link');
        expect(link).toHaveAttribute('href', 'https://siglens.io/blog');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        expect(link).toHaveTextContent('https://siglens.io/blog');
    });

    it('linkLabel이 있으면 라벨을 표시한다', async () => {
        mockedAction.mockResolvedValue([
            notice({ linkUrl: 'https://x.io', linkLabel: '자세히 보기' }),
        ]);
        render(<NoticePopup />);
        expect(await screen.findByText('자세히 보기')).toBeInTheDocument();
    });

    it('현재 경로와 매칭되지 않는 공지는 표시하지 않는다', async () => {
        // pathname은 '/'로 모킹됨 → '/market'에만 노출되는 공지는 숨김
        mockedAction.mockResolvedValue([notice({ pathPattern: '/market' })]);
        const { container } = render(<NoticePopup />);
        await waitFor(() => expect(mockedAction).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it('이미 dismiss된 공지는 표시하지 않는다', async () => {
        localStorage.setItem(
            DISMISSED_NOTICES_STORAGE_KEY,
            JSON.stringify(['n1'])
        );
        mockedAction.mockResolvedValue([notice({ id: 'n1' })]);
        const { container } = render(<NoticePopup />);
        await waitFor(() => expect(mockedAction).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it('"닫기"는 임시 닫기 — localStorage에 저장하지 않고 다음 공지로 넘어간다', async () => {
        mockedAction.mockResolvedValue([
            notice({ id: 'n1', title: '첫 번째' }),
            notice({ id: 'n2', title: '두 번째' }),
        ]);
        render(<NoticePopup />);

        expect(await screen.findByText('첫 번째')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));

        expect(await screen.findByText('두 번째')).toBeInTheDocument();
        // 임시 닫기는 dismiss 저장 안 함
        expect(
            localStorage.getItem(DISMISSED_NOTICES_STORAGE_KEY)
        ).toBeNull();
    });

    it('"다시 보지 않기"는 해당 ID를 localStorage에 저장하고 다음 공지로 넘어간다', async () => {
        mockedAction.mockResolvedValue([
            notice({ id: 'n1', title: '첫 번째' }),
            notice({ id: 'n2', title: '두 번째' }),
        ]);
        render(<NoticePopup />);

        expect(await screen.findByText('첫 번째')).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole('button', { name: '다시 보지 않기' })
        );

        expect(await screen.findByText('두 번째')).toBeInTheDocument();
        expect(
            JSON.parse(
                localStorage.getItem(DISMISSED_NOTICES_STORAGE_KEY) ?? '[]'
            )
        ).toEqual(['n1']);
    });

    it('마지막 공지를 닫으면 모달이 사라진다', async () => {
        mockedAction.mockResolvedValue([notice({ id: 'n1' })]);
        render(<NoticePopup />);

        await screen.findByRole('dialog');
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));

        await waitFor(() =>
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        );
    });

    it('action이 reject해도 throw하지 않고 모달을 띄우지 않는다', async () => {
        mockedAction.mockRejectedValue(new Error('network'));
        const { container } = render(<NoticePopup />);
        await waitFor(() => expect(mockedAction).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run src/widgets/notice-popup/__tests__/NoticePopup.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: 컴포넌트 구현**

`src/widgets/notice-popup/ui/NoticePopup.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { getActiveNoticesAction } from '@/entities/notice/actions';
import {
    matchPath,
    loadDismissedNoticeIds,
    dismissNotice,
    type NoticeRecord,
} from '@/entities/notice';

const MODAL_TITLE_ID = 'notice-modal-title';

/** createdAt을 'YYYY.MM.DD 작성' 형태로 포맷한다(로컬 타임존). */
function formatNoticeDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day} 작성`;
}

/**
 * 사이트 공지 팝업. 마운트 시 활성 공지를 fetch해 현재 경로 매칭 + dismiss
 * 필터를 적용하고, 남은 공지를 우선순위 순(서버 정렬)으로 하나씩 모달로 띄운다.
 * - X / 배경 클릭 / Esc = 임시 닫기(다음 방문 시 재노출)
 * - "다시 보지 않기" = localStorage에 ID 영구 저장
 */
export function NoticePopup() {
    const pathname = usePathname();
    const [queue, setQueue] = useState<NoticeRecord[]>([]);
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        getActiveNoticesAction()
            .then(notices => {
                if (cancelled) return;
                const dismissed = loadDismissedNoticeIds();
                setQueue(
                    notices.filter(
                        n =>
                            matchPath(n.pathPattern, pathname) &&
                            !dismissed.includes(n.id)
                    )
                );
            })
            .catch(() => {
                // 공지 fetch 실패는 무시(부가 기능)
            });
        return () => {
            cancelled = true;
        };
    }, [pathname]);

    const current = queue[0] ?? null;
    const isOpen = current !== null;

    const advance = () => setQueue(prev => prev.slice(1));
    const handleDontShowAgain = () => {
        if (current !== null) dismissNotice(current.id);
        advance();
    };

    useEscapeKey(advance, isOpen);
    useFocusTrap(dialogRef, isOpen);
    useEffect(() => {
        if (isOpen) dialogRef.current?.focus();
    }, [isOpen]);

    if (current === null) return null;

    return (
        <div
            data-testid="notice-modal-backdrop"
            className="bg-secondary-950/80 fixed inset-0 z-9999 flex items-center justify-center px-4 backdrop-blur-sm"
            onClick={advance}
        >
            <div
                ref={dialogRef}
                tabIndex={-1}
                data-testid="notice-modal-content"
                role="dialog"
                aria-modal="true"
                aria-labelledby={MODAL_TITLE_ID}
                className="border-secondary-700 bg-secondary-800 w-full max-w-md rounded-2xl border p-5"
                onClick={e => e.stopPropagation()}
            >
                <div className="mb-3 flex items-start justify-between gap-3">
                    <h2
                        id={MODAL_TITLE_ID}
                        className="text-secondary-100 text-base font-bold"
                    >
                        {current.title}
                    </h2>
                    <button
                        onClick={advance}
                        aria-label="닫기"
                        className="text-secondary-500 hover:text-secondary-300 focus-visible:ring-primary-500 shrink-0 text-xl leading-none transition-colors focus-visible:ring-1 focus-visible:outline-none"
                    >
                        ✕
                    </button>
                </div>
                <p className="text-secondary-500 mb-3 text-xs">
                    {formatNoticeDate(current.createdAt)}
                </p>
                <MarkdownText className="text-secondary-300 text-sm">
                    {current.body}
                </MarkdownText>
                {current.linkUrl !== null && (
                    <a
                        href={current.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-primary-600 hover:bg-primary-500 mt-4 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
                    >
                        {current.linkLabel ?? current.linkUrl}
                    </a>
                )}
                <div className="mt-5 flex items-center justify-end gap-3">
                    <button
                        onClick={handleDontShowAgain}
                        className="text-secondary-400 hover:text-secondary-200 text-sm transition-colors"
                    >
                        다시 보지 않기
                    </button>
                    <button
                        onClick={advance}
                        className="border-secondary-600 text-secondary-200 hover:bg-secondary-700 rounded-lg border px-4 py-2 text-sm transition-colors"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
```

> 주의: 헤더의 X 버튼은 `aria-label="닫기"`이고 하단에도 텍스트 "닫기" 버튼이 있어 `getByRole('button', { name: '닫기' })`가 두 개를 매칭할 수 있다. 테스트는 하단 버튼만 의도하므로, 만약 충돌하면 X 버튼의 `aria-label`을 `"팝업 닫기"`로 바꾼다(테스트의 `name: '닫기'`는 하단 버튼만 가리키게 됨). 구현 시 이 점을 반영해 X 버튼 aria-label을 `"팝업 닫기"`로 설정하고, 위 테스트의 backdrop/임시닫기 검증은 하단 "닫기" 버튼 기준으로 둔다.

- [ ] **Step 4: barrel 작성**

`src/widgets/notice-popup/index.ts`:

```typescript
export { NoticePopup } from './ui/NoticePopup';
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `yarn vitest run src/widgets/notice-popup/__tests__/NoticePopup.test.tsx`
Expected: PASS (X 버튼 aria-label 충돌 시 Step 3 주의사항대로 `"팝업 닫기"`로 수정)

- [ ] **Step 6: Commit**

```bash
git add src/widgets/notice-popup/
git commit -m "feat: 공지 팝업 모달 컴포넌트(NoticePopup) 추가"
```

---

## Task 7: 루트 레이아웃에 마운트

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: import 추가**

`src/app/layout.tsx`의 import 블록에서 `import { PwaBanner } from '@/features/pwa-install';` 다음 줄에 추가:

```typescript
import { NoticePopup } from '@/widgets/notice-popup';
```

- [ ] **Step 2: 컴포넌트 마운트**

`<ReactQueryProvider>` 내부, `<PwaBanner />` 다음 줄에 추가:

```tsx
                <ReactQueryProvider>
                    <PwaBanner />
                    <NoticePopup />
```

- [ ] **Step 3: 타입체크 + 린트**

Run: `yarn tsc --noEmit && yarn lint`
Expected: 에러 없음 (레이어 경계: app → widgets → entities, 정방향)

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: 루트 레이아웃에 공지 팝업 마운트"
```

---

## Task 8: 커버리지·린트·빌드 검증

**Files:** 없음 (검증 전용)

- [ ] **Step 1: notice 관련 전체 테스트 + 커버리지**

Run: `yarn vitest run src/entities/notice src/widgets/notice-popup --coverage`
Expected: 모든 테스트 PASS. 커버리지 리포트에서 다음 파일이 **각각 90% 이상**:
- `src/entities/notice/api.ts`
- `src/entities/notice/lib/matchPath.ts`
- `src/entities/notice/lib/noticeStorage.ts`
- `src/entities/notice/actions/getActiveNoticesAction.ts`
- `src/widgets/notice-popup/ui/NoticePopup.tsx`

- [ ] **Step 2: 90% 미달 시 보강**

90% 미만 파일이 있으면 미커버 라인을 확인해 테스트를 추가한다.
- `noticeStorage.ts`의 SSR 가드(`typeof window === 'undefined'`)가 미커버로 남고 그 때문에 90% 미달이면, 해당 분기에 `/* v8 ignore next */` 주석을 추가하거나, `vi.stubGlobal('window', undefined)`로 SSR 케이스 테스트를 추가한다.
- 추가 후 Step 1 재실행.

- [ ] **Step 3: 전체 테스트 스위트 (회귀 확인)**

Run: `yarn test`
Expected: 전체 PASS (기존 테스트 무회귀)

- [ ] **Step 4: 린트 + 스타일린트**

Run: `yarn lint && yarn lint:style`
Expected: 에러 없음

- [ ] **Step 5: 빌드 (exit code 직접 캡처)**

Run: `yarn build > /tmp/notice-build.log 2>&1; echo "EXIT=$?"`
Expected: `EXIT=0`. (파이프로 exit code를 가리지 않는다 — 빌드 실패가 0으로 마스킹되는 것을 방지.) 실패 시 `/tmp/notice-build.log` 확인.

- [ ] **Step 6: Commit (보강이 있었을 경우만)**

```bash
git add -A
git commit -m "test: 공지 팝업 커버리지 보강"
```

---

## Task 9: E2E 테스트 (Playwright)

> E2E 시드/네비게이션 방식은 기존 스위트에 맞춰야 하므로, 먼저 harness를 확인한 뒤 spec을 작성한다.

**Files:**
- Create: `e2e/notice-popup.spec.ts`

- [ ] **Step 1: 기존 E2E harness 파악**

Run: `ls e2e && ls e2e/fixtures 2>/dev/null; ls e2e/helpers 2>/dev/null`
그리고 DB seed/리셋과 쿠키 seam을 사용하는 대표 spec 1~2개를 읽는다(예: 분석 에러주입 쿠키 seam을 쓰는 spec, DB 초기화 helper). 확인 항목:
- 테스트 DB에 row를 seed하는 헬퍼/패턴 (postgres 직접 insert인지, fixture인지)
- `baseURL`, 네비게이션 패턴, `data-testid` 사용 관례
- `playwright.config`의 `workers`(메모리상 `workers:1`), `COMPOSE_PROJECT_NAME` 주의사항

- [ ] **Step 2: E2E spec 작성**

확인한 seed 헬퍼를 사용해 `e2e/notice-popup.spec.ts`를 작성한다. 아래는 검증할 시나리오와 assertion 골격이다(seed 호출부는 Step 1에서 확인한 실제 헬퍼명으로 대체):

```typescript
import { test, expect } from '@playwright/test';
// import { seedNotice, resetNotices } from './helpers/...';  // Step 1에서 확인한 실제 경로

test.describe('공지 팝업', () => {
    test.afterEach(async () => {
        // await resetNotices();
    });

    test('활성 공지가 있으면 첫 방문 시 모달이 노출된다', async ({ page }) => {
        // await seedNotice({ title: 'E2E 점검', body: '점검 안내', isActive: true });
        await page.goto('/');
        await expect(page.getByTestId('notice-modal-content')).toBeVisible();
        await expect(page.getByText('E2E 점검')).toBeVisible();
    });

    test('"다시 보지 않기" 후 재방문하면 노출되지 않는다', async ({ page }) => {
        // await seedNotice({ id: '...', title: 'E2E 점검', isActive: true });
        await page.goto('/');
        await page.getByRole('button', { name: '다시 보지 않기' }).click();
        await expect(
            page.getByTestId('notice-modal-content')
        ).not.toBeVisible();

        await page.reload();
        await expect(
            page.getByTestId('notice-modal-content')
        ).not.toBeVisible();
    });

    test('"닫기"(임시) 후 새로고침하면 다시 노출된다', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('button', { name: '닫기' }).click();
        await expect(
            page.getByTestId('notice-modal-content')
        ).not.toBeVisible();

        await page.reload();
        await expect(
            page.getByTestId('notice-modal-content')
        ).toBeVisible();
    });

    test('경로 타게팅: 매칭되는 경로에서만 노출된다', async ({ page }) => {
        // await seedNotice({ title: '마켓 공지', pathPattern: '/market', isActive: true });
        await page.goto('/');
        await expect(
            page.getByTestId('notice-modal-content')
        ).not.toBeVisible();

        await page.goto('/market');
        await expect(page.getByText('마켓 공지')).toBeVisible();
    });
});
```

- [ ] **Step 3: E2E 실행**

Run: `yarn e2e` (또는 Step 1에서 확인한 E2E 빌드/실행 명령. 메모리: `E2E_TEST=1 yarn build` 후 실행)
Expected: notice-popup spec 전부 PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/notice-popup.spec.ts
git commit -m "test: 공지 팝업 E2E 시나리오 추가"
```

---

## Self-Review 결과

- **Spec 커버리지**: §2 데이터모델→Task1, §2 경로매칭→Task2, "다시보지않기"→Task3, §3 repository/필터→Task4, §4 server action/캐싱→Task5, §5 UI/UX→Task6, 마운트→Task7, §7 테스트(커버리지90%/worst/통합)→Task2~6·8, §7 E2E→Task9, §8 마이그레이션→Task1. 누락 없음.
- **Placeholder 스캔**: 모든 코드 스텝에 실제 코드 포함. E2E의 seed 호출만 harness 확인 후 확정(Task9 Step1에서 구체화) — 이는 기존 인프라 의존이라 의도적으로 조사 스텝을 둠.
- **타입 일관성**: `NoticeRecord`(model/types.ts) 필드명이 api.ts select, action 반환, NoticePopup 사용처에서 모두 일치. `matchPath(pattern, pathname)`, `loadDismissedNoticeIds()`, `dismissNotice(id)`, `DISMISSED_NOTICES_STORAGE_KEY` 시그니처가 정의처와 사용처에서 일치.
- **레이어 의존**: app→widgets→entities→shared 정방향만 사용. server-only(api.ts)는 barrel 제외, action은 actions.ts barrel 경유.

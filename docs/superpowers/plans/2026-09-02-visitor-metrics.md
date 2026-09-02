# MAU/DAU 방문자 집계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 봇을 제외한 사람 방문자 기준으로 DAU와 MAU를 측정하고, 그 수집을 고지하도록 개인정보처리방침을 개정한다.

**Architecture:** 루트 레이아웃의 client 컴포넌트가 하루 한 번 `/api/presence`에 본문 없는 POST를 보낸다. 라우트가 `IP + User-Agent + 고정 pepper`를 SHA-256으로 해시해 `visitor_days`에 방문자당 하루 1행을 `ON CONFLICT DO NOTHING`으로 적재한다. 조회는 `yarn metrics` 스크립트 하나.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + Neon Postgres, vitest, `node:crypto`

**설계 문서:** `docs/superpowers/specs/2026-09-02-visitor-metrics-design.md`

**워크트리:** `/Users/y0ngha/Project/siglens-visitor-metrics` (브랜치 `feat/visitor-metrics`)

---

## 파일 구조

**방문자 집계**

| 파일 | 책임 |
|---|---|
| `src/shared/lib/etTimeUtils.ts` (수정) | `kstDateKey` 추출·export. 서버와 클라이언트가 같은 날짜 경계를 쓰게 한다 |
| `src/shared/api/getClientIp.ts` (이동) | `entities/chat-message/api/`에서 옮긴다. 채팅 도메인 것이 아니고, 지금 3곳이 deep import 중이다 |
| `src/shared/db/schema.ts` (수정) | `visitorDays` 테이블 |
| `src/entities/visitor/lib/visitorHash.ts` | 순수 함수 하나. DB도 env도 모른다 |
| `src/entities/visitor/types.ts` | `DailyActiveUsers` |
| `src/entities/visitor/api.ts` | `DrizzleVisitorRepository` — 적재·정리·집계 |
| `src/entities/visitor/index.ts` | barrel |
| `src/features/visitor-ping/ui/VisitorPing.tsx` | 비콘 발사. 렌더 결과 없음 |
| `src/app/api/presence/route.ts` | 봇 판정 → 해시 → 적재 → 보존기간 정리 |
| `scripts/metrics.ts` | 읽기 |

**법률 문서**

| 파일 | 책임 |
|---|---|
| `src/entities/terms/api.ts` (수정) | `upsertFromSeed`가 id 반환, `upsertTranslation` 추가 |
| `db/scripts/seedTerms.ts` (수정) | frontmatter `locale` 지원 |
| `db/seeds/terms/privacy/v2.md` 외 7개 | 본문·번역 |

---

## Task 1: `kstDateKey` 추출

`etToKst()` 안에 인라인으로 있는 KST 날짜 조립을 함수로 꺼낸다. 서버 라우트와
클라이언트 비콘이 **같은** 날짜 경계를 써야 하는데, 지금은 꺼내 쓸 수가 없다.

**Files:**
- Modify: `src/shared/lib/etTimeUtils.ts`
- Test: `src/shared/lib/__tests__/etTimeUtils.test.ts` (기존 파일에 추가)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/shared/lib/__tests__/etTimeUtils.test.ts` 끝에 추가한다. 파일 상단의
import 목록에 `kstDateKey`를 넣는다.

```ts
describe('kstDateKey', () => {
    it('KST 자정 직전은 그 전날로 남는다', () => {
        // 2026-09-01T14:59:59Z = KST 2026-09-01 23:59:59
        expect(kstDateKey(new Date('2026-09-01T14:59:59.000Z'))).toBe(
            '2026-09-01'
        );
    });

    it('KST 자정을 넘기면 다음 날이 된다', () => {
        // 2026-09-01T15:00:00Z = KST 2026-09-02 00:00:00
        expect(kstDateKey(new Date('2026-09-01T15:00:00.000Z'))).toBe(
            '2026-09-02'
        );
    });

    it('월·일을 2자리로 0 채움한다', () => {
        expect(kstDateKey(new Date('2026-01-05T03:00:00.000Z'))).toBe(
            '2026-01-05'
        );
    });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
yarn test src/shared/lib/__tests__/etTimeUtils.test.ts
```

기대: `kstDateKey is not a function` 또는 import 해석 실패.

- [ ] **Step 3: 함수를 꺼낸다**

`src/shared/lib/etTimeUtils.ts`의 `KST_DATE_PARTS_FORMATTER` 선언 **바로 아래**에
추가한다.

```ts
/**
 * KST 기준 `YYYY-MM-DD`.
 *
 * `en-CA`로 바로 `format()`하면 ICU 버전에 따라 구분자가 `/`가 되거나 순서가
 * 바뀌어 `split('-')`이 NaN을 내놓는다. `formatToParts`로 조각을 뽑아 조립한다.
 *
 * 방문자 집계(`/api/presence`)와 그 클라이언트 비콘이 이 함수를 공유한다 —
 * 둘이 다른 날짜 경계를 쓰면 특정 날의 방문자가 통째로 누락된다.
 */
export function kstDateKey(date: Date): string {
    const parts = KST_DATE_PARTS_FORMATTER.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value ?? '';
    const month = parts.find(p => p.type === 'month')?.value ?? '';
    const day = parts.find(p => p.type === 'day')?.value ?? '';
    return `${year}-${month}-${day}`;
}
```

`etToKst` 안의 인라인 조립을 이 함수 호출로 바꾼다. 아래 5줄을

```ts
    const parts = KST_DATE_PARTS_FORMATTER.formatToParts(d);
    const year = parts.find(p => p.type === 'year')?.value ?? '';
    const month = parts.find(p => p.type === 'month')?.value ?? '';
    const day = parts.find(p => p.type === 'day')?.value ?? '';
    const kstDateKey = `${year}-${month}-${day}`;
```

이 1줄로 교체한다. 지역 변수명을 바꿔야 한다 — 안 바꾸면 함수 이름을 가린다.

```ts
    const kstDateKeyValue = kstDateKey(d);
```

그리고 같은 함수의 `return` 문에서 `kstDateKey,`를 `kstDateKey: kstDateKeyValue,`로
바꾼다. 바로 위의 인라인 조립 설명 주석(`'YYYY-MM-DD' 형식으로 ...`)은 함수
JSDoc으로 옮겼으므로 지운다.

- [ ] **Step 4: 통과를 확인한다**

```bash
yarn test src/shared/lib/__tests__/etTimeUtils.test.ts
```

기대: 전부 PASS. 기존 `etToKst` 테스트도 그대로 통과해야 한다 — 하나라도 깨지면
지역 변수 교체를 잘못한 것이다.

- [ ] **Step 5: 커밋**

```bash
git add src/shared/lib/etTimeUtils.ts src/shared/lib/__tests__/etTimeUtils.test.ts
git commit -m "refactor(time): KST 날짜 조립을 kstDateKey로 꺼낸다"
```

---

## Task 2: `getClientIp`을 shared로 옮긴다

`x-forwarded-for` 첫 값을 읽는 4줄짜리 함수가 `entities/chat-message/api/`에 있다.
채팅 도메인 것이 아니고, 이미 3곳이 슬라이스 barrel을 건너뛰고 deep import 중이다
(CLAUDE.md 위반). `isBot.ts` 옆이 제자리다.

**Files:**
- Create: `src/shared/api/getClientIp.ts`
- Delete: `src/entities/chat-message/api/getClientIp.ts`
- Modify: `src/entities/chat-message/actions/chatAction.ts`
- Modify: `src/entities/chat-message/actions/getRemainingTokensAction.ts`
- Modify: `src/entities/shared-analysis/actions/createShareSnapshotAction.ts`

- [ ] **Step 1: 새 위치에 파일을 만든다**

`src/shared/api/getClientIp.ts` — 내용은 원본 그대로다.

```ts
import 'server-only';
import { headers } from 'next/headers';

/**
 * x-forwarded-for 헤더 첫 번째 IP를 반환한다.
 * Cloudflare/ALB 뒤에서는 실 클라이언트 IP가 헤더 첫 값으로 삽입된다.
 * 헤더가 없거나 파싱 실패 시 'unknown'을 반환한다.
 */
export async function getClientIp(): Promise<string> {
    const headersList = await headers();
    return (
        headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    );
}
```

- [ ] **Step 2: 원본을 지우고 호출부 3곳을 고친다**

```bash
rm src/entities/chat-message/api/getClientIp.ts
```

세 파일에서 import 경로를 바꾼다.

`src/entities/chat-message/actions/chatAction.ts`
```
- import { getClientIp } from '../api/getClientIp';
+ import { getClientIp } from '@/shared/api/getClientIp';
```

`src/entities/chat-message/actions/getRemainingTokensAction.ts`
```
- import { getClientIp } from '../api/getClientIp';
+ import { getClientIp } from '@/shared/api/getClientIp';
```

`src/entities/shared-analysis/actions/createShareSnapshotAction.ts`
```
- import { getClientIp } from '@/entities/chat-message/api/getClientIp';
+ import { getClientIp } from '@/shared/api/getClientIp';
```

- [ ] **Step 3: 옛 경로가 0건인지 확인한다**

"이동"은 복사가 아니다. 원본이 남아 있으면 두 구현이 갈라진다.

```bash
grep -rn "chat-message/api/getClientIp\|from '../api/getClientIp'" src/ e2e/ scripts/ db/
```

기대: **출력 없음.** 한 줄이라도 나오면 그 파일을 마저 고친다.

- [ ] **Step 4: 타입과 관련 테스트를 돌린다**

```bash
yarn tsc --noEmit
yarn test:related src/shared/api/getClientIp.ts src/entities/chat-message src/entities/shared-analysis
```

기대: tsc 오류 0, 테스트 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add -u src/entities
git add src/shared/api/getClientIp.ts
git commit -m "refactor(shared): getClientIp을 shared/api로 옮긴다"
```

---

## Task 3: `visitor_days` 테이블

**Files:**
- Modify: `src/shared/db/schema.ts`
- Create: `drizzle/00XX_*.sql` (`yarn db:generate` 산출물 — 이름은 drizzle-kit이 정한다)

- [ ] **Step 1: 스키마에 테이블을 추가한다**

`src/shared/db/schema.ts`에서 `usageLogs` 정의 **바로 아래**에 넣는다.
`date`·`primaryKey`·`text`·`timestamp`는 이미 import되어 있다.

```ts
/**
 * 방문자 1명당 하루 1행. DAU/MAU 집계용.
 *
 * 복합 PK 하나가 세 가지를 동시에 한다: 중복 방지(`ON CONFLICT DO NOTHING`의
 * 대상), DAU 조회 인덱스(`WHERE date = $1`이 PK 접두사), MAU range 스캔.
 * 별도 인덱스도 `id` 컬럼도 두지 않는다.
 *
 * `usage_logs`를 재사용하지 않는 이유가 두 가지다. 그쪽은 `action_type`·
 * `model_used`가 NOT NULL인 분석 요청 로그라 방문 행을 넣으려면 의미 없는 값을
 * 채워야 하고, `ip_hash`가 UTC 날짜를 salt로 섞어 매일 달라지므로 날짜를
 * 가로지르는 MAU 집계가 원리적으로 불가능하다.
 */
export const visitorDays = pgTable(
    'visitor_days',
    {
        visitorHash: text('visitor_hash').notNull(),
        /**
         * KST 기준 `YYYY-MM-DD`. UTC로 하면 자정이 KST 09:00이라 한국 사용자의
         * 오전이 이틀로 쪼개진다.
         */
        date: date('date').notNull(),
        /**
         * 그날 그 방문자의 첫 접속 시각. 집계에는 쓰이지 않는다 — 시간대별
         * 트래픽 분포를 나중에 보고 싶을 때 이 컬럼이 없으면 소급이 불가능하다.
         */
        firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [primaryKey({ columns: [table.date, table.visitorHash] })]
);
```

- [ ] **Step 2: 마이그레이션을 생성한다**

손으로 `.sql`을 쓰면 안 된다. `drizzle/meta/_journal.json`에 등록되지 않아
조용히 건너뛰어지고, e2e DB에 테이블이 없어 스위트가 통째로 깨진다.

```bash
yarn db:generate
```

기대: `drizzle/00XX_<이름>.sql`이 새로 생기고 `drizzle/meta/_journal.json`에
항목이 하나 늘어난다.

- [ ] **Step 3: 생성물을 확인한다**

```bash
git status --short drizzle/
cat drizzle/00*_*.sql | tail -20
```

기대: `CREATE TABLE "visitor_days"`와 `PRIMARY KEY("date","visitor_hash")`가 보인다.

- [ ] **Step 4: 커밋**

```bash
git add src/shared/db/schema.ts drizzle/
git commit -m "feat(db): visitor_days 테이블을 추가한다"
```

---

## Task 4: `buildVisitorHash` 순수 함수

**Files:**
- Create: `src/entities/visitor/lib/visitorHash.ts`
- Test: `src/entities/visitor/__tests__/visitorHash.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest';
import { buildVisitorHash } from '@/entities/visitor/lib/visitorHash';

const PEPPER = 'test-pepper';
const IP = '203.0.113.10';
const UA = 'Mozilla/5.0 (Macintosh) Chrome/140.0.0.0';

describe('buildVisitorHash', () => {
    it('같은 입력에 같은 해시를 준다', () => {
        expect(buildVisitorHash(PEPPER, IP, UA)).toBe(
            buildVisitorHash(PEPPER, IP, UA)
        );
    });

    it('64자 hex를 반환한다', () => {
        expect(buildVisitorHash(PEPPER, IP, UA)).toMatch(/^[0-9a-f]{64}$/);
    });

    it('pepper가 다르면 다른 해시가 된다', () => {
        expect(buildVisitorHash('other-pepper', IP, UA)).not.toBe(
            buildVisitorHash(PEPPER, IP, UA)
        );
    });

    it('같은 IP라도 User-Agent가 다르면 다른 해시가 된다', () => {
        // 통신사 NAT 뒤의 서로 다른 사람이 1명으로 뭉치는 것을 줄인다.
        expect(buildVisitorHash(PEPPER, IP, 'Mozilla/5.0 (iPhone)')).not.toBe(
            buildVisitorHash(PEPPER, IP, UA)
        );
    });

    it('날짜를 섞지 않는다 — 그래야 MAU가 성립한다', () => {
        // hashUsageIp와의 결정적 차이. 이 함수는 시간에 의존하지 않는다.
        const first = buildVisitorHash(PEPPER, IP, UA);
        const second = buildVisitorHash(PEPPER, IP, UA);
        expect(first).toBe(second);
        // hashUsageIp가 만드는 해시와도 달라야 한다(같으면 salt가 섞인 것이다).
        expect(first).not.toBe(
            buildVisitorHash(`${PEPPER}:2026-09-02`, IP, UA)
        );
    });

    it('pepper가 비어 있으면 던진다', () => {
        // 무염 SHA-256은 IPv4 2^32를 전수 대입하면 즉시 역산된다.
        expect(() => buildVisitorHash('', IP, UA)).toThrow(
            /VISITOR_HASH_PEPPER/
        );
    });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
yarn test src/entities/visitor/__tests__/visitorHash.test.ts
```

기대: 모듈 해석 실패.

- [ ] **Step 3: 구현한다**

`src/entities/visitor/lib/visitorHash.ts`

```ts
import { createHash } from 'node:crypto';

const SHA_256_ALGORITHM = 'sha256';
const HEX_DIGEST_ENCODING = 'hex';

/**
 * 방문자 식별용 가명 해시.
 *
 * `hashUsageIp`(core)를 쓰지 않는 이유: 그쪽은 salt에 UTC 날짜를 섞어 같은 IP도
 * 매일 다른 해시가 된다. 일일 rate limit에는 맞지만 MAU는 원리적으로 불가능하다 —
 * 한 사람이 30일 방문하면 30명으로 세어진다.
 *
 * `pepper`가 비면 던진다. IPv4 공간은 2^32뿐이라 무염 SHA-256은 전수 대입으로
 * 즉시 역산된다 — 빈 문자열 폴백은 "해시했으니 안전하다"는 거짓 안전감만 준다.
 * pepper를 교체하면 그 시점에 MAU 연속성이 끊기므로 고정해서 쓴다.
 *
 * User-Agent를 함께 섞는다. IP만 쓰면 통신사 NAT·CGNAT 뒤의 수백 명이 1명으로
 * 뭉쳐 과소집계된다. 반대급부로 한 사람이 폰과 PC를 쓰면 2명이 되지만, 모바일
 * 비중이 큰 서비스에서는 NAT 뭉침 쪽이 훨씬 크다.
 */
export function buildVisitorHash(
    pepper: string,
    clientIp: string,
    userAgent: string
): string {
    if (pepper === '') {
        throw new Error(
            'VISITOR_HASH_PEPPER is required — refusing to build an unsalted visitor hash'
        );
    }
    return createHash(SHA_256_ALGORITHM)
        .update(`${pepper}:${clientIp}:${userAgent}`)
        .digest(HEX_DIGEST_ENCODING);
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
yarn test src/entities/visitor/__tests__/visitorHash.test.ts
```

기대: 6개 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/entities/visitor
git commit -m "feat(visitor): 방문자 가명 해시 함수를 추가한다"
```

---

## Task 5: `DrizzleVisitorRepository`

**Files:**
- Create: `src/entities/visitor/types.ts`
- Create: `src/entities/visitor/api.ts`
- Create: `src/entities/visitor/index.ts`
- Test: `src/entities/visitor/__tests__/api.test.ts`

- [ ] **Step 1: 타입을 먼저 정의한다**

`src/entities/visitor/types.ts`

```ts
/** 하루치 활성 사용자 수. `date`는 KST 기준 `YYYY-MM-DD`. */
export interface DailyActiveUsers {
    readonly date: string;
    readonly count: number;
}
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`src/entities/visitor/__tests__/api.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import { DrizzleVisitorRepository } from '@/entities/visitor/api';
import type { SiglensDatabase } from '@/shared/db/types';

function makeInsertDb(): {
    db: SiglensDatabase;
    values: ReturnType<typeof vi.fn>;
    onConflictDoNothing: ReturnType<typeof vi.fn>;
} {
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const insert = vi.fn(() => ({ values }));
    return {
        db: { insert } as unknown as SiglensDatabase,
        values,
        onConflictDoNothing,
    };
}

function makeDeleteDb(): {
    db: SiglensDatabase;
    where: ReturnType<typeof vi.fn>;
} {
    const where = vi.fn().mockResolvedValue(undefined);
    const del = vi.fn(() => ({ where }));
    return { db: { delete: del } as unknown as SiglensDatabase, where };
}

/**
 * 세 가지 select 체인을 한 목으로 덮는다.
 *  - `dailyActiveUsers`: select().from().where().groupBy().orderBy()
 *  - `monthlyActiveUsers`: select().from().where()  ← where가 곧 thenable
 *  - `totalRows`: select().from()                    ← from이 곧 thenable
 *
 * 그래서 `from`과 `where`는 **객체이면서 동시에 await 가능**해야 한다.
 * `then`을 얹어 둘 다 만족시킨다.
 */
function makeSelectDb(rows: unknown[]): SiglensDatabase {
    const orderBy = vi.fn().mockResolvedValue(rows);
    const groupBy = vi.fn(() => ({ orderBy }));
    const thenable = (extra: object) => ({
        ...extra,
        then: (resolve: (value: unknown[]) => unknown) => resolve(rows),
    });
    const where = vi.fn(() => thenable({ groupBy }));
    const from = vi.fn(() => thenable({ where }));
    const select = vi.fn(() => ({ from }));
    return { select } as unknown as SiglensDatabase;
}

describe('DrizzleVisitorRepository', () => {
    it('recordVisit은 중복을 무시하고 삽입한다', async () => {
        const { db, values, onConflictDoNothing } = makeInsertDb();
        await new DrizzleVisitorRepository(db).recordVisit(
            'hash-1',
            '2026-09-02'
        );

        expect(values).toHaveBeenCalledWith({
            visitorHash: 'hash-1',
            date: '2026-09-02',
        });
        // 같은 방문자가 하루에 여러 번 와도 행은 하나여야 한다.
        expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
    });

    it('pruneOlderThan은 삭제를 한 번 건다', async () => {
        const { db, where } = makeDeleteDb();
        await new DrizzleVisitorRepository(db).pruneOlderThan('2025-07-29');
        expect(where).toHaveBeenCalledTimes(1);
    });

    it('monthlyActiveUsers는 행이 없으면 0을 준다', async () => {
        const repo = new DrizzleVisitorRepository(makeSelectDb([]));
        await expect(repo.monthlyActiveUsers('2026-08-03')).resolves.toBe(0);
    });

    it('monthlyActiveUsers는 distinct 집계값을 꺼낸다', async () => {
        const repo = new DrizzleVisitorRepository(
            makeSelectDb([{ value: 1847 }])
        );
        await expect(repo.monthlyActiveUsers('2026-08-03')).resolves.toBe(1847);
    });

    it('totalRows는 행이 없으면 0을 준다', async () => {
        const repo = new DrizzleVisitorRepository(makeSelectDb([]));
        await expect(repo.totalRows()).resolves.toBe(0);
    });

    it('dailyActiveUsers는 날짜별 행을 그대로 돌려준다', async () => {
        const rows = [
            { date: '2026-09-02', count: 142 },
            { date: '2026-09-01', count: 118 },
        ];
        const repo = new DrizzleVisitorRepository(makeSelectDb(rows));
        await expect(repo.dailyActiveUsers('2026-08-03')).resolves.toEqual(rows);
    });
});
```

- [ ] **Step 3: 실패를 확인한다**

```bash
yarn test src/entities/visitor/__tests__/api.test.ts
```

기대: 모듈 해석 실패.

- [ ] **Step 4: 리포지토리를 구현한다**

`src/entities/visitor/api.ts`

```ts
import 'server-only';

import { count, countDistinct, desc, gte, lt } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { visitorDays } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import type { DailyActiveUsers } from './types';

/** 방문자 일자 행의 적재·정리·집계. 날짜는 전부 KST `YYYY-MM-DD`. */
export interface VisitorRepository {
    /** 방문자당 하루 1행. 이미 있으면 아무 일도 하지 않는다. */
    recordVisit(visitorHash: string, date: string): Promise<void>;
    /** `cutoffDate` **이전** 행을 지운다. 개인정보처리방침 §4의 보존 기간 집행. */
    pruneOlderThan(cutoffDate: string): Promise<void>;
    /** `fromDate` 이후의 날짜별 방문자 수. 최신 날짜가 먼저 온다. */
    dailyActiveUsers(fromDate: string): Promise<DailyActiveUsers[]>;
    /** `fromDate` 이후 구간의 고유 방문자 수. */
    monthlyActiveUsers(fromDate: string): Promise<number>;
    /** 테이블 전체 행 수. 집계 테이블 도입 시점을 판단하는 데 쓴다. */
    totalRows(): Promise<number>;
}

/** Drizzle ORM-backed implementation. */
export class DrizzleVisitorRepository implements VisitorRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async recordVisit(visitorHash: string, date: string): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(visitorDays)
                    .values({ visitorHash, date })
                    .onConflictDoNothing(),
            NEON_TRANSIENT_RETRY
        );
    }

    async pruneOlderThan(cutoffDate: string): Promise<void> {
        await this.db
            .delete(visitorDays)
            .where(lt(visitorDays.date, cutoffDate));
    }

    async dailyActiveUsers(fromDate: string): Promise<DailyActiveUsers[]> {
        return this.db
            .select({ date: visitorDays.date, count: count() })
            .from(visitorDays)
            .where(gte(visitorDays.date, fromDate))
            .groupBy(visitorDays.date)
            .orderBy(desc(visitorDays.date));
    }

    async monthlyActiveUsers(fromDate: string): Promise<number> {
        const rows = await this.db
            .select({ value: countDistinct(visitorDays.visitorHash) })
            .from(visitorDays)
            .where(gte(visitorDays.date, fromDate));
        return rows[0]?.value ?? 0;
    }

    async totalRows(): Promise<number> {
        const rows = await this.db
            .select({ value: count() })
            .from(visitorDays);
        return rows[0]?.value ?? 0;
    }
}
```

`src/entities/visitor/index.ts`

```ts
export { DrizzleVisitorRepository, type VisitorRepository } from './api';
export { buildVisitorHash } from './lib/visitorHash';
export type { DailyActiveUsers } from './types';
```

`api.ts`가 `server-only`이므로 이 barrel 전체가 서버 전용이 된다. 클라이언트가
실수로 import하면 빌드가 즉시 깨진다 — `VisitorPing`은 이 barrel을 쓰지 않는다.

- [ ] **Step 5: 통과를 확인한다**

```bash
yarn test src/entities/visitor/__tests__/api.test.ts
```

기대: 6개 PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/entities/visitor
git commit -m "feat(visitor): 방문자 집계 리포지토리를 추가한다"
```

---

## Task 6: `/api/presence` 라우트

**Files:**
- Create: `src/app/api/presence/route.ts`
- Test: `src/app/api/presence/__tests__/route.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/presence/__tests__/route.test.ts`

```ts
import { constants } from 'node:http2';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
    HTTP_STATUS_NO_CONTENT,
    HTTP_STATUS_INTERNAL_SERVER_ERROR,
} = constants;

const HUMAN_UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/140.0.0.0';
const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const recordVisit = vi.fn().mockResolvedValue(undefined);
const pruneOlderThan = vi.fn().mockResolvedValue(undefined);
let requestHeaders = new Headers();

vi.mock('next/headers', () => ({
    headers: () => Promise.resolve(requestHeaders),
}));

/**
 * `after()`만 갈아끼운다. 모듈을 통째로 대체하면 `isBot`이 쓰는
 * `userAgent`가 함께 사라져 봇 판정이 던진다.
 */
vi.mock('next/server', async importOriginal => {
    const actual = await importOriginal<typeof import('next/server')>();
    return {
        ...actual,
        // 콜백을 즉시 실행해 prune 경로를 테스트에서 관찰 가능하게 만든다.
        after: (fn: () => unknown) => {
            void fn();
        },
    };
});

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

vi.mock('@/entities/visitor', () => ({
    DrizzleVisitorRepository: class {
        recordVisit = recordVisit;
        pruneOlderThan = pruneOlderThan;
    },
    buildVisitorHash: (pepper: string, ip: string, ua: string) =>
        `hash(${pepper}|${ip}|${ua})`,
}));

/**
 * 라우트가 모듈 스코프에 마지막 prune 날짜를 들고 있다. 테스트마다
 * 새로 import해야 그 상태가 격리된다.
 */
async function importRoute() {
    vi.resetModules();
    return import('@/app/api/presence/route');
}

describe('POST /api/presence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('VISITOR_HASH_PEPPER', 'test-pepper');
        requestHeaders = new Headers({
            'user-agent': HUMAN_UA,
            'x-forwarded-for': '203.0.113.10, 10.0.0.1',
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('사람 요청을 하루 1행으로 기록하고 204를 준다', async () => {
        const { POST } = await importRoute();
        const res = await POST();

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        // x-forwarded-for의 첫 값만 쓴다(프록시 체인의 뒤쪽은 우리 인프라다).
        expect(recordVisit).toHaveBeenCalledWith(
            `hash(test-pepper|203.0.113.10|${HUMAN_UA})`,
            expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
        );
    });

    it('봇 User-Agent는 기록하지 않는다', async () => {
        requestHeaders.set('user-agent', BOT_UA);
        const { POST } = await importRoute();
        const res = await POST();

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(recordVisit).not.toHaveBeenCalled();
    });

    it('프로덕션이 아니면 기록하지 않는다', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        const { POST } = await importRoute();
        const res = await POST();

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(recordVisit).not.toHaveBeenCalled();
    });

    it('pepper가 없으면 500과 함께 로그를 남긴다', async () => {
        vi.stubEnv('VISITOR_HASH_PEPPER', '');
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { POST } = await importRoute();
        const res = await POST();

        // 조용히 0이 찍히는 것이 최악이다. 프로덕션 로그에 남아야 한다.
        expect(res.status).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR);
        expect(spy).toHaveBeenCalledWith(
            expect.stringContaining('VISITOR_HASH_PEPPER')
        );
        expect(recordVisit).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('DB 쓰기가 실패해도 204를 준다', async () => {
        recordVisit.mockRejectedValueOnce(new Error('neon down'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { POST } = await importRoute();
        const res = await POST();

        // 집계 실패가 사용자 화면을 깨뜨리면 안 된다.
        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('보존 기간을 넘긴 행을 하루 한 번만 지운다', async () => {
        const { POST } = await importRoute();
        await POST();
        await POST();

        // 같은 날 두 번째 요청은 prune을 다시 돌리지 않는다.
        expect(pruneOlderThan).toHaveBeenCalledTimes(1);
        expect(pruneOlderThan).toHaveBeenCalledWith(
            expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
        );
    });

    it('정리 기준일은 오늘로부터 400일 전이다', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-02T03:00:00.000Z'));

        const { POST } = await importRoute();
        await POST();

        // KST 2026-09-02 기준 400일 전 = 2025-07-29
        expect(pruneOlderThan).toHaveBeenCalledWith('2025-07-29');
        vi.useRealTimers();
    });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
yarn test src/app/api/presence/__tests__/route.test.ts
```

기대: 모듈 해석 실패.

- [ ] **Step 3: 라우트를 구현한다**

`src/app/api/presence/route.ts`

```ts
/**
 * 방문자 집계 수집점. 하는 일은 방문자당 하루 1행을 남기는 것뿐이다.
 *
 * 서버 컴포넌트가 아니라 클라이언트 비콘이 이 라우트를 부른다. 페이지에서
 * `headers()`를 부르면 그 라우트의 ISR이 통째로 꺼지고, 프록시에서 세면 RSC
 * prefetch까지 전부 세어 사람 수가 부풀려진다. 자세한 근거는
 * `docs/superpowers/specs/2026-09-02-visitor-metrics-design.md` §4.
 *
 * 경로가 `analytics`·`track`·`collect`가 아닌 이유: EasyList 계열 차단 목록이
 * 그 단어가 든 경로를 막는다.
 */
import { constants } from 'node:http2';
import { after } from 'next/server';
import { headers } from 'next/headers';
import { buildVisitorHash, DrizzleVisitorRepository } from '@/entities/visitor';
import { getClientIp } from '@/shared/api/getClientIp';
import { isBot } from '@/shared/api/isBot';
import { getDatabaseClient } from '@/shared/db/client';
import { kstDateKey } from '@/shared/lib/etTimeUtils';

const { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_INTERNAL_SERVER_ERROR } = constants;

export const dynamic = 'force-dynamic';

/**
 * 개인정보처리방침 §4가 고지한 보존 기간.
 *
 * **바꾸면 방침 본문(`db/seeds/terms/privacy/`)도 같이 바꿔야 한다.** 방침에
 * 적힌 기간과 실제 삭제 기준이 어긋나면 그 자체가 방침 위반이다.
 */
const RETENTION_DAYS = 400;

const MILLISECONDS_PER_DAY = 86_400_000;
const ISO_DATE_LENGTH = 10;

/**
 * 이 인스턴스가 마지막으로 정리를 돌린 KST 날짜.
 *
 * 보존 기간 집행을 위해 별도 EventBridge cron을 만들지 않는다. `DELETE`는
 * 멱등이라 인스턴스가 몇 개든, 같은 날 몇 번 돌든 결과가 같다. 트래픽이 0이면
 * 정리도 안 돌지만 그때는 지울 행도 없다.
 */
let lastPrunedDate: string | null = null;

function noContent(): Response {
    return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
}

/** `todayKst`로부터 `RETENTION_DAYS`일 전 날짜. 달력 문자열 산술이라 UTC로 파싱한다. */
function retentionCutoff(todayKst: string): string {
    const base = new Date(`${todayKst}T00:00:00Z`);
    return new Date(base.getTime() - RETENTION_DAYS * MILLISECONDS_PER_DAY)
        .toISOString()
        .slice(0, ISO_DATE_LENGTH);
}

export async function POST(): Promise<Response> {
    const headerList = await headers();

    // 봇 필터 2층. 1층은 이 라우트에 도달하지도 않는다 — 비콘이 JS 실행을
    // 요구하므로 JS를 돌리지 않는 크롤러는 애초에 요청을 만들지 않는다.
    if (isBot(headerList)) return noContent();
    if (process.env.NODE_ENV !== 'production') return noContent();

    const pepper = process.env.VISITOR_HASH_PEPPER ?? '';
    if (pepper === '') {
        // 조용히 0이 찍히는 것이 최악이다. 프로덕션 로그에 남긴다.
        console.error(
            '[visitor-metrics] VISITOR_HASH_PEPPER is not set — visits are not being recorded'
        );
        return new Response(null, {
            status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
        });
    }

    const today = kstDateKey(new Date());
    const visitorHash = buildVisitorHash(
        pepper,
        await getClientIp(),
        headerList.get('user-agent') ?? ''
    );

    const { db } = getDatabaseClient();
    const repo = new DrizzleVisitorRepository(db);

    try {
        await repo.recordVisit(visitorHash, today);
    } catch (error) {
        // 집계 실패가 사용자 화면을 깨뜨리면 안 된다.
        console.error('[visitor-metrics] recordVisit failed:', error);
    }

    if (lastPrunedDate !== today) {
        lastPrunedDate = today;
        after(async () => {
            try {
                await repo.pruneOlderThan(retentionCutoff(today));
            } catch (error) {
                // 다음 날 다시 시도된다.
                console.error('[visitor-metrics] prune failed:', error);
            }
        });
    }

    return noContent();
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
yarn test src/app/api/presence/__tests__/route.test.ts
```

기대: 7개 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/presence
git commit -m "feat(visitor): /api/presence 수집 라우트를 추가한다"
```

---

## Task 7: `VisitorPing` 클라이언트 컴포넌트

**Files:**
- Create: `src/features/visitor-ping/ui/VisitorPing.tsx`
- Create: `src/features/visitor-ping/index.ts`
- Test: `src/features/visitor-ping/__tests__/VisitorPing.test.tsx`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/visitor-ping/__tests__/VisitorPing.test.tsx`

```tsx
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisitorPing } from '@/features/visitor-ping';
import { kstDateKey } from '@/shared/lib/etTimeUtils';

const STORAGE_KEY = 'siglens:visit';

/**
 * 가짜 타이머를 쓰지 않는다. RTL의 `waitFor`가 타이머로 폴링하는데, vitest의
 * 가짜 타이머를 RTL이 감지하지 못해 폴링이 영원히 진행되지 않는다.
 * 대신 실제 현재 시각의 KST 날짜를 그대로 기대값으로 쓴다.
 */
const TODAY = kstDateKey(new Date());

describe('VisitorPing', () => {
    beforeEach(() => {
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

    it('첫 방문에 본문 없는 POST를 보낸다', async () => {
        render(<VisitorPing />);

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith('/api/presence', {
                method: 'POST',
                keepalive: true,
            });
        });
    });

    it('성공하면 오늘 날짜를 기록해 다시 보내지 않는다', async () => {
        const { unmount } = render(<VisitorPing />);
        await waitFor(() => {
            expect(window.localStorage.getItem(STORAGE_KEY)).toBe(TODAY);
        });
        unmount();

        render(<VisitorPing />);
        // 같은 날 두 번째 마운트는 요청을 만들지 않는다.
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('저장된 날짜가 오늘이 아니면 다시 보낸다', async () => {
        window.localStorage.setItem(STORAGE_KEY, '2000-01-01');
        render(<VisitorPing />);
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledTimes(1);
        });
    });

    it('자동화 브라우저에서는 보내지 않는다', () => {
        Object.defineProperty(navigator, 'webdriver', {
            value: true,
            configurable: true,
        });
        render(<VisitorPing />);
        // 사람 수를 세는 것이 목적이다. Playwright·Puppeteer는 사람이 아니다.
        expect(fetch).not.toHaveBeenCalled();
    });

    it('응답이 실패하면 날짜를 기록하지 않는다', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        render(<VisitorPing />);

        await waitFor(() => {
            expect(fetch).toHaveBeenCalled();
        });
        // pepper 미설정 같은 배포 오류는 다음 로드에서 다시 드러나야 한다.
        expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('네트워크가 던져도 화면을 깨뜨리지 않는다', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('blocked')));
        expect(() => render(<VisitorPing />)).not.toThrow();
        await waitFor(() => {
            expect(fetch).toHaveBeenCalled();
        });
    });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
yarn test src/features/visitor-ping/__tests__/VisitorPing.test.tsx
```

기대: 모듈 해석 실패.

- [ ] **Step 3: 컴포넌트를 구현한다**

`src/features/visitor-ping/ui/VisitorPing.tsx`

```tsx
'use client';

import { useEffect } from 'react';
import { kstDateKey } from '@/shared/lib/etTimeUtils';

/** 마지막으로 비콘을 보낸 KST 날짜를 담는다. */
const STORAGE_KEY = 'siglens:visit';

/**
 * 하루 한 번, 방문 사실만 알린다. **본문은 보내지 않는다** — IP와 User-Agent는
 * 이미 요청 헤더에 있다.
 *
 * 서버가 아니라 클라이언트에서 보내는 이유가 두 가지다.
 *  1. 페이지에서 `headers()`를 부르면 그 라우트의 ISR이 꺼진다.
 *  2. JS를 실행하지 않는 크롤러는 이 비콘을 아예 띄우지 않는다 — UA 정규식보다
 *     강한 봇 필터가 공짜로 생긴다.
 *
 * 날짜는 `kstDateKey`로 판정한다. 브라우저 로컬 타임존을 쓰면 서버의 날짜 경계와
 * 어긋나 그 방문자가 특정 날에 통째로 누락된다. 반대 방향(중복 전송)은 서버가
 * `ON CONFLICT DO NOTHING`으로 흡수하므로 무해하다.
 *
 * `@/entities/visitor` barrel은 `server-only`라 여기서 import하지 않는다.
 */
export function VisitorPing(): null {
    useEffect(() => {
        // 사람 수를 세는 것이 목적이다. Playwright·Puppeteer는 사람이 아니다.
        if (navigator.webdriver) return;

        const today = kstDateKey(new Date());

        let last: string | null = null;
        try {
            last = window.localStorage.getItem(STORAGE_KEY);
        } catch {
            // 사파리 프라이빗 모드 등 — 매번 보낸다. 서버가 중복을 흡수한다.
        }
        if (last === today) return;

        void fetch('/api/presence', { method: 'POST', keepalive: true })
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
                // 차단기·오프라인. 집계 하나 놓치는 편이 화면을 깨뜨리는 것보다 낫다.
            });
    }, []);

    return null;
}
```

`src/features/visitor-ping/index.ts`

```ts
export { VisitorPing } from './ui/VisitorPing';
```

- [ ] **Step 4: 통과를 확인한다**

```bash
yarn test src/features/visitor-ping/__tests__/VisitorPing.test.tsx
```

기대: 6개 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/features/visitor-ping
git commit -m "feat(visitor): 방문 비콘 클라이언트 컴포넌트를 추가한다"
```

---

## Task 8: 레이아웃 마운트와 환경 변수

**Files:**
- Modify: `src/app/[locale]/layout.tsx`
- Modify: `.env.example`
- Modify: `.env.e2e`

- [ ] **Step 1: 레이아웃에 마운트한다**

`src/app/[locale]/layout.tsx`의 import 목록에 추가한다.

```ts
import { VisitorPing } from '@/features/visitor-ping';
```

`<SearchOverlayProvider>` 바로 안쪽, `<PwaBanner />` 위에 넣는다.

```tsx
                            <SearchOverlayProvider>
                                {/* 방문자 집계 비콘. 렌더 결과가 없고 하루 한 번만
                                    요청하므로 어느 위치에 두어도 무방하지만, 다른
                                    UI보다 먼저 보내 이탈이 빠른 방문자도 잡는다. */}
                                <VisitorPing />
                                <PwaBanner />
```

- [ ] **Step 2: `.env.example`에 키를 등록한다**

파일 끝에 추가한다.

```
# ── 방문자 집계 (MAU/DAU) ──────────────────────────────────────────────────
# REQUIRED. `/api/presence`가 방문자 가명 해시를 만드는 데 쓰는 고정 pepper다.
#
# 없으면 라우트가 500과 함께 `[visitor-metrics] VISITOR_HASH_PEPPER is not set`을
# 남기고 집계가 0이 된다 — 조용히 0이 되는 것보다 낫게 만든 의도된 동작이다.
# (OPTIONAL_KEYS에 넣지 않으므로 check-env.sh가 자동으로 필수로 수집한다.)
#
# ⚠️ **한 번 정하면 바꾸지 않는다.** 교체하면 그 시점에 MAU 연속성이 끊긴다
# (같은 사람이 교체 전후로 다른 방문자가 된다).
# 생성: `openssl rand -hex 32`
VISITOR_HASH_PEPPER=
```

- [ ] **Step 3: `.env.e2e`에도 넣는다**

e2e는 프로덕션 빌드로 돌기 때문에 `NODE_ENV` 게이트를 통과한다. 값이 없으면
모든 e2e 페이지 로드가 500 응답 하나씩을 만든다.

`.env.e2e` 끝에 추가한다.

```
# 방문자 집계 — 값 자체는 아무래도 좋다. 없으면 매 페이지 로드가 500을 만든다.
VISITOR_HASH_PEPPER=e2e-fixed-pepper
```

- [ ] **Step 4: 타입과 빌드 영향을 확인한다**

```bash
yarn tsc --noEmit
yarn test src/features/visitor-ping
```

기대: tsc 오류 0, 테스트 PASS.

- [ ] **Step 5: 커밋**

```bash
git add "src/app/[locale]/layout.tsx" .env.example .env.e2e
git commit -m "feat(visitor): 루트 레이아웃에 방문 비콘을 마운트한다"
```

---

## Task 9: `yarn metrics` 읽기 스크립트

**Files:**
- Create: `scripts/metrics.ts`
- Modify: `package.json`

- [ ] **Step 1: 스크립트를 쓴다**

`scripts/metrics.ts`

```ts
/**
 * MAU/DAU 읽기. 관리자 UI도 API 라우트도 만들지 않는 이유는
 * `docs/superpowers/specs/2026-09-02-visitor-metrics-design.md` §6에 있다 —
 * `users`에 role 컬럼조차 없어 권한 체계부터 만들어야 한다.
 *
 * 실행: `yarn metrics`
 */
import { DrizzleVisitorRepository } from '@/entities/visitor';
import { getDatabaseClient } from '@/shared/db/client';
import { kstDateKey } from '@/shared/lib/etTimeUtils';

/** 표에 찍을 일수. */
const DAU_WINDOW_DAYS = 30;

/** MAU는 롤링 30일이다. 달력 월 기준은 월초에 1일치로 떨어져 추세를 못 읽는다. */
const MAU_WINDOW_DAYS = 30;

const MILLISECONDS_PER_DAY = 86_400_000;
const ISO_DATE_LENGTH = 10;

/** 달력 문자열 산술이라 UTC로 파싱한다. */
function daysBefore(todayKst: string, days: number): string {
    const base = new Date(`${todayKst}T00:00:00Z`);
    return new Date(base.getTime() - days * MILLISECONDS_PER_DAY)
        .toISOString()
        .slice(0, ISO_DATE_LENGTH);
}

async function main(): Promise<void> {
    const today = kstDateKey(new Date());
    const { db } = getDatabaseClient();
    const repo = new DrizzleVisitorRepository(db);

    const [daily, mau, total] = await Promise.all([
        repo.dailyActiveUsers(daysBefore(today, DAU_WINDOW_DAYS)),
        repo.monthlyActiveUsers(daysBefore(today, MAU_WINDOW_DAYS)),
        repo.totalRows(),
    ]);

    console.log('날짜         DAU');
    for (const row of daily) {
        console.log(`${row.date}   ${row.count.toLocaleString('ko-KR')}`);
    }
    if (daily.length === 0) {
        console.log('(행 없음 — VISITOR_HASH_PEPPER 설정을 먼저 확인한다)');
    }

    console.log('');
    console.log(
        `MAU (${MAU_WINDOW_DAYS}일 롤링): ${mau.toLocaleString('ko-KR')}`
    );
    // 이 수가 수백만이 되면 그때 일별 집계 테이블을 도입한다.
    console.log(`총 행 수: ${total.toLocaleString('ko-KR')}`);
}

if (require.main === module) {
    main().catch(err => {
        console.error('[metrics] failed:', err);
        process.exit(1);
    });
}
```

- [ ] **Step 2: `package.json`에 스크립트를 등록한다**

`db:seed:terms` 줄 근처, 알파벳 순서에 맞는 자리에 추가한다.

```json
        "metrics": "dotenv -e .env.local -- node_modules/.bin/tsx scripts/metrics.ts",
```

- [ ] **Step 3: 실행해 본다**

로컬 DB에는 행이 없다. `(행 없음 ...)` 안내와 `MAU: 0`, `총 행 수: 0`이 나오면
연결과 쿼리가 정상이라는 뜻이다.

```bash
yarn metrics
```

기대:
```
날짜         DAU
(행 없음 — VISITOR_HASH_PEPPER 설정을 먼저 확인한다)

MAU (30일 롤링): 0
총 행 수: 0
```

- [ ] **Step 4: 커밋**

```bash
git add scripts/metrics.ts package.json
git commit -m "feat(visitor): yarn metrics 조회 스크립트를 추가한다"
```

---

## Task 10: `terms` 리포지토리에 번역 적재를 넣는다

`upsertFromSeed`가 `void`를 돌려줘서 방금 넣은 행의 id를 알 수 없다. 번역
사이드카는 `entityId`로 그 id가 필요하다.

**Files:**
- Modify: `src/entities/terms/api.ts`
- Test: `src/entities/terms/__tests__/api.test.ts` (기존 파일에 추가)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/entities/terms/__tests__/api.test.ts` 끝에 추가한다.

```ts
describe('DrizzleTermsRepository.upsertFromSeed', () => {
    it('새로 삽입하면 그 행의 id를 준다', async () => {
        const returning = vi.fn().mockResolvedValue([{ id: 'terms-1' }]);
        const onConflictDoNothing = vi.fn(() => ({ returning }));
        const values = vi.fn(() => ({ onConflictDoNothing }));
        const db = {
            insert: vi.fn(() => ({ values })),
        } as unknown as SiglensDatabase;

        const id = await new DrizzleTermsRepository(db).upsertFromSeed({
            kind: 'privacy',
            version: 2,
            effectiveDate: new Date('2026-09-09T00:00:00+09:00'),
            body: '## 1. 총칙',
        });

        expect(id).toBe('terms-1');
    });

    it('이미 있는 버전이면 기존 행의 id를 조회해 준다', async () => {
        // 충돌하면 returning이 빈 배열이다 — 번역을 붙이려면 id가 여전히 필요하다.
        const returning = vi.fn().mockResolvedValue([]);
        const onConflictDoNothing = vi.fn(() => ({ returning }));
        const values = vi.fn(() => ({ onConflictDoNothing }));
        const limit = vi.fn().mockResolvedValue([{ id: 'terms-existing' }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        const db = {
            insert: vi.fn(() => ({ values })),
            select: vi.fn(() => ({ from })),
        } as unknown as SiglensDatabase;

        const id = await new DrizzleTermsRepository(db).upsertFromSeed({
            kind: 'privacy',
            version: 1,
            effectiveDate: new Date('2026-04-30T00:00:00+09:00'),
            body: '## 1. 총칙',
        });

        expect(id).toBe('terms-existing');
    });
});

describe('DrizzleTermsRepository.upsertTranslation', () => {
    it('human 출처로 사이드카에 넣고 재실행하면 갱신한다', async () => {
        const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
        const values = vi.fn(() => ({ onConflictDoUpdate }));
        const db = {
            insert: vi.fn(() => ({ values })),
        } as unknown as SiglensDatabase;

        await new DrizzleTermsRepository(db).upsertTranslation({
            termsId: 'terms-1',
            locale: 'en',
            body: '## 1. General',
        });

        expect(values).toHaveBeenCalledWith(
            expect.objectContaining({
                entity: 'terms',
                entityId: 'terms-1',
                field: 'body',
                locale: 'en',
                value: '## 1. General',
                // 약관 읽기 경로는 source='human' 행만 신뢰한다.
                source: 'human',
            })
        );
        expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
yarn test src/entities/terms/__tests__/api.test.ts
```

기대: `upsertTranslation is not a function`, 그리고 `upsertFromSeed`가
`undefined`를 반환해 id 단언이 실패한다.

- [ ] **Step 3: 리포지토리를 고친다**

`src/entities/terms/api.ts`의 import에 추가한다.

```ts
import { contentTranslations, terms } from '@/shared/db/schema';
```

(기존 `import { terms } from '@/shared/db/schema';`를 위 줄로 교체한다.)

`TermsSeedInput` 아래에 새 입력 타입을 넣는다.

```ts
/** Input used by the seed script to upsert a human-authored body translation. */
export interface TermsTranslationInput {
    /** `terms` 행의 uuid. `upsertFromSeed`가 돌려준 값이다. */
    termsId: string;
    locale: Locale;
    body: string;
}
```

`TermsRepository` 인터페이스의 `upsertFromSeed` 선언을 바꾸고 메서드를 추가한다.

```ts
    /**
     * Insert a versioned row; no-op on (kind, version) conflict.
     *
     * 충돌해도 **그 행의 id를 돌려준다** — 번역 사이드카가 `entityId`로 이 값을
     * 쓰므로, 이미 적재된 버전에 번역만 덧붙이는 재실행이 성립해야 한다.
     */
    upsertFromSeed(input: TermsSeedInput): Promise<string>;
    /**
     * 인간이 쓴 본문 번역을 사이드카에 적재한다. 재실행하면 갱신된다.
     *
     * `source`를 항상 `human`으로 박는다 — 읽기 경로(`findActive`)가 그 값만
     * 신뢰하므로, `ai`로 들어간 행은 화면에 나오지도 않으면서 테이블만 채운다.
     */
    upsertTranslation(input: TermsTranslationInput): Promise<void>;
```

`DrizzleTermsRepository.upsertFromSeed`를 통째로 교체한다.

```ts
    async upsertFromSeed(input: TermsSeedInput): Promise<string> {
        const inserted = await withRetry(
            () =>
                this.db
                    .insert(terms)
                    .values({
                        kind: input.kind,
                        version: input.version,
                        effectiveDate: input.effectiveDate,
                        body: input.body,
                    })
                    .onConflictDoNothing({
                        target: [terms.kind, terms.version],
                    })
                    .returning({ id: terms.id }),
            NEON_TRANSIENT_RETRY
        );
        const insertedId = inserted[0]?.id;
        if (insertedId !== undefined) return insertedId;

        // 충돌 = 이미 적재된 버전. 발효된 본문은 조용히 바꾸지 않는다(그래서
        // DoNothing이다). 하지만 번역을 붙이려면 그 행의 id가 여전히 필요하다.
        const existing = await withRetry(
            () =>
                this.db
                    .select({ id: terms.id })
                    .from(terms)
                    .where(
                        and(
                            eq(terms.kind, input.kind),
                            eq(terms.version, input.version)
                        )
                    )
                    .limit(1),
            NEON_TRANSIENT_RETRY
        );
        const existingId = existing[0]?.id;
        if (existingId === undefined) {
            throw new Error(
                `terms ${input.kind} v${input.version} not found after upsert`
            );
        }
        return existingId;
    }

    async upsertTranslation(input: TermsTranslationInput): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(contentTranslations)
                    .values({
                        entity: TRANSLATABLE_ENTITY.terms,
                        entityId: input.termsId,
                        field: CONTENT_FIELD.terms.body,
                        locale: input.locale,
                        value: input.body,
                        source: TRANSLATION_SOURCE.human,
                    })
                    .onConflictDoUpdate({
                        target: [
                            contentTranslations.entity,
                            contentTranslations.entityId,
                            contentTranslations.field,
                            contentTranslations.locale,
                        ],
                        set: {
                            value: input.body,
                            source: TRANSLATION_SOURCE.human,
                            updatedAt: sql`now()`,
                        },
                    }),
            NEON_TRANSIENT_RETRY
        );
    }
```

`and`·`eq`·`sql`은 이미 import되어 있다.

- [ ] **Step 4: 통과를 확인한다**

```bash
yarn test src/entities/terms/__tests__/api.test.ts
yarn tsc --noEmit
```

기대: 테스트 전부 PASS, tsc 오류 0.

- [ ] **Step 5: 커밋**

```bash
git add src/entities/terms
git commit -m "feat(terms): 약관 본문 번역 적재 경로를 리포지토리에 추가한다"
```

---

## Task 11: `seedTerms.ts`에 `locale` frontmatter 지원

**Files:**
- Modify: `db/scripts/seedTerms.ts`
- Test: `src/shared/db/__tests__/scripts/seedTerms.test.ts` (기존 파일에 추가)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

기존 `describe` 블록들 뒤에 추가한다. `validateSeedFiles`와 `ParsedSeed`는
이 파일이 이미 `@/../db/scripts/seedTerms`에서 import하고 있으므로 import 문은
건드리지 않는다.

```ts

function base(version: number): ParsedSeed {
    return {
        kind: 'privacy',
        version,
        effectiveDate: new Date('2026-04-30T00:00:00+09:00'),
        body: '## 1. 총칙',
        sourceFile: `privacy/v${version}.md`,
    };
}

function translation(version: number, locale: 'en' | 'ja' | 'zh'): ParsedSeed {
    return {
        kind: 'privacy',
        version,
        locale,
        body: '## 1. General',
        sourceFile: `privacy/v${version}.${locale}.md`,
    };
}

describe('validateSeedFiles', () => {
    it('번역은 버전 연속성 검사에서 제외된다', () => {
        // 번역 3개가 v1을 공유해도 "중복 v1"이 아니다.
        expect(() =>
            validateSeedFiles([
                base(1),
                translation(1, 'en'),
                translation(1, 'ja'),
                translation(1, 'zh'),
            ])
        ).not.toThrow();
    });

    it('원문 버전이 겹치면 여전히 던진다', () => {
        expect(() => validateSeedFiles([base(1), base(1)])).toThrow(
            /duplicate seed/
        );
    });

    it('원문 버전에 구멍이 있으면 여전히 던진다', () => {
        expect(() => validateSeedFiles([base(1), base(3)])).toThrow(
            /version gap/
        );
    });

    it('짝이 되는 원문이 없는 번역은 던진다', () => {
        // 버전 오타 하나가 조용히 고아 번역 행을 만드는 것을 막는다.
        expect(() =>
            validateSeedFiles([base(1), translation(2, 'en')])
        ).toThrow(/orphan translation/);
    });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
yarn test src/shared/db/__tests__/scripts/seedTerms.test.ts
```

기대: `orphan translation` 케이스가 실패하고, 번역 3개 케이스가
`duplicate seed`로 던진다.

- [ ] **Step 3: 스크립트를 고친다**

`db/scripts/seedTerms.ts`의 import에 추가한다.

```ts
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/shared/i18n/locales';
```

`FrontmatterSchema`를 교체한다.

```ts
const FrontmatterSchema = z.object({
    kind: z.enum(TERMS_KIND_VALUES),
    version: z.number().int().positive(),
    /**
     * 생략하거나 `ko`면 원문 시드다. 나머지는 그 로케일의 **인간 번역**이며
     * `content_translations`에 `source='human'`으로 들어간다.
     *
     * 파일명이 아니라 frontmatter에서 읽는다. 파일명 파싱은 오타가 나면 그
     * 파일이 조용히 무시되고, 화면은 폴백 배너로 멀쩡해 보인다.
     */
    locale: z.enum(LOCALES).optional(),
    /** 원문 시드에만 필요하다. 번역은 원문의 발효일을 그대로 따른다. */
    effectiveDate: z
        .union([z.string(), z.date()])
        .optional()
        .transform(value => {
            if (value === undefined) return undefined;
            const date = typeof value === 'string' ? new Date(value) : value;
            if (Number.isNaN(date.getTime())) {
                throw new Error('Invalid effectiveDate');
            }
            return date;
        }),
});
```

`ParsedSeed`를 교체한다.

```ts
export interface ParsedSeed {
    kind: TermsKind;
    version: number;
    /** 번역 시드면 그 로케일, 원문 시드면 `undefined`. */
    locale?: Exclude<Locale, typeof DEFAULT_LOCALE>;
    /** 원문 시드에만 있다. */
    effectiveDate?: Date;
    body: string;
    sourceFile: string;
}
```

`parseSeedFile`의 `return` 직전에 검사를 넣고 반환값을 바꾼다.

```ts
    const isTranslation =
        result.data.locale !== undefined &&
        result.data.locale !== DEFAULT_LOCALE;

    if (!isTranslation && result.data.effectiveDate === undefined) {
        throw new Error(
            `Invalid frontmatter in ${filePath} — 원문 시드에는 effectiveDate가 필요하다`
        );
    }

    return {
        kind: result.data.kind,
        version: result.data.version,
        locale: isTranslation
            ? (result.data.locale as Exclude<Locale, typeof DEFAULT_LOCALE>)
            : undefined,
        effectiveDate: result.data.effectiveDate,
        body: parsed.content.trim(),
        sourceFile: filePath,
    };
```

`validateSeedFiles`를 교체한다.

```ts
/** Validate version monotonicity, detect duplicates / gaps, and orphan translations. */
export function validateSeedFiles(seeds: readonly ParsedSeed[]): void {
    const originals = seeds.filter(seed => seed.locale === undefined);
    const byKind = new Map<string, number[]>();
    for (const seed of originals) {
        const list = byKind.get(seed.kind) ?? [];
        if (list.includes(seed.version)) {
            throw new Error(
                `duplicate seed for ${seed.kind} v${seed.version} (${seed.sourceFile})`
            );
        }
        byKind.set(seed.kind, [...list, seed.version]);
    }
    for (const [kind, versions] of byKind) {
        const sorted = versions.toSorted((a, b) => a - b);
        const gapIdx = sorted.findIndex((v, i) => v !== i + 1);
        if (gapIdx !== -1) {
            throw new Error(
                `version gap detected for kind=${kind}: expected ${gapIdx + 1}, got ${sorted[gapIdx]}`
            );
        }
    }

    // 버전 오타 하나가 아무도 읽지 않는 고아 번역 행을 조용히 만드는 것을 막는다.
    const originalKeys = new Set(
        originals.map(seed => `${seed.kind}:${seed.version}`)
    );
    for (const seed of seeds) {
        if (seed.locale === undefined) continue;
        if (!originalKeys.has(`${seed.kind}:${seed.version}`)) {
            throw new Error(
                `orphan translation: ${seed.kind} v${seed.version} ${seed.locale} has no original seed (${seed.sourceFile})`
            );
        }
    }
}
```

`main()`의 upsert 블록을 교체한다.

```ts
    const originals = seeds.filter(seed => seed.locale === undefined);
    const translations = seeds.filter(seed => seed.locale !== undefined);

    // 번역은 원문 행의 uuid를 `entityId`로 쓰므로 원문을 먼저 적재해야 한다.
    const idByKey = new Map<string, string>();
    for (const seed of originals) {
        const id = await repo.upsertFromSeed({
            kind: seed.kind,
            version: seed.version,
            // validateSeedFiles/parseSeedFile이 원문에 발효일이 있음을 보장한다.
            effectiveDate: seed.effectiveDate!,
            body: seed.body,
        });
        idByKey.set(`${seed.kind}:${seed.version}`, id);
        console.log(`[seed] ${seed.kind} v${seed.version}: upserted`);
    }

    await Promise.all(
        translations.map(async seed => {
            const termsId = idByKey.get(`${seed.kind}:${seed.version}`);
            // validateSeedFiles가 고아 번역을 이미 막았다.
            if (termsId === undefined) return;
            await repo.upsertTranslation({
                termsId,
                locale: seed.locale!,
                body: seed.body,
            });
            console.log(
                `[seed] ${seed.kind} v${seed.version} ${seed.locale}: translation upserted`
            );
        })
    );
```

- [ ] **Step 4: 통과를 확인한다**

```bash
yarn test src/shared/db/__tests__/scripts/seedTerms.test.ts
yarn tsc --noEmit
```

기대: 4개 PASS, tsc 오류 0.

- [ ] **Step 5: 커밋**

```bash
git add db/scripts
git commit -m "feat(terms): 시드 frontmatter의 locale로 번역을 적재한다"
```

---

## Task 12: 개인정보처리방침 v2 (한국어)

**Files:**
- Create: `db/seeds/terms/privacy/v2.md`

- [ ] **Step 1: v1을 복사해 시작한다**

```bash
cp db/seeds/terms/privacy/v1.md db/seeds/terms/privacy/v2.md
```

- [ ] **Step 2: frontmatter를 고친다**

`effectiveDate`는 **배포일이 아니라 고지 7일 뒤**여야 한다(설계 §7.4).
아래 날짜는 예시다 — 실제 고지일을 확인하고 그 7일 뒤로 맞춘다.

```yaml
---
kind: privacy
version: 2
effectiveDate: 2026-09-09T00:00:00+09:00
---
```

- [ ] **Step 3: §2에 방문자 통계 항목을 추가한다**

§2의 비회원 자동수집 목록에서 마지막 항목(`AI 질문 횟수 제한(Rate Limiting): ...`)
**바로 뒤**에 한 줄 추가한다.

```markdown
- 접속 통계(방문자 수 집계): IP 주소와 User-Agent를 결합하여 SHA-256 해시로 변환한 가명 식별자와 접속 일자를 저장합니다. 원본 IP 주소는 저장하지 않으며, 다른 개인정보와 결합하지 않습니다. 서비스 이용자 규모(일간·월간 활성 사용자)를 파악하는 용도로만 이용합니다.
```

- [ ] **Step 4: §4에 보유 기간을 추가한다**

§4의 목록에서 `접속 로그: 수집일로부터 최대 3개월 ...` **바로 뒤**에 추가한다.

```markdown
- 접속 통계(방문자 수 집계): 수집일로부터 최대 400일 (전년 동월 대비 이용자 추이 비교 목적)
```

400일은 코드의 `RETENTION_DAYS`(`src/app/api/presence/route.ts`)와 같은 값이어야
한다. 한쪽만 바꾸면 방침 위반이 된다.

- [ ] **Step 5: §6을 현재 스택으로 교체한다**

"개인정보 처리 위탁 및 국외 이전 업체" 아래 목록 전체를 아래로 바꾼다.

```markdown
- **Amazon Web Services, Inc.** (미국): 웹 서비스 호스팅 및 컴퓨팅 — 서비스 접속에 따른 IP 주소 등 접속 정보가 처리됩니다.
- **Cloudflare, Inc.** (미국): CDN 및 보안(WAF) — 서비스 접속에 따른 IP 주소 등 접속 정보가 처리됩니다.
- **Neon, Inc.** (미국): 회원 계정·세션·등급 정보 및 방문자 수 집계용 가명 식별자의 PostgreSQL 데이터베이스 저장
- **Upstash, Inc.** (미국): AI 질문 횟수 제한 (Redis) — IP 주소를 SHA-256으로 해시 처리한 가명 식별자가 저장되며, 24시간 후 자동 삭제됩니다.
- **Google LLC** (미국): Google 계정으로 소셜 로그인을 선택한 경우의 OAuth 인증 위탁 — 이메일·프로필 정보가 처리됩니다.
- **Kakao Corp.** (대한민국): 카카오 계정으로 소셜 로그인을 선택한 경우의 OAuth 인증 위탁 — 이메일·프로필 정보가 처리됩니다.
```

"외부 API 연동 (개인정보 미이전)" 아래 목록 전체를 아래로 바꾼다.

```markdown
- **Financial Modeling Prep** (미국): 주식 시세·재무제표·기업 정보 조회
- **Yahoo Finance** (미국): 국내 주식(KRX) 시세 및 차트 데이터 조회
- **NAVER Corp.** (대한민국): 국내 종목 뉴스 검색
- **한국 공공데이터포털** (대한민국): KRX 상장 종목 정보 조회
- **Anthropic, PBC** (미국): AI 기반 분석 생성 및 채팅 응답 생성 (Claude API)
- **Google LLC** (미국): AI 기반 분석 생성 및 채팅 응답 생성 (Gemini API)
- **OpenAI Inc** (미국): AI 기반 분석 생성 및 채팅 응답 생성 (ChatGPT API)
- **DeepSeek** (중국): AI 기반 분석 생성 및 채팅 응답 생성 (DeepSeek API)
```

- [ ] **Step 6: 파싱을 확인한다**

```bash
yarn test src/shared/db/__tests__/scripts/seedTerms.test.ts
node -e "const m=require('gray-matter');const p=m(require('fs').readFileSync('db/seeds/terms/privacy/v2.md','utf-8'));console.log(p.data);console.log('본문 길이',p.content.trim().length)"
```

기대: `{ kind: 'privacy', version: 2, effectiveDate: ... }`가 찍히고 본문 길이가
9000자 이상이다.

- [ ] **Step 7: 커밋**

```bash
git add db/seeds/terms/privacy/v2.md
git commit -m "feat(legal): 개인정보처리방침 v2 — 방문자 통계 수집 고지와 위탁 업체 정정"
```

---

## Task 13: 법률 문서 번역 6종

`v2.md`(Task 12 결과)와 `db/seeds/terms/tos/v1.md`를 원문으로 삼아 번역한다.
번역할 원문은 두 파일 안에 완전히 정의되어 있다 — 이 태스크에 미정 항목은 없다.

**Files:**
- Create: `db/seeds/terms/privacy/v2.en.md`
- Create: `db/seeds/terms/privacy/v2.ja.md`
- Create: `db/seeds/terms/privacy/v2.zh.md`
- Create: `db/seeds/terms/tos/v1.en.md`
- Create: `db/seeds/terms/tos/v1.ja.md`
- Create: `db/seeds/terms/tos/v1.zh.md`

- [ ] **Step 1: frontmatter 형식을 정한다**

번역 파일에는 `effectiveDate`를 쓰지 않는다 — 원문의 발효일을 따르며, 여기
따로 적으면 두 값이 갈라진다.

`db/seeds/terms/privacy/v2.en.md`의 첫 5줄:

```yaml
---
kind: privacy
version: 2
locale: en
---
```

나머지 5개도 같은 형태다. `locale`과 `kind`·`version`만 바꾼다.

| 파일 | kind | version | locale |
|---|---|---|---|
| `privacy/v2.en.md` | privacy | 2 | en |
| `privacy/v2.ja.md` | privacy | 2 | ja |
| `privacy/v2.zh.md` | privacy | 2 | zh |
| `tos/v1.en.md` | tos | 1 | en |
| `tos/v1.ja.md` | tos | 1 | ja |
| `tos/v1.zh.md` | tos | 1 | zh |

- [ ] **Step 2: 본문을 번역한다**

번역 규칙:

- **의무를 더하거나 빼지 않는다.** 법률 문서의 오역은 곧 의무의 변경이다.
- 절 번호와 `##` 헤딩 구조를 원문과 1:1로 유지한다. `extractToc`가 헤딩으로
  목차를 만들고, 목차가 어긋나면 원문과 대조가 불가능해진다.
- 회사명·서비스명·기술명은 원문 표기 그대로 둔다 — `SigLens`, `Amazon Web
  Services, Inc.`, `bcrypt`, `SHA-256`, `HttpOnly`, `SameSite=Lax`,
  `siglens_session`, `Cloudflare, Inc.`, `Neon, Inc.`, `Upstash, Inc.`,
  `Anthropic, PBC`, `DeepSeek`.
- 마크다운 링크는 URL을 그대로 두고 라벨만 번역한다
  (`[계정 설정 → 회원 탈퇴](/account/delete)`,
  `[stock.siglens@gmail.com](mailto:stock.siglens@gmail.com)`).
- 한국 법령명은 번역문 뒤 괄호에 원어를 병기한다
  (예: `the Personal Information Protection Act (개인정보 보호법)`).
- 기관명(개인정보보호위원회, 개인정보침해신고센터, 대검찰청, 경찰청)도 같은 방식.

- [ ] **Step 3: 구조가 원문과 맞는지 기계적으로 확인한다**

헤딩 개수가 다르면 절이 통째로 빠졌거나 늘어난 것이다.

```bash
for f in db/seeds/terms/privacy/v2.md db/seeds/terms/privacy/v2.*.md; do
  echo "$f: $(grep -c '^## ' "$f") headings"
done
for f in db/seeds/terms/tos/v1.md db/seeds/terms/tos/v1.*.md; do
  echo "$f: $(grep -c '^## ' "$f") headings"
done
```

기대: privacy 4개 파일이 모두 같은 수, tos 4개 파일이 모두 같은 수.
다르면 그 파일을 고친다.

- [ ] **Step 4: 시드 검증을 돌린다**

```bash
yarn test src/shared/db/__tests__/scripts/seedTerms.test.ts
```

기대: PASS. `orphan translation` 오류가 나면 번역의 `kind`/`version`이
원문과 어긋난 것이다.

- [ ] **Step 5: 커밋**

```bash
git add db/seeds/terms
git commit -m "feat(legal): 개인정보처리방침·이용약관 en/ja/zh 번역을 추가한다"
```

---

## Task 14: 전체 게이트

**Files:** 없음 (검증만)

- [ ] **Step 1: 타입 검사**

```bash
yarn tsc --noEmit
```

기대: 오류 0.

- [ ] **Step 2: 린트 — 경고 수를 센다**

exit code가 0이어도 경고는 남는다. `exhaustive-deps` 같은 규칙은 `warn`이라
위반해도 0으로 끝난다. **수를 봐야 한다.**

```bash
yarn lint 2>&1 | tee /tmp/lint.txt | tail -5
grep -c "warning" /tmp/lint.txt
```

기대: 이 브랜치가 추가한 경고 0건. `VisitorPing`의 `useEffect`가
`exhaustive-deps` 경고를 내면 의존성을 고친다(비활성 주석으로 덮지 않는다).

- [ ] **Step 3: i18n 추출 drift**

`--write`가 없으면 스캔만 하고 파일을 쓰지 않는다. 통계는 똑같이 찍히므로
빈 `git status`를 "drift 없음"으로 읽으면 CI에서 죽는다.

```bash
yarn i18n:extract --write
git diff --exit-code -- messages/
```

기대: 종료 코드 0. 아니면 그 산출물을 이 커밋에 포함한다.

- [ ] **Step 4: 전체 테스트**

파이프를 걸면 실패가 exit 0으로 가려진다. 파일로 받는다.

```bash
yarn test > /tmp/test.txt 2>&1; echo "exit=$?"; tail -20 /tmp/test.txt
```

기대: `exit=0`, 실패 0건.

- [ ] **Step 5: 프로덕션 빌드**

```bash
yarn build > /tmp/build.txt 2>&1; echo "exit=$?"; tail -30 /tmp/build.txt
```

기대: `exit=0`. 라우트 표에서 `/[locale]/privacy`와 `/[locale]/terms`가
여전히 `●`(정적)이어야 한다 — `ƒ`로 바뀌었으면 ISR이 꺼진 것이다.
`/api/presence`는 `ƒ`가 맞다(`force-dynamic`).

- [ ] **Step 6: i18n 산출물이 있으면 커밋**

```bash
git status --short
# messages/ 변경이 있으면
git add messages/
git commit -m "chore(i18n): 추출 산출물을 갱신한다"
```

---

## 배포 절차 (구현 후)

설계 §13과 같다. 순서를 지켜야 한다.

1. PR 병합
2. `notices` 테이블에 개정 예고 행을 직접 입력 — **시행 7일 전**
3. 프로덕션 SSM에 `VISITOR_HASH_PEPPER` 게시 (`infra/aws/04-params.sh`).
   값은 `openssl rand -hex 32`. **한 번 정하면 바꾸지 않는다**
4. `yarn db:migrate` — `visitor_days` 생성
5. `yarn db:seed:terms` — privacy v2 + 번역 6건
6. 시행일에 애플리케이션 배포
7. 다음 날 `yarn metrics` — 행이 실제로 쌓이는지 확인.
   `총 행 수: 0`이면 pepper 미설정이거나 비콘이 차단된 것이다.
   프로덕션 로그에서 `[visitor-metrics]`를 먼저 본다

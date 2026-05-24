# 약관 동의 시스템 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원가입(이메일 + OAuth) 시 개인정보처리방침 / 서비스 이용약관에 대한 명시적 동의를 수집하고, 약관 본문을 DB 기반 버전 관리로 전환한다.

**Architecture:** Drizzle 기반 `terms`(버전화 약관) + `agreements`(사용자 동의 row) 테이블 도입. 약관 본문은 마크다운 시드 파일 → 시드 스크립트로 DB 적재 → privacy/terms 페이지가 활성 버전을 RSC에서 렌더(react-markdown). 이메일 가입은 details 단계에 ConsentCheckboxGroup 추가 + registerAction 트랜잭션. OAuth 가입은 callback에서 신규 사용자 분기 → Redis 임시 저장 → `/signup/oauth/consent` 페이지 → finalize action에서 user + agreement atomic 생성.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Drizzle ORM, PostgreSQL, Upstash Redis, Jest + Testing Library, react-markdown, remark-gfm, rehype-slug, gray-matter.

**Spec reference:** `docs/superpowers/specs/2026-05-04-terms-agreement-design.md`

**Phases:**
- Phase 1 (Tasks 1–3): 의존성 + 마이그레이션 스크립트 이관
- Phase 2 (Tasks 4–7): DB 스키마 + repositories
- Phase 3 (Tasks 8–10): 마크다운 시드 + 시드 스크립트
- Phase 4 (Tasks 11–14): 페이지 렌더링 (legal-toc, PolicyMarkdownBody, privacy/terms)
- Phase 5 (Tasks 15–17): ConsentCheckboxGroup
- Phase 6 (Tasks 18–21): 이메일 가입 통합
- Phase 7 (Tasks 22–28): OAuth 가입 흐름
- Phase 8 (Task 29): 배포 검증

---

## Phase 1 — 의존성 & 스크립트 이관

### Task 1: 의존성 추가

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/package.json`

- [ ] **Step 1: 의존성 설치**

```bash
yarn add remark-gfm rehype-slug gray-matter
```

- [ ] **Step 2: 설치 결과 검증**

Run: `grep -E '"(remark-gfm|rehype-slug|gray-matter)"' package.json`
Expected: 세 패키지 모두 dependencies에 추가됨

- [ ] **Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: add markdown rendering dependencies"
```

---

### Task 2: migrate.ts를 db/scripts/로 이관

**Files:**
- Move: `/Users/y0ngha/Project/siglens/migrate.ts` → `/Users/y0ngha/Project/siglens/db/scripts/migrate.ts`
- Modify: `/Users/y0ngha/Project/siglens/package.json`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p db/scripts
```

- [ ] **Step 2: 파일 이동**

```bash
git mv migrate.ts db/scripts/migrate.ts
```

- [ ] **Step 3: migrate.ts 내부 경로 검증**

Run: `grep -nE "drizzle/(meta|.*\.sql)" db/scripts/migrate.ts`
Expected: `'./drizzle/...'` 형태가 있다면 `'../../drizzle/...'`로 변경 필요

migrate.ts에서 `'./drizzle/meta/_journal.json'` 및 `'./drizzle/${entry.tag}.sql'` 부분을 `'../../drizzle/meta/_journal.json'` 및 `'../../drizzle/${entry.tag}.sql'`로 변경:

```ts
const journal: { entries: JournalEntry[] } = JSON.parse(
    readFileSync('../../drizzle/meta/_journal.json', 'utf-8')
);
// ...
const migrationSql = readFileSync(
    `../../drizzle/${entry.tag}.sql`,
    'utf-8'
);
```

**대안 (더 안정적):** `path.resolve(__dirname, '../../drizzle/...')` 사용. 단, ESM 환경에서는 `import.meta.url` 기반 처리 필요. 현재 tsx 환경에서는 `__dirname` 사용 가능하므로 이쪽이 안전:

```ts
import path from 'path';

const drizzleRoot = path.resolve(__dirname, '../../drizzle');
const journal: { entries: JournalEntry[] } = JSON.parse(
    readFileSync(path.join(drizzleRoot, 'meta/_journal.json'), 'utf-8')
);
// ...
const migrationSql = readFileSync(
    path.join(drizzleRoot, `${entry.tag}.sql`),
    'utf-8'
);
```

- [ ] **Step 4: package.json 스크립트 경로 갱신**

`scripts.db:migrate`를 다음으로 변경:

```json
"db:migrate": "dotenv -e .env.local -- node_modules/.bin/tsx db/scripts/migrate.ts",
```

- [ ] **Step 5: 동작 검증**

Run: `yarn db:migrate`
Expected: 기존과 동일하게 "Migrations complete" 출력 (이미 적용된 마이그레이션은 skip)

- [ ] **Step 6: Commit**

```bash
git add db/scripts/migrate.ts package.json
git rm migrate.ts  # 이미 mv로 처리되었지만 명시
git commit -m "chore: relocate migrate.ts to db/scripts/"
```

---

### Task 3: TERMS_KIND_VALUES enum 상수 추가

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/src/infrastructure/db/constants.ts`

- [ ] **Step 1: 기존 파일 구조 확인**

Run: `cat src/infrastructure/db/constants.ts | head -30`
Expected: `USER_TIER_VALUES`, `OAUTH_PROVIDER_VALUES` 등의 패턴 확인

- [ ] **Step 2: 상수 추가**

`src/infrastructure/db/constants.ts` 파일 하단에 추가:

```ts
/** Legal terms document kinds tracked in the `terms` table. */
export const TERMS_KIND_VALUES = ['privacy', 'tos'] as const;
export type TermsKind = (typeof TERMS_KIND_VALUES)[number];
```

- [ ] **Step 3: 타입 체크**

Run: `yarn lint src/infrastructure/db/constants.ts`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/db/constants.ts
git commit -m "feat(db): add TERMS_KIND_VALUES constant"
```

---

## Phase 2 — DB 스키마 & Repositories

### Task 4: terms / agreements 테이블 schema 정의

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/src/infrastructure/db/schema.ts`

- [ ] **Step 1: schema.ts 상단 import 확장**

`drizzle-orm/pg-core`에서 `integer`를 import. 그리고 `TERMS_KIND_VALUES`도 import.

기존 import 구문에서 누락된 항목 추가:

```ts
import {
    boolean,
    date,
    index,
    integer,           // 추가
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from 'drizzle-orm/pg-core';
import {
    LLM_PROVIDER_VALUES,
    OAUTH_PROVIDER_VALUES,
    TERMS_KIND_VALUES,        // 추가
    USAGE_ACTION_TYPE_VALUES,
    USER_TIER_VALUES,
} from '@/infrastructure/db/constants';
```

- [ ] **Step 2: termsKindEnum + terms 테이블 추가**

`schema.ts` 하단(기존 마지막 테이블 정의 뒤)에 추가:

```ts
/** Postgres enum for legal terms document kinds. */
export const termsKindEnum = pgEnum('terms_kind', TERMS_KIND_VALUES);

/** Versioned legal documents (privacy policy, terms of service).
 *  Active version = WHERE kind = ? AND effective_date <= NOW()
 *                   ORDER BY effective_date DESC LIMIT 1. */
export const terms = pgTable(
    'terms',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        kind: termsKindEnum('kind').notNull(),
        version: integer('version').notNull(),
        effectiveDate: timestamp('effective_date', {
            withTimezone: true,
        }).notNull(),
        body: text('body').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        uniqueIndex('terms_kind_version_uidx').on(table.kind, table.version),
        index('terms_kind_effective_date_idx').on(
            table.kind,
            table.effectiveDate
        ),
    ]
);
```

- [ ] **Step 3: agreements 테이블 추가**

`terms` 테이블 정의 직후에 추가:

```ts
/** User agreement records — one row per (user, terms) pair.
 *  Mutable: `agreed` and `updatedAt` change if user revokes/re-grants
 *  consent (future feature for optional terms). */
export const agreements = pgTable(
    'agreements',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        termsId: uuid('terms_id')
            .notNull()
            .references(() => terms.id, { onDelete: 'restrict' }),
        agreed: boolean('agreed').notNull(),
        agreedAt: timestamp('agreed_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        uniqueIndex('agreements_user_terms_uidx').on(
            table.userId,
            table.termsId
        ),
        index('agreements_user_id_idx').on(table.userId),
        index('agreements_terms_id_idx').on(table.termsId),
    ]
);
```

- [ ] **Step 4: 타입 체크**

Run: `yarn lint src/infrastructure/db/schema.ts`
Expected: no errors

- [ ] **Step 5: 마이그레이션 SQL 생성**

Run: `yarn db:generate`
Expected: `drizzle/` 폴더에 새 SQL 파일 생성. 내용에 `CREATE TABLE terms`, `CREATE TABLE agreements`, `CREATE TYPE terms_kind` 포함

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/db/schema.ts drizzle/
git commit -m "feat(db): add terms and agreements tables"
```

---

### Task 5: termsRepository 구현 (TDD)

**Files:**
- Create: `/Users/y0ngha/Project/siglens/src/infrastructure/db/termsRepository.ts`
- Test: `/Users/y0ngha/Project/siglens/src/__tests__/infrastructure/db/termsRepository.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/__tests__/infrastructure/db/termsRepository.test.ts`:

```ts
import {
    DrizzleTermsRepository,
    type TermsRecord,
} from '@/infrastructure/db/termsRepository';
import type { SiglensDatabase } from '@/infrastructure/db/types';

interface InsertedRow {
    id: string;
    kind: 'privacy' | 'tos';
    version: number;
    effective_date: Date;
    body: string;
}

function makeMockDb(rows: InsertedRow[]): SiglensDatabase {
    // Drizzle의 select 체이닝을 모킹: select().from().where().orderBy().limit()
    const builder = {
        from: () => builder,
        where: () => builder,
        orderBy: () => builder,
        limit: (n: number) => Promise.resolve(rows.slice(0, n)),
    };
    return {
        select: () => builder,
        // upsertFromSeed에 필요한 insert 모킹
        insert: () => ({
            values: () => ({
                onConflictDoNothing: () => Promise.resolve(),
            }),
        }),
    } as unknown as SiglensDatabase;
}

describe('DrizzleTermsRepository', () => {
    describe('findActive', () => {
        it('returns the latest effective version for the given kind', async () => {
            const db = makeMockDb([
                {
                    id: 't1',
                    kind: 'privacy',
                    version: 2,
                    effective_date: new Date('2026-04-30T00:00:00+09:00'),
                    body: '## v2 body',
                },
            ]);
            const repo = new DrizzleTermsRepository(db);

            const result = await repo.findActive('privacy');

            expect(result).not.toBeNull();
            expect(result?.kind).toBe('privacy');
            expect(result?.version).toBe(2);
        });

        it('returns null when no active version exists', async () => {
            const db = makeMockDb([]);
            const repo = new DrizzleTermsRepository(db);

            const result = await repo.findActive('tos');

            expect(result).toBeNull();
        });
    });

    describe('upsertFromSeed', () => {
        it('calls insert with onConflictDoNothing', async () => {
            const onConflict = jest.fn().mockResolvedValue(undefined);
            const values = jest.fn().mockReturnValue({
                onConflictDoNothing: onConflict,
            });
            const insert = jest.fn().mockReturnValue({ values });
            const db = { insert } as unknown as SiglensDatabase;
            const repo = new DrizzleTermsRepository(db);

            await repo.upsertFromSeed({
                kind: 'privacy',
                version: 1,
                effectiveDate: new Date('2026-04-30T00:00:00+09:00'),
                body: '## body',
            });

            expect(insert).toHaveBeenCalledTimes(1);
            expect(values).toHaveBeenCalledWith(
                expect.objectContaining({
                    kind: 'privacy',
                    version: 1,
                    body: '## body',
                })
            );
            expect(onConflict).toHaveBeenCalled();
        });
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/__tests__/infrastructure/db/termsRepository.test.ts`
Expected: FAIL — `Cannot find module '@/infrastructure/db/termsRepository'`

- [ ] **Step 3: 최소 구현**

`src/infrastructure/db/termsRepository.ts`:

```ts
import { and, desc, eq, lte } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { terms } from '@/infrastructure/db/schema';
import type { TermsKind } from '@/infrastructure/db/constants';
import type { SiglensDatabase } from '@/infrastructure/db/types';

/** Public-facing record returned by the repository. */
export interface TermsRecord {
    id: string;
    kind: TermsKind;
    version: number;
    effectiveDate: Date;
    body: string;
}

/** Input used by the seed script to upsert a versioned terms row. */
export interface TermsSeedInput {
    kind: TermsKind;
    version: number;
    effectiveDate: Date;
    body: string;
}

/** Repository for versioned legal terms documents. */
export interface TermsRepository {
    /** Return the active version for the given kind, or null if none. */
    findActive(kind: TermsKind): Promise<TermsRecord | null>;
    /** Insert a versioned row; no-op on (kind, version) conflict. */
    upsertFromSeed(input: TermsSeedInput): Promise<void>;
}

/** Drizzle ORM-backed implementation. */
export class DrizzleTermsRepository implements TermsRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async findActive(kind: TermsKind): Promise<TermsRecord | null> {
        const rows = await this.db
            .select({
                id: terms.id,
                kind: terms.kind,
                version: terms.version,
                effectiveDate: terms.effectiveDate,
                body: terms.body,
            })
            .from(terms)
            .where(and(eq(terms.kind, kind), lte(terms.effectiveDate, sql`NOW()`)))
            .orderBy(desc(terms.effectiveDate))
            .limit(1);

        if (rows.length === 0) return null;

        const row = rows[0];
        return {
            id: row.id,
            kind: row.kind as TermsKind,
            version: row.version,
            effectiveDate: row.effectiveDate,
            body: row.body,
        };
    }

    async upsertFromSeed(input: TermsSeedInput): Promise<void> {
        await this.db
            .insert(terms)
            .values({
                kind: input.kind,
                version: input.version,
                effectiveDate: input.effectiveDate,
                body: input.body,
            })
            .onConflictDoNothing({
                target: [terms.kind, terms.version],
            });
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/__tests__/infrastructure/db/termsRepository.test.ts`
Expected: PASS — 모든 케이스

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/db/termsRepository.ts src/__tests__/infrastructure/db/termsRepository.test.ts
git commit -m "feat(db): add termsRepository with findActive and upsertFromSeed"
```

---

### Task 6: agreementRepository 구현 (TDD)

**Files:**
- Create: `/Users/y0ngha/Project/siglens/src/infrastructure/db/agreementRepository.ts`
- Test: `/Users/y0ngha/Project/siglens/src/__tests__/infrastructure/db/agreementRepository.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/__tests__/infrastructure/db/agreementRepository.test.ts`:

```ts
import { DrizzleAgreementRepository } from '@/infrastructure/db/agreementRepository';
import type { SiglensDatabase } from '@/infrastructure/db/types';

describe('DrizzleAgreementRepository', () => {
    it('inserts multiple agreement rows', async () => {
        const valuesMock = jest.fn().mockResolvedValue(undefined);
        const insert = jest.fn().mockReturnValue({ values: valuesMock });
        const db = { insert } as unknown as SiglensDatabase;
        const repo = new DrizzleAgreementRepository(db);

        const now = new Date('2026-05-04T00:00:00Z');
        await repo.insertMany([
            {
                userId: 'u1',
                termsId: 't1',
                agreed: true,
                agreedAt: now,
            },
            {
                userId: 'u1',
                termsId: 't2',
                agreed: true,
                agreedAt: now,
            },
        ]);

        expect(insert).toHaveBeenCalledTimes(1);
        expect(valuesMock).toHaveBeenCalledWith([
            expect.objectContaining({
                userId: 'u1',
                termsId: 't1',
                agreed: true,
            }),
            expect.objectContaining({
                userId: 'u1',
                termsId: 't2',
                agreed: true,
            }),
        ]);
    });

    it('throws if input array is empty', async () => {
        const db = {
            insert: jest.fn(),
        } as unknown as SiglensDatabase;
        const repo = new DrizzleAgreementRepository(db);

        await expect(repo.insertMany([])).rejects.toThrow(
            'agreement input must not be empty'
        );
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/__tests__/infrastructure/db/agreementRepository.test.ts`
Expected: FAIL

- [ ] **Step 3: 최소 구현**

`src/infrastructure/db/agreementRepository.ts`:

```ts
import { agreements } from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';

export interface AgreementInsertInput {
    userId: string;
    termsId: string;
    agreed: boolean;
    agreedAt: Date;
}

export interface AgreementRepository {
    /** Insert multiple agreement rows in a single statement. */
    insertMany(inputs: readonly AgreementInsertInput[]): Promise<void>;
}

export class DrizzleAgreementRepository implements AgreementRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async insertMany(inputs: readonly AgreementInsertInput[]): Promise<void> {
        if (inputs.length === 0) {
            throw new Error('agreement input must not be empty');
        }
        await this.db.insert(agreements).values(
            inputs.map(input => ({
                userId: input.userId,
                termsId: input.termsId,
                agreed: input.agreed,
                agreedAt: input.agreedAt,
            }))
        );
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/__tests__/infrastructure/db/agreementRepository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/db/agreementRepository.ts src/__tests__/infrastructure/db/agreementRepository.test.ts
git commit -m "feat(db): add agreementRepository with insertMany"
```

---

### Task 7: domain/legal/termsKind.ts 재내보내기

**Files:**
- Create: `/Users/y0ngha/Project/siglens/src/domain/legal/termsKind.ts`

- [ ] **Step 1: 파일 작성**

`src/domain/legal/termsKind.ts`:

```ts
/** Re-export of TERMS_KIND_VALUES + type for use across layers.
 *  Domain layer imports from infrastructure/db/constants are allowed for
 *  enum value sharing (constants module is pure data). */
export {
    TERMS_KIND_VALUES,
    type TermsKind,
} from '@/infrastructure/db/constants';
```

- [ ] **Step 2: 타입 체크**

Run: `yarn lint src/domain/legal/termsKind.ts`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/domain/legal/termsKind.ts
git commit -m "feat(domain): add legal/termsKind re-export"
```

---

## Phase 3 — 마크다운 시드

### Task 8: privacy v1.md 시드 파일 작성

**Files:**
- Create: `/Users/y0ngha/Project/siglens/db/seeds/terms/privacy/v1.md`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p db/seeds/terms/privacy db/seeds/terms/tos
```

- [ ] **Step 2: 파일 작성**

`db/seeds/terms/privacy/v1.md`의 frontmatter:

```markdown
---
kind: privacy
version: 1
effectiveDate: 2026-04-30T00:00:00+09:00
---
```

본문은 현재 `src/app/privacy/page.tsx`의 PolicySection 11개를 마크다운 h2로 옮긴다. 매핑 규칙:
- `<PolicySection id="intro" title="1. 총칙">` → `## 1. 총칙`
- `<p>` 단락 → 빈 줄로 분리된 마크다운 단락
- `<ul>` + `<li>` → `- 항목` 마크다운 리스트
- `<strong>...</strong>` → `**...**`
- 내부 링크 `<Link href="/account/delete">계정 설정 → 회원 탈퇴</Link>` → `[계정 설정 → 회원 탈퇴](/account/delete)`
- 외부 링크 `<a href="mailto:dev.y0ngha@gmail.com">` → `[dev.y0ngha@gmail.com](mailto:dev.y0ngha@gmail.com)`
- 사이트 이름 `{SITE_NAME}` → 텍스트 `SigLens`로 인라인 (시드 시점 고정)

11개 섹션:
1. `## 1. 총칙`
2. `## 2. 수집하는 개인정보 항목 및 수집 방법`
3. `## 3. 개인정보의 수집 및 이용 목적`
4. `## 4. 개인정보의 보유 및 이용 기간`
5. `## 5. 개인정보의 제3자 제공`
6. `## 6. 개인정보 처리의 위탁 및 국외 이전`
7. `## 7. 쿠키 및 로컬 스토리지`
8. `## 8. 이용자의 권리와 행사 방법`
9. `## 9. 개인정보의 안전성 확보 조치`
10. `## 10. 개인정보 보호책임자 및 문의`
11. `## 11. 개인정보처리방침의 변경`

각 섹션의 본문은 `src/app/privacy/page.tsx`의 해당 PolicySection children을 정확히 마크다운으로 변환. 시행일 텍스트(`시행일: ...`)는 페이지 chrome이 effectiveDate prop으로 처리하므로 본문에는 **포함하지 않음**.

- [ ] **Step 3: 파일 검증**

Run: `head -10 db/seeds/terms/privacy/v1.md`
Expected: frontmatter + `## 1. 총칙` 시작 확인

- [ ] **Step 4: Commit**

```bash
git add db/seeds/terms/privacy/v1.md
git commit -m "feat(seed): add privacy policy v1 markdown"
```

---

### Task 9: tos v1.md 시드 파일 작성

**Files:**
- Create: `/Users/y0ngha/Project/siglens/db/seeds/terms/tos/v1.md`

- [ ] **Step 1: 파일 작성**

`db/seeds/terms/tos/v1.md`의 frontmatter:

```markdown
---
kind: tos
version: 1
effectiveDate: 2026-04-30T00:00:00+09:00
---
```

본문은 현재 `src/app/terms/page.tsx`의 12개 PolicySection을 마크다운으로 옮긴다. Task 8과 동일 매핑 규칙 적용.

12개 섹션:
1. `## 제1조 (목적)`
2. `## 제2조 (용어의 정의)`
3. `## 제3조 (약관의 효력 및 변경)`
4. `## 제4조 (서비스의 제공 및 변경)`
5. `## 제5조 (투자 정보에 관한 면책)`
6. `## 제6조 (회원가입 및 계정 관리)`
7. `## 제7조 (이용자의 의무)`
8. `## 제8조 (지적재산권)`
9. `## 제9조 (책임의 제한)`
10. `## 제10조 (개인정보의 보호)`
11. `## 제11조 (준거법 및 관할)`
12. `## 제12조 (문의처)`

빨간 박스 "투자 면책 고지" 토픽은 페이지 chrome(topNotice)에 그대로 유지되므로 본문엔 포함하지 않는다. 각 섹션 본문만 옮긴다.

- [ ] **Step 2: 파일 검증**

Run: `head -10 db/seeds/terms/tos/v1.md`
Expected: frontmatter + `## 제1조 (목적)` 시작

- [ ] **Step 3: Commit**

```bash
git add db/seeds/terms/tos/v1.md
git commit -m "feat(seed): add terms of service v1 markdown"
```

---

### Task 10: 시드 스크립트 + 단위 테스트

**Files:**
- Create: `/Users/y0ngha/Project/siglens/db/scripts/seedTerms.ts`
- Create: `/Users/y0ngha/Project/siglens/src/__tests__/db/scripts/seedTerms.test.ts`
- Modify: `/Users/y0ngha/Project/siglens/package.json`

- [ ] **Step 1: 실패 테스트 작성**

`src/__tests__/db/scripts/seedTerms.test.ts`:

```ts
import path from 'path';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import {
    parseSeedFile,
    validateSeedFiles,
    type ParsedSeed,
} from '@/../db/scripts/seedTerms';

function writeFixture(dir: string, name: string, body: string): string {
    const file = path.join(dir, name);
    writeFileSync(file, body, 'utf-8');
    return file;
}

describe('seedTerms — parseSeedFile', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = mkdtempSync(path.join(tmpdir(), 'seed-terms-'));
    });

    afterEach(() => {
        rmSync(tmp, { recursive: true, force: true });
    });

    it('parses a valid markdown seed file', () => {
        const file = writeFixture(
            tmp,
            'v1.md',
            `---
kind: privacy
version: 1
effectiveDate: 2026-04-30T00:00:00+09:00
---

## 1. 총칙

본 문서는 ...
`
        );

        const result = parseSeedFile(file);

        expect(result.kind).toBe('privacy');
        expect(result.version).toBe(1);
        expect(result.effectiveDate.toISOString()).toBe(
            new Date('2026-04-30T00:00:00+09:00').toISOString()
        );
        expect(result.body.trim()).toMatch(/^## 1\. 총칙/);
    });

    it('throws on missing frontmatter field', () => {
        const file = writeFixture(
            tmp,
            'v1.md',
            `---
kind: privacy
---

## body
`
        );

        expect(() => parseSeedFile(file)).toThrow(/version/);
    });

    it('throws on invalid kind value', () => {
        const file = writeFixture(
            tmp,
            'v1.md',
            `---
kind: marketing
version: 1
effectiveDate: 2026-04-30T00:00:00+09:00
---

## body
`
        );

        expect(() => parseSeedFile(file)).toThrow(/kind/);
    });
});

describe('seedTerms — validateSeedFiles', () => {
    function makeSeed(
        kind: 'privacy' | 'tos',
        version: number
    ): ParsedSeed {
        return {
            kind,
            version,
            effectiveDate: new Date('2026-04-30T00:00:00+09:00'),
            body: '## body',
            sourceFile: `${kind}-v${version}.md`,
        };
    }

    it('accepts contiguous version sequence per kind', () => {
        expect(() =>
            validateSeedFiles([
                makeSeed('privacy', 1),
                makeSeed('privacy', 2),
                makeSeed('tos', 1),
            ])
        ).not.toThrow();
    });

    it('rejects version gap', () => {
        expect(() =>
            validateSeedFiles([
                makeSeed('privacy', 1),
                makeSeed('privacy', 3),
            ])
        ).toThrow(/version gap/);
    });

    it('rejects duplicate (kind, version)', () => {
        expect(() =>
            validateSeedFiles([
                makeSeed('privacy', 1),
                makeSeed('privacy', 1),
            ])
        ).toThrow(/duplicate/);
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/__tests__/db/scripts/seedTerms.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 시드 스크립트 구현**

`db/scripts/seedTerms.ts`:

```ts
import path from 'path';
import { readFileSync } from 'fs';
import { glob } from 'glob';
import matter from 'gray-matter';
import { z } from 'zod';
import { TERMS_KIND_VALUES } from '../../src/infrastructure/db/constants';
import { DrizzleTermsRepository } from '../../src/infrastructure/db/termsRepository';
import { getDatabaseClient } from '../../src/infrastructure/db/client';

const FrontmatterSchema = z.object({
    kind: z.enum(TERMS_KIND_VALUES),
    version: z.number().int().positive(),
    effectiveDate: z.union([z.string(), z.date()]).transform(value => {
        const date = typeof value === 'string' ? new Date(value) : value;
        if (Number.isNaN(date.getTime())) {
            throw new Error('Invalid effectiveDate');
        }
        return date;
    }),
});

export interface ParsedSeed {
    kind: 'privacy' | 'tos';
    version: number;
    effectiveDate: Date;
    body: string;
    sourceFile: string;
}

/** Parse a single seed markdown file into a ParsedSeed. */
export function parseSeedFile(filePath: string): ParsedSeed {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = matter(raw);
    const result = FrontmatterSchema.safeParse(parsed.data);
    if (!result.success) {
        const issues = result.error.issues
            .map(i => `${i.path.join('.')}: ${i.message}`)
            .join(', ');
        throw new Error(`Invalid frontmatter in ${filePath} — ${issues}`);
    }
    return {
        kind: result.data.kind,
        version: result.data.version,
        effectiveDate: result.data.effectiveDate,
        body: parsed.content.trim(),
        sourceFile: filePath,
    };
}

/** Validate version monotonicity and detect duplicates / gaps. */
export function validateSeedFiles(seeds: readonly ParsedSeed[]): void {
    const byKind = new Map<string, number[]>();
    for (const seed of seeds) {
        const list = byKind.get(seed.kind) ?? [];
        if (list.includes(seed.version)) {
            throw new Error(
                `duplicate seed for ${seed.kind} v${seed.version} (${seed.sourceFile})`
            );
        }
        list.push(seed.version);
        byKind.set(seed.kind, list);
    }
    for (const [kind, versions] of byKind) {
        const sorted = [...versions].sort((a, b) => a - b);
        for (let i = 0; i < sorted.length; i += 1) {
            if (sorted[i] !== i + 1) {
                throw new Error(
                    `version gap detected for kind=${kind}: expected ${i + 1}, got ${sorted[i]}`
                );
            }
        }
    }
}

async function main(): Promise<void> {
    const seedsRoot = path.resolve(__dirname, '../seeds/terms');
    const files = await glob('**/*.md', { cwd: seedsRoot, absolute: true });
    if (files.length === 0) {
        console.warn('[seed] no terms seed files found at', seedsRoot);
        return;
    }

    const seeds = files.map(parseSeedFile);
    validateSeedFiles(seeds);

    const db = getDatabaseClient();
    const repo = new DrizzleTermsRepository(db);

    for (const seed of seeds) {
        await repo.upsertFromSeed({
            kind: seed.kind,
            version: seed.version,
            effectiveDate: seed.effectiveDate,
            body: seed.body,
        });
        console.log(`[seed] ${seed.kind} v${seed.version}: upserted`);
    }
}

main().catch(err => {
    console.error('[seed] failed:', err);
    process.exit(1);
});
```

`glob` 패키지는 Drizzle Kit이 이미 의존하지만 명시 의존성으로 추가하는 게 안전:

```bash
yarn add -D glob @types/glob zod
```

(zod도 검증용. 이미 설치되어 있으면 스킵.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/__tests__/db/scripts/seedTerms.test.ts`
Expected: PASS

- [ ] **Step 5: package.json 스크립트 추가**

`package.json`의 `scripts` 객체에 추가:

```json
"db:seed:terms": "dotenv -e .env.local -- node_modules/.bin/tsx db/scripts/seedTerms.ts",
```

- [ ] **Step 6: 통합 동작 검증**

Run: `yarn db:migrate && yarn db:seed:terms`
Expected: 두 row 시딩 ("privacy v1: upserted", "tos v1: upserted"). 재실행 시 ON CONFLICT DO NOTHING으로 idempotent.

`psql` 또는 Drizzle Studio로 확인:
```sql
SELECT kind, version, effective_date FROM terms;
```

- [ ] **Step 7: Commit**

```bash
git add db/scripts/seedTerms.ts src/__tests__/db/scripts/seedTerms.test.ts package.json
git commit -m "feat(seed): add seedTerms script with markdown parsing"
```

---

## Phase 4 — 페이지 렌더링

### Task 11: legal-toc 유틸 (TDD)

**Files:**
- Create: `/Users/y0ngha/Project/siglens/src/lib/legal-toc.ts`
- Test: `/Users/y0ngha/Project/siglens/src/__tests__/lib/legal-toc.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/__tests__/lib/legal-toc.test.ts`:

```ts
import { extractToc } from '@/lib/legal-toc';

describe('extractToc', () => {
    it('extracts h2 headings only (h3 ignored)', () => {
        const md = `## 1. 총칙

내용

### 1.1 세부

## 2. 수집

내용
`;
        const toc = extractToc(md);
        expect(toc).toHaveLength(2);
        expect(toc[0].label).toBe('1. 총칙');
        expect(toc[1].label).toBe('2. 수집');
    });

    it('generates slug ids for korean headings', () => {
        const md = `## 1. 총칙

본문
`;
        const toc = extractToc(md);
        expect(toc[0].id).toBe('1-총칙');
    });

    it('handles parenthesized headings (제1조 형식)', () => {
        const md = `## 제1조 (목적)

본문
`;
        const toc = extractToc(md);
        expect(toc[0].label).toBe('제1조 (목적)');
        expect(toc[0].id).toBe('제1조-목적');
    });

    it('returns empty array when no h2 found', () => {
        expect(extractToc('단순 본문 텍스트')).toEqual([]);
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/__tests__/lib/legal-toc.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/lib/legal-toc.ts`:

```ts
export interface TocItem {
    id: string;
    label: string;
}

const H2_PATTERN = /^##\s+(.+?)\s*$/gm;

/** Convert heading text to a stable slug compatible with rehype-slug.
 *  Lowercases ASCII letters, strips punctuation, collapses whitespace
 *  to hyphens, leaves Korean characters intact. */
function slugify(text: string): string {
    return text
        .trim()
        .toLowerCase()
        .replace(/[()[\]{}.,!?;:]/g, '')
        .replace(/\s+/g, '-');
}

/** Extract h2 headings from a markdown document for table-of-contents
 *  rendering. h3+ are intentionally excluded — TOC shows top sections only. */
export function extractToc(markdown: string): readonly TocItem[] {
    const items: TocItem[] = [];
    for (const match of markdown.matchAll(H2_PATTERN)) {
        const label = match[1].trim();
        items.push({ id: slugify(label), label });
    }
    return items;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/__tests__/lib/legal-toc.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/legal-toc.ts src/__tests__/lib/legal-toc.test.ts
git commit -m "feat(lib): add legal-toc extractor for h2 headings"
```

---

### Task 12: PolicyMarkdownBody 컴포넌트 (TDD)

**Files:**
- Create: `/Users/y0ngha/Project/siglens/src/components/legal/PolicyMarkdownBody.tsx`
- Test: `/Users/y0ngha/Project/siglens/src/__tests__/components/legal/PolicyMarkdownBody.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

`src/__tests__/components/legal/PolicyMarkdownBody.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { PolicyMarkdownBody } from '@/components/legal/PolicyMarkdownBody';

describe('PolicyMarkdownBody', () => {
    it('renders h2 with slug id', () => {
        const md = '## 1. 총칙\n\n본문\n';
        render(<PolicyMarkdownBody markdown={md} />);
        const h2 = screen.getByRole('heading', { level: 2, name: '1. 총칙' });
        expect(h2.id).toBe('1-총칙');
    });

    it('renders internal link as next/link', () => {
        const md = '단어 [계정 설정](/account/delete) 안내';
        const { container } = render(<PolicyMarkdownBody markdown={md} />);
        const anchor = container.querySelector('a[href="/account/delete"]');
        expect(anchor).not.toBeNull();
        // 외부 target 없어야 함
        expect(anchor?.getAttribute('target')).toBeNull();
    });

    it('renders external link with target=_blank rel=noopener', () => {
        const md = '문의 [메일](mailto:dev.y0ngha@gmail.com)';
        const { container } = render(<PolicyMarkdownBody markdown={md} />);
        const anchor = container.querySelector('a[href^="mailto:"]');
        expect(anchor?.getAttribute('target')).toBe('_blank');
        expect(anchor?.getAttribute('rel')).toContain('noopener');
    });

    it('renders unordered list', () => {
        const md = '- 항목1\n- 항목2\n';
        render(<PolicyMarkdownBody markdown={md} />);
        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(2);
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/__tests__/components/legal/PolicyMarkdownBody.test.tsx`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/components/legal/PolicyMarkdownBody.tsx`:

```tsx
import Link from 'next/link';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';

interface PolicyMarkdownBodyProps {
    markdown: string;
}

function isInternalHref(href: string | undefined): boolean {
    if (!href) return false;
    return href.startsWith('/') && !href.startsWith('//');
}

const components: Components = {
    h2: ({ id, children }) => (
        <h2
            id={id}
            className="text-secondary-100 scroll-mt-24 text-lg font-semibold sm:text-xl"
        >
            {children}
        </h2>
    ),
    h3: ({ id, children }) => (
        <h3
            id={id}
            className="text-secondary-200 scroll-mt-24 text-base font-medium sm:text-lg"
        >
            {children}
        </h3>
    ),
    p: ({ children }) => (
        <p className="text-secondary-300 mt-3 text-sm leading-relaxed sm:text-base">
            {children}
        </p>
    ),
    ul: ({ children }) => (
        <ul className="text-secondary-300 mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed sm:text-base">
            {children}
        </ul>
    ),
    li: ({ children }) => <li>{children}</li>,
    strong: ({ children }) => (
        <strong className="text-secondary-200 font-semibold">{children}</strong>
    ),
    a: ({ href, children }) => {
        if (isInternalHref(href)) {
            return (
                <Link
                    href={href ?? '#'}
                    className="text-primary-400 hover:text-primary-300 focus-visible:ring-primary-500 rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                    {children}
                </Link>
            );
        }
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 hover:text-primary-300 focus-visible:ring-primary-500 rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
                {children}
            </a>
        );
    },
};

/** Render legal terms markdown body with SigLens design system classes.
 *  Internal links are converted to next/link; external links open in a new tab. */
export function PolicyMarkdownBody({ markdown }: PolicyMarkdownBodyProps) {
    return (
        <div className="space-y-8">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSlug]}
                components={components}
            >
                {markdown}
            </ReactMarkdown>
        </div>
    );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/__tests__/components/legal/PolicyMarkdownBody.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/legal/PolicyMarkdownBody.tsx src/__tests__/components/legal/PolicyMarkdownBody.test.tsx
git commit -m "feat(legal): add PolicyMarkdownBody component"
```

---

### Task 13: privacy/page.tsx DB 기반으로 변경

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/src/app/privacy/page.tsx`
- Modify: `/Users/y0ngha/Project/siglens/src/lib/legal.ts` (필요 시)

- [ ] **Step 1: privacy/page.tsx 새 구조 작성**

기존 11개 PolicySection을 제거하고 DB에서 활성 버전을 가져와 PolicyMarkdownBody로 렌더. intro/topNotice/bottomNotice는 코드 상수로 유지.

```tsx
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { PolicyMarkdownBody } from '@/components/legal/PolicyMarkdownBody';
import { JsonLd } from '@/components/ui/JsonLd';
import { CONTACT_EMAIL } from '@/lib/contact';
import { extractToc } from '@/lib/legal-toc';
import {
    INVESTMENT_DISCLAIMER,
    PRIVACY_DESCRIPTION,
    PRIVACY_FULL_TITLE,
    PRIVACY_PATH,
    PRIVACY_TITLE,
    TERMS_PATH,
    TERMS_TITLE,
} from '@/lib/legal';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/lib/og';
import { buildBreadcrumbJsonLd, SITE_NAME, SITE_URL } from '@/lib/seo';
import { DrizzleTermsRepository } from '@/infrastructure/db/termsRepository';
import { getAuthDatabaseClient } from '@/infrastructure/auth/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const PAGE_URL = `${SITE_URL}${PRIVACY_PATH}`;

const JSON_LD = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${PRIVACY_TITLE} | ${SITE_NAME}`,
    description: PRIVACY_DESCRIPTION,
    url: PAGE_URL,
    inLanguage: 'ko',
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
};

const BREADCRUMB_JSON_LD = buildBreadcrumbJsonLd([
    { name: PRIVACY_TITLE, url: PAGE_URL },
]);

export const metadata: Metadata = {
    title: PRIVACY_TITLE,
    description: PRIVACY_DESCRIPTION,
    robots: { index: true, follow: true },
    alternates: { canonical: PAGE_URL },
    openGraph: {
        type: 'article',
        siteName: SITE_NAME,
        title: PRIVACY_FULL_TITLE,
        description: PRIVACY_DESCRIPTION,
        url: PAGE_URL,
        locale: 'ko_KR',
        images: [
            {
                url: '/og-image.png',
                width: OG_IMAGE_WIDTH,
                height: OG_IMAGE_HEIGHT,
                alt: PRIVACY_FULL_TITLE,
            },
        ],
    },
    twitter: {
        card: 'summary',
        title: PRIVACY_FULL_TITLE,
        description: PRIVACY_DESCRIPTION,
        images: ['/og-image.png'],
    },
};

const INTRO = `${SITE_NAME}(이하 "운영자")는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」 등 관련 법령을 준수하기 위하여 노력하고 있습니다. 운영자는 개인정보처리방침을 통하여 이용자가 제공하는 개인정보가 어떠한 용도와 방식으로 이용되고 있으며, 개인정보 보호를 위해 어떠한 조치가 취해지고 있는지 알려드립니다.`;

const bottomNotice = (
    <div
        role="note"
        aria-label="투자 면책 고지"
        className="border-secondary-800 bg-secondary-900/40 mt-12 rounded-lg border p-5"
    >
        <p className="text-secondary-400 text-xs leading-relaxed sm:text-sm">
            {INVESTMENT_DISCLAIMER} 서비스 이용과 관련한 자세한 조건은&nbsp;
            <Link
                href={TERMS_PATH}
                className="text-primary-400 hover:text-primary-300 focus-visible:ring-primary-500 rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
                {TERMS_TITLE}
            </Link>
            을(를) 참고해 주세요.
        </p>
    </div>
);

function formatKoreanDate(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = date.getMonth() + 1;
    const dd = date.getDate();
    return `${yyyy}년 ${mm}월 ${dd}일`;
}

export default async function PrivacyPage() {
    const { db } = getAuthDatabaseClient();
    const repo = new DrizzleTermsRepository(db);
    const terms = await repo.findActive('privacy');
    if (!terms) notFound();

    const toc = extractToc(terms.body);

    return (
        <>
            <JsonLd data={JSON_LD} />
            <JsonLd data={BREADCRUMB_JSON_LD} />
            <LegalPageShell
                breadcrumbTitle={PRIVACY_TITLE}
                eyebrow="PRIVACY POLICY"
                title={PRIVACY_TITLE}
                intro={INTRO}
                effectiveDate={formatKoreanDate(terms.effectiveDate)}
                toc={toc}
                bottomNotice={bottomNotice}
            >
                <PolicyMarkdownBody markdown={terms.body} />
            </LegalPageShell>
        </>
    );
}
```

- [ ] **Step 2: lib/legal.ts에서 LEGAL_EFFECTIVE_DATE 사용처 확인**

Run: `grep -rn "LEGAL_EFFECTIVE_DATE" src/`
Expected: privacy/page.tsx, terms/page.tsx 외에 다른 사용처가 있는지 확인. 없으면 다음 Task에서 정리.

- [ ] **Step 3: 동작 검증**

Run: `yarn dev`
브라우저: `http://localhost:4200/privacy`
Expected: 기존 디자인 그대로 노출, 시행일 "2026년 4월 30일", 본문 §1~§11.

- [ ] **Step 4: Commit**

```bash
git add src/app/privacy/page.tsx
git commit -m "feat(privacy): render policy body from terms table"
```

---

### Task 14: terms/page.tsx DB 기반으로 변경

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/src/app/terms/page.tsx`
- Modify: `/Users/y0ngha/Project/siglens/src/lib/legal.ts`

- [ ] **Step 1: terms/page.tsx 새 구조 작성**

Task 13과 동일 패턴, topNotice(빨간 박스) JSX는 코드 유지:

```tsx
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { PolicyMarkdownBody } from '@/components/legal/PolicyMarkdownBody';
import { JsonLd } from '@/components/ui/JsonLd';
import { CONTACT_EMAIL } from '@/lib/contact';
import { extractToc } from '@/lib/legal-toc';
import {
    INVESTMENT_DISCLAIMER,
    PRIVACY_PATH,
    PRIVACY_TITLE,
    TERMS_DESCRIPTION,
    TERMS_FULL_TITLE,
    TERMS_PATH,
    TERMS_TITLE,
} from '@/lib/legal';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/lib/og';
import { buildBreadcrumbJsonLd, SITE_NAME, SITE_URL } from '@/lib/seo';
import { DrizzleTermsRepository } from '@/infrastructure/db/termsRepository';
import { getAuthDatabaseClient } from '@/infrastructure/auth/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const PAGE_URL = `${SITE_URL}${TERMS_PATH}`;

const JSON_LD = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: TERMS_TITLE,
    description: TERMS_DESCRIPTION,
    url: PAGE_URL,
    inLanguage: 'ko',
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
};

const BREADCRUMB_JSON_LD = buildBreadcrumbJsonLd([
    { name: TERMS_TITLE, url: PAGE_URL },
]);

export const metadata: Metadata = {
    title: TERMS_TITLE,
    description: TERMS_DESCRIPTION,
    robots: { index: true, follow: true },
    alternates: { canonical: PAGE_URL },
    openGraph: {
        type: 'article',
        siteName: SITE_NAME,
        title: TERMS_FULL_TITLE,
        description: TERMS_DESCRIPTION,
        url: PAGE_URL,
        locale: 'ko_KR',
        images: [
            {
                url: '/og-image.png',
                width: OG_IMAGE_WIDTH,
                height: OG_IMAGE_HEIGHT,
                alt: TERMS_FULL_TITLE,
            },
        ],
    },
    twitter: {
        card: 'summary',
        title: TERMS_FULL_TITLE,
        description: TERMS_DESCRIPTION,
        images: ['/og-image.png'],
    },
};

const INTRO = `본 약관은 ${SITE_NAME}(이하 "운영자")이 제공하는 미국 주식 기술적 분석 웹 서비스의 이용 조건 및 운영자와 이용자 간의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다. 서비스를 이용하기 전에 본 약관을 주의 깊게 읽어 주시기 바랍니다.`;

const topNotice = (
    <div
        role="note"
        aria-label="투자 면책 고지 요약"
        className="border-ui-danger/30 bg-ui-danger/5 my-8 rounded-lg border p-5"
    >
        <p className="text-ui-danger mb-2 text-xs font-semibold tracking-wider uppercase">
            중요 안내
        </p>
        <p className="text-secondary-200 text-sm leading-relaxed sm:text-base">
            {INVESTMENT_DISCLAIMER}
        </p>
        <p className="text-secondary-400 mt-2 text-xs leading-relaxed sm:text-sm">
            {SITE_NAME}은(는) 투자 자문이나 매매 권유를 제공하지 않으며, 제공되는
            모든 분석은 통계적·기술적 관점의 정보입니다. 자세한 내용은 아래
            제5조를 확인해 주세요.
        </p>
    </div>
);

function formatKoreanDate(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = date.getMonth() + 1;
    const dd = date.getDate();
    return `${yyyy}년 ${mm}월 ${dd}일`;
}

export default async function TermsPage() {
    const { db } = getAuthDatabaseClient();
    const repo = new DrizzleTermsRepository(db);
    const terms = await repo.findActive('tos');
    if (!terms) notFound();

    const toc = extractToc(terms.body);

    return (
        <>
            <JsonLd data={JSON_LD} />
            <JsonLd data={BREADCRUMB_JSON_LD} />
            <LegalPageShell
                breadcrumbTitle={TERMS_TITLE}
                eyebrow="TERMS OF SERVICE"
                title={TERMS_TITLE}
                intro={INTRO}
                effectiveDate={formatKoreanDate(terms.effectiveDate)}
                toc={toc}
                topNotice={topNotice}
            >
                <PolicyMarkdownBody markdown={terms.body} />
            </LegalPageShell>
        </>
    );
}
```

- [ ] **Step 2: lib/legal.ts 정리**

`LEGAL_EFFECTIVE_DATE` 상수가 이제 어디서도 import되지 않으므로 삭제:

```bash
grep -rn "LEGAL_EFFECTIVE_DATE" src/ db/
```

만약 결과가 없으면 (혹은 lib/legal.ts 자체에서만 export된다면) `src/lib/legal.ts`에서 해당 export 제거:

```ts
// 삭제: export const LEGAL_EFFECTIVE_DATE = '2026년 4월 30일';
```

다른 사용처가 있다면 그곳도 함께 정리.

- [ ] **Step 3: 동작 검증**

Run: `yarn dev`
브라우저: `http://localhost:4200/terms`
Expected: 빨간 박스 정상 노출, 본문 제1조~제12조, 시행일 "2026년 4월 30일".

- [ ] **Step 4: Commit**

```bash
git add src/app/terms/page.tsx src/lib/legal.ts
git commit -m "feat(terms): render terms body from terms table; drop unused effective date constant"
```

---

## Phase 5 — ConsentCheckboxGroup 컴포넌트

### Task 15: ConsentCheckboxGroup 기본 구조 + 토글 동작 (TDD)

**Files:**
- Create: `/Users/y0ngha/Project/siglens/src/components/auth/ConsentCheckboxGroup.tsx`
- Test: `/Users/y0ngha/Project/siglens/src/__tests__/components/auth/ConsentCheckboxGroup.test.tsx`

- [ ] **Step 1: 실패 테스트 작성 (기본 토글 케이스)**

`src/__tests__/components/auth/ConsentCheckboxGroup.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsentCheckboxGroup } from '@/components/auth/ConsentCheckboxGroup';

describe('ConsentCheckboxGroup', () => {
    function Renderer({
        initialPrivacy = false,
        initialTos = false,
        error,
    }: {
        initialPrivacy?: boolean;
        initialTos?: boolean;
        error?: string;
    } = {}) {
        const [p, setP] = require('react').useState(initialPrivacy);
        const [t, setT] = require('react').useState(initialTos);
        return (
            <ConsentCheckboxGroup
                privacyChecked={p}
                tosChecked={t}
                onPrivacyChange={setP}
                onTosChange={setT}
                error={error}
            />
        );
    }

    it('renders fieldset with sr-only legend', () => {
        render(<Renderer />);
        expect(screen.getByText('동의 항목')).toHaveClass('sr-only');
    });

    it('renders three checkboxes (master + privacy + tos)', () => {
        render(<Renderer />);
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes).toHaveLength(3);
    });

    it('checking master toggles both individual checkboxes', async () => {
        const user = userEvent.setup();
        render(<Renderer />);
        const master = screen.getByLabelText('모두 동의');
        await user.click(master);
        expect(
            screen.getByLabelText(/개인정보 수집·이용 동의/)
        ).toBeChecked();
        expect(screen.getByLabelText(/서비스 이용약관 동의/)).toBeChecked();
    });

    it('unchecking master clears both individuals', async () => {
        const user = userEvent.setup();
        render(<Renderer initialPrivacy initialTos />);
        const master = screen.getByLabelText('모두 동의');
        await user.click(master);
        expect(
            screen.getByLabelText(/개인정보 수집·이용 동의/)
        ).not.toBeChecked();
        expect(
            screen.getByLabelText(/서비스 이용약관 동의/)
        ).not.toBeChecked();
    });

    it('individual checkbox toggle does not affect the other', async () => {
        const user = userEvent.setup();
        render(<Renderer />);
        await user.click(screen.getByLabelText(/개인정보 수집·이용 동의/));
        expect(
            screen.getByLabelText(/개인정보 수집·이용 동의/)
        ).toBeChecked();
        expect(
            screen.getByLabelText(/서비스 이용약관 동의/)
        ).not.toBeChecked();
    });

    it('master shows checked when both individuals checked', () => {
        render(<Renderer initialPrivacy initialTos />);
        expect(screen.getByLabelText('모두 동의')).toBeChecked();
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/__tests__/components/auth/ConsentCheckboxGroup.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 최소 구현**

`src/components/auth/ConsentCheckboxGroup.tsx`:

```tsx
'use client';

import { useEffect, useId, useRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { PRIVACY_PATH, TERMS_PATH } from '@/lib/legal';

interface ConsentCheckboxGroupProps {
    privacyChecked: boolean;
    tosChecked: boolean;
    onPrivacyChange: (checked: boolean) => void;
    onTosChange: (checked: boolean) => void;
    error?: string;
}

interface ConsentRowProps {
    id: string;
    label: string;
    href: string;
    detailLabel: string;
    checked: boolean;
    invalid: boolean;
    onChange: (checked: boolean) => void;
}

function ExternalArrowIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            width="14"
            height="14"
            aria-hidden="true"
            className="ml-1 inline-block"
        >
            <path
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M6 4h6v6M11 5L4.5 11.5"
            />
        </svg>
    );
}

function CheckboxBox({
    checked,
    indeterminate,
    invalid,
    inputProps,
}: {
    checked: boolean;
    indeterminate?: boolean;
    invalid: boolean;
    inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}) {
    const ref = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (ref.current) {
            ref.current.indeterminate = indeterminate ?? false;
        }
    }, [indeterminate]);

    return (
        <span className="relative inline-flex shrink-0">
            <input
                ref={ref}
                type="checkbox"
                checked={checked}
                {...inputProps}
                className={cn(
                    'peer size-5 cursor-pointer appearance-none rounded-sm border bg-transparent transition-colors duration-100',
                    'focus-visible:ring-primary-400 focus-visible:ring-offset-secondary-950 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                    invalid
                        ? 'border-ui-danger'
                        : 'border-secondary-500 hover:border-secondary-300',
                    checked || indeterminate
                        ? 'bg-primary-500 border-primary-500 hover:bg-primary-400'
                        : '',
                    'disabled:cursor-not-allowed disabled:opacity-50'
                )}
            />
            {/* 체크 SVG */}
            {checked && !indeterminate ? (
                <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className="pointer-events-none absolute inset-0 m-auto size-3 text-white motion-safe:animate-[scale-in_150ms_ease-out]"
                    style={{ animationFillMode: 'both' }}
                >
                    <path
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.5 8.5L6.5 11.5L12.5 5.5"
                    />
                </svg>
            ) : null}
            {/* Indeterminate dash */}
            {indeterminate ? (
                <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className="pointer-events-none absolute inset-0 m-auto size-3 text-white"
                >
                    <path
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        d="M4 8H12"
                    />
                </svg>
            ) : null}
        </span>
    );
}

function ConsentRow({
    id,
    label,
    href,
    detailLabel,
    checked,
    invalid,
    onChange,
}: ConsentRowProps) {
    return (
        <label
            htmlFor={id}
            className={cn(
                'group flex min-h-[44px] cursor-pointer flex-col gap-1 py-1 sm:flex-row sm:items-center sm:justify-between',
                checked
                    ? 'border-l border-primary-500 pl-3'
                    : 'border-l border-transparent pl-3',
                invalid ? 'border-l border-ui-danger' : '',
                'transition-colors duration-200'
            )}
        >
            <span className="flex min-w-0 items-center gap-2">
                <CheckboxBox
                    checked={checked}
                    invalid={invalid}
                    inputProps={{
                        id,
                        required: true,
                        'aria-required': true,
                        'aria-invalid': invalid || undefined,
                        onChange: e => onChange(e.target.checked),
                    }}
                />
                <span className="text-secondary-300 text-sm">
                    <span className="text-secondary-400 mr-1 text-xs">
                        (필수)
                    </span>
                    {label}
                </span>
            </span>
            <Link
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={detailLabel}
                onClick={e => e.stopPropagation()}
                className="text-secondary-400 hover:text-primary-400 focus-visible:ring-primary-400 focus-visible:ring-offset-secondary-950 inline-flex shrink-0 items-center rounded-sm px-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
                자세히 보기
                <ExternalArrowIcon />
                <span className="sr-only">(새 탭에서 열림)</span>
            </Link>
        </label>
    );
}

export function ConsentCheckboxGroup({
    privacyChecked,
    tosChecked,
    onPrivacyChange,
    onTosChange,
    error,
}: ConsentCheckboxGroupProps) {
    const privacyId = useId();
    const tosId = useId();

    const allChecked = privacyChecked && tosChecked;
    const someChecked = privacyChecked || tosChecked;
    const indeterminate = someChecked && !allChecked;

    function handleMasterChange(next: boolean): void {
        onPrivacyChange(next);
        onTosChange(next);
    }

    return (
        <fieldset
            className="border-secondary-800 space-y-3 border-y py-4"
            style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
            }}
        >
            <legend className="sr-only">동의 항목</legend>
            <p className="text-secondary-400 text-xs">
                계속하려면 아래 항목에 동의해주세요.
            </p>
            <label
                htmlFor="signup-consent-master"
                className="flex min-h-[44px] cursor-pointer items-center gap-2 py-1"
            >
                <CheckboxBox
                    checked={allChecked}
                    indeterminate={indeterminate}
                    invalid={false}
                    inputProps={{
                        id: 'signup-consent-master',
                        onChange: e => handleMasterChange(e.target.checked),
                        'aria-controls': `${privacyId} ${tosId}`,
                    }}
                />
                <span className="text-secondary-100 text-sm font-semibold">
                    모두 동의
                </span>
            </label>
            <div
                role="separator"
                aria-hidden="true"
                className="border-secondary-800 border-t"
            />
            <ConsentRow
                id={privacyId}
                label="개인정보 수집·이용 동의"
                href={PRIVACY_PATH}
                detailLabel="개인정보처리방침 자세히 보기"
                checked={privacyChecked}
                invalid={Boolean(error) && !privacyChecked}
                onChange={onPrivacyChange}
            />
            <ConsentRow
                id={tosId}
                label="서비스 이용약관 동의"
                href={TERMS_PATH}
                detailLabel="이용약관 자세히 보기"
                checked={tosChecked}
                invalid={Boolean(error) && !tosChecked}
                onChange={onTosChange}
            />
            {error ? (
                <p
                    role="alert"
                    aria-live="polite"
                    className="text-ui-danger text-xs motion-safe:animate-[fade-up_150ms_ease-out]"
                    style={{ animationFillMode: 'both' }}
                >
                    {error}
                </p>
            ) : null}
        </fieldset>
    );
}
```

전역 keyframes (`scale-in`, `fade-up`)은 `tailwind.config.ts` 또는 `globals.css`에 정의되어 있어야 한다. 미정의 시 `globals.css`에 추가:

```css
@keyframes scale-in {
    from { transform: scale(0); opacity: 0; }
    to   { transform: scale(1); opacity: 1; }
}
@keyframes fade-up {
    from { opacity: 0; transform: translateY(-2px); }
    to   { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/__tests__/components/auth/ConsentCheckboxGroup.test.tsx`
Expected: PASS — 6개 케이스 모두

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/ConsentCheckboxGroup.tsx src/__tests__/components/auth/ConsentCheckboxGroup.test.tsx src/app/globals.css
git commit -m "feat(auth): add ConsentCheckboxGroup component"
```

---

### Task 16: ConsentCheckboxGroup — indeterminate / a11y / error 케이스 추가

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/src/__tests__/components/auth/ConsentCheckboxGroup.test.tsx`

- [ ] **Step 1: 추가 테스트 작성**

기존 파일에 다음 it 블록 추가:

```tsx
it('master shows indeterminate when only one individual checked', () => {
    render(<Renderer initialPrivacy initialTos={false} />);
    const master = screen.getByLabelText('모두 동의') as HTMLInputElement;
    expect(master.indeterminate).toBe(true);
    expect(master.checked).toBe(false);
});

it('renders error message with role=alert and aria-live=polite', () => {
    render(
        <Renderer error="개인정보처리방침과 이용약관에 동의해주세요." />
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(
        '개인정보처리방침과 이용약관에 동의해주세요.'
    );
    expect(alert).toHaveAttribute('aria-live', 'polite');
});

it('individual checkboxes are required and aria-required', () => {
    render(<Renderer />);
    const privacy = screen.getByLabelText(
        /개인정보 수집·이용 동의/
    ) as HTMLInputElement;
    expect(privacy).toBeRequired();
    expect(privacy).toHaveAttribute('aria-required', 'true');
});

it('detail links open in new tab with rel=noopener and aria-label', () => {
    render(<Renderer />);
    const privacyLink = screen.getByLabelText(
        '개인정보처리방침 자세히 보기'
    );
    expect(privacyLink).toHaveAttribute('target', '_blank');
    expect(privacyLink.getAttribute('rel')).toContain('noopener');
});

it('error highlights only the unchecked rows (border-ui-danger)', () => {
    render(<Renderer initialPrivacy={false} initialTos error="에러" />);
    const privacyRow = screen
        .getByLabelText(/개인정보 수집·이용 동의/)
        .closest('label');
    expect(privacyRow?.className).toContain('border-ui-danger');
});
```

- [ ] **Step 2: 테스트 실행**

Run: `yarn test src/__tests__/components/auth/ConsentCheckboxGroup.test.tsx`
Expected: 추가 5개 케이스 PASS (Task 15 구현이 이미 모두 만족)

만약 실패하면 ConsentCheckboxGroup 구현을 보강. 위 구현은 모든 케이스를 충족하도록 작성됨.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/components/auth/ConsentCheckboxGroup.test.tsx
git commit -m "test(auth): cover ConsentCheckboxGroup indeterminate, a11y, error states"
```

---

### Task 17: ConsentCheckboxGroup 시각 회귀 — 수동 확인

이 Task는 자동 테스트가 아닌 수동 시각 검증.

- [ ] **Step 1: dev 서버에서 임시 페이지로 시각 확인**

(생략 가능. 통합 후 SignupForm과 함께 검증)

- [ ] **Step 2: 변경 사항 없으면 commit 스킵**

(이 Task는 검증 단계로, 코드 변경 없으면 commit 없음)

---

## Phase 6 — 이메일 가입 통합

### Task 18: SignupFormState 타입 확장

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/src/domain/auth/formTypes.ts`

- [ ] **Step 1: 기존 파일 확인**

Run: `cat src/domain/auth/formTypes.ts`

- [ ] **Step 2: error.code 확장**

`SignupFormState` 타입의 `error.code`에 `'consent_required'`, `'service_unavailable'` 추가. 정확한 코드는 기존 파일 구조에 맞춰 해당 union 타입에 두 값 추가:

```ts
// 예시 (기존 코드 형태에 맞춰 조정)
export interface SignupFormState {
    error?: {
        code:
            | 'invalid_email'
            | 'invalid_password'
            | 'email_already_exists'
            | 'invalid_email_token'
            | 'redis_unavailable'
            | 'auto_login_failed'
            | 'consent_required'        // 추가
            | 'service_unavailable';    // 추가
        field?: 'email' | 'password';
        message: string;
    };
}
```

- [ ] **Step 3: 타입 체크**

Run: `yarn lint src/domain/auth/formTypes.ts`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/domain/auth/formTypes.ts
git commit -m "feat(auth): extend SignupFormState with consent_required and service_unavailable codes"
```

---

### Task 19: registerUser use-case에 agreedTermsIds + 트랜잭션 (TDD)

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/src/infrastructure/auth/use-cases/registerUser.ts`
- Modify: `/Users/y0ngha/Project/siglens/src/infrastructure/auth/use-cases/types.ts`
- Modify: `/Users/y0ngha/Project/siglens/src/__tests__/infrastructure/auth/use-cases/registerUser.test.ts`

- [ ] **Step 1: 기존 use-case 시그니처 확인**

```bash
cat src/infrastructure/auth/use-cases/registerUser.ts
cat src/infrastructure/auth/use-cases/types.ts | head -80
```

- [ ] **Step 2: 실패 테스트 작성 (input에 agreedTermsIds 추가)**

기존 `registerUser.test.ts`에 다음 케이스 추가 (정확한 의존성 모킹은 기존 테스트 패턴 따름):

```ts
it('inserts agreement rows for each agreedTermsId in a transaction', async () => {
    const insertManyMock = jest.fn().mockResolvedValue(undefined);
    const transactionMock = jest
        .fn()
        .mockImplementation(async (cb: (tx: any) => Promise<any>) => {
            return cb({});
        });
    // 기존 deps 구조에 agreements + db 추가
    const result = await registerUser(
        {
            email: 'new@example.com',
            password: 'StrongPwd!1',
            agreedTermsIds: ['terms-privacy-id', 'terms-tos-id'],
        },
        {
            ...baseDeps,            // 기존 테스트의 mock deps 변수
            agreements: { insertMany: insertManyMock },
            db: { transaction: transactionMock },
        }
    );

    expect(result.ok).toBe(true);
    expect(insertManyMock).toHaveBeenCalledWith([
        expect.objectContaining({
            termsId: 'terms-privacy-id',
            agreed: true,
        }),
        expect.objectContaining({
            termsId: 'terms-tos-id',
            agreed: true,
        }),
    ]);
});

it('rejects empty agreedTermsIds', async () => {
    const result = await registerUser(
        {
            email: 'new@example.com',
            password: 'StrongPwd!1',
            agreedTermsIds: [],
        },
        baseDeps   // 기존 mock deps
    );
    expect(result.ok).toBe(false);
});
```

`baseDeps`는 기존 테스트의 deps 객체를 재사용. 신규 deps(`agreements`, `db`)도 기존 deps에 합쳐 빈 인터페이스 모킹 추가.

- [ ] **Step 3: types.ts 시그니처 확장**

`src/infrastructure/auth/use-cases/types.ts`의 `RegisterUserInput`, `RegisterUserDependencies`에 추가:

```ts
import type { AgreementRepository } from '@/infrastructure/db/agreementRepository';
import type { SiglensDatabase } from '@/infrastructure/db/types';

export interface RegisterUserInput {
    email: string;
    password: string;
    name?: string;
    agreedTermsIds: readonly string[];   // 추가
}

export interface RegisterUserDependencies {
    users: AuthUserRepository;
    passwordHasher: PasswordHasher;
    emailTokens: EmailTokenStore;
    agreements: AgreementRepository;     // 추가
    db: SiglensDatabase;                 // 추가 (트랜잭션 러너)
}
```

- [ ] **Step 4: registerUser 구현 변경**

`src/infrastructure/auth/use-cases/registerUser.ts`에서 user 생성 + agreement 기록을 `db.transaction` 안으로:

```ts
import { agreements as agreementsTable } from '@/infrastructure/db/schema';
import { DrizzleAgreementRepository } from '@/infrastructure/db/agreementRepository';

export async function registerUser(
    input: RegisterUserInput,
    deps: RegisterUserDependencies
): Promise<RegisterUserResult> {
    if (input.agreedTermsIds.length === 0) {
        return {
            ok: false,
            error: {
                code: 'invalid_input',
                message: 'agreedTermsIds must not be empty',
            },
        };
    }

    // 기존 검증 (이메일/비밀번호/토큰/해시) 그대로
    // ...

    const now = new Date();

    try {
        const user = await deps.db.transaction(async tx => {
            // tx 기반 repository 인스턴스를 생성하거나, 기존 패턴에 맞춰 처리
            const txAgreements = new DrizzleAgreementRepository(tx);
            const created = await deps.users.createWithEmailAndPassword({
                email,
                passwordHash,
                name: input.name,
            });
            // 기존 unique 제약 위반 케이스도 그대로
            await txAgreements.insertMany(
                input.agreedTermsIds.map(termsId => ({
                    userId: created.id,
                    termsId,
                    agreed: true,
                    agreedAt: now,
                }))
            );
            return created;
        });
        // 이메일 토큰 invalidate
        await deps.emailTokens.invalidate(email);
        return { ok: true, user };
    } catch (err) {
        // 기존 에러 분기 처리
        return mapCreateUserError(err);
    }
}
```

**중요:** Drizzle의 `db.transaction`은 콜백에 `tx`(같은 인터페이스)를 넘긴다. `users.createWithEmailAndPassword`도 `tx` 기반으로 호출되어야 atomic. 만약 기존 `AuthUserRepository`가 db를 생성자에서 받는 구조라면 `tx` 받는 변형 메서드를 추가하거나, 트랜잭션 안에서 새 repo 인스턴스 생성.

기존 코드 구조에 따라 minor 조정 필요:
- 옵션 A: `users` repository 메서드에 `tx?` 파라미터 추가
- 옵션 B: 트랜잭션 안에서 `new DrizzleUserRepository(tx)` 생성 (간단)

옵션 B를 추천. registerUser에서 직접 `new DrizzleUserRepository(tx)`, `new DrizzleAgreementRepository(tx)`로 해도 깔끔.

- [ ] **Step 5: 테스트 통과 확인**

Run: `yarn test src/__tests__/infrastructure/auth/use-cases/registerUser.test.ts`
Expected: PASS (기존 케이스 + 신규 2개)

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/auth/use-cases/registerUser.ts src/infrastructure/auth/use-cases/types.ts src/__tests__/infrastructure/auth/use-cases/registerUser.test.ts
git commit -m "feat(auth): record agreements atomically in registerUser transaction"
```

---

### Task 20: registerAction 동의 검증 + 활성 약관 조회 (TDD)

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/src/infrastructure/auth/registerAction.ts`
- Create/Modify: `/Users/y0ngha/Project/siglens/src/__tests__/infrastructure/auth/registerAction.test.ts`

- [ ] **Step 1: 기존 테스트 파일 존재 여부 확인**

```bash
ls src/__tests__/infrastructure/auth/registerAction.test.ts 2>/dev/null
```

기존 테스트가 없으면 새로 작성. 있으면 확장.

- [ ] **Step 2: 실패 테스트 작성**

```ts
import { registerAction } from '@/infrastructure/auth/registerAction';

// 의존성을 mock 하기 위해 jest.mock 사용:
jest.mock('@/infrastructure/db/termsRepository');
jest.mock('@/infrastructure/auth/use-cases/registerUser');

describe('registerAction — consent validation', () => {
    function buildFormData(overrides: Record<string, string> = {}): FormData {
        const fd = new FormData();
        fd.set('email', 'new@example.com');
        fd.set('password', 'StrongPwd!1');
        fd.set('agreed_privacy', 'true');
        fd.set('agreed_tos', 'true');
        for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
        return fd;
    }

    it('returns consent_required when agreed_privacy is false', async () => {
        const result = await registerAction(
            {} as any,
            buildFormData({ agreed_privacy: 'false' })
        );
        expect(result.error?.code).toBe('consent_required');
    });

    it('returns consent_required when agreed_tos is missing', async () => {
        const fd = buildFormData();
        fd.delete('agreed_tos');
        const result = await registerAction({} as any, fd);
        expect(result.error?.code).toBe('consent_required');
    });

    it('returns service_unavailable when no active terms found', async () => {
        const { DrizzleTermsRepository } =
            jest.requireMock('@/infrastructure/db/termsRepository');
        DrizzleTermsRepository.mockImplementation(() => ({
            findActive: jest.fn().mockResolvedValue(null),
        }));
        const result = await registerAction({} as any, buildFormData());
        expect(result.error?.code).toBe('service_unavailable');
    });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `yarn test src/__tests__/infrastructure/auth/registerAction.test.ts`
Expected: FAIL (consent 검증 코드가 아직 없음)

- [ ] **Step 4: registerAction 구현 변경**

`src/infrastructure/auth/registerAction.ts` 수정:

```ts
'use server';

import { DrizzleAgreementRepository } from '@/infrastructure/db/agreementRepository';
import { DrizzleSessionRepository } from '@/infrastructure/db/sessionRepository';
import { DrizzleTermsRepository } from '@/infrastructure/db/termsRepository';
import { DrizzleUserRepository } from '@/infrastructure/db/userRepository';
import {
    bcryptPasswordHasher,
    bcryptPasswordVerifier,
} from '@/infrastructure/auth/bcrypt';
import { loginUser } from '@/infrastructure/auth/use-cases/loginUser';
import { registerUser } from '@/infrastructure/auth/use-cases/registerUser';
import { createEmailTokenStore } from '@/infrastructure/email/tokenStore';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { SignupFormState } from '@/domain/auth/formTypes';
import { sanitizeNextPath } from '@/domain/auth/redirect';
import { applyAuthCookie } from '@/infrastructure/auth/applyAuthCookie';
import { getAuthDatabaseClient } from '@/infrastructure/auth/db';
import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from '@/infrastructure/auth/errorMessages';
import { isSecureCookieEnv } from '@/infrastructure/auth/sessionCookieOptions';
import { createAuthHintCookie } from '@/infrastructure/auth/authHintCookie';
import { DEFAULT_SESSION_TTL_SECONDS } from '@/infrastructure/auth/sessionCookie';

const AUTO_LOGIN_FAILED_MESSAGE =
    '회원가입은 완료되었으나 자동 로그인에 실패했습니다. 로그인 페이지에서 다시 시도해주세요.';

const CONSENT_REQUIRED_MESSAGE =
    '개인정보처리방침과 이용약관에 동의해주세요.';

export async function registerAction(
    _prev: SignupFormState,
    formData: FormData
): Promise<SignupFormState> {
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const rawName = String(formData.get('name') ?? '').trim();
    const name = rawName ? rawName : undefined;
    const next = sanitizeNextPath(formData.get('next')?.toString());
    const agreedPrivacy = String(formData.get('agreed_privacy') ?? '');
    const agreedTos = String(formData.get('agreed_tos') ?? '');

    if (agreedPrivacy !== 'true' || agreedTos !== 'true') {
        return {
            error: {
                code: 'consent_required',
                message: CONSENT_REQUIRED_MESSAGE,
            },
        };
    }

    const emailTokens = createEmailTokenStore();
    if (!emailTokens) {
        return {
            error: {
                code: 'redis_unavailable',
                message: AUTH_SERVICE_UNAVAILABLE_MESSAGE,
            },
        };
    }

    const { db } = getAuthDatabaseClient();
    const termsRepo = new DrizzleTermsRepository(db);
    const [termsP, termsT] = await Promise.all([
        termsRepo.findActive('privacy'),
        termsRepo.findActive('tos'),
    ]);
    if (!termsP || !termsT) {
        return {
            error: {
                code: 'service_unavailable',
                message: AUTH_SERVICE_UNAVAILABLE_MESSAGE,
            },
        };
    }

    const userRepo = new DrizzleUserRepository(db);
    const agreementRepo = new DrizzleAgreementRepository(db);

    const registerResult = await registerUser(
        {
            email,
            password,
            name,
            agreedTermsIds: [termsP.id, termsT.id],
        },
        {
            users: userRepo,
            passwordHasher: bcryptPasswordHasher,
            emailTokens,
            agreements: agreementRepo,
            db,
        }
    );

    if (!registerResult.ok) {
        return {
            error: {
                code: registerResult.error.code,
                field: registerResult.error.field,
                message: registerResult.error.message,
            },
        };
    }

    // 이하 자동 로그인 + 쿠키 설정 + redirect 기존 로직 그대로
    const loginResult = await loginUser(
        { email, password },
        {
            users: userRepo,
            sessions: new DrizzleSessionRepository(db),
            passwordVerifier: bcryptPasswordVerifier,
        },
        { secureCookie: isSecureCookieEnv() }
    );

    if (!loginResult.ok) {
        return {
            error: {
                code: 'auto_login_failed',
                message: AUTO_LOGIN_FAILED_MESSAGE,
            },
        };
    }

    const cookieStore = await cookies();
    cookieStore.set(applyAuthCookie(loginResult.cookie));
    cookieStore.set(
        createAuthHintCookie({
            maxAgeSeconds: DEFAULT_SESSION_TTL_SECONDS,
            secure: isSecureCookieEnv(),
        })
    );
    redirect(next);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `yarn test src/__tests__/infrastructure/auth/registerAction.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/auth/registerAction.ts src/__tests__/infrastructure/auth/registerAction.test.ts
git commit -m "feat(auth): require consent and record agreements in registerAction"
```

---

### Task 21: SignupForm details 단계에 동의 박스 통합

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/src/components/auth/SignupForm.tsx`

- [ ] **Step 1: SignupFormFlow에 동의 state + hidden inputs + ConsentCheckboxGroup 삽입**

`src/components/auth/SignupForm.tsx`에서 details 단계 폼 부분을 수정. import 추가:

```tsx
import { ConsentCheckboxGroup } from '@/components/auth/ConsentCheckboxGroup';
```

`SignupFormFlow` 함수 내부에 state 추가:

```tsx
const [privacyChecked, setPrivacyChecked] = useState(false);
const [tosChecked, setTosChecked] = useState(false);
```

`signupFormError` 옆에 consent 에러 추출 추가:

```tsx
const consentErrorMessage =
    signupError?.code === 'consent_required'
        ? signupError.message
        : undefined;
const formLevelError =
    signupError && !signupError.field && signupError.code !== 'consent_required'
        ? signupError.message
        : null;
```

`phase === 'details'` 분기 내부의 form 안 (`<SubmitButton>` 직전)에 hidden input + ConsentCheckboxGroup 추가:

```tsx
{phase === 'details' && (
    <form action={signupFormAction} className="space-y-4" noValidate>
        <input type="hidden" name="email" value={email} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <input
            type="hidden"
            name="agreed_privacy"
            value={privacyChecked ? 'true' : 'false'}
        />
        <input
            type="hidden"
            name="agreed_tos"
            value={tosChecked ? 'true' : 'false'}
        />
        {formLevelError ? (
            <AuthErrorAlert message={formLevelError} />
        ) : null}
        {signupEmailError ? (
            <AuthErrorAlert message={signupEmailError} />
        ) : null}
        <p className="text-secondary-300 text-sm">
            <span className="text-ui-success" aria-hidden="true">✓</span>{' '}
            인증 완료:{' '}
            <span className="text-secondary-100 font-mono break-all">
                {email}
            </span>{' '}
            <EmailEditButton onClick={onRestart} />
        </p>
        <AuthFieldGroup
            id="signup-name"
            name="name"
            label="표시 이름 (선택)"
            type="text"
            autoComplete="name"
            placeholder="다른 사용자에게 보이는 이름"
        />
        <PasswordField
            id="signup-password"
            name="password"
            label="비밀번호"
            autoComplete="new-password"
            required
            error={signupPasswordError}
            describedById={hintId}
            onChange={setPassword}
            hint={
                <PasswordStrengthHint
                    password={password}
                    descriptionId={hintId}
                />
            }
        />
        <ConsentCheckboxGroup
            privacyChecked={privacyChecked}
            tosChecked={tosChecked}
            onPrivacyChange={setPrivacyChecked}
            onTosChange={setTosChecked}
            error={consentErrorMessage}
        />
        <SubmitButton label="회원가입" pendingLabel="가입 중…" />
    </form>
)}
```

- [ ] **Step 2: 동작 검증 (수동)**

Run: `yarn dev`
브라우저: `http://localhost:4200/signup`
- 이메일 → 코드 → details 진입
- 동의 체크 안 한 채 제출 → "개인정보처리방침과 이용약관에 동의해주세요." 노출
- 두 항목 체크 → 가입 성공 → next로 redirect
- DB 확인: `SELECT u.email, COUNT(a.id) FROM users u LEFT JOIN agreements a ON a.user_id = u.id GROUP BY u.email`
  → 새 가입 사용자에 agreement 2 row

- [ ] **Step 3: SignupForm 테스트 추가**

`src/__tests__/components/auth/SignupForm.test.tsx`에 details 단계 테스트가 있다면 확장. 없으면 신규 케이스만 별도 파일로:

```tsx
it('details step renders ConsentCheckboxGroup with consent_required error from action', async () => {
    // signupFormAction이 { error: { code: 'consent_required', message: '...' } } 를 반환하는 케이스
    // 기존 SignupForm 테스트 patterns에 맞춰 구현
});
```

기존 테스트 구조에 맞춰 fixture 작성 (구체 mock 패턴은 기존 SignupForm.test 참고).

- [ ] **Step 4: 테스트 실행**

Run: `yarn test src/__tests__/components/auth/SignupForm.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/SignupForm.tsx src/__tests__/components/auth/SignupForm.test.tsx
git commit -m "feat(auth): integrate ConsentCheckboxGroup into SignupForm details step"
```

---

## Phase 7 — OAuth 가입 흐름

### Task 22: pendingOAuthSignupStore (TDD)

**Files:**
- Create: `/Users/y0ngha/Project/siglens/src/infrastructure/auth/pendingOAuthSignupStore.ts`
- Test: `/Users/y0ngha/Project/siglens/src/__tests__/infrastructure/auth/pendingOAuthSignupStore.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/__tests__/infrastructure/auth/pendingOAuthSignupStore.test.ts`:

```ts
import {
    createPendingOAuthSignupStore,
    type PendingOAuthSignup,
} from '@/infrastructure/auth/pendingOAuthSignupStore';

describe('PendingOAuthSignupStore', () => {
    function makeRedis() {
        const store = new Map<string, string>();
        return {
            client: {
                set: jest.fn(async (key: string, value: string) => {
                    store.set(key, value);
                }),
                get: jest.fn(async (key: string) => store.get(key) ?? null),
                del: jest.fn(async (key: string) => {
                    store.delete(key);
                }),
            },
            store,
        };
    }

    const sample: PendingOAuthSignup = {
        provider: 'google',
        email: 'new@example.com',
        providerAccountId: 'gid_123',
        name: 'Hong Gildong',
        accessToken: 'at',
        next: '/',
        createdAt: new Date('2026-05-04T00:00:00Z').toISOString(),
    };

    it('save stores under the namespaced key with TTL', async () => {
        const { client } = makeRedis();
        const store = createPendingOAuthSignupStore(client as any);

        const token = await store.save(sample);

        expect(token).toMatch(/^[a-f0-9]{64}$/);
        expect(client.set).toHaveBeenCalledWith(
            `pending_oauth_signup:${token}`,
            JSON.stringify(sample),
            expect.objectContaining({ ex: 600 })
        );
    });

    it('peek returns stored profile without deleting', async () => {
        const { client, store } = makeRedis();
        const sut = createPendingOAuthSignupStore(client as any);
        const token = await sut.save(sample);

        const peeked = await sut.peek(token);

        expect(peeked).toEqual(sample);
        expect(store.has(`pending_oauth_signup:${token}`)).toBe(true);
    });

    it('consume returns and deletes', async () => {
        const { client, store } = makeRedis();
        const sut = createPendingOAuthSignupStore(client as any);
        const token = await sut.save(sample);

        const first = await sut.consume(token);
        const second = await sut.consume(token);

        expect(first).toEqual(sample);
        expect(second).toBeNull();
        expect(store.has(`pending_oauth_signup:${token}`)).toBe(false);
    });

    it('delete removes the entry', async () => {
        const { client, store } = makeRedis();
        const sut = createPendingOAuthSignupStore(client as any);
        const token = await sut.save(sample);

        await sut.delete(token);

        expect(store.has(`pending_oauth_signup:${token}`)).toBe(false);
    });

    it('peek returns null for nonexistent token', async () => {
        const { client } = makeRedis();
        const sut = createPendingOAuthSignupStore(client as any);

        expect(await sut.peek('nonexistent')).toBeNull();
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/__tests__/infrastructure/auth/pendingOAuthSignupStore.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/infrastructure/auth/pendingOAuthSignupStore.ts`:

```ts
import crypto from 'crypto';
import type { Redis } from '@upstash/redis';
import type { SupportedOAuthProvider } from '@/domain/types';

const NAMESPACE = 'pending_oauth_signup';
const TTL_SECONDS = 600;

export interface PendingOAuthSignup {
    provider: SupportedOAuthProvider;
    email: string;
    providerAccountId: string;
    name?: string;
    avatarUrl?: string;
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: string;
    next: string;
    createdAt: string;
}

export interface PendingOAuthSignupStore {
    save(profile: PendingOAuthSignup): Promise<string>;
    peek(token: string): Promise<PendingOAuthSignup | null>;
    consume(token: string): Promise<PendingOAuthSignup | null>;
    delete(token: string): Promise<void>;
}

function generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

function buildKey(token: string): string {
    return `${NAMESPACE}:${token}`;
}

function tryParse(value: string | null): PendingOAuthSignup | null {
    if (value === null) return null;
    try {
        return JSON.parse(value) as PendingOAuthSignup;
    } catch {
        return null;
    }
}

export function createPendingOAuthSignupStore(
    client: Redis
): PendingOAuthSignupStore {
    return {
        async save(profile) {
            const token = generateToken();
            await client.set(buildKey(token), JSON.stringify(profile), {
                ex: TTL_SECONDS,
            });
            return token;
        },
        async peek(token) {
            const raw = (await client.get(buildKey(token))) as
                | string
                | null;
            return tryParse(raw);
        },
        async consume(token) {
            const key = buildKey(token);
            const raw = (await client.get(key)) as string | null;
            if (raw === null) return null;
            await client.del(key);
            return tryParse(raw);
        },
        async delete(token) {
            await client.del(buildKey(token));
        },
    };
}

/** Factory that reads Redis env vars and returns a store, or null if unavailable. */
export function createPendingOAuthSignupStoreFromEnv():
    | PendingOAuthSignupStore
    | null {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    // 동기 import 대신 require로 처리 (기존 createEmailTokenStore 패턴)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require('@upstash/redis');
    const client = new Redis({ url, token });
    return createPendingOAuthSignupStore(client);
}
```

(env factory의 정확한 import 구조는 기존 `createEmailTokenStore` 코드를 참조하여 동일 패턴으로 작성.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/__tests__/infrastructure/auth/pendingOAuthSignupStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/auth/pendingOAuthSignupStore.ts src/__tests__/infrastructure/auth/pendingOAuthSignupStore.test.ts
git commit -m "feat(auth): add pendingOAuthSignupStore for OAuth consent flow"
```

---

### Task 23: callback route 분기 — 신규 사용자는 consent 페이지로

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/src/app/api/auth/callback/[provider]/route.ts`
- Modify: `/Users/y0ngha/Project/siglens/src/__tests__/app/api/auth/callback/[provider]/route.test.ts` (있으면) 또는 신규 작성

- [ ] **Step 1: 실패 테스트 작성 — 신규 사용자 분기**

기존 callback 테스트가 있다면 확장. 없으면:

`src/__tests__/app/api/auth/callback/[provider]/route.test.ts`:

```ts
// 기존 테스트 환경 설정 그대로 따르고, 다음 케이스 추가
it('redirects new users to /signup/oauth/consent with token', async () => {
    // 1. profile 모킹: existingByOAuthAccount=null, existingByEmail=null
    // 2. pendingOAuthSignupStore.save 모킹 → 'token-abc' 반환
    // 3. callback 호출
    // 4. response.location === '/signup/oauth/consent?token=token-abc' 검증
});

it('logs in existing OAuth users immediately (regression)', async () => {
    // 기존 동작과 동일 — 변경 없음 검증
});

it('redirects to /login on email conflict (regression)', async () => {
    // 기존 동작 유지 검증
});
```

- [ ] **Step 2: callback route 변경**

`src/app/api/auth/callback/[provider]/route.ts`의 `socialLoginUser` 호출 부분을 분기로 교체:

```ts
import { createPendingOAuthSignupStoreFromEnv } from '@/infrastructure/auth/pendingOAuthSignupStore';
import { createAuthSession } from '@/infrastructure/auth/sessionCookie';

// ... 기존 코드 ...

const userRepo = new DrizzleUserRepository(db);
const sessionRepo = new DrizzleSessionRepository(db);

const existing = await userRepo.findByOAuthAccount(
    profileResult.profile.provider,
    profileResult.profile.providerAccountId
);

if (existing !== null) {
    // 기존 사용자 → 즉시 로그인 (기존 socialLoginUser 동작과 동일)
    const { cookie } = await createAuthSession({
        userId: existing.id,
        sessions: sessionRepo,
        secureCookie: isSecureCookieEnv(),
    });
    const response = NextResponse.redirect(
        new URL(sanitizeNextPath(stateResult.next), req.url)
    );
    response.cookies.set(applyAuthCookie(cookie));
    response.cookies.set(expiredOAuthStateCookie());
    return response;
}

const existingByEmail = await userRepo.findByEmail(profileResult.profile.email);
if (existingByEmail !== null) {
    return redirectToLoginWithError(
        req,
        'oauth_email_conflict',
        profileResult.profile.email
    );
}

// 신규 사용자 → pending store에 저장 + consent 페이지로
const pendingStore = createPendingOAuthSignupStoreFromEnv();
if (!pendingStore) {
    return redirectToLoginWithError(req, 'oauth_unknown');
}

const token = await pendingStore.save({
    provider: profileResult.profile.provider,
    email: profileResult.profile.email,
    providerAccountId: profileResult.profile.providerAccountId,
    name: profileResult.profile.name,
    avatarUrl: profileResult.profile.avatarUrl,
    accessToken: profileResult.profile.accessToken,
    refreshToken: profileResult.profile.refreshToken,
    tokenExpiresAt: profileResult.profile.tokenExpiresAt?.toISOString(),
    next: stateResult.next,
    createdAt: new Date().toISOString(),
});

const consentUrl = new URL('/signup/oauth/consent', req.url);
consentUrl.searchParams.set('token', token);
const response = NextResponse.redirect(consentUrl);
response.cookies.set(expiredOAuthStateCookie());
return response;
```

`socialLoginUser` use-case는 더 이상 callback에서 사용되지 않으므로 import 제거. 다른 사용처가 있는지 확인 후 안전하면 파일 자체 deprecate (Task 28에서 정리).

- [ ] **Step 3: 테스트 통과 확인**

Run: `yarn test src/__tests__/app/api/auth/callback/`
Expected: 신규 케이스 + 회귀 케이스 모두 PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/callback/[provider]/route.ts src/__tests__/app/api/auth/callback/
git commit -m "feat(auth): redirect new OAuth users to consent page"
```

---

### Task 24: /signup/oauth/consent 페이지 (RSC)

**Files:**
- Create: `/Users/y0ngha/Project/siglens/src/app/signup/oauth/consent/page.tsx`

- [ ] **Step 1: 페이지 작성**

`src/app/signup/oauth/consent/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AuthCardShell } from '@/components/auth/AuthCardShell';
import { OAuthConsentForm } from '@/components/auth/OAuthConsentForm';
import { createPendingOAuthSignupStoreFromEnv } from '@/infrastructure/auth/pendingOAuthSignupStore';
import { SITE_NAME } from '@/lib/seo';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: '소셜 로그인 가입 동의',
    description: `${SITE_NAME} 소셜 로그인 가입 약관 동의`,
    robots: { index: false, follow: false },
};

interface PageProps {
    searchParams: Promise<{ token?: string }>;
}

async function ConsentContent({ searchParams }: PageProps) {
    const params = await searchParams;
    const token = params.token;
    if (!token) {
        redirect('/login?error=oauth_consent_invalid');
    }

    const store = createPendingOAuthSignupStoreFromEnv();
    if (!store) {
        redirect('/login?error=service_unavailable');
    }

    const profile = await store.peek(token);
    if (!profile) {
        redirect('/login?error=oauth_consent_expired');
    }

    return (
        <OAuthConsentForm
            token={token}
            provider={profile.provider}
            email={profile.email}
            name={profile.name}
            avatarUrl={profile.avatarUrl}
        />
    );
}

export default function OAuthConsentPage({ searchParams }: PageProps) {
    return (
        <AuthCardShell
            title="소셜 로그인 가입"
            subtitle="아래 정보로 SigLens에 가입됩니다"
        >
            <Suspense>
                <ConsentContent searchParams={searchParams} />
            </Suspense>
        </AuthCardShell>
    );
}
```

- [ ] **Step 2: 동작 확인 (build 단계)**

Run: `yarn build`
Expected: 빌드 통과 (OAuthConsentForm 미구현이라 import 에러 가능 → Task 25 진행 후 검증)

이 Task는 Task 25 함께 통합 검증이 자연스러우므로 commit은 Task 25에서 함께.

---

### Task 25: OAuthConsentForm 컴포넌트 (TDD)

**Files:**
- Create: `/Users/y0ngha/Project/siglens/src/components/auth/OAuthConsentForm.tsx`
- Test: `/Users/y0ngha/Project/siglens/src/__tests__/components/auth/OAuthConsentForm.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

`src/__tests__/components/auth/OAuthConsentForm.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OAuthConsentForm } from '@/components/auth/OAuthConsentForm';

// finalizeOAuthSignupAction, cancelOAuthSignupAction 모킹
jest.mock('@/infrastructure/auth/finalizeOAuthSignupAction', () => ({
    finalizeOAuthSignupAction: jest.fn(),
}));
jest.mock('@/infrastructure/auth/cancelOAuthSignupAction', () => ({
    cancelOAuthSignupAction: jest.fn(),
}));

describe('OAuthConsentForm', () => {
    const baseProps = {
        token: 'token-abc',
        provider: 'google' as const,
        email: 'new@example.com',
        name: 'Hong Gildong',
        avatarUrl: undefined,
    };

    it('renders profile email and name', () => {
        render(<OAuthConsentForm {...baseProps} />);
        expect(screen.getByText('new@example.com')).toBeInTheDocument();
        expect(screen.getByText('Hong Gildong')).toBeInTheDocument();
    });

    it('renders ConsentCheckboxGroup with master and individual checkboxes', () => {
        render(<OAuthConsentForm {...baseProps} />);
        expect(screen.getByLabelText('모두 동의')).toBeInTheDocument();
        expect(
            screen.getByLabelText(/개인정보 수집·이용 동의/)
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText(/서비스 이용약관 동의/)
        ).toBeInTheDocument();
    });

    it('includes hidden token input in finalize form', () => {
        const { container } = render(<OAuthConsentForm {...baseProps} />);
        const tokenInput = container.querySelector(
            'input[name="token"][value="token-abc"]'
        );
        expect(tokenInput).not.toBeNull();
    });

    it('renders 가입 완료 and 취소 buttons', () => {
        render(<OAuthConsentForm {...baseProps} />);
        expect(
            screen.getByRole('button', { name: /가입 완료/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /취소/ })
        ).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/__tests__/components/auth/OAuthConsentForm.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/components/auth/OAuthConsentForm.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { SupportedOAuthProvider } from '@/domain/types';
import { ConsentCheckboxGroup } from '@/components/auth/ConsentCheckboxGroup';
import { AuthErrorAlert } from '@/components/auth/AuthErrorAlert';
import { finalizeOAuthSignupAction } from '@/infrastructure/auth/finalizeOAuthSignupAction';
import { cancelOAuthSignupAction } from '@/infrastructure/auth/cancelOAuthSignupAction';
import { useActionState } from 'react';

interface OAuthConsentFormProps {
    token: string;
    provider: SupportedOAuthProvider;
    email: string;
    name?: string;
    avatarUrl?: string;
}

const PROVIDER_LABEL: Record<SupportedOAuthProvider, string> = {
    google: 'Google',
    kakao: 'Kakao',
};

export function OAuthConsentForm({
    token,
    provider,
    email,
    name,
    avatarUrl,
}: OAuthConsentFormProps) {
    const [privacyChecked, setPrivacyChecked] = useState(false);
    const [tosChecked, setTosChecked] = useState(false);
    const [finalizeState, finalizeFormAction] = useActionState(
        finalizeOAuthSignupAction,
        {}
    );

    useEffect(() => {
        const handlePageShow = (event: PageTransitionEvent): void => {
            if (event.persisted) {
                window.location.reload();
            }
        };
        window.addEventListener('pageshow', handlePageShow);
        return () => window.removeEventListener('pageshow', handlePageShow);
    }, []);

    const consentError =
        finalizeState.error?.code === 'consent_required'
            ? finalizeState.error.message
            : undefined;
    const formError =
        finalizeState.error && finalizeState.error.code !== 'consent_required'
            ? finalizeState.error.message
            : undefined;

    return (
        <div className="space-y-6">
            <div className="border-secondary-800 bg-secondary-900/40 flex items-center gap-3 rounded-lg border p-4">
                {avatarUrl ? (
                    <Image
                        src={avatarUrl}
                        alt=""
                        width={32}
                        height={32}
                        className="rounded-full"
                    />
                ) : (
                    <div
                        aria-hidden="true"
                        className="bg-secondary-800 size-8 rounded-full"
                    />
                )}
                <div className="min-w-0 flex-1">
                    <p className="text-secondary-100 truncate font-mono text-sm">
                        {email}
                    </p>
                    {name ? (
                        <p className="text-secondary-300 truncate text-xs">
                            {name}
                        </p>
                    ) : null}
                    <p className="text-secondary-400 text-xs">
                        {PROVIDER_LABEL[provider]} 계정으로 가입
                    </p>
                </div>
            </div>

            <form action={finalizeFormAction} className="space-y-4" noValidate>
                <input type="hidden" name="token" value={token} />
                <input
                    type="hidden"
                    name="agreed_privacy"
                    value={privacyChecked ? 'true' : 'false'}
                />
                <input
                    type="hidden"
                    name="agreed_tos"
                    value={tosChecked ? 'true' : 'false'}
                />
                {formError ? <AuthErrorAlert message={formError} /> : null}
                <ConsentCheckboxGroup
                    privacyChecked={privacyChecked}
                    tosChecked={tosChecked}
                    onPrivacyChange={setPrivacyChecked}
                    onTosChange={setTosChecked}
                    error={consentError}
                />
                <button
                    type="submit"
                    className="bg-primary-500 hover:bg-primary-400 text-secondary-950 focus-visible:ring-primary-400 focus-visible:ring-offset-secondary-950 inline-flex h-12 w-full items-center justify-center rounded-md text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    가입 완료
                </button>
            </form>

            <form action={cancelOAuthSignupAction}>
                <input type="hidden" name="token" value={token} />
                <button
                    type="submit"
                    className="text-secondary-400 hover:text-secondary-200 focus-visible:ring-primary-400 focus-visible:ring-offset-secondary-950 inline-flex h-10 w-full items-center justify-center rounded-md text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    취소
                </button>
            </form>
        </div>
    );
}
```

(`useActionState`의 정확한 state 타입은 finalize action 시그니처에 따라 조정. 다음 Task에서 action 정의.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/__tests__/components/auth/OAuthConsentForm.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit (Task 24의 페이지와 함께)**

```bash
git add src/app/signup/oauth/consent/page.tsx src/components/auth/OAuthConsentForm.tsx src/__tests__/components/auth/OAuthConsentForm.test.tsx
git commit -m "feat(auth): add OAuth consent page and form"
```

---

### Task 26: finalizeOAuthSignupAction (TDD)

**Files:**
- Create: `/Users/y0ngha/Project/siglens/src/infrastructure/auth/finalizeOAuthSignupAction.ts`
- Test: `/Users/y0ngha/Project/siglens/src/__tests__/infrastructure/auth/finalizeOAuthSignupAction.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { finalizeOAuthSignupAction } from '@/infrastructure/auth/finalizeOAuthSignupAction';

jest.mock('@/infrastructure/auth/pendingOAuthSignupStore');
jest.mock('@/infrastructure/db/termsRepository');

describe('finalizeOAuthSignupAction', () => {
    function buildFormData(over: Record<string, string> = {}): FormData {
        const fd = new FormData();
        fd.set('token', 'tok');
        fd.set('agreed_privacy', 'true');
        fd.set('agreed_tos', 'true');
        for (const [k, v] of Object.entries(over)) fd.set(k, v);
        return fd;
    }

    it('returns consent_required when checkboxes missing', async () => {
        const result = await finalizeOAuthSignupAction(
            {} as any,
            buildFormData({ agreed_privacy: 'false' })
        );
        expect(result.error?.code).toBe('consent_required');
    });

    // 다른 케이스는 모킹 setup이 복잡하므로 통합 테스트로 검증
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/__tests__/infrastructure/auth/finalizeOAuthSignupAction.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/infrastructure/auth/finalizeOAuthSignupAction.ts`:

```ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { applyAuthCookie } from '@/infrastructure/auth/applyAuthCookie';
import { createAuthHintCookie } from '@/infrastructure/auth/authHintCookie';
import { createAuthSession } from '@/infrastructure/auth/sessionCookie';
import { DEFAULT_SESSION_TTL_SECONDS } from '@/infrastructure/auth/sessionCookie';
import { getAuthDatabaseClient } from '@/infrastructure/auth/db';
import { isSecureCookieEnv } from '@/infrastructure/auth/sessionCookieOptions';
import { createPendingOAuthSignupStoreFromEnv } from '@/infrastructure/auth/pendingOAuthSignupStore';
import { DrizzleAgreementRepository } from '@/infrastructure/db/agreementRepository';
import { DrizzleSessionRepository } from '@/infrastructure/db/sessionRepository';
import { DrizzleTermsRepository } from '@/infrastructure/db/termsRepository';
import { DrizzleUserRepository } from '@/infrastructure/db/userRepository';
import { sanitizeNextPath } from '@/domain/auth/redirect';

interface FinalizeError {
    code: 'consent_required';
    message: string;
}

export interface FinalizeOAuthSignupState {
    error?: FinalizeError;
}

const CONSENT_REQUIRED_MESSAGE =
    '개인정보처리방침과 이용약관에 동의해주세요.';

export async function finalizeOAuthSignupAction(
    _prev: FinalizeOAuthSignupState,
    formData: FormData
): Promise<FinalizeOAuthSignupState> {
    const token = String(formData.get('token') ?? '').trim();
    const agreedPrivacy = String(formData.get('agreed_privacy') ?? '');
    const agreedTos = String(formData.get('agreed_tos') ?? '');

    if (!token) {
        redirect('/login?error=oauth_consent_invalid');
    }

    if (agreedPrivacy !== 'true' || agreedTos !== 'true') {
        return {
            error: {
                code: 'consent_required',
                message: CONSENT_REQUIRED_MESSAGE,
            },
        };
    }

    const store = createPendingOAuthSignupStoreFromEnv();
    if (!store) {
        redirect('/login?error=service_unavailable');
    }

    const profile = await store.peek(token);
    if (!profile) {
        redirect('/login?error=oauth_consent_expired');
    }

    const { db } = getAuthDatabaseClient();
    const termsRepo = new DrizzleTermsRepository(db);
    const [termsP, termsT] = await Promise.all([
        termsRepo.findActive('privacy'),
        termsRepo.findActive('tos'),
    ]);
    if (!termsP || !termsT) {
        redirect('/login?error=service_unavailable');
    }

    const consumed = await store.consume(token);
    if (!consumed) {
        redirect('/login?error=oauth_consent_expired');
    }

    const userRepo = new DrizzleUserRepository(db);
    const sessionRepo = new DrizzleSessionRepository(db);

    // race 체크
    const conflict = await userRepo.findByEmail(consumed.email);
    if (conflict) {
        redirect('/login?error=oauth_email_conflict');
    }

    let createdUserId: string;
    try {
        createdUserId = await db.transaction(async tx => {
            const txUserRepo = new DrizzleUserRepository(tx);
            const txAgreementRepo = new DrizzleAgreementRepository(tx);
            const created = await txUserRepo.createOAuthUser({
                email: consumed.email,
                provider: consumed.provider,
                providerAccountId: consumed.providerAccountId,
                name: consumed.name,
                avatarUrl: consumed.avatarUrl,
                accessToken: consumed.accessToken,
                refreshToken: consumed.refreshToken,
                tokenExpiresAt: consumed.tokenExpiresAt
                    ? new Date(consumed.tokenExpiresAt)
                    : undefined,
            });
            if (!created) {
                throw new Error('createOAuthUser returned null');
            }
            await txAgreementRepo.insertMany([
                {
                    userId: created.id,
                    termsId: termsP.id,
                    agreed: true,
                    agreedAt: new Date(),
                },
                {
                    userId: created.id,
                    termsId: termsT.id,
                    agreed: true,
                    agreedAt: new Date(),
                },
            ]);
            return created.id;
        });
    } catch {
        redirect('/login?error=oauth_email_conflict');
    }

    const { cookie } = await createAuthSession({
        userId: createdUserId,
        sessions: sessionRepo,
        secureCookie: isSecureCookieEnv(),
    });

    const cookieStore = await cookies();
    cookieStore.set(applyAuthCookie(cookie));
    cookieStore.set(
        createAuthHintCookie({
            maxAgeSeconds: DEFAULT_SESSION_TTL_SECONDS,
            secure: isSecureCookieEnv(),
        })
    );

    redirect(sanitizeNextPath(consumed.next));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/__tests__/infrastructure/auth/finalizeOAuthSignupAction.test.ts`
Expected: PASS (consent_required 케이스)

추가 통합 시나리오는 다음 Task의 e2e 검증으로 커버.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/auth/finalizeOAuthSignupAction.ts src/__tests__/infrastructure/auth/finalizeOAuthSignupAction.test.ts
git commit -m "feat(auth): add finalizeOAuthSignupAction with terms-first ordering"
```

---

### Task 27: cancelOAuthSignupAction (TDD)

**Files:**
- Create: `/Users/y0ngha/Project/siglens/src/infrastructure/auth/cancelOAuthSignupAction.ts`
- Test: `/Users/y0ngha/Project/siglens/src/__tests__/infrastructure/auth/cancelOAuthSignupAction.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { cancelOAuthSignupAction } from '@/infrastructure/auth/cancelOAuthSignupAction';
import { redirect } from 'next/navigation';

jest.mock('next/navigation', () => ({ redirect: jest.fn() }));
jest.mock('@/infrastructure/auth/pendingOAuthSignupStore', () => ({
    createPendingOAuthSignupStoreFromEnv: jest.fn(),
}));

describe('cancelOAuthSignupAction', () => {
    afterEach(() => jest.clearAllMocks());

    it('deletes the token and redirects to /login', async () => {
        const deleteMock = jest.fn().mockResolvedValue(undefined);
        const {
            createPendingOAuthSignupStoreFromEnv,
        } = require('@/infrastructure/auth/pendingOAuthSignupStore');
        createPendingOAuthSignupStoreFromEnv.mockReturnValue({
            delete: deleteMock,
        });

        const fd = new FormData();
        fd.set('token', 'tok');
        await cancelOAuthSignupAction(fd);

        expect(deleteMock).toHaveBeenCalledWith('tok');
        expect(redirect).toHaveBeenCalledWith('/login');
    });

    it('redirects to /login even without token', async () => {
        const fd = new FormData();
        await cancelOAuthSignupAction(fd);
        expect(redirect).toHaveBeenCalledWith('/login');
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/__tests__/infrastructure/auth/cancelOAuthSignupAction.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/infrastructure/auth/cancelOAuthSignupAction.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { createPendingOAuthSignupStoreFromEnv } from '@/infrastructure/auth/pendingOAuthSignupStore';

export async function cancelOAuthSignupAction(
    formData: FormData
): Promise<void> {
    const token = String(formData.get('token') ?? '').trim();
    if (token) {
        const store = createPendingOAuthSignupStoreFromEnv();
        if (store) await store.delete(token);
    }
    redirect('/login');
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/__tests__/infrastructure/auth/cancelOAuthSignupAction.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/auth/cancelOAuthSignupAction.ts src/__tests__/infrastructure/auth/cancelOAuthSignupAction.test.ts
git commit -m "feat(auth): add cancelOAuthSignupAction"
```

---

### Task 28: /login OAUTH_ERROR_MESSAGES 확장 + /signup 안내 문구 + socialLoginUser 정리

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/src/app/login/page.tsx`
- Modify: `/Users/y0ngha/Project/siglens/src/app/signup/page.tsx`
- (선택) Delete: `/Users/y0ngha/Project/siglens/src/infrastructure/auth/use-cases/socialLoginUser.ts`

- [ ] **Step 1: /login 에러 메시지 확장**

`src/app/login/page.tsx`의 `OAUTH_ERROR_MESSAGES` 객체에 추가:

```ts
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
    oauth_email_conflict:
        '이미 비밀번호로 가입된 이메일입니다. 비밀번호로 로그인해주세요.',
    oauth_profile_invalid: '소셜 로그인 정보를 확인할 수 없습니다.',
    oauth_unknown: '소셜 로그인 중 알 수 없는 오류가 발생했습니다.',
    oauth_consent_invalid:
        '잘못된 가입 요청입니다. 처음부터 다시 시작해주세요.',
    oauth_consent_expired:
        '가입 시간이 만료되었습니다. 다시 시도해주세요.',
    service_unavailable:
        '서비스를 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도해주세요.',
};
```

- [ ] **Step 2: /signup 안내 문구 추가**

`src/app/signup/page.tsx`의 `SignupContent` 내 `<SocialLoginButtons />` 직전에:

```tsx
<p className="text-secondary-500 mt-6 mb-2 text-xs">
    소셜 로그인 시작 후 약관 동의 단계가 있습니다.
</p>
<SocialLoginButtons next={nextParam} />
```

- [ ] **Step 3: socialLoginUser use-case 정리**

Run: `grep -rn "socialLoginUser" src/`
Expected: 더 이상 callback에서 사용 안 됨. 다른 사용처 없으면 파일 삭제 + 테스트 삭제 가능.

만약 다른 사용처 있으면 그곳도 정리 (예: 수동 OAuth 로그인 흐름이 있다면 새 use-case로 대체).

가장 안전한 접근: **삭제하지 않고** export만 유지. 향후 PR에서 데드코드 정리. 지금은 callback에서만 import 제거하고 파일은 그대로 둔다.

- [ ] **Step 4: 빌드 + 동작 확인**

Run: `yarn build`
Expected: 빌드 통과

수동 검증:
- `/login`에서 `?error=oauth_consent_expired` 쿼리로 접속 → "가입 시간이 만료되었습니다..." 메시지 노출
- `/signup` 진입 → SocialLoginButtons 위에 안내 문구 노출

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx src/app/signup/page.tsx
git commit -m "feat(auth): add OAuth consent error messages and signup notice"
```

---

## Phase 8 — 배포 검증

### Task 29: E2E 동작 검증 + 배포 절차 문서화

**Files:** (변경 없음, 검증 단계)

- [ ] **Step 1: 로컬 통합 빌드**

```bash
yarn lint
yarn test
yarn build
```

Expected: 모두 통과

- [ ] **Step 2: dev 환경에서 흐름 검증**

Run: `yarn dev`

체크리스트:
- [ ] `/privacy` 페이지 본문 + TOC + 시행일 정상 노출
- [ ] `/terms` 페이지 빨간 박스 + 본문 정상 노출
- [ ] 이메일 회원가입: 이메일 → 코드 → details 진입
- [ ] details에서 동의 미체크로 제출 → 에러 메시지 노출, 가입 진행 안 됨
- [ ] details에서 동의 후 제출 → 가입 성공 → 자동 로그인 → next 이동
- [ ] DB: 새 사용자에 agreement 2 row 생성 확인
- [ ] OAuth 가입: Continue with Google → 신규 계정 → /signup/oauth/consent 도착
- [ ] consent 페이지: profile 카드(이메일/이름/provider) 노출
- [ ] consent 페이지에서 미동의 제출 → 에러
- [ ] consent 페이지에서 동의 + "가입 완료" → 가입 + 자동 로그인 + next 이동
- [ ] consent 페이지에서 "취소" → /login redirect
- [ ] OAuth 기존 사용자 로그인 → 동의 페이지 거치지 않고 바로 next (회귀)
- [ ] /signup → 홈 이동 → 뒤로가기 → 폼 1단계로 초기화
- [ ] /signup/oauth/consent → 홈 이동 → 뒤로가기 → 페이지 reload (token 유효하면 재표시, 만료면 /login)

- [ ] **Step 3: 운영 배포 시 실행 명령 명시 (배포자 인지용)**

배포 워크플로 또는 README에 다음 절차를 기록 (선택, 별도 PR도 가능):

```bash
# 배포 후 즉시
yarn db:migrate          # 스키마 적용
yarn db:seed:terms       # v1 시딩

# 검증
psql $DATABASE_URL -c "SELECT kind, version, effective_date FROM terms;"
```

- [ ] **Step 4: 최종 commit (이번 PR에서 변경 없으면 스킵)**

만약 검증 중 발견된 사소한 수정이 있으면:

```bash
git add <files>
git commit -m "fix: address e2e validation findings"
```

없으면 이 단계는 commit 없이 종료.

---

## 완료 체크

이 plan의 모든 Task가 완료되면:
- [ ] `terms`, `agreements` 테이블 생성 + privacy/tos v1 row 시딩
- [ ] `/privacy`, `/terms` 페이지가 DB 본문을 렌더링 (디자인 유지)
- [ ] 이메일 회원가입 폼에 동의 박스 추가, registerAction에 트랜잭션 + 동의 검증
- [ ] OAuth 신규 사용자가 consent 페이지 거쳐 가입, 기존 사용자는 즉시 로그인 (회귀)
- [ ] bfcache 처리로 SignupForm 1단계 reset, OAuthConsentForm reload
- [ ] 모든 신규 코드에 단위/통합 테스트
- [ ] 배포 절차 명확히 정의됨

---

## Self-Review Notes

이 plan은 다음 spec 요구사항을 모두 커버한다:

**§3 Schema:** Task 4
**§4 폴더 구조:** Task 1 (deps), Task 2 (migrate move), Task 3 (constants), Task 4 (schema), Task 5–7 (repositories + domain)
**§5 시드:** Tasks 8–10
**§6 페이지 렌더링:** Tasks 11–14
**§7 ConsentCheckboxGroup:** Tasks 15–17
**§8 회원가입 흐름:**
- 이메일: Tasks 18–21
- OAuth: Tasks 22–28

**§9 캐싱·bfcache:**
- /signup force-dynamic + pageshow → 기존 (변경 없음)
- /signup/oauth/consent force-dynamic + pageshow → Task 24, Task 25
- /privacy, /terms는 force-dynamic 미적용 (현 plan에서 `'use cache'` 명시는 안 함 — 향후 별도 PR로 도입 가능. 1차 구현은 RSC 기본 캐싱)

**§10 테스트:** 각 Task의 Step 1 (테스트 작성) + Step 4 (검증)
**§11 배포 순서:** Task 29
**§12 비스코프:** plan에 포함하지 않음 ✓

**Type 일관성:**
- `TermsKind`: Task 3에서 정의 → Tasks 5, 7, 8, 9, 12 등에서 사용 ✓
- `TermsRecord`: Task 5 → Task 13, 14, 24, 26 ✓
- `PendingOAuthSignup`: Task 22 → Task 23, 24, 26, 27 ✓
- `AgreementInsertInput`: Task 6 → Task 19, 26 ✓
- `agreedTermsIds`: Task 19 → Task 20 ✓

**Placeholder scan:** 명시적 TBD/TODO 없음. 단, Task 9 (tos 시드)는 본문 변환 작업이 길어 매핑 규칙만 제시 — 실행자는 실제 변환을 수행해야 함. 이는 placeholder가 아니라 분량 문제로 인한 위임이며, 변환 규칙은 명시되어 있음.

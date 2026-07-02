# 분석 결과 공유 기능 Implementation Plan (이슈 #367)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 `[symbol]/**` 탭에서 현재 탭의 AI 분석 결과를 스냅샷해 공개 `/share/[id]` 링크·SNS로 공유한다.

**Architecture:** client-supplied 스냅샷 — 각 탭 위젯이 `ShareableAnalysisContext`에 `{status, result, trigger}`를 등록하고, 헤더의 `ShareButton`이 이를 읽어 서버 액션(`createShareSnapshotAction`)으로 DB(`shared_analyses`)에 저장한다. core `filterAnalysisResult`는 쓰지 않는다(public 미노출·chart 전용). 티어 마스킹은 비범위.

**Tech Stack:** Next.js 16 (App Router, FSD), Drizzle ORM + Neon, vitest(globals, 90% threshold), Tailwind v4, 손수 만든 hooks(useDialog/usePopoverToggle/useCopyToClipboard), vaul, inline SVG. 신규 라이브러리 도입 금지.

**스펙:** `docs/superpowers/specs/2026-06-29-symbol-analysis-share-design.md` (R1~R3 검증 반영). 각 task 구현 전 해당 스펙 섹션을 읽을 것.

**작업 위치:** 워크트리 `../siglens-share-367`, 브랜치 `feat/367/분석-결과-공유`.

**핵심 컨벤션 (entities/CLAUDE.md):**
- `'use server'`는 `actions/<name>.ts` 개별 파일에만. `actions.ts` 배럴은 평범한 re-export. `'use server'` 파일은 async 함수만 export.
- `DrizzleXxxRepository`(schema/server-only import)는 entity `index.ts` 배럴에서 **제외** — 서버 소비자는 `@/entities/shared-analysis/api` 딥임포트.
- 커버리지 90%(statements/branches/functions/lines). 제외: `index.ts`, `types.ts`, `*.d.ts`, `actions/index.ts`, `app/**/page.tsx|opengraph-image.tsx`, `test-utils/**`. → repository·개별 action·lib 순수함수·hooks는 ≥90% 필요.
- vitest는 `globals:true` → `describe/it/expect/vi` import 불필요. node 프로젝트=`__tests__/**/*.test.ts`, dom=`*.test.tsx`.
- 단일 파일 테스트: `yarn test <path>`.
- 색상은 토큰만(하드코딩 hex 금지). 인터랙티브 요소는 `transition-colors` + `touch-manipulation`.

**커밋:** 각 task 끝에 커밋. 메시지는 `feat(share): ...` / `test(share): ...`. push·PR은 하지 않음(git-agent 담당).

---

## Phase 1 — DB 스키마 + 마이그레이션

### Task 1.1: shareableKind 상수 + enum

**Files:**
- Modify: `src/shared/db/constants.ts`

- [ ] **Step 1: kind 값 배열 추가** (`src/shared/db/constants.ts` 끝에)

```ts
export const SHAREABLE_KIND_VALUES = [
    'chart',
    'overall',
    'news',
    'fundamental',
    'financials',
    'congress',
    'options',
    'fear-greed',
] as const;
export type ShareableKind = (typeof SHAREABLE_KIND_VALUES)[number];
```

- [ ] **Step 2: 커밋**

```bash
git add src/shared/db/constants.ts
git commit -m "feat(share): add shareable kind constants"
```

### Task 1.2: shared_analyses 테이블

**Files:**
- Modify: `src/shared/db/schema.ts`

- [ ] **Step 1: import에 `SHAREABLE_KIND_VALUES` 추가** (constants import 블록)

```ts
import {
    LLM_PROVIDER_VALUES,
    OAUTH_PROVIDER_VALUES,
    SHAREABLE_KIND_VALUES,
    TERMS_KIND_VALUES,
    USAGE_ACTION_TYPE_VALUES,
    USER_TIER_VALUES,
} from './constants';
```

- [ ] **Step 2: enum + 테이블 정의 추가** (기존 pgEnum 블록 근처 + 테이블 영역)

```ts
export const shareableKindEnum = pgEnum('shareable_kind', SHAREABLE_KIND_VALUES);

const CONTENT_HASH_LENGTH = 64; // sha256 hex

export const sharedAnalyses = pgTable(
    'shared_analyses',
    {
        id: text('id').primaryKey(),
        userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
        kind: shareableKindEnum('kind').notNull(),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        contentHash: varchar('content_hash', { length: CONTENT_HASH_LENGTH }).notNull(),
        snapshotJson: jsonb('snapshot_json').notNull(),
        sharerTier: userTierEnum('sharer_tier').notNull().default('free'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    },
    table => [
        index('shared_analyses_symbol_idx').on(table.symbol),
        index('shared_analyses_expires_at_idx').on(table.expiresAt),
        uniqueIndex('shared_analyses_content_uq').on(table.contentHash),
    ]
);
```

- [ ] **Step 3: 마이그레이션 생성**

Run: `yarn db:generate`
Expected: `drizzle/0022_*.sql` 생성 + `drizzle/meta/_journal.json` 갱신. SQL에 `CREATE TYPE "shareable_kind"`, `CREATE TABLE "shared_analyses"`, 3개 인덱스 포함 확인.

- [ ] **Step 4: 마이그레이션 적용 (로컬 DB)**

Run: `yarn db:migrate`
Expected: 신규 마이그레이션 적용 성공(이미 적용 시 멱등 통과).

- [ ] **Step 5: 커밋**

```bash
git add src/shared/db/schema.ts drizzle/
git commit -m "feat(share): add shared_analyses table and shareable_kind enum"
```

---

## Phase 2 — entity 순수 로직 (`src/entities/shared-analysis/`)

> 스펙 §7, §8 참조. 모든 함수는 순수(시각·crypto는 주입/Node crypto). 테스트는 `__tests__/*.test.ts`.

### Task 2.1: 타입 정의

**Files:**
- Create: `src/entities/shared-analysis/types.ts`

- [ ] **Step 1: 타입 작성**

```ts
import type {
    AnalysisResponse,
    OverallAnalysisResponse,
    NewsAnalysisResponse,
    FundamentalAnalysisResponse,
    FinancialsAnalysisResponse,
    CongressTrendResponse,
    OptionsAnalysisResponse,
    FearGreedSnapshot,
    Tier,
} from '@y0ngha/siglens-core';
import type { ShareableKind } from '@/shared/db/constants';

export type { ShareableKind };

/** kind → 그 탭의 분석 결과 타입. */
export interface ShareResultMap {
    chart: AnalysisResponse;
    overall: OverallAnalysisResponse;
    news: NewsAnalysisResponse;
    fundamental: FundamentalAnalysisResponse;
    financials: FinancialsAnalysisResponse;
    congress: CongressTrendResponse;
    options: OptionsAnalysisResponse;
    'fear-greed': FearGreedSnapshot;
}
export type SnapshotResultOf<K extends ShareableKind> = ShareResultMap[K];

/** 스냅샷 표시에 필요한 부가 컨텍스트. */
export interface ShareContext {
    symbol: string;
    displayName: string;
    koreanName?: string;
    assetClass: string;
    analyzedAt?: string;
}

/** DB jsonb에 저장되는 스냅샷(직렬화 안전: Date 없음). */
export interface SharedAnalysisSnapshot<K extends ShareableKind = ShareableKind> {
    kind: K;
    symbol: string;
    context: ShareContext;
    result: SnapshotResultOf<K>;
}

/** createShareSnapshotAction 입력(클라 전달). */
export interface CreateShareInput<K extends ShareableKind = ShareableKind> {
    kind: K;
    symbol: string;
    context: ShareContext;
    result: SnapshotResultOf<K>;
    sharerTier: Tier;
    userId?: string;
}

/** 액션 결과. */
export type CreateShareResult =
    | { ok: true; id: string }
    | { ok: false; code: 'invalid_input' | 'rate_limited' | 'persist_failed' };

/** /share 조회 결과. */
export type SharedAnalysisLookup =
    | { status: 'found'; snapshot: SharedAnalysisSnapshot; createdAt: string }
    | { status: 'expired' }
    | { status: 'not_found' };
```

- [ ] **Step 2: 커밋**

```bash
git add src/entities/shared-analysis/types.ts
git commit -m "feat(share): add shared-analysis domain types"
```

### Task 2.2: generateShareId

**Files:**
- Create: `src/entities/shared-analysis/lib/generateShareId.ts`
- Test: `src/entities/shared-analysis/__tests__/generateShareId.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { generateShareId } from '@/entities/shared-analysis/lib/generateShareId';

const URL_SAFE = /^[A-Za-z0-9_-]+$/;

describe('generateShareId', () => {
    it('returns a url-safe base64url token', () => {
        expect(generateShareId()).toMatch(URL_SAFE);
    });
    it('returns a token of meaningful length (>= 16 chars)', () => {
        expect(generateShareId().length).toBeGreaterThanOrEqual(16);
    });
    it('returns different tokens on repeated calls', () => {
        expect(generateShareId()).not.toBe(generateShareId());
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/shared-analysis/__tests__/generateShareId.test.ts` → FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```ts
import { randomBytes } from 'node:crypto';

const SHARE_ID_BYTES = 16; // base64url 22자

/** URL 슬러그용 추측 불가 토큰. */
export function generateShareId(): string {
    return randomBytes(SHARE_ID_BYTES).toString('base64url');
}
```

- [ ] **Step 4: 통과 확인** — Run 위 명령 → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/entities/shared-analysis/lib/generateShareId.ts src/entities/shared-analysis/__tests__/generateShareId.test.ts
git commit -m "feat(share): add generateShareId"
```

### Task 2.3: isExpired

**Files:**
- Create: `src/entities/shared-analysis/lib/isExpired.ts`
- Test: `src/entities/shared-analysis/__tests__/isExpired.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
import { isExpired } from '@/entities/shared-analysis/lib/isExpired';

describe('isExpired', () => {
    const now = new Date('2026-06-29T00:00:00Z');
    it('returns false when expiresAt is in the future', () => {
        expect(isExpired(new Date('2026-06-30T00:00:00Z'), now)).toBe(false);
    });
    it('returns true when expiresAt is in the past', () => {
        expect(isExpired(new Date('2026-06-28T00:00:00Z'), now)).toBe(true);
    });
    it('returns true at the exact boundary', () => {
        expect(isExpired(new Date('2026-06-29T00:00:00Z'), now)).toBe(true);
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/shared-analysis/__tests__/isExpired.test.ts` → FAIL

- [ ] **Step 3: 구현**

```ts
/** expiresAt <= now 이면 만료. */
export function isExpired(expiresAt: Date, now: Date): boolean {
    return expiresAt.getTime() <= now.getTime();
}
```

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/entities/shared-analysis/lib/isExpired.ts src/entities/shared-analysis/__tests__/isExpired.test.ts
git commit -m "feat(share): add isExpired"
```

### Task 2.4: contentHash

**Files:**
- Create: `src/entities/shared-analysis/lib/contentHash.ts`
- Test: `src/entities/shared-analysis/__tests__/contentHash.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
import { contentHash } from '@/entities/shared-analysis/lib/contentHash';

const SHA256_HEX = /^[0-9a-f]{64}$/;

describe('contentHash', () => {
    it('returns a sha256 hex digest', () => {
        expect(contentHash('chart', 'AAPL', { a: 1 })).toMatch(SHA256_HEX);
    });
    it('is stable for the same inputs', () => {
        expect(contentHash('chart', 'AAPL', { a: 1 })).toBe(contentHash('chart', 'AAPL', { a: 1 }));
    });
    it('differs when kind differs', () => {
        expect(contentHash('chart', 'AAPL', { a: 1 })).not.toBe(contentHash('news', 'AAPL', { a: 1 }));
    });
    it('differs when result differs', () => {
        expect(contentHash('chart', 'AAPL', { a: 1 })).not.toBe(contentHash('chart', 'AAPL', { a: 2 }));
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/shared-analysis/__tests__/contentHash.test.ts` → FAIL

- [ ] **Step 3: 구현**

```ts
import { createHash } from 'node:crypto';

/** kind+symbol+result로 dedupe용 안정 해시 생성. */
export function contentHash(kind: string, symbol: string, result: unknown): string {
    const payload = JSON.stringify({ kind, symbol: symbol.toUpperCase(), result });
    return createHash('sha256').update(payload).digest('hex');
}
```

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/entities/shared-analysis/lib/contentHash.ts src/entities/shared-analysis/__tests__/contentHash.test.ts
git commit -m "feat(share): add contentHash"
```

### Task 2.5: buildShareSnapshot (직렬화 안전 보장)

**Files:**
- Create: `src/entities/shared-analysis/lib/buildShareSnapshot.ts`
- Test: `src/entities/shared-analysis/__tests__/buildShareSnapshot.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
import { buildShareSnapshot } from '@/entities/shared-analysis/lib/buildShareSnapshot';
import type { CreateShareInput } from '@/entities/shared-analysis/types';

const input = {
    kind: 'chart',
    symbol: 'aapl',
    context: { symbol: 'AAPL', displayName: 'Apple', assetClass: 'us_equity', analyzedAt: '2026-06-29T00:00:00Z' },
    result: { trend: 'bullish', summary: '요약' },
    sharerTier: 'free',
} as unknown as CreateShareInput;

describe('buildShareSnapshot', () => {
    it('builds a snapshot with uppercased symbol', () => {
        const snap = buildShareSnapshot(input);
        expect(snap.symbol).toBe('AAPL');
        expect(snap.kind).toBe('chart');
        expect(snap.result).toEqual({ trend: 'bullish', summary: '요약' });
    });
    it('produces a JSON-stable object (no Date/undefined/functions)', () => {
        const snap = buildShareSnapshot(input);
        expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/shared-analysis/__tests__/buildShareSnapshot.test.ts` → FAIL

- [ ] **Step 3: 구현**

```ts
import type { CreateShareInput, SharedAnalysisSnapshot, ShareableKind } from '../types';

/**
 * 클라 입력을 DB 저장용 스냅샷으로 변환한다.
 * JSON.stringify→parse 라운드트립으로 Date/undefined/함수를 제거해 jsonb 직렬화 안전성을 보장한다.
 */
export function buildShareSnapshot<K extends ShareableKind>(
    input: CreateShareInput<K>
): SharedAnalysisSnapshot<K> {
    const snapshot: SharedAnalysisSnapshot<K> = {
        kind: input.kind,
        symbol: input.symbol.toUpperCase(),
        context: { ...input.context, symbol: input.symbol.toUpperCase() },
        result: input.result,
    };
    return JSON.parse(JSON.stringify(snapshot)) as SharedAnalysisSnapshot<K>;
}
```

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/entities/shared-analysis/lib/buildShareSnapshot.ts src/entities/shared-analysis/__tests__/buildShareSnapshot.test.ts
git commit -m "feat(share): add buildShareSnapshot"
```

### Task 2.6: parseSnapshot (DB row → 타입 경계)

**Files:**
- Create: `src/entities/shared-analysis/lib/parseSnapshot.ts`
- Test: `src/entities/shared-analysis/__tests__/parseSnapshot.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
import { parseSnapshot } from '@/entities/shared-analysis/lib/parseSnapshot';

describe('parseSnapshot', () => {
    const valid = { kind: 'chart', symbol: 'AAPL', context: { symbol: 'AAPL', displayName: 'Apple', assetClass: 'us_equity' }, result: { trend: 'bullish' } };
    it('returns the snapshot for a valid shape', () => {
        expect(parseSnapshot(valid)).toEqual(valid);
    });
    it('returns null when kind is missing', () => {
        expect(parseSnapshot({ symbol: 'AAPL', context: {}, result: {} })).toBeNull();
    });
    it('returns null when kind is not a shareable kind', () => {
        expect(parseSnapshot({ ...valid, kind: 'bogus' })).toBeNull();
    });
    it('returns null for non-object input', () => {
        expect(parseSnapshot(null)).toBeNull();
        expect(parseSnapshot('x')).toBeNull();
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/shared-analysis/__tests__/parseSnapshot.test.ts` → FAIL

- [ ] **Step 3: 구현**

```ts
import { SHAREABLE_KIND_VALUES } from '@/shared/db/constants';
import type { SharedAnalysisSnapshot } from '../types';

function isShareableKind(v: unknown): v is SharedAnalysisSnapshot['kind'] {
    return typeof v === 'string' && (SHAREABLE_KIND_VALUES as readonly string[]).includes(v);
}

/** jsonb로 저장된 스냅샷을 검증하고 타입을 좁힌다. 형태 불일치면 null. */
export function parseSnapshot(raw: unknown): SharedAnalysisSnapshot | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const obj = raw as Record<string, unknown>;
    if (!isShareableKind(obj.kind)) return null;
    if (typeof obj.symbol !== 'string') return null;
    if (typeof obj.context !== 'object' || obj.context === null) return null;
    if (typeof obj.result !== 'object' || obj.result === null) return null;
    return obj as unknown as SharedAnalysisSnapshot;
}
```

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/entities/shared-analysis/lib/parseSnapshot.ts src/entities/shared-analysis/__tests__/parseSnapshot.test.ts
git commit -m "feat(share): add parseSnapshot"
```

---

## Phase 3 — kind 서버 레지스트리 (`server/kindServerRegistry.ts`)

> 스펙 §6-1, §6-3. kind별 입력 검증 + OG 텍스트(방향성/요약). overall·options는 top-level direction 없음 → scenarios/tone에서 도출.

### Task 3.1: ShareableKind 단일 소스 exhaustiveness 가드

**Files:**
- Create: `src/entities/shared-analysis/lib/assertExhaustiveKinds.ts`
- Test: `src/entities/shared-analysis/__tests__/kindExhaustiveness.test.ts`

- [ ] **Step 1: 실패 테스트** (TABS와 enum 정합)

```ts
import { SHAREABLE_KIND_VALUES } from '@/shared/db/constants';
import { TABS } from '@/views/symbol/utils/symbolTabsConfig';

describe('shareable kind exhaustiveness', () => {
    it('every shareable kind maps to a known tab key', () => {
        const tabKeys = new Set(TABS.map(t => t.key));
        for (const kind of SHAREABLE_KIND_VALUES) {
            expect(tabKeys.has(kind)).toBe(true);
        }
    });
});
```

> 참고: `TABS`의 export 위치/형태는 `src/views/symbol/utils/symbolTabsConfig.ts`에서 확인(키: chart/news/fundamental/financials/congress/options/fear-greed/overall). import 경로가 다르면 실제 경로로 교정.

- [ ] **Step 2: 실패 확인 후 통과** — enum이 TABS와 정합하므로 통과해야 함. 실패 시 enum/TABS 불일치를 수정.

- [ ] **Step 3: 커밋**

```bash
git add src/entities/shared-analysis/__tests__/kindExhaustiveness.test.ts
git commit -m "test(share): assert shareable kinds align with symbol tabs"
```

### Task 3.2: buildOgText (kind별)

**Files:**
- Create: `src/entities/shared-analysis/server/buildOgText.ts`
- Test: `src/entities/shared-analysis/__tests__/buildOgText.test.ts`

스펙 §6-1 표의 필드 매핑을 그대로 구현. 반환 `{ description, tweet }`. `tweet`은 길이 클램프(URL 별도 추가될 것이므로 텍스트는 충분히 짧게, 상수 `TWEET_TEXT_MAX = 180`).

- [ ] **Step 1: 실패 테스트**

```ts
import { buildOgText } from '@/entities/shared-analysis/server/buildOgText';
import type { SharedAnalysisSnapshot } from '@/entities/shared-analysis/types';

function snap(kind: string, result: unknown): SharedAnalysisSnapshot {
    return { kind, symbol: 'AAPL', context: { symbol: 'AAPL', displayName: 'Apple', assetClass: 'us_equity' }, result } as unknown as SharedAnalysisSnapshot;
}

describe('buildOgText', () => {
    it('chart: uses trend + summary first line', () => {
        const out = buildOgText(snap('chart', { trend: 'bullish', summary: '상승 추세\n둘째 줄' }));
        expect(out.description).toContain('상승');
        expect(out.description).not.toContain('둘째 줄');
    });
    it('news: uses overallSentiment + currentDriverKo', () => {
        const out = buildOgText(snap('news', { overallSentiment: 'bearish', currentDriverKo: '악재 지속' }));
        expect(out.description).toContain('악재 지속');
    });
    it('fear-greed: uses label + score', () => {
        const out = buildOgText(snap('fear-greed', { label: 'EXTREME_FEAR', score: 12 }));
        expect(out.description).toContain('12');
    });
    it('overall: derives direction from scenarios when no top-level field', () => {
        const out = buildOgText(snap('overall', { headlineKo: '혼조세 전망', scenarios: [{ name: 'bearish' }, { name: 'bearish' }, { name: 'bullish' }] }));
        expect(out.description).toContain('혼조세 전망');
    });
    it('options: derives from tone/signals + summary', () => {
        const out = buildOgText(snap('options', { summary: '콜 우위', signals: [{ kind: 'bullish' }] }));
        expect(out.description).toContain('콜 우위');
    });
    it('clamps tweet text to the max length', () => {
        const long = 'x'.repeat(500);
        const out = buildOgText(snap('chart', { trend: 'neutral', summary: long }));
        expect(out.tweet.length).toBeLessThanOrEqual(180);
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/shared-analysis/__tests__/buildOgText.test.ts` → FAIL

- [ ] **Step 3: 구현** (각 kind 분기 + direction 한글 라벨 매핑 + 클램프)

```ts
import type { SharedAnalysisSnapshot, ShareableKind } from '../types';

const TWEET_TEXT_MAX = 180;

const DIRECTION_KO: Record<string, string> = {
    bullish: '강세',
    bearish: '약세',
    neutral: '중립',
    cautious: '주의',
};

function firstLine(text: string): string {
    return text.split('\n')[0]?.trim() ?? '';
}

function clamp(text: string, max: number): string {
    return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function majorityName(scenarios: ReadonlyArray<{ name?: string }> | undefined): string {
    if (!scenarios?.length) return 'neutral';
    const counts = new Map<string, number>();
    for (const s of scenarios) {
        if (s.name) counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
    }
    let best = 'neutral';
    let bestN = -1;
    for (const [name, n] of counts) {
        if (n > bestN) { best = name; bestN = n; }
    }
    return best;
}

interface OgText {
    description: string;
    tweet: string;
}

/** kind별 방향성+요약 텍스트. 스펙 §6-1 필드 매핑. */
export function buildOgText(snapshot: SharedAnalysisSnapshot): OgText {
    const r = snapshot.result as Record<string, unknown>;
    let direction = 'neutral';
    let summary = '';

    const kind = snapshot.kind as ShareableKind;
    switch (kind) {
        case 'chart':
            direction = String(r.trend ?? 'neutral');
            summary = firstLine(String(r.summary ?? ''));
            break;
        case 'overall':
            direction = majorityName(r.scenarios as { name?: string }[] | undefined);
            summary = firstLine(String(r.headlineKo ?? r.integratedConclusionKo ?? ''));
            break;
        case 'news':
            direction = String(r.overallSentiment ?? 'neutral');
            summary = firstLine(String(r.currentDriverKo ?? ''));
            break;
        case 'fundamental':
            direction = String(r.overallSentiment ?? 'neutral');
            summary = firstLine(String(r.overallConclusionKo ?? ''));
            break;
        case 'financials':
            direction = String(r.overallSentiment ?? 'neutral');
            summary = firstLine(String(r.overallConclusionKo ?? ''));
            break;
        case 'congress':
            direction = String(r.overallSentiment ?? 'neutral');
            summary = firstLine(String(r.summaryKo ?? ''));
            break;
        case 'options': {
            const signals = (r.signals as { kind?: string }[] | undefined) ?? [];
            direction = signals[0]?.kind ?? String(r.tone ?? 'neutral');
            summary = firstLine(String(r.summary ?? ''));
            break;
        }
        case 'fear-greed':
            direction = String(r.label ?? 'NEUTRAL');
            summary = `공포·탐욕 지수 ${String(r.score ?? '')}`;
            break;
    }

    const dirKo = DIRECTION_KO[direction] ?? direction;
    const description = clamp(summary ? `${dirKo} · ${summary}` : dirKo, 200);
    const tweet = clamp(`${snapshot.symbol} ${dirKo} — ${summary}`, TWEET_TEXT_MAX);
    return { description, tweet };
}
```

> 구현 시 각 `*AnalysisResponse`의 실제 필드명을 스펙 §6-1 표로 재확인. `fear-greed`의 `label`/`score`, `overall`의 `scenarios[].name`은 R3 실측 확인됨.

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/entities/shared-analysis/server/buildOgText.ts src/entities/shared-analysis/__tests__/buildOgText.test.ts
git commit -m "feat(share): add per-kind buildOgText"
```

### Task 3.3: assertValidInput (kind별 형태 검증)

**Files:**
- Create: `src/entities/shared-analysis/server/assertValidInput.ts`
- Test: `src/entities/shared-analysis/__tests__/assertValidInput.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
import { isValidShareInput } from '@/entities/shared-analysis/server/assertValidInput';

describe('isValidShareInput', () => {
    it('accepts a well-formed chart input', () => {
        expect(isValidShareInput({ kind: 'chart', symbol: 'AAPL', context: { symbol: 'AAPL', displayName: 'Apple', assetClass: 'us_equity' }, result: { trend: 'bullish', summary: 'x' }, sharerTier: 'free' })).toBe(true);
    });
    it('rejects unknown kind', () => {
        expect(isValidShareInput({ kind: 'bogus', symbol: 'AAPL', context: {}, result: {}, sharerTier: 'free' })).toBe(false);
    });
    it('rejects missing symbol', () => {
        expect(isValidShareInput({ kind: 'chart', context: {}, result: {}, sharerTier: 'free' })).toBe(false);
    });
    it('rejects missing result object', () => {
        expect(isValidShareInput({ kind: 'chart', symbol: 'AAPL', context: { symbol: 'AAPL', displayName: 'A', assetClass: 'x' }, result: null, sharerTier: 'free' })).toBe(false);
    });
    it('rejects invalid tier', () => {
        expect(isValidShareInput({ kind: 'chart', symbol: 'AAPL', context: { symbol: 'AAPL', displayName: 'A', assetClass: 'x' }, result: {}, sharerTier: 'enterprise' })).toBe(false);
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/shared-analysis/__tests__/assertValidInput.test.ts` → FAIL

- [ ] **Step 3: 구현**

```ts
import { SHAREABLE_KIND_VALUES, USER_TIER_VALUES } from '@/shared/db/constants';
import type { CreateShareInput } from '../types';

function isNonEmptyString(v: unknown): v is string {
    return typeof v === 'string' && v.length > 0;
}

/** 클라가 전달한 공유 입력의 형태를 검증한다(내용 신뢰 X, 형태만). */
export function isValidShareInput(raw: unknown): raw is CreateShareInput {
    if (typeof raw !== 'object' || raw === null) return false;
    const o = raw as Record<string, unknown>;
    if (!(SHAREABLE_KIND_VALUES as readonly string[]).includes(o.kind as string)) return false;
    if (!isNonEmptyString(o.symbol)) return false;
    if (typeof o.context !== 'object' || o.context === null) return false;
    const ctx = o.context as Record<string, unknown>;
    if (!isNonEmptyString(ctx.displayName) || !isNonEmptyString(ctx.assetClass)) return false;
    if (typeof o.result !== 'object' || o.result === null) return false;
    if (!(USER_TIER_VALUES as readonly string[]).includes(o.sharerTier as string)) return false;
    return true;
}
```

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/entities/shared-analysis/server/assertValidInput.ts src/entities/shared-analysis/__tests__/assertValidInput.test.ts
git commit -m "feat(share): add isValidShareInput"
```

---

## Phase 4 — repository (`api.ts`)

> 스펙 §8. server-only. dedupe upsert + 만료 7일 갱신. 배럴 제외(서버 딥임포트).

### Task 4.1: DrizzleSharedAnalysisRepository

**Files:**
- Create: `src/entities/shared-analysis/api.ts`
- Test: `src/entities/shared-analysis/__tests__/api.test.ts`

- [ ] **Step 1: 실패 테스트** (fake db 빌더 체인 — §5 패턴)

```ts
import type { Mock } from 'vitest';
import type { SiglensDatabase } from '@/shared/db/types';
import { DrizzleSharedAnalysisRepository } from '@/entities/shared-analysis/api';
import type { SharedAnalysisSnapshot } from '@/entities/shared-analysis/types';

const snapshot = { kind: 'chart', symbol: 'AAPL', context: { symbol: 'AAPL', displayName: 'Apple', assetClass: 'us_equity' }, result: { trend: 'bullish' } } as unknown as SharedAnalysisSnapshot;

function makeUpsertDb(returnedId: string): { db: SiglensDatabase; values: Mock } {
    const returning = vi.fn().mockResolvedValue([{ id: returnedId }]);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    return { db: { insert } as unknown as SiglensDatabase, values };
}

function makeSelectDb(rows: unknown[]): SiglensDatabase {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return { select } as unknown as SiglensDatabase;
}

describe('DrizzleSharedAnalysisRepository', () => {
    describe('create', () => {
        it('inserts and returns the id', async () => {
            const { db } = makeUpsertDb('abc123');
            const repo = new DrizzleSharedAnalysisRepository(db);
            const id = await repo.create({ id: 'abc123', kind: 'chart', symbol: 'AAPL', contentHash: 'h', snapshot, sharerTier: 'free', userId: null, expiresAt: new Date('2026-07-06T00:00:00Z') });
            expect(id).toBe('abc123');
        });
    });
    describe('findById', () => {
        it('returns the row when present', async () => {
            const db = makeSelectDb([{ snapshotJson: snapshot, createdAt: new Date(), expiresAt: new Date('2026-07-06T00:00:00Z') }]);
            const repo = new DrizzleSharedAnalysisRepository(db);
            const row = await repo.findById('abc123');
            expect(row).not.toBeNull();
        });
        it('returns null when absent', async () => {
            const repo = new DrizzleSharedAnalysisRepository(makeSelectDb([]));
            expect(await repo.findById('nope')).toBeNull();
        });
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/shared-analysis/__tests__/api.test.ts` → FAIL

- [ ] **Step 3: 구현**

```ts
import { eq, sql } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { sharedAnalyses } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import type { SharedAnalysisSnapshot } from './types';
import type { Tier } from '@y0ngha/siglens-core';

export interface SharedAnalysisRow {
    snapshotJson: unknown;
    createdAt: Date;
    expiresAt: Date;
}

export interface CreateRecord {
    id: string;
    kind: SharedAnalysisSnapshot['kind'];
    symbol: string;
    contentHash: string;
    snapshot: SharedAnalysisSnapshot;
    sharerTier: Tier;
    userId: string | null;
    expiresAt: Date;
}

export interface SharedAnalysisRepository {
    create(record: CreateRecord): Promise<string>;
    findById(id: string): Promise<SharedAnalysisRow | null>;
}

export class DrizzleSharedAnalysisRepository implements SharedAnalysisRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /** content_hash 충돌 시 기존 id 반환 + 만료 7일 갱신(단일 statement). */
    async create(record: CreateRecord): Promise<string> {
        const [row] = await withRetry(
            () =>
                this.db
                    .insert(sharedAnalyses)
                    .values({
                        id: record.id,
                        userId: record.userId,
                        kind: record.kind,
                        symbol: record.symbol,
                        contentHash: record.contentHash,
                        snapshotJson: record.snapshot,
                        sharerTier: record.sharerTier,
                        expiresAt: record.expiresAt,
                    })
                    .onConflictDoUpdate({
                        target: sharedAnalyses.contentHash,
                        set: { expiresAt: record.expiresAt },
                    })
                    .returning({ id: sharedAnalyses.id }),
            NEON_TRANSIENT_RETRY
        );
        return row!.id;
    }

    async findById(id: string): Promise<SharedAnalysisRow | null> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        snapshotJson: sharedAnalyses.snapshotJson,
                        createdAt: sharedAnalyses.createdAt,
                        expiresAt: sharedAnalyses.expiresAt,
                    })
                    .from(sharedAnalyses)
                    .where(eq(sharedAnalyses.id, id))
                    .limit(1),
            NEON_TRANSIENT_RETRY
        );
        return rows[0] ?? null;
    }
}
```

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/entities/shared-analysis/api.ts src/entities/shared-analysis/__tests__/api.test.ts
git commit -m "feat(share): add DrizzleSharedAnalysisRepository"
```

---

## Phase 5 — server actions

> 스펙 §4, §7, §8, §11. rate limit + dedupe. `'use server'` 파일은 async 함수만 export.

### Task 5.1: rate limit 헬퍼

**Files:**
- Create: `src/entities/shared-analysis/server/rateLimit.ts`
- Test: `src/entities/shared-analysis/__tests__/rateLimit.test.ts`

스펙 §7: Redis INCR 우선, 미설정 시 통과(graceful). `getRedisReaderWriter()`가 null이면 허용.

- [ ] **Step 1: 실패 테스트** (Redis 모킹)

```ts
const { mockGetRedis } = vi.hoisted(() => ({ mockGetRedis: vi.fn() }));
vi.mock('@/shared/cache/redisClient', () => ({ getRedisReaderWriter: mockGetRedis }));

import { checkShareRateLimit } from '@/entities/shared-analysis/server/rateLimit';

describe('checkShareRateLimit', () => {
    beforeEach(() => vi.clearAllMocks());
    it('allows when redis is unavailable (graceful)', async () => {
        mockGetRedis.mockReturnValue(null);
        expect(await checkShareRateLimit('ipHashA')).toBe(true);
    });
    it('allows under the limit', async () => {
        mockGetRedis.mockReturnValue({ incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1) });
        expect(await checkShareRateLimit('ipHashA')).toBe(true);
    });
    it('blocks over the limit', async () => {
        mockGetRedis.mockReturnValue({ incr: vi.fn().mockResolvedValue(999), expire: vi.fn().mockResolvedValue(1) });
        expect(await checkShareRateLimit('ipHashA')).toBe(false);
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/shared-analysis/__tests__/rateLimit.test.ts` → FAIL

> 참고: `getRedisReaderWriter`의 실제 반환 인터페이스(incr/expire 메서드명)는 `src/shared/cache/redisClient.ts`에서 확인해 교정. null 반환 가능(env 미설정).

- [ ] **Step 3: 구현**

```ts
import { getRedisReaderWriter } from '@/shared/cache/redisClient';

const SHARE_LIMIT_PER_HOUR = 30;
const WINDOW_SECONDS = 3600;

/** IP 해시당 시간당 공유 생성 횟수 제한. Redis 미설정 시 통과. */
export async function checkShareRateLimit(ipHash: string): Promise<boolean> {
    const redis = getRedisReaderWriter();
    if (!redis) return true;
    const key = `share:rl:${ipHash}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW_SECONDS);
    return count <= SHARE_LIMIT_PER_HOUR;
}
```

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/entities/shared-analysis/server/rateLimit.ts src/entities/shared-analysis/__tests__/rateLimit.test.ts
git commit -m "feat(share): add share rate limit helper"
```

### Task 5.2: createShareSnapshotAction

**Files:**
- Create: `src/entities/shared-analysis/actions/createShareSnapshotAction.ts`
- Test: `src/entities/shared-analysis/__tests__/createShareSnapshotAction.test.ts`

- [ ] **Step 1: 실패 테스트** (§5 action 모킹 패턴)

```ts
const { mockCreate, mockRateLimit, mockGetClientIp } = vi.hoisted(() => ({
    mockCreate: vi.fn(),
    mockRateLimit: vi.fn(),
    mockGetClientIp: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({ getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })) }));
vi.mock('@/entities/shared-analysis/api', () => ({
    DrizzleSharedAnalysisRepository: vi.fn().mockImplementation(() => ({ create: mockCreate })),
}));
vi.mock('@/entities/shared-analysis/server/rateLimit', () => ({ checkShareRateLimit: mockRateLimit }));
vi.mock('@/entities/chat-message/api/getClientIp', () => ({ getClientIp: mockGetClientIp }));
vi.mock('@y0ngha/siglens-core', async (orig) => ({ ...(await orig()), hashUsageIp: vi.fn(() => 'ipHashX') }));

import { createShareSnapshotAction } from '../actions/createShareSnapshotAction';

const validInput = { kind: 'chart', symbol: 'AAPL', context: { symbol: 'AAPL', displayName: 'Apple', assetClass: 'us_equity' }, result: { trend: 'bullish', summary: 'x' }, sharerTier: 'free' };

describe('createShareSnapshotAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRateLimit.mockResolvedValue(true);
        mockGetClientIp.mockResolvedValue('1.2.3.4');
        mockCreate.mockResolvedValue('id123');
    });
    it('returns ok with id on success', async () => {
        const res = await createShareSnapshotAction(validInput);
        expect(res).toEqual({ ok: true, id: 'id123' });
    });
    it('rejects invalid input', async () => {
        const res = await createShareSnapshotAction({ kind: 'bogus' });
        expect(res).toEqual({ ok: false, code: 'invalid_input' });
    });
    it('blocks when rate limited', async () => {
        mockRateLimit.mockResolvedValue(false);
        const res = await createShareSnapshotAction(validInput);
        expect(res).toEqual({ ok: false, code: 'rate_limited' });
    });
    it('returns persist_failed when repo throws', async () => {
        mockCreate.mockRejectedValue(new Error('db down'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = await createShareSnapshotAction(validInput);
        expect(res).toEqual({ ok: false, code: 'persist_failed' });
        spy.mockRestore();
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/shared-analysis/__tests__/createShareSnapshotAction.test.ts` → FAIL

- [ ] **Step 3: 구현**

```ts
'use server';

import { hashUsageIp } from '@y0ngha/siglens-core';
import { getDatabaseClient } from '@/shared/db/client';
import { getClientIp } from '@/entities/chat-message/api/getClientIp';
import { DrizzleSharedAnalysisRepository } from '../api';
import { isValidShareInput } from '../server/assertValidInput';
import { checkShareRateLimit } from '../server/rateLimit';
import { buildShareSnapshot } from '../lib/buildShareSnapshot';
import { contentHash } from '../lib/contentHash';
import { generateShareId } from '../lib/generateShareId';
import type { CreateShareResult } from '../types';

const SHARE_TTL_DAYS = 7;

export async function createShareSnapshotAction(rawInput: unknown): Promise<CreateShareResult> {
    if (!isValidShareInput(rawInput)) {
        return { ok: false, code: 'invalid_input' };
    }
    const input = rawInput;

    const now = new Date();
    const ip = await getClientIp();
    const ipHash = hashUsageIp(ip, now);
    if (!(await checkShareRateLimit(ipHash))) {
        return { ok: false, code: 'rate_limited' };
    }

    try {
        const snapshot = buildShareSnapshot(input);
        const expiresAt = new Date(now.getTime() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000);
        const { db } = getDatabaseClient();
        const repo = new DrizzleSharedAnalysisRepository(db);
        const id = await repo.create({
            id: generateShareId(),
            kind: snapshot.kind,
            symbol: snapshot.symbol,
            contentHash: contentHash(snapshot.kind, snapshot.symbol, snapshot.result),
            snapshot,
            sharerTier: input.sharerTier,
            userId: input.userId ?? null,
            expiresAt,
        });
        return { ok: true, id };
    } catch (error) {
        console.error('[createShareSnapshotAction] Failed to persist share snapshot', error);
        return { ok: false, code: 'persist_failed' };
    }
}
```

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/entities/shared-analysis/actions/createShareSnapshotAction.ts src/entities/shared-analysis/__tests__/createShareSnapshotAction.test.ts
git commit -m "feat(share): add createShareSnapshotAction"
```

### Task 5.3: getSharedAnalysisAction

**Files:**
- Create: `src/entities/shared-analysis/actions/getSharedAnalysisAction.ts`
- Test: `src/entities/shared-analysis/__tests__/getSharedAnalysisAction.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
const { mockFindById } = vi.hoisted(() => ({ mockFindById: vi.fn() }));
vi.mock('@/shared/db/client', () => ({ getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })) }));
vi.mock('@/entities/shared-analysis/api', () => ({
    DrizzleSharedAnalysisRepository: vi.fn().mockImplementation(() => ({ findById: mockFindById })),
}));

import { getSharedAnalysis } from '../actions/getSharedAnalysisAction';

const snap = { kind: 'chart', symbol: 'AAPL', context: { symbol: 'AAPL', displayName: 'Apple', assetClass: 'us_equity' }, result: { trend: 'bullish' } };

describe('getSharedAnalysis', () => {
    beforeEach(() => vi.clearAllMocks());
    it('returns found for a live snapshot', async () => {
        mockFindById.mockResolvedValue({ snapshotJson: snap, createdAt: new Date('2026-06-29T00:00:00Z'), expiresAt: new Date('2999-01-01T00:00:00Z') });
        const res = await getSharedAnalysis('id1');
        expect(res.status).toBe('found');
    });
    it('returns expired when past expiresAt', async () => {
        mockFindById.mockResolvedValue({ snapshotJson: snap, createdAt: new Date('2020-01-01T00:00:00Z'), expiresAt: new Date('2020-01-08T00:00:00Z') });
        const res = await getSharedAnalysis('id1');
        expect(res.status).toBe('expired');
    });
    it('returns not_found when missing', async () => {
        mockFindById.mockResolvedValue(null);
        expect((await getSharedAnalysis('id1')).status).toBe('not_found');
    });
    it('returns not_found when snapshot shape is invalid', async () => {
        mockFindById.mockResolvedValue({ snapshotJson: { bogus: true }, createdAt: new Date(), expiresAt: new Date('2999-01-01T00:00:00Z') });
        expect((await getSharedAnalysis('id1')).status).toBe('not_found');
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/shared-analysis/__tests__/getSharedAnalysisAction.test.ts` → FAIL

- [ ] **Step 3: 구현**

```ts
'use server';

import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleSharedAnalysisRepository } from '../api';
import { parseSnapshot } from '../lib/parseSnapshot';
import { isExpired } from '../lib/isExpired';
import type { SharedAnalysisLookup } from '../types';

export async function getSharedAnalysis(id: string): Promise<SharedAnalysisLookup> {
    const { db } = getDatabaseClient();
    const repo = new DrizzleSharedAnalysisRepository(db);
    const row = await repo.findById(id);
    if (!row) return { status: 'not_found' };
    if (isExpired(row.expiresAt, new Date())) return { status: 'expired' };
    const snapshot = parseSnapshot(row.snapshotJson);
    if (!snapshot) return { status: 'not_found' };
    return { status: 'found', snapshot, createdAt: row.createdAt.toISOString() };
}
```

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/entities/shared-analysis/actions/getSharedAnalysisAction.ts src/entities/shared-analysis/__tests__/getSharedAnalysisAction.test.ts
git commit -m "feat(share): add getSharedAnalysis lookup"
```

### Task 5.4: entity 배럴

**Files:**
- Create: `src/entities/shared-analysis/index.ts`

- [ ] **Step 1: 배럴 작성** (Drizzle 클래스·server 모듈 제외 — §6 컨벤션)

```ts
// DrizzleSharedAnalysisRepository / server·actions 모듈은 barrel에서 제외(server-only).
// 서버 소비자는 @/entities/shared-analysis/api, /actions/<name> 딥임포트.
export type {
    ShareableKind,
    ShareContext,
    SharedAnalysisSnapshot,
    SnapshotResultOf,
    CreateShareInput,
    CreateShareResult,
    SharedAnalysisLookup,
} from './types';
```

- [ ] **Step 2: 전체 Phase 1–5 테스트 통과 확인**

Run: `yarn test src/entities/shared-analysis/`
Expected: 모든 테스트 PASS.

- [ ] **Step 3: 커밋**

```bash
git add src/entities/shared-analysis/index.ts
git commit -m "feat(share): add shared-analysis barrel"
```

---

## Phase 6 — ShareableAnalysisContext (`src/features/share/`)

> 스펙 §5-1. 각 탭 위젯이 자기 분석 상태를 헤더에 등록. context는 features에 두어 widgets·views 양쪽이 import 가능.

### Task 6.1: context + provider + hooks

**Files:**
- Create: `src/features/share/model/ShareableAnalysisContext.tsx`
- Create: `src/features/share/index.ts`
- Test: `src/features/share/__tests__/ShareableAnalysisContext.test.tsx`

- [ ] **Step 1: 실패 테스트** (register → useShareable 반영, 언마운트 시 해제)

```tsx
import { render, screen, act } from '@testing-library/react';
import { ShareableAnalysisProvider, useShareable, useRegisterShareable } from '@/features/share';
import type { ShareableRegistration } from '@/features/share/model/ShareableAnalysisContext';

function Reader() {
    const reg = useShareable();
    return <div data-testid="status">{reg ? reg.status : 'none'}</div>;
}
function Registrar({ reg }: { reg: ShareableRegistration }) {
    useRegisterShareable(reg);
    return null;
}
const baseReg = { kind: 'chart', status: 'success', result: { trend: 'bullish' }, context: { symbol: 'AAPL', displayName: 'Apple', assetClass: 'us_equity' }, trigger: () => {} } as unknown as ShareableRegistration;

describe('ShareableAnalysisContext', () => {
    it('exposes the registered value via useShareable', () => {
        render(<ShareableAnalysisProvider><Registrar reg={baseReg} /><Reader /></ShareableAnalysisProvider>);
        expect(screen.getByTestId('status').textContent).toBe('success');
    });
    it('returns null when nothing registered', () => {
        render(<ShareableAnalysisProvider><Reader /></ShareableAnalysisProvider>);
        expect(screen.getByTestId('status').textContent).toBe('none');
    });
    it('clears registration on unmount', () => {
        const { rerender } = render(<ShareableAnalysisProvider><Registrar reg={baseReg} /><Reader /></ShareableAnalysisProvider>);
        act(() => { rerender(<ShareableAnalysisProvider><Reader /></ShareableAnalysisProvider>); });
        expect(screen.getByTestId('status').textContent).toBe('none');
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/features/share/__tests__/ShareableAnalysisContext.test.tsx` → FAIL

- [ ] **Step 3: 구현** (`ShareableAnalysisContext.tsx`)

```tsx
'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ShareContext, ShareableKind, SnapshotResultOf } from '@/entities/shared-analysis';

export type ShareableStatus = 'idle' | 'pending' | 'success' | 'error' | 'unavailable';

export interface ShareableRegistration<K extends ShareableKind = ShareableKind> {
    kind: K;
    status: ShareableStatus;
    result: SnapshotResultOf<K> | null;
    context: ShareContext;
    trigger: () => void;
}

interface ShareableContextValue {
    current: ShareableRegistration | null;
    register: (reg: ShareableRegistration | null) => void;
}

const Ctx = createContext<ShareableContextValue | null>(null);

export function ShareableAnalysisProvider({ children }: { children: ReactNode }) {
    const [current, setCurrent] = useState<ShareableRegistration | null>(null);
    const register = useCallback((reg: ShareableRegistration | null) => setCurrent(reg), []);
    const value = useMemo(() => ({ current, register }), [current]);
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 헤더 ShareButton이 현재 활성 탭의 등록값을 읽는다. Provider 밖이면 null. */
export function useShareable(): ShareableRegistration | null {
    return useContext(Ctx)?.current ?? null;
}

/** 활성 탭 위젯이 자기 상태를 등록한다. 언마운트 시 해제. */
export function useRegisterShareable(reg: ShareableRegistration): void {
    const ctx = useContext(Ctx);
    const regRef = useRef(reg);
    regRef.current = reg;
    useEffect(() => {
        ctx?.register(regRef.current);
    }, [ctx, reg.kind, reg.status, reg.result]);
    useEffect(() => {
        return () => ctx?.register(null);
    }, [ctx]);
}
```

`src/features/share/index.ts`:

```ts
export {
    ShareableAnalysisProvider,
    useShareable,
    useRegisterShareable,
} from './model/ShareableAnalysisContext';
export type { ShareableRegistration, ShareableStatus } from './model/ShareableAnalysisContext';
```

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/share/
git commit -m "feat(share): add ShareableAnalysisContext"
```

---

## Phase 7 — 탭별 register 어댑터

> 스펙 §5-1 표. 작업량: overall/fear-greed=1줄, news류 5개=trigger 추가(moderate), chart=status 합성(hook 작업). 각 위젯에서 `useRegisterShareable`을 호출. **분석 결과 렌더 화면을 깨지 않도록 추가만 한다(기존 단언 불변).**

### Task 7.1: 5개 훅에 top-level trigger 노출

**Files (각 훅 + 반환 타입):**
- Modify: `src/widgets/news/hooks/useNewsAnalysis.ts` (return 타입 `NewsAnalysisState` union 각 variant에 `trigger` 추가 or `{...state, trigger}`)
- Modify: `src/widgets/fundamental/hooks/useFundamentalAnalysis.ts`
- Modify: `src/widgets/financials/hooks/useFinancialsAnalysis.ts`
- Modify: `src/widgets/congress/hooks/useCongressTrend.ts`
- Modify: `src/widgets/options/hooks/useOptionsAnalysis.ts`

각 훅은 이미 내부에 `const { refetch } = query;` + `retry = useCallback(() => void refetch(), [refetch])`가 있다(R3 실측: useNewsAnalysis L137–141). 패턴: 반환 객체에 `trigger: retry`(또는 동등 콜백)를 최상위로 추가.

- [ ] **Step 1 (per hook): 실패 테스트** — 예: `src/widgets/news/__tests__/useNewsAnalysis.test.tsx`(없으면 생성). 훅이 `trigger`를 반환하고 호출 시 refetch가 불리는지.

```tsx
// 기존 훅 테스트가 있으면 거기에 추가. 없으면 renderHook으로:
import { renderHook } from '@testing-library/react';
// QueryClientProvider 래퍼 필요 — 기존 테스트 유틸(예: src/shared/test-utils/queryWrapper)이 있으면 사용.
// 핵심 단언:
//   const { result } = renderHook(() => useNewsAnalysis({ symbol: 'AAPL', companyName: 'Apple', modelId, enabled: true }), { wrapper });
//   expect(typeof result.current.trigger).toBe('function');
```

> QueryClient 래퍼 유틸 위치를 먼저 확인(`src/shared/test-utils/` 또는 기존 widgets 테스트에서 사용하는 패턴). 없으면 인라인 `new QueryClient()` 래퍼 작성.

- [ ] **Step 2: 실패 확인** — Run 각 훅 테스트 → FAIL

- [ ] **Step 3: 구현** — 각 훅 반환에 `trigger` 추가. 예(useNewsAnalysis):

```ts
// 기존: return { status: 'done', result } / { status: 'error', retry } 등
// 변경: 모든 variant에 trigger를 합류. 가장 단순한 방법은 공통 trigger를 만들고 spread:
const trigger = retry; // 이미 존재하는 stable callback
// 각 return을 { ...stateVariant, trigger } 형태로 통일하거나, 반환 타입을 { state, trigger }로 감싼다.
```

반환 타입 변경 시 **소비 위젯(NewsAiSummary 등)의 분해 코드도 함께 수정**(기존 단언/렌더 불변). 위젯이 `const state = useNewsAnalysis(...)`로 쓰면 `state.trigger`만 추가되어 영향 최소.

- [ ] **Step 4: 통과 확인** → 해당 훅 테스트 + 위젯 테스트 PASS

- [ ] **Step 5: 커밋** (훅별로)

```bash
git add src/widgets/news/
git commit -m "feat(share): expose trigger from useNewsAnalysis"
```
(fundamental/financials/congress/options 동일 반복)

### Task 7.2: 5개 위젯에서 register

**Files (각 AI 패널 위젯):**
- Modify: `src/widgets/news/.../NewsAiSummary.tsx` 외 4개 위젯 — `useRegisterShareable` 호출 추가.

- [ ] **Step 1: 매핑 헬퍼** `src/features/share/lib/mapAnalysisStatus.ts` + 테스트

```ts
// status 문자열을 ShareableStatus로 정규화
export function mapAnalysisStatus(raw: string): import('@/features/share').ShareableStatus {
    switch (raw) {
        case 'done': return 'success';
        case 'loading': case 'submitting': case 'polling': case 'pending_dependencies': return 'pending';
        case 'bot_blocked': case 'no_trades': return 'unavailable';
        case 'error': return 'error';
        default: return 'idle';
    }
}
```

테스트: 각 입력 → 기대 출력(5케이스 + default).

- [ ] **Step 2: 각 위젯에서 register** (예: NewsAiSummary)

```tsx
// 위젯 내부, 훅 호출 직후:
const state = useNewsAnalysis({ symbol, companyName, modelId, enabled });
useRegisterShareable({
    kind: 'news',
    status: mapAnalysisStatus(state.status),
    result: state.status === 'done' ? state.result : null,
    context: { symbol, displayName: companyName, assetClass /* 위젯 props에서 */, analyzedAt: state.status === 'done' ? state.result.analyzedAt : undefined },
    trigger: state.trigger,
});
```

> `assetClass`·`displayName`이 위젯 스코프에 없으면 props로 전달받도록 위젯/호출부를 보강(최소 변경). 없는 경우 page.tsx에서 내려오는 값 사용.

- [ ] **Step 3: 위젯 테스트** — register가 불리는지(Provider 래핑 + useShareable 관찰) 또는 기존 위젯 테스트에 Provider 추가. 기존 단언 불변 확인.

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: 커밋** (위젯별)

### Task 7.3: overall register (1줄)

**Files:**
- Modify: `src/widgets/overall/.../OverallContent.tsx`

- [ ] **Step 1~2: register 추가** — `useOverallAnalysis`는 이미 `{ state, trigger }` 반환.

```tsx
const { state, trigger } = useOverallAnalysis({ ... });
useRegisterShareable({
    kind: 'overall',
    status: mapAnalysisStatus(state.status),
    result: state.status === 'done' ? state.result : null,
    context: { symbol, displayName, assetClass, analyzedAt: state.status === 'done' ? state.result.analyzedAt : undefined },
    trigger,
});
```

- [ ] **Step 3: 테스트 + 커밋**

```bash
git add src/widgets/overall/
git commit -m "feat(share): register overall analysis to share context"
```

### Task 7.4: fear-greed register (deterministic)

**Files:**
- Modify: `src/widgets/fear-greed/.../FearGreedPage.tsx` (또는 컨테이너)

- [ ] **Step 1~2: register** — snapshot null이면 unavailable, 아니면 success. trigger=noop.

```tsx
const { snapshot } = useFearGreedFromSymbol(symbol, fmpSymbol);
useRegisterShareable({
    kind: 'fear-greed',
    status: snapshot ? 'success' : 'unavailable',
    result: snapshot,
    context: { symbol, displayName, assetClass },
    trigger: () => {},
});
```

- [ ] **Step 3: 테스트 + 커밋**

### Task 7.5: chart register (status 합성 — hook 작업)

**Files:**
- Modify: `src/views/symbol/ChartContent.tsx` (또는 useAnalysis 소비처)

`useAnalysis`는 status enum이 없고 booleans(`isAnalyzing`/`analysisError`/`isBotBlocked`/`analysisResult`) + `handleReanalyze`(쿨다운 게이트)를 반환(R3). 위젯 레벨 어댑터에서 합성:

- [ ] **Step 1: 합성 헬퍼** `src/features/share/lib/deriveChartStatus.ts` + 테스트

```ts
import type { ShareableStatus } from '@/features/share';

export function deriveChartStatus(args: {
    isAnalyzing: boolean;
    analysisError: string | null;
    isBotBlocked: boolean;
    hasResult: boolean;
}): ShareableStatus {
    if (args.isBotBlocked) return 'unavailable';
    if (args.isAnalyzing) return 'pending';
    if (args.analysisError) return 'error';
    if (args.hasResult) return 'success';
    return 'idle';
}
```

테스트: 우선순위 케이스(bot > analyzing > error > result > idle).

- [ ] **Step 2: register** (ChartContent에서 useAnalysis 결과로)

```tsx
const a = useAnalysis({ ... }); // 기존
useRegisterShareable({
    kind: 'chart',
    status: deriveChartStatus({ isAnalyzing: a.isAnalyzing, analysisError: a.analysisError, isBotBlocked: a.isBotBlocked, hasResult: a.analysisResult != null }),
    result: a.analysisResult ?? a.analysis ?? null, // 표시중인 분석을 우선
    context: { symbol, displayName, assetClass, analyzedAt: (a.analysisResult ?? a.analysis)?.analyzedAt },
    trigger: a.handleReanalyze,
});
```

> `a.analysis`(초기 seed 포함 정규화 결과)가 항상 존재할 수 있음 — `result`로는 표시 중인 최신 분석을 넣되, `status`는 `analysisResult`(새 분석) 또는 seed 유무로 판단. 구현 시 useAnalysis 반환을 재확인해 "표시 중 결과"가 공유되도록 한다.

- [ ] **Step 3: 테스트** — deriveChartStatus 단위 테스트 + ChartContent register 관찰. 기존 ChartContent 테스트 단언 불변.

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/share/lib/deriveChartStatus.ts src/views/symbol/
git commit -m "feat(share): register chart analysis to share context"
```

---

## Phase 8 — 공유 분기 헬퍼 (`src/shared/lib/share.ts`)

> 스펙 §9-5.

### Task 8.1: share.ts

**Files:**
- Create: `src/shared/lib/share.ts`
- Test: `src/shared/lib/__tests__/share.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
import { buildTweetIntentUrl, isShareAbort } from '@/shared/lib/share';

describe('buildTweetIntentUrl', () => {
    it('includes the share url and encoded text', () => {
        const url = buildTweetIntentUrl({ text: 'AAPL 강세', shareUrl: 'https://siglens.io/share/abc' });
        expect(url).toContain('https://twitter.com/intent/tweet');
        expect(url).toContain(encodeURIComponent('https://siglens.io/share/abc'));
        expect(url).toContain(encodeURIComponent('AAPL 강세'));
    });
});

describe('isShareAbort', () => {
    it('detects AbortError', () => {
        const e = new DOMException('cancelled', 'AbortError');
        expect(isShareAbort(e)).toBe(true);
    });
    it('returns false for other errors', () => {
        expect(isShareAbort(new Error('boom'))).toBe(false);
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/shared/lib/__tests__/share.test.ts` → FAIL

- [ ] **Step 3: 구현**

```ts
const TWITTER_INTENT = 'https://twitter.com/intent/tweet';

export function buildTweetIntentUrl({ text, shareUrl }: { text: string; shareUrl: string }): string {
    const params = new URLSearchParams({ text, url: shareUrl });
    return `${TWITTER_INTENT}?${params.toString()}`;
}

/** navigator.share 지원 + 모바일(coarse pointer) 판정. */
export function canShareNatively(): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        return window.matchMedia('(pointer: coarse)').matches;
    }
    return false;
}

export function isShareAbort(err: unknown): boolean {
    return err instanceof DOMException && err.name === 'AbortError';
}

export interface KakaoSharePayload {
    title: string;
    description: string;
    url: string;
}
export function buildKakaoSharePayload(p: KakaoSharePayload): KakaoSharePayload {
    return p;
}
```

> `canShareNatively`는 jsdom에서 navigator.share/matchMedia가 없어 false. 테스트는 buildTweetIntentUrl·isShareAbort에 집중하고, canShareNatively는 navigator/matchMedia를 stub해 양 분기 커버(coverage 90% 위해 최소 2케이스 추가).

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/shared/lib/share.ts src/shared/lib/__tests__/share.test.ts
git commit -m "feat(share): add share branching helpers"
```

---

## Phase 9 — UI 컴포넌트 (`src/widgets/share/`)

> 스펙 §9-0~§9-4. 재사용 primitive(useDialog/usePopoverToggle/useCopyToClipboard), inline SVG, 토큰만, a11y(R2). 색상·클래스는 스펙 §9에 명시된 값을 그대로 사용.

### Task 9.1: inline 아이콘

**Files:**
- Create: `src/widgets/share/ui/icons.tsx` (ShareIcon, LinkIcon, CheckIcon, XLogoIcon, KakaoIcon, SpinnerIcon)

- [ ] **Step 1: 구현** — `EyeIcon.tsx` 하우스 스타일(20×20 `fill="currentColor"` `aria-hidden`). SpinnerIcon은 `animate-spin` ring.
- [ ] **Step 2: 커밋** `feat(share): add inline share icons`

### Task 9.2: ShareSheet (데스크톱 팝오버 + 모바일 native)

**Files:**
- Create: `src/widgets/share/ui/ShareSheet.tsx`
- Test: `src/widgets/share/__tests__/ShareSheet.test.tsx`

스펙 §9-4. props: `{ shareUrl, tweetText, title, description, onClose }`. `usePopoverToggle`는 부모(ShareButton)에서 열림 관리하거나 ShareSheet 자체가 controlled. 항목: 링크복사(useCopyToClipboard, `aria-live="polite"`), X(`<a rel="noopener noreferrer">`), Kakao(`NEXT_PUBLIC_KAKAO_JS_KEY` 있을 때만 렌더).

- [ ] **Step 1: 실패 테스트**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareSheet } from '@/widgets/share/ui/ShareSheet';

describe('ShareSheet', () => {
    const props = { shareUrl: 'https://siglens.io/share/abc', tweetText: 'AAPL 강세', title: 'AAPL AI 분석 결과', description: '강세', onClose: () => {} };
    it('renders copy and X options', () => {
        render(<ShareSheet {...props} />);
        expect(screen.getByRole('button', { name: /복사/ })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /X|트위터/ })).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });
    it('shows copied feedback with aria-live after copy', async () => {
        render(<ShareSheet {...props} />);
        fireEvent.click(screen.getByRole('button', { name: /복사/ }));
        expect(await screen.findByText(/복사했어요|복사됨/)).toBeInTheDocument();
    });
    it('hides Kakao when no JS key', () => {
        render(<ShareSheet {...props} />);
        expect(screen.queryByRole('button', { name: /카카오|Kakao/ })).not.toBeInTheDocument();
    });
});
```

> `useCopyToClipboard`가 `navigator.clipboard`를 쓰므로 테스트에서 `vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })` 등으로 stub. Kakao 키는 `process.env.NEXT_PUBLIC_KAKAO_JS_KEY` — 미설정 기본.

- [ ] **Step 2~4: 구현 → 통과**. 스펙 §9-4 클래스 적용.
- [ ] **Step 5: 커밋** `feat(share): add ShareSheet`

### Task 9.3: ShareTriggerDialog

**Files:**
- Create: `src/widgets/share/ui/ShareTriggerDialog.tsx`
- Test: `src/widgets/share/__tests__/ShareTriggerDialog.test.tsx`

스펙 §9-2. props `{ open, onConfirm, onCancel }`. 부드러운 카피, 기본 포커스=기본 CTA, `role=dialog aria-modal aria-labelledby`. `useFocusTrap`+`useEscapeKey`(UserApiKeyRequiredModal 패턴) 또는 `useDialog`.

- [ ] **Step 1: 실패 테스트** — 제목/본문/CTA 렌더, onConfirm/onCancel 호출, `!open`이면 null.
- [ ] **Step 2~4: 구현 → 통과**
- [ ] **Step 5: 커밋** `feat(share): add ShareTriggerDialog`

### Task 9.4: SharePreparingModal

**Files:**
- Create: `src/widgets/share/ui/SharePreparingModal.tsx`
- Test: `src/widgets/share/__tests__/SharePreparingModal.test.tsx`

스펙 §9-3. props `{ open, phase: 'pending'|'error', onClose, onRetry }`. `aria-busy`, `aria-live="polite"` 상태 텍스트, error면 재시도 CTA. 완료 전이는 부모(ShareButton)가 open=false로 닫고 시트로 넘김.

- [ ] **Step 1: 실패 테스트** — pending 텍스트(말줄임), error시 재시도 버튼+onRetry, 닫기 onClose.
- [ ] **Step 2~4: 구현 → 통과**
- [ ] **Step 5: 커밋** `feat(share): add SharePreparingModal`

### Task 9.5: kindPanelRegistry (읽기전용 패널)

**Files:**
- Create: `src/widgets/share/ui/kindPanelRegistry.tsx`

스펙 §6-2. kind → presentational `*View`. 6개는 기존 `*View({ result })` 재사용(news/options/fundamental/financials는 private View export 필요, congress는 export됨, chart는 `AnalysisPanel({ analysis })`). overall은 Task 12에서 추출하는 `OverallView`. fear-greed는 기존 FearGreed 표시 컴포넌트.

- [ ] **Step 1: 각 위젯에서 `*View` export** (private → export). 예: `export { NewsAiSummaryView }`. 기존 단언 불변.
- [ ] **Step 2: 레지스트리 작성**

```tsx
import type { ShareableKind, SnapshotResultOf } from '@/entities/shared-analysis';
// 각 View import...
type ReadonlyPanel<K extends ShareableKind> = (props: { result: SnapshotResultOf<K> }) => JSX.Element;
export const SHARE_KIND_PANEL_REGISTRY: { [K in ShareableKind]: ReadonlyPanel<K> } = {
    chart: ({ result }) => <AnalysisPanel analysis={result} />,
    overall: ({ result }) => <OverallView result={result} />,
    news: ({ result }) => <NewsAiSummaryView result={result} />,
    fundamental: ({ result }) => <FundamentalAiSummaryView result={result} />,
    financials: ({ result }) => <FinancialsAiSummaryView result={result} />,
    congress: ({ result }) => <CongressTrendSummaryView result={result} />,
    options: ({ result }) => <OptionsAiAnalysisView result={result} />,
    'fear-greed': ({ result }) => <FearGreedShareView snapshot={result} />,
};
```

> 각 View의 실제 prop 이름을 구현 시 확인(`result` vs `analysis` vs `snapshot`). AnalysisPanel은 `analysis`, fear-greed는 `snapshot`. 어댑터로 통일.

- [ ] **Step 3: 커밋** `feat(share): add kind panel registry`

### Task 9.6: ShareButton (상태머신 통합)

**Files:**
- Create: `src/widgets/share/ui/ShareButton.tsx`
- Create: `src/widgets/share/index.ts`
- Test: `src/widgets/share/__tests__/ShareButton.test.tsx`

스펙 §9-1. `useShareable()` status 분기. `useMutation`(createShareSnapshotAction). success→시트, pending→preparing, idle/error→trigger dialog, unavailable→인라인 안내. 중복클릭 방지.

- [ ] **Step 1: 실패 테스트** (Provider로 등록값 주입)

```tsx
// 케이스:
// - status 'success' + 클릭 → createShareSnapshotAction 호출(모킹) → ShareSheet 표시(데스크톱) / native(canShareNatively stub)
// - status 'idle' + 클릭 → ShareTriggerDialog 표시
// - status 'pending' + 클릭 → SharePreparingModal 표시
// - status 'unavailable' + 클릭 → 인라인 안내 텍스트
// - aria-label 존재
vi.mock('@/entities/shared-analysis/actions/createShareSnapshotAction', () => ({ createShareSnapshotAction: vi.fn().mockResolvedValue({ ok: true, id: 'abc' }) }));
```

- [ ] **Step 2~4: 구현 → 통과**. `src/widgets/share/index.ts`는 `export { ShareButton } from './ui/ShareButton';`
- [ ] **Step 5: 커밋** `feat(share): add ShareButton`

---

## Phase 10 — 헤더 삽입 + Provider 배치

### Task 10.1: Provider를 [symbol] 레이아웃에 배치

**Files:**
- Modify: `src/app/[symbol]/SymbolLayoutClient.tsx` (또는 `SymbolLayoutProviders`)

- [ ] **Step 1: ShareableAnalysisProvider로 children 감싸기** — 기존 provider 트리에 추가(chat/model context 형제).
- [ ] **Step 2: 빌드/기존 테스트 불변 확인**
- [ ] **Step 3: 커밋** `feat(share): mount ShareableAnalysisProvider in symbol layout`

### Task 10.2: ShareButton을 헤더에 삽입

**Files:**
- Modify: `src/views/symbol/SymbolLayoutHeader.tsx` (우측 액션 div, ModelSelector 왼쪽)

- [ ] **Step 1: `<ShareButton />` 삽입** (스펙 §9-1 위치). `@/widgets/share`에서 import.
- [ ] **Step 2: 기존 헤더 테스트 불변 + 새 노출 테스트**(있으면)
- [ ] **Step 3: 커밋** `feat(share): add ShareButton to symbol header`

---

## Phase 11 — /share/[id] 라우트 + OG

### Task 11.1: OverallView 추출 (Task 9.5 의존)

**Files:**
- Create/Modify: `src/widgets/overall/.../OverallView.tsx` — `OverallContent`의 결과 렌더 부분(9개 섹션, R3)을 `OverallView({ result })`로 추출해 OverallContent가 재사용.

- [ ] **Step 1: 추출 + OverallContent가 OverallView 사용**(기존 렌더/단언 불변)
- [ ] **Step 2: 테스트 통과**
- [ ] **Step 3: 커밋** `refactor(share): extract OverallView for reuse`

### Task 11.2: buildSnapshotOgImage

**Files:**
- Create: `src/entities/og-image/lib/buildSnapshotOgImage.tsx` (또는 기존 `buildSymbolOgImage` 재사용 래퍼)

스펙 §10. `buildSymbolOgImage({ ticker, label })` 재사용 가능(R3) — kindLabel을 label로. 별도 빌더 불필요하면 라우트에서 직접 호출. 본 task는 kind→한글 라벨 매핑 헬퍼만:

- [ ] **Step 1: kindLabel 헬퍼** `src/entities/shared-analysis/lib/kindLabel.ts` + 테스트(8 kind → 한글 라벨, 예 chart→'차트 분석').
- [ ] **Step 2: 커밋** `feat(share): add kindLabel`

### Task 11.3: opengraph-image 라우트

**Files:**
- Create: `src/app/share/[id]/opengraph-image.tsx`

스펙 §10. dynamic. `getSharedAnalysis(id)` → found면 `buildSymbolOgImage({ ticker: snapshot.symbol, label: kindLabel(kind) })`, 아니면 fallback(`label: '만료된 공유'`).

- [ ] **Step 1: 구현** (`[symbol]/opengraph-image.tsx` 패턴, 단 `dynamic`은 동적 — `export const dynamic = 'force-dynamic'` 또는 기본). size/contentType/alt 리터럴.
- [ ] **Step 2: 빌드 확인**(opengraph-image는 커버리지 제외)
- [ ] **Step 3: 커밋** `feat(share): add share OG image route`

### Task 11.4: share 페이지 SEO 헬퍼

**Files:**
- Create: `src/entities/shared-analysis/lib/buildShareSeo.ts` + 테스트

- [ ] **Step 1: 실패 테스트** — title `"{TICKER} AI 분석 결과"`, description=buildOgText, noindex 메타.

```ts
import { buildShareMetadata } from '@/entities/shared-analysis/lib/buildShareSeo';
// found 스냅샷 → { title, description, robots:{index:false} } 형태 단언
// expired/not_found → noindex 기본 메타
```

- [ ] **Step 2~4: 구현** — `symbolMetadataFromSeo` 패턴 변형 + `robots:{ index:false, follow:false }` 스프레드. (seo.ts의 robots-override 관용구 활용.)
- [ ] **Step 5: 커밋** `feat(share): add share metadata builder`

### Task 11.5: share 페이지

**Files:**
- Create: `src/app/share/[id]/page.tsx`

스펙 §10. RSC, 동적. `getSharedAnalysis` → found면 `SHARE_KIND_PANEL_REGISTRY[kind].Panel` + disclaimer + 바이럴 CTA(`<Link href="/{symbol}">`), expired/not_found면 빈 상태. `generateMetadata`는 `buildShareMetadata`.

- [ ] **Step 1: 구현** — page.tsx(커버리지 제외). disclaimer 클래스(스펙 §10), CTA, 빈 상태 카피.
- [ ] **Step 2: 빌드 + 수동 확인**(`yarn build`로 라우트 컴파일)
- [ ] **Step 3: 커밋** `feat(share): add /share/[id] page`

---

## Phase 12 — env + 문서

### Task 12.1: env 예시

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: `NEXT_PUBLIC_KAKAO_JS_KEY=` 추가**(주석: Kakao JS SDK 공유용, 선택).
- [ ] **Step 2: 커밋** `chore(share): document NEXT_PUBLIC_KAKAO_JS_KEY`

### Task 12.2: 문서 업데이트

**Files:**
- Modify: `docs/architecture/ARCHITECTURE.md` (새 entity slice `shared-analysis`, features `share`, `/share` 라우트 추가 시 레이어 표 반영) — 필요 시.

- [ ] **Step 1: 변경 반영**(레이어/폴더 표에 신규 슬라이스). 불필요하면 skip.
- [ ] **Step 2: 커밋** `docs(share): note shared-analysis slice`

---

## Phase 13 — E2E (Playwright)

> 기존 E2E 스위트 패턴(`project_e2e_suite_landed`) 따름. HYBRID 백엔드, workers:1.

### Task 13.1: 공유 흐름 E2E

**Files:**
- Create: `e2e/share.spec.ts` (기존 e2e 디렉토리 구조 확인 후 경로 맞춤)

- [ ] **Step 1: 시나리오 작성**
  - 헤더에 공유 버튼이 모든 탭에서 보임
  - 분석 있는 상태에서 공유 클릭 → 시트/URL 생성(액션 모킹 또는 실DB)
  - `/share/[id]` 직접 방문 → 읽기전용 패널 + disclaimer + CTA 렌더
  - `/share/만료id` → 만료 빈 상태
- [ ] **Step 2: 실행** `yarn e2e`(또는 스코프 스펙). 안정화.
- [ ] **Step 3: 커밋** `test(share): add share flow e2e`

---

## Phase 14 — 최종 검증

### Task 14.1: 전체 게이트

- [ ] **Step 1:** `yarn lint` → 0 error
- [ ] **Step 2:** `yarn lint:style` → 0 error
- [ ] **Step 3:** `npx prettier --check .` → clean (yarn format --cache stale 주의)
- [ ] **Step 4:** `yarn test` → 전체 PASS, 신규 코드 커버리지 ≥90%(repository/action/lib/hooks)
- [ ] **Step 5:** `yarn build 2>&1 > /tmp/build.log; echo $?` → exit 0 (파이프로 가리지 말 것)
- [ ] **Step 6:** `yarn e2e` → PASS (시간 소요)
- [ ] **Step 7:** ISSUE_IMPL_FLOW에 따라 review-agent 호출로 인계

---

## Self-Review: Spec Coverage Map & 보강 Addenda

fresh-context coverage 감사(spec↔plan 전수 대조) 결과를 반영한 보강. **각 항목은 지정 task 구현 시 반드시 함께 반영**한다. 구현자는 해당 task + 이 addenda를 함께 본다.

### A. 구조 결정 (확정)

- **A-1 (vaul 미사용 확정):** 스펙 §9-0 표의 `vaul Drawer` 행은 **사용하지 않는다.** `navigator.share` 미지원 환경(데스크톱 + 일부 모바일 브라우저)은 모두 `ShareSheet` 데스크톱 팝오버로 fallback한다(vaul 불필요). Tech Stack/§9-0의 vaul 언급은 무시. → Task 9.2/9.6은 `canShareNatively()` true → `navigator.share`, false → 팝오버, 두 갈래만 구현.
- **A-2 (crossCheckPeek MVP 제외 확정):** 스펙 §6-1 `crossCheckPeek?`(chart/overall 서버 peek 교차검증)는 **스펙상 "옵션"이며 MVP 비범위로 확정**한다(§12에 준함). client-supplied 입력은 `isValidShareInput`(형태) + rate limit으로만 방어하고, 6개 kind와 동일하게 내용 위조 가능성은 noindex로 완화·수용한다. 후속에서 필요 시 `peekAnalysisCache`/`peekOverallAnalysisCache`로 추가. **→ 별도 task 없음(의도된 누락, 명시적 수용).**

### B. 신규/보강 task

- **B-1 (Task 3.4 신규 — 통합 서버 레지스트리):** `src/entities/shared-analysis/server/kindServerRegistry.ts` 생성. `buildOgText`·`isValidShareInput`(kind 무관 공통)을 두되, **kind별 분기가 있는 `buildOgText`는 `SHARE_KIND_OG_BUILDERS: Record<ShareableKind, (r) => OgText>` 객체로 재구성**하고 `satisfies Record<ShareableKind, ...>`로 **type-level exhaustiveness**를 강제(스펙 §6-1/§6-3, Gap #5/#7). `buildOgText(snapshot)`은 이 객체를 디스패치하는 얇은 래퍼. 테스트: 8개 키 존재 + 누락 시 컴파일 에러가 나는 구조임을 주석/타입으로 보장. 커밋 `feat(share): unify kind server registry with exhaustiveness`.

- **B-2 (Task 11.4b 신규 — resolveAsOf 순수 헬퍼):** `src/entities/shared-analysis/lib/resolveAsOf.ts` + 테스트. `resolveAsOf(snapshot, createdAt): string` — `snapshot.context.analyzedAt`가 있으면 그것, 없으면 `createdAt`(스펙 §8/§10/§13 "as of {analyzedAt|createdAt}" fallback). 테스트: analyzedAt 있음→그 값, 없음→createdAt. page.tsx와 disclaimer가 이 헬퍼를 사용. 커밋 `feat(share): add resolveAsOf for snapshot disclaimer`.

- **B-3 (Task 9.5 보강 — FearGreedShareView):** `kindPanelRegistry`의 `'fear-greed'` 엔트리가 참조하는 읽기전용 뷰가 **추출 대상에 포함**되어야 함(Gap #6). fear-greed의 기존 표시 컴포넌트(`FearGreedPage`/`FearGreedCard`)에서 `snapshot`+`history`를 prop으로 받는 presentational 부분을 `FearGreedShareView({ snapshot })`로 식별/추출하는 Step을 Task 9.5 Step 1 목록에 추가(news/options/fundamental/financials/overall과 동일하게 per-widget으로 나열). 각 `*View` export는 위젯별 Step + 기존 단언 불변 확인.

### C. 테스트 케이스 보강 (90% 게이트 직결 — 반드시 추가)

- **C-1 (Task 8.1, Gap #18 HIGH):** share.ts 테스트에 누락된 케이스 추가:
  - `canShareNatively`: `navigator.share`+`matchMedia('(pointer: coarse)')` stub → true; 미지원(navigator.share 없음) → false; coarse 아님 → false. (`vi.stubGlobal`)
  - `buildKakaoSharePayload`: 입력 객체를 그대로 반환하는지 단언.
- **C-2 (Task 4.1, Gap #22):** api.test에 **dedupe 경로** 추가 — `onConflictDoUpdate` 체인이 기존 id를 반환하는 케이스(`returning` mock이 기존 id 반환) 단언.
- **C-3 (Task 5.2, Gap #22):** createShareSnapshotAction 테스트에 **kind 라우팅**(chart 외 1개 kind, 예 news 입력도 ok) + dedupe 결과(동일 contentHash→동일 id, repo mock이 같은 id 반환) 케이스 추가.
- **C-4 (Task 9.6, Gap #11/#2):** ShareButton 테스트에 추가 — unavailable일 때 버튼이 **`disabled`가 아님**(`not.toBeDisabled`) + `aria-describedby`가 사유 요소를 가리킴; mutation 진행 중 **`aria-busy="true"`**; `useShareable()`가 **null**(미등록)일 때도 unavailable 처리.
- **C-5 (Task 9.2, Gap #15/#16/#17):** ShareSheet 테스트에 추가 — 팝오버 열림 시 **첫 항목 포커스**·닫힘 시 **trigger로 포커스 복원**·Escape 닫힘; 복사 실패(`writeText` reject) 시 **선택 가능한 readonly input fallback** 노출; Kakao 키 **설정 시 버튼 렌더**(`vi.stubEnv('NEXT_PUBLIC_KAKAO_JS_KEY', 'k')`).
- **C-6 (Task 9.3, Gap #12):** ShareTriggerDialog 테스트 — 열릴 때 **기본 CTA에 포커스**, 닫을 때 **trigger(여기선 부모가 전달한 ref/콜백)로 복원**.
- **C-7 (Task 9.4, Gap #13):** SharePreparingModal 테스트 — `aria-busy`/`aria-live` 영역 존재, error phase에서 재시도 CTA + onRetry, pending 텍스트 말줄임.
- **C-8 (Task 11.4, Gap #21):** buildShareMetadata 테스트 — openGraph.title/description + twitter.card `summary_large_image` + `robots.index===false` 단언.

### D. 구현 노트 보강

- **D-1 (Task 7.2, Gap #1):** `mapAnalysisStatus`에 **options 빈 시장** 상태 토큰을 `unavailable`로 매핑. options 훅의 빈-시장 status 토큰명을 `useOptionsAnalysis.ts`에서 확인(예: `empty`/`no_options`)해 추가. 미존재 시 options 위젯 어댑터에서 `OptionsEmptyState` 분기로 `unavailable` 등록.
- **D-2 (Task 7.2, options expirationDate, §5-1):** options 위젯 어댑터는 사용자가 선택한 `expirationDate` 기준 결과를 등록해야 함(헤더는 모름) — register는 위젯 내부에서 현재 선택된 결과로 구성됨을 Step 주석에 명시.
- **D-3 (Task 11.5, Gap #20):** /share 페이지에 스냅샷 disclaimer(`border-secondary-700`)와 **별개로 기존 투자 면책 고지 박스**(`border-ui-danger/30 bg-ui-danger/5`, 기존 컴포넌트 재사용)를 함께 렌더(스펙 §10). 두 박스는 역할이 다름(정보 disclaimer vs 투자 면책).
- **D-4 (Task 13.1, Gap #23):** E2E에 `notFound`(존재하지 않는 id) 케이스를 expired와 **별도**로 추가하고, `confirm→loading→share` 인터랙티브 전체 흐름(분석 없는 심볼에서 공유→컨펌→로딩→시트) 시나리오 추가.
- **D-5 (Task 2.2, Gap #8, LOW):** `generateShareId`는 기존 `generateUrlSafeToken`(`entities/auth/lib/tokenUtils.ts`) 재사용을 우선 검토(스펙 §7 reuse 의도). 동일 base64url이므로 그 함수를 호출하는 래퍼로 구현해도 무방.

### E. Spec 섹션 → Task 매핑 요약 (전 항목 COVERED 확인)

| Spec | Task | Spec | Task |
|---|---|---|---|
| §2 8 kind | 1.1, 2.1 | §9-1 ShareButton | 9.6, 10.2, C-4 |
| §3 스코프(no filter) | preamble | §9-2 Dialog | 9.3, C-6 |
| §4 흐름(client-supplied) | 5.2, 6, 7 | §9-3 Modal | 9.4, C-7 |
| §5-1 context | 6.1, 7.x | §9-4 Sheet | 9.2, C-5, A-1 |
| §5-2 UX 카피 | 9.3/9.4/9.6 | §9-5 share.ts | 8.1, C-1 |
| §6-1 서버 레지스트리 | 3.2/3.3/**3.4(B-1)** | §10 /share | 11.5, D-3, C-8 |
| §6-2 패널 레지스트리 | 9.5, **B-3** | §10 OG | 11.3, 11.2 |
| §6-3 단일소스 exhaustiveness | 1.1, 3.1, **B-1** | §10 as-of disclaimer | **B-2**, 11.5 |
| §7 DB | 1.2 | §11 엣지 | 5.x/7.x/9.6, D-1 |
| §7 rate-limit | 5.1, 5.2 | §11 forgery/peek | 3.3, **A-2** |
| §8 slice | 2.x–5.x | §12 비범위 | preamble, A-2 |
| §8 dedupe | 4.1, C-2 | §13 테스트 | 전 task + C-1~C-8 |
| §8 server-only barrel | 5.4 | §14 파일 | 전 phase |
| §0-4 robots 불변 | 11.4(메타만), 미수정 | | |

**결론:** A-2(peek)·A-1(vaul)는 의도적 제외로 확정, 나머지 모든 spec 항목은 기존 task + B/C/D 보강으로 커버됨. 누락 없음.

# `/[symbol]/congress` 의회 거래 탭 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 미국 상·하원 의원의 종목별 거래 공시를 표로 열람하고 AI 동향 해석을 붙이는 신규 종목 탭 `/[symbol]/congress`를, 기존 financials 탭 레시피를 평행 적용해 구현한다(per-symbol ISR/SEO/2계층 캐시/봇 차단/클라 폴링).

**Architecture:** core(`@y0ngha/siglens-core`)=순수 도메인(타입·정규화·통계·프롬프트·AI 잡), siglens=I/O(FMP fetch·캐시·ISR·UI·chat). cross-repo 순서(**병목 최소화** — 사용자 지침): **core 먼저 구현 → core 빌드 후 siglens 워크트리 node_modules에 dist overlay → Part B를 overlay 위에서 즉시 진행**. 정식 publish는 **사용자가 직접·병행** 수행하며 Part B를 막지 않는다. 사용자 publish 완료 후 `package.json` 버전 핀 갱신 + clean install은 **최종 검증/PR 직전**에 1회 수행. financials와 단 하나의 의도적 차이: congress는 "거래 0건=정상"이라 `getProfileResilient` 패턴을 미러한 **resilient 래퍼**로 0건↔장애를 구분한다(provider는 정상 `[]`를 캐시, FMP 장애만 throw).

**Tech Stack:** TypeScript, Next.js 16(App Router, ISR), React 19, @tanstack/react-query, vitest, Playwright, Redis(getOrSetCache), FMP `/stable/senate-trades`·`/stable/house-trades`.

**근거 스펙:** `docs/superpowers/specs/2026-06-16-symbol-congress-trades-design.md` (부록 B=Phase 0 실측, 부록 C=financials 미러 맵, 부록 D=확정 결정).

---

## 작업 환경 / 사전 조건

- **워크트리**: `/Users/y0ngha/Project/siglens/.claude/worktrees/feat+symbol-congress`, 브랜치 `feat/symbol-congress-trades`. 모든 siglens 작업은 이 워크트리에서.
- **core 레포**: `/Users/y0ngha/Project/siglens-core` (v0.23.0). Part A는 여기서 작업.
- **cross-repo 핸드오프 규칙**(메모리 `siglens_core_release_method`·`worktree_node_modules_prod_verify` + 사용자 지침): core는 GitHub Packages(`npm.pkg.github.com`) publish. **publish는 사용자가 직접·병행 수행**. 병목 최소화를 위해 **Part A 종료 시 core를 빌드해 siglens 워크트리 node_modules에 dist를 overlay하고 Part B를 즉시 시작**한다(publish 대기 없음). 사용자 publish가 끝나면 `package.json` 핀 갱신 + clean install을 **최종 검증/PR 직전**에 1회 수행해 overlay와 정식 패키지의 일치를 확인한다.
- **FMP 키**: 워크트리 `.env.local`의 `FMP_API_KEY` (Phase 0에서 검증 완료, 402 없음).
- **커밋 규칙**: 각 태스크 끝에서 커밋. 단, **실제 `git commit` 실행은 git-agent에 위임**(CLAUDE.md). 인라인/서브에이전트 실행 시에는 각 태스크 경계에서 변경을 스테이징하고 커밋 메시지를 제안한 뒤 git-agent 라우팅. push 금지(사용자 담당).
- **커밋 메시지**: Conventional Commits, 한글 요약. 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## File Structure (생성/수정 맵)

### Part A — siglens-core (`/Users/y0ngha/Project/siglens-core`)
- 수정 `src/domain/types.ts` — congress 도메인 타입 블록 추가.
- 생성 `src/domain/ports/congressTradesProvider.ts` — `CongressTradesProvider` port.
- 생성 `src/domain/analysis/normalizeCongressTrades.ts` — wire→domain 정규화(chamber/side/amount).
- 생성 `src/domain/analysis/summarizeCongressTrades.ts` — 결정론적 건수 통계.
- 생성 `src/domain/analysis/congressTrendPrompt.ts` — AI 프롬프트 빌더.
- 생성 `src/domain/analysis/normalizeCongressTrend.ts` — LLM raw→typed 정규화.
- 생성 `src/application/congress/{submitCongressTrend,pollCongressTrend,cancelCongressTrendJob,types}.ts` — AI 잡.
- 수정 `src/infrastructure/cache/config.ts` — `CONGRESS_PROMPT_TEMPLATE_VERSION`, 캐시 키 빌더, TTL.
- 수정 `src/index.ts` — public barrel exports.
- 생성 `src/__tests__/domain/analysis/{normalizeCongressTrades,summarizeCongressTrades,congressTrendPrompt,normalizeCongressTrend}.test.ts`
- 생성 `src/__tests__/application/congress/{submitCongressTrend,pollCongressTrend}.test.ts`

### Part B — siglens (`.claude/worktrees/feat+symbol-congress`)
- 수정 `src/shared/config/time.ts` — `CONGRESS_REVALIDATE_SECONDS`.
- 생성 `src/shared/api/fmp/congressTrades.types.ts` — raw FMP wire 타입(siglens측, 옵션).
- 생성 `src/shared/api/fmp/congressTradesClient.ts` — FMP 어댑터.
- 생성 `src/shared/api/fmp/CachedCongressTradesProvider.ts` — 2키 캐시(throw 표면화).
- 생성 `src/shared/api/fmp/getCongressTradesProvider.ts` — 팩토리(isE2E 분기).
- 생성 `src/shared/api/fmp/FakeCongressTradesProvider.ts` — E2E 픽스처.
- 생성 `src/entities/congress-trades/lib/{getCongressTrades,getCongressTradesResilient}.ts` + `index.ts`.
- 생성 `src/app/[symbol]/congress/{page.tsx,congressData.ts,CongressDegraded.tsx,opengraph-image.tsx,twitter-image.tsx}`.
- 생성 `src/widgets/congress/{CongressTradesTable,CongressTrendSummary,CongressTrendSummarySkeleton,CongressTrendSummaryError,index}.tsx`, `hooks/useCongressTrend.ts`, `utils/buildChatState.ts`, `congressTooltips.tsx`.
- 생성 `src/entities/analysis/actions/{submitCongressTrendAction,pollCongressTrendAction,cancelCongressTrendJobAction}.ts` + `actions.ts` barrel 수정.
- 수정 `src/shared/api/e2eAnalysisStub.ts` — `E2E_FORCE_CONGRESS_ERROR_COOKIE` + stub.
- 수정 `src/widgets/symbol-page/utils/symbolTabsConfig.ts` — TABS 항목 추가.
- 수정 `src/shared/config/queryConfig.ts` — `QUERY_KEYS.congressTrend`.
- 수정 `src/shared/lib/seo.ts`(또는 해당 위치) — `buildSymbolCongressSeoContent`.
- 수정 `src/app/sitemap.ts`, CrossLinkCards — 롱테일 라우트 추가.
- 수정 `docs/architecture/ISR_REVALIDATE.md` — congress 행 추가.
- 생성 테스트: 각 구현 파일에 `__tests__` 동행 + `e2e/congress.spec.ts`(Playwright).

---

# PART A — siglens-core (도메인)

> 작업 디렉토리: `/Users/y0ngha/Project/siglens-core`. 명령은 이 레포에서 실행. 빌드: `npm run build`(=`tsc -p tsconfig.build.json && tsc-alias -p tsconfig.build.json`). 테스트: `npx vitest run <file>`. 커버리지 목표 90%.

## Task A1: congress 도메인 타입 추가

**Files:**
- Modify: `src/domain/types.ts` (financials 타입 블록 인근 ~line 3078 뒤에 congress 블록 추가)

- [ ] **Step 1: 타입 블록 추가**

`src/domain/types.ts` 끝부분의 financials 타입 블록 다음에 아래를 추가한다. (financials 블록과 동일한 주석 스타일·export 방식.)

```typescript
// ─── Congress trades (의회 거래) ─────────────────────────────────
export type Chamber = 'senate' | 'house';
export type CongressTradeSide = 'buy' | 'sell' | 'unknown';
export type CongressOwner = 'self' | 'spouse' | 'joint' | 'child' | 'unknown';
export type CongressSentiment = 'bullish' | 'neutral' | 'bearish';
export type CongressTrendDirection =
    | 'net_buying'
    | 'net_selling'
    | 'balanced'
    | 'no_trades';

export interface CongressAmountRange {
    min: number | null; // USD, 하한
    max: number | null; // USD, 상한 (상한 없는 구간이면 null)
    label: string; // FMP 원문 ("$1,001 - $15,000")
}

export interface CongressTrade {
    chamber: Chamber;
    firstName: string;
    lastName: string;
    office: string; // 표시용 의원명 (FMP office 필드)
    district: string; // 상원=주(WV), 하원=선거구; 빈 문자열 가능
    owner: CongressOwner;
    side: CongressTradeSide;
    rawType: string; // FMP 원본 type 보존 ("Sale (Partial)" 등)
    amount: CongressAmountRange;
    assetType: string; // "Stock" | "Stock Option" | ...
    assetDescription: string;
    transactionDate: string; // yyyy-mm-dd
    disclosureDate: string; // yyyy-mm-dd
    link: string;
    capitalGainsOver200USD: boolean;
}

/** @internal FMP wire 단건 (느슨한 unknown — 어댑터/정규화 입력) */
export interface RawCongressTrade {
    senateID?: unknown;
    disclosureDate?: unknown;
    transactionDate?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    office?: unknown;
    district?: unknown;
    owner?: unknown;
    assetDescription?: unknown;
    assetType?: unknown;
    type?: unknown;
    amount?: unknown;
    capitalGainsOver200USD?: unknown;
    link?: unknown;
}

export interface CongressTradeStats {
    buyCount: number;
    sellCount: number;
    unknownCount: number;
    direction: CongressTrendDirection;
    uniqueMembers: number;
    senateCount: number;
    houseCount: number;
}

export interface CongressTrendResponse {
    summaryKo: string;
    notableMembersKo: string[];
    riskNoteKo: string;
    overallSentiment: CongressSentiment;
}

/** @internal LLM raw 응답 (정규화 전) */
export interface RawCongressTrendResponse {
    summaryKo?: unknown;
    notableMembersKo?: unknown;
    riskNoteKo?: unknown;
    overallSentiment?: unknown;
}
```

- [ ] **Step 2: 타입 컴파일 확인**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: PASS (타입만 추가했으므로 에러 0)

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(congress): 의회 거래 도메인 타입 추가"
```

## Task A2: CongressTradesProvider port

**Files:**
- Create: `src/domain/ports/congressTradesProvider.ts`

- [ ] **Step 1: port 작성**

`src/domain/ports/financialStatementsProvider.ts` 패턴을 따른다. 상·하원 스키마가 동일하므로 chamber 인자 1개 메서드로 충분하다.

```typescript
import type { Chamber, CongressTrade } from '@/domain/types';

/**
 * 의회 거래 공시 데이터 포트.
 * 구현(siglens 어댑터)은 거래일(transactionDate) 내림차순으로 반환하고,
 * 데이터 없음은 빈 배열, **인프라 장애만 throw**한다(0건 != 장애 — 어댑터/래퍼 계약).
 */
export interface CongressTradesProvider {
    getTrades(symbol: string, chamber: Chamber, limit: number): Promise<CongressTrade[]>;
}
```

- [ ] **Step 2: 컴파일 확인**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/domain/ports/congressTradesProvider.ts
git commit -m "feat(congress): CongressTradesProvider port 추가"
```

## Task A3: normalizeCongressTrades (wire→domain 정규화)

> 부록 B의 핵심 정규화. side 변종 흡수(B.3), amount 구간 파싱(B.4), chamber 태깅, 거래일 desc 정렬. **throw 금지**.

**Files:**
- Create: `src/domain/analysis/normalizeCongressTrades.ts`
- Test: `src/__tests__/domain/analysis/normalizeCongressTrades.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
import { describe, expect, it } from 'vitest';
import { normalizeCongressTrades } from '@/domain/analysis/normalizeCongressTrades';
import type { RawCongressTrade } from '@/domain/types';

const senateRaw: RawCongressTrade = {
    senateID: 'C001047',
    disclosureDate: '2026-05-07',
    transactionDate: '2026-04-17',
    firstName: 'Shelley',
    lastName: 'Moore Capito',
    office: 'Shelley Moore Capito',
    district: 'WV',
    owner: 'Spouse',
    assetDescription: 'Apple Inc',
    assetType: 'Stock',
    type: 'Sale',
    amount: '$1,001 - $15,000',
    capitalGainsOver200USD: 'False',
    link: 'https://efdsearch.senate.gov/x',
};
const houseRaw: RawCongressTrade = {
    senateID: null,
    disclosureDate: '2026-06-04',
    transactionDate: '2025-02-07',
    firstName: 'Tim',
    lastName: 'Walberg',
    office: 'Tim Walberg',
    district: '',
    owner: 'Joint',
    assetDescription: 'Apple Inc',
    assetType: 'Stock',
    type: 'Purchase',
    amount: '$15,001 - $50,000',
    capitalGainsOver200USD: 'False',
    link: 'https://disclosures-clerk.house.gov/x.pdf',
};

describe('normalizeCongressTrades', () => {
    it('상·하원을 chamber로 태깅해 합친다', () => {
        const out = normalizeCongressTrades([senateRaw], [houseRaw]);
        expect(out).toHaveLength(2);
        expect(out.map(t => t.chamber).sort()).toEqual(['house', 'senate']);
    });

    it('거래일(transactionDate) 내림차순으로 정렬한다', () => {
        const out = normalizeCongressTrades([senateRaw], [houseRaw]);
        expect(out[0].transactionDate).toBe('2026-04-17'); // senate가 더 최근
        expect(out[1].transactionDate).toBe('2025-02-07');
    });

    it('Purchase는 buy로 매핑한다', () => {
        const out = normalizeCongressTrades([], [houseRaw]);
        expect(out[0].side).toBe('buy');
    });

    it.each(['Sale', 'Sale (Full)', 'Sale (Partial)', 'Sale Partial'])(
        '매도 변종 "%s"를 모두 sell로 흡수한다',
        type => {
            const out = normalizeCongressTrades([{ ...senateRaw, type }], []);
            expect(out[0].side).toBe('sell');
            expect(out[0].rawType).toBe(type); // 원본 보존
        }
    );

    it('알 수 없는 type은 unknown으로 보존(드롭 금지)', () => {
        const out = normalizeCongressTrades([{ ...senateRaw, type: 'Exchange' }], []);
        expect(out[0].side).toBe('unknown');
        expect(out).toHaveLength(1);
    });

    it('amount 구간을 min/max/label로 구조화한다', () => {
        const out = normalizeCongressTrades([senateRaw], []);
        expect(out[0].amount).toEqual({ min: 1001, max: 15000, label: '$1,001 - $15,000' });
    });

    it('파싱 불가 amount는 min/max null + 원문 label 보존(throw 금지)', () => {
        const out = normalizeCongressTrades([{ ...senateRaw, amount: 'N/A' }], []);
        expect(out[0].amount).toEqual({ min: null, max: null, label: 'N/A' });
    });

    it('상한 없는 구간("$50,000,000 +")은 max=null', () => {
        const out = normalizeCongressTrades([{ ...senateRaw, amount: '$50,000,000 +' }], []);
        expect(out[0].amount.min).toBe(50000000);
        expect(out[0].amount.max).toBeNull();
    });

    it('owner를 소문자 enum으로 정규화하고 빈/미지값은 unknown', () => {
        expect(normalizeCongressTrades([{ ...senateRaw, owner: 'Spouse' }], [])[0].owner).toBe('spouse');
        expect(normalizeCongressTrades([{ ...senateRaw, owner: '' }], [])[0].owner).toBe('unknown');
        expect(normalizeCongressTrades([{ ...senateRaw, owner: 'Trustee' }], [])[0].owner).toBe('unknown');
    });

    it('capitalGainsOver200USD "True"/"False"를 boolean으로', () => {
        expect(normalizeCongressTrades([{ ...senateRaw, capitalGainsOver200USD: 'True' }], [])[0].capitalGainsOver200USD).toBe(true);
        expect(normalizeCongressTrades([senateRaw], [])[0].capitalGainsOver200USD).toBe(false);
    });

    it('누락/null 문자열 필드는 빈 문자열로 안전 처리', () => {
        const out = normalizeCongressTrades([{ type: 'Purchase' } as RawCongressTrade], []);
        expect(out[0].firstName).toBe('');
        expect(out[0].office).toBe('');
        expect(out[0].link).toBe('');
    });

    it('빈 입력은 빈 배열', () => {
        expect(normalizeCongressTrades([], [])).toEqual([]);
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/__tests__/domain/analysis/normalizeCongressTrades.test.ts`
Expected: FAIL ("Cannot find module .../normalizeCongressTrades")

- [ ] **Step 3: 구현 작성**

```typescript
import type {
    Chamber,
    CongressAmountRange,
    CongressOwner,
    CongressTrade,
    CongressTradeSide,
    RawCongressTrade,
} from '@/domain/types';
import { asString } from './normalizePrimitives';

const OWNERS: readonly CongressOwner[] = ['self', 'spouse', 'joint', 'child'];

function toSide(rawType: string): CongressTradeSide {
    const t = rawType.trim().toLowerCase();
    if (t === 'purchase') return 'buy';
    if (t.startsWith('sale')) return 'sell'; // "Sale", "Sale (Full/Partial)", "Sale Partial" 모두 흡수
    return 'unknown';
}

function toOwner(raw: unknown): CongressOwner {
    const o = asString(raw).trim().toLowerCase();
    return (OWNERS as readonly string[]).includes(o) ? (o as CongressOwner) : 'unknown';
}

function toAmount(raw: unknown): CongressAmountRange {
    const label = asString(raw);
    // "$1,001 - $15,000" | "$50,000,000 +" | 그 외
    const nums = label.match(/\$[\d,]+/g);
    const parse = (s: string): number | null => {
        const n = Number(s.replace(/[$,]/g, ''));
        return Number.isFinite(n) ? n : null;
    };
    if (!nums || nums.length === 0) return { min: null, max: null, label };
    const min = parse(nums[0]);
    const max = nums.length >= 2 ? parse(nums[1]) : null; // 단일값("$X +")은 상한 없음
    return { min, max, label };
}

function toTrade(raw: RawCongressTrade, chamber: Chamber): CongressTrade {
    const rawType = asString(raw.type);
    return {
        chamber,
        firstName: asString(raw.firstName),
        lastName: asString(raw.lastName),
        office: asString(raw.office),
        district: asString(raw.district),
        owner: toOwner(raw.owner),
        side: toSide(rawType),
        rawType,
        amount: toAmount(raw.amount),
        assetType: asString(raw.assetType),
        assetDescription: asString(raw.assetDescription),
        transactionDate: asString(raw.transactionDate),
        disclosureDate: asString(raw.disclosureDate),
        link: asString(raw.link),
        capitalGainsOver200USD: asString(raw.capitalGainsOver200USD).toLowerCase() === 'true',
    };
}

/**
 * FMP senate-trades + house-trades wire 배열을 통합 도메인 모델로 정규화한다.
 * 상·하원 스키마가 동일하므로 단일 매퍼 + chamber 인자를 쓴다(부록 B.2).
 * 거래일(transactionDate) 내림차순 정렬. 절대 throw하지 않는다(부록 B.3/B.4).
 */
export function normalizeCongressTrades(
    senate: readonly RawCongressTrade[],
    house: readonly RawCongressTrade[]
): CongressTrade[] {
    const merged = [
        ...senate.map(r => toTrade(r, 'senate')),
        ...house.map(r => toTrade(r, 'house')),
    ];
    return merged.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}
```

> `asString`은 `./normalizePrimitives`에 이미 존재(financials 정규화가 사용). 시그니처: `asString(value: unknown): string` (string 아니면 `''`). 파일을 열어 export를 확인하고, `asString`이 null/undefined→`''`인지 검증한 뒤 사용한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/__tests__/domain/analysis/normalizeCongressTrades.test.ts`
Expected: PASS (모든 it)

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis/normalizeCongressTrades.ts src/__tests__/domain/analysis/normalizeCongressTrades.test.ts
git commit -m "feat(congress): wire→domain 정규화(side 변종·amount 구간·chamber)"
```

## Task A4: summarizeCongressTrades (결정론적 건수 통계)

> 부록 D #3: AI 우세 판정은 **건수 기반**. 통계는 결정론으로 코드에서 계산해 프롬프트에 주입한다.

**Files:**
- Create: `src/domain/analysis/summarizeCongressTrades.ts`
- Test: `src/__tests__/domain/analysis/summarizeCongressTrades.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
import { describe, expect, it } from 'vitest';
import { summarizeCongressTrades } from '@/domain/analysis/summarizeCongressTrades';
import type { CongressTrade } from '@/domain/types';

function trade(p: Partial<CongressTrade>): CongressTrade {
    return {
        chamber: 'senate', firstName: 'A', lastName: 'B', office: 'A B', district: 'WV',
        owner: 'self', side: 'buy', rawType: 'Purchase',
        amount: { min: 1001, max: 15000, label: '$1,001 - $15,000' },
        assetType: 'Stock', assetDescription: 'X', transactionDate: '2026-01-01',
        disclosureDate: '2026-02-01', link: '', capitalGainsOver200USD: false, ...p,
    };
}

describe('summarizeCongressTrades', () => {
    it('빈 입력은 no_trades', () => {
        const s = summarizeCongressTrades([]);
        expect(s).toEqual({ buyCount: 0, sellCount: 0, unknownCount: 0, direction: 'no_trades', uniqueMembers: 0, senateCount: 0, houseCount: 0 });
    });

    it('매수 우세는 net_buying', () => {
        const s = summarizeCongressTrades([trade({ side: 'buy' }), trade({ side: 'buy' }), trade({ side: 'sell' })]);
        expect(s.buyCount).toBe(2);
        expect(s.sellCount).toBe(1);
        expect(s.direction).toBe('net_buying');
    });

    it('매도 우세는 net_selling', () => {
        expect(summarizeCongressTrades([trade({ side: 'sell' }), trade({ side: 'buy' }), trade({ side: 'sell' })]).direction).toBe('net_selling');
    });

    it('동수는 balanced', () => {
        expect(summarizeCongressTrades([trade({ side: 'buy' }), trade({ side: 'sell' })]).direction).toBe('balanced');
    });

    it('unknown은 방향 판정에서 제외하되 카운트', () => {
        const s = summarizeCongressTrades([trade({ side: 'unknown' }), trade({ side: 'unknown' })]);
        expect(s.unknownCount).toBe(2);
        expect(s.direction).toBe('balanced'); // buy=sell=0
    });

    it('의원 고유 수는 office 기준 dedup', () => {
        const s = summarizeCongressTrades([trade({ office: 'A' }), trade({ office: 'A' }), trade({ office: 'B' })]);
        expect(s.uniqueMembers).toBe(2);
    });

    it('chamber별 건수를 센다', () => {
        const s = summarizeCongressTrades([trade({ chamber: 'senate' }), trade({ chamber: 'house' }), trade({ chamber: 'house' })]);
        expect(s.senateCount).toBe(1);
        expect(s.houseCount).toBe(2);
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/__tests__/domain/analysis/summarizeCongressTrades.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: 구현 작성**

```typescript
import type {
    CongressTrade,
    CongressTradeStats,
    CongressTrendDirection,
} from '@/domain/types';

function directionOf(buyCount: number, sellCount: number, total: number): CongressTrendDirection {
    if (total === 0) return 'no_trades';
    if (buyCount > sellCount) return 'net_buying';
    if (sellCount > buyCount) return 'net_selling';
    return 'balanced';
}

/**
 * 거래 표를 결정론적 건수 통계로 요약한다(부록 D #3 — 건수 기반 우세).
 * amount 구간은 정확 합산 불가하므로 금액이 아닌 건수로 방향을 판정한다.
 */
export function summarizeCongressTrades(
    trades: readonly CongressTrade[]
): CongressTradeStats {
    let buyCount = 0;
    let sellCount = 0;
    let unknownCount = 0;
    let senateCount = 0;
    let houseCount = 0;
    const members = new Set<string>();
    for (const t of trades) {
        if (t.side === 'buy') buyCount++;
        else if (t.side === 'sell') sellCount++;
        else unknownCount++;
        if (t.chamber === 'senate') senateCount++;
        else houseCount++;
        members.add(t.office);
    }
    return {
        buyCount,
        sellCount,
        unknownCount,
        direction: directionOf(buyCount, sellCount, trades.length),
        uniqueMembers: members.size,
        senateCount,
        houseCount,
    };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/__tests__/domain/analysis/summarizeCongressTrades.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis/summarizeCongressTrades.ts src/__tests__/domain/analysis/summarizeCongressTrades.test.ts
git commit -m "feat(congress): 결정론적 건수 통계(summarizeCongressTrades)"
```

## Task A5: congressTrendPrompt (AI 프롬프트 빌더)

**Files:**
- Create: `src/domain/analysis/congressTrendPrompt.ts`
- Test: `src/__tests__/domain/analysis/congressTrendPrompt.test.ts`

> 먼저 `src/domain/analysis/financialsPrompt.ts`를 읽어 ① skills 필터(`category === ...`) 주입 방식, ② JSON-schema 응답 지시 문자열 포맷, ③ Skill 타입 import 경로를 확인하고 동일 스타일로 작성한다. financials는 `category === 'fundamental'`을 필터 — congress는 `category === 'congress'`(없으면 빈 배열, financials와 동일하게 graceful).

- [ ] **Step 1: 실패 테스트 작성**

```typescript
import { describe, expect, it } from 'vitest';
import { buildCongressTrendPrompt } from '@/domain/analysis/congressTrendPrompt';
import type { CongressTrade, CongressTradeStats } from '@/domain/types';

const stats: CongressTradeStats = {
    buyCount: 3, sellCount: 1, unknownCount: 0, direction: 'net_buying',
    uniqueMembers: 2, senateCount: 2, houseCount: 2,
};
const trades: CongressTrade[] = [{
    chamber: 'senate', firstName: 'Shelley', lastName: 'Capito', office: 'Shelley Capito',
    district: 'WV', owner: 'spouse', side: 'buy', rawType: 'Purchase',
    amount: { min: 1001, max: 15000, label: '$1,001 - $15,000' },
    assetType: 'Stock', assetDescription: 'Apple Inc', transactionDate: '2026-04-17',
    disclosureDate: '2026-05-07', link: '', capitalGainsOver200USD: false,
}];

describe('buildCongressTrendPrompt', () => {
    it('심볼과 건수 통계를 프롬프트에 주입한다', () => {
        const p = buildCongressTrendPrompt('AAPL', trades, stats, []);
        expect(p).toContain('AAPL');
        expect(p).toContain('3'); // buyCount
        expect(p).toContain('net_buying');
    });

    it('공시 지연(약 45일) 주의를 프롬프트에 포함한다', () => {
        const p = buildCongressTrendPrompt('AAPL', trades, stats, []);
        expect(p.toLowerCase()).toContain('disclos'); // disclosure lag 언급
    });

    it('JSON 응답 필드(summaryKo 등)를 지시한다', () => {
        const p = buildCongressTrendPrompt('AAPL', trades, stats, []);
        expect(p).toContain('summaryKo');
        expect(p).toContain('overallSentiment');
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/__tests__/domain/analysis/congressTrendPrompt.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현 작성** (financialsPrompt 스타일 — 영어 본문, KO 응답 필드 지시)

```typescript
import type { CongressTrade, CongressTradeStats } from '@/domain/types';
import type { Skill } from '@/domain/types'; // financialsPrompt와 동일 경로 사용 (확인 후 맞춤)

function formatTrades(trades: readonly CongressTrade[]): string {
    return trades
        .slice(0, 50)
        .map(
            t =>
                `- ${t.chamber} | ${t.office} (${t.district}) | ${t.side} | ${t.amount.label} | ${t.assetType} | tx ${t.transactionDate} / disclosed ${t.disclosureDate}`
        )
        .join('\n');
}

/**
 * 의회 거래 동향 해석 프롬프트. 우세 방향은 결정론적 건수 통계(stats)로 주입하고,
 * LLM은 산문 해석(summaryKo/notableMembersKo/riskNoteKo/overallSentiment)만 생성한다.
 * 공시 지연(~45일) 한계를 명시해 과대해석을 막는다.
 */
export function buildCongressTrendPrompt(
    symbol: string,
    trades: readonly CongressTrade[],
    stats: CongressTradeStats,
    skills: readonly Skill[]
): string {
    const skillLines = skills
        .filter(s => s.category === 'congress')
        .map(s => `- ${s.name}: ${s.content}`)
        .join('\n');
    return `You are a financial analyst summarizing US congressional (Senate + House) stock trading disclosures for ${symbol}.

Deterministic trade statistics (count-based; amounts are disclosed as ranges, so use COUNTS, not notional sums):
- Buys: ${stats.buyCount}, Sells: ${stats.sellCount}, Unknown: ${stats.unknownCount}
- Net direction: ${stats.direction}
- Unique members: ${stats.uniqueMembers} (Senate ${stats.senateCount}, House ${stats.houseCount})

Recent trades (newest first, max 50):
${formatTrades(trades)}

${skillLines ? `Domain notes:\n${skillLines}\n` : ''}
IMPORTANT caveats: Congressional trades are disclosed with a lag of ~45 days (sometimes longer), and amounts are coarse ranges. Do NOT overstate signal. This is sentiment/context, not a precise quantitative score.

Respond ONLY with a JSON object (no markdown fences) matching:
{
  "summaryKo": string,            // 2-4문장, '~이에요'체 한국어 동향 요약
  "notableMembersKo": string[],   // 주목할 의원·패턴 (없으면 [])
  "riskNoteKo": string,           // 공시지연·데이터 희소성 등 한 줄 주의
  "overallSentiment": "bullish" | "neutral" | "bearish"
}`;
}
```

> Skill 타입의 import 경로·`category` 필드 유무는 financialsPrompt.ts에서 확인 후 정확히 맞춘다. financials가 다른 import 경로/필터 헬퍼를 쓰면 그대로 채택한다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/__tests__/domain/analysis/congressTrendPrompt.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis/congressTrendPrompt.ts src/__tests__/domain/analysis/congressTrendPrompt.test.ts
git commit -m "feat(congress): AI 동향 프롬프트 빌더(건수 통계 주입)"
```

## Task A6: normalizeCongressTrendResponse (LLM raw→typed)

> `normalizeFinancialsAnalysisResponse` 패턴 그대로(부록 C). markdown fence 제거→JSON.parse→방어 정규화, JSON.parse 외 throw 금지.

**Files:**
- Create: `src/domain/analysis/normalizeCongressTrend.ts`
- Test: `src/__tests__/domain/analysis/normalizeCongressTrend.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
import { describe, expect, it } from 'vitest';
import { normalizeCongressTrendResponse } from '@/domain/analysis/normalizeCongressTrend';

describe('normalizeCongressTrendResponse', () => {
    it('정상 객체를 통과시킨다', () => {
        const r = normalizeCongressTrendResponse({
            summaryKo: '최근 순매수 우세예요.',
            notableMembersKo: ['Capito 의원 매수'],
            riskNoteKo: '공시 지연 45일 유의.',
            overallSentiment: 'bullish',
        });
        expect(r.summaryKo).toBe('최근 순매수 우세예요.');
        expect(r.notableMembersKo).toEqual(['Capito 의원 매수']);
        expect(r.overallSentiment).toBe('bullish');
    });

    it('markdown fence 감싼 JSON 문자열을 파싱한다', () => {
        const raw = '```json\n{"summaryKo":"x","overallSentiment":"bearish"}\n```';
        const r = normalizeCongressTrendResponse(raw);
        expect(r.summaryKo).toBe('x');
        expect(r.overallSentiment).toBe('bearish');
    });

    it('누락 string은 빈 문자열, 누락 array는 []', () => {
        const r = normalizeCongressTrendResponse({});
        expect(r.summaryKo).toBe('');
        expect(r.riskNoteKo).toBe('');
        expect(r.notableMembersKo).toEqual([]);
    });

    it('invalid enum은 neutral로 폴백', () => {
        expect(normalizeCongressTrendResponse({ overallSentiment: 'moon' }).overallSentiment).toBe('neutral');
    });

    it('notableMembersKo의 비문자열 항목은 드롭', () => {
        const r = normalizeCongressTrendResponse({ notableMembersKo: ['ok', 3, null, ''] });
        expect(r.notableMembersKo).toEqual(['ok']);
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/__tests__/domain/analysis/normalizeCongressTrend.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현 작성** (normalizeFinancials.ts 구조 미러)

```typescript
import type {
    CongressSentiment,
    CongressTrendResponse,
    RawCongressTrendResponse,
} from '@/domain/types';
import { asArray, asEnum, asObject, asString } from './normalizePrimitives';
import { extractJsonFromLlmResponse } from './promptFormat';

const VALID_SENTIMENTS: readonly CongressSentiment[] = ['bullish', 'neutral', 'bearish'];

function parseLlmPayload(raw: unknown): unknown {
    return typeof raw === 'string' ? extractJsonFromLlmResponse(raw) : raw;
}

function normalizeStringArray(raw: unknown): string[] {
    return asArray(raw)
        .map(item => asString(item))
        .filter(item => item.length > 0);
}

export function normalizeCongressTrendResponse(raw: unknown): CongressTrendResponse {
    const parsed = parseLlmPayload(raw);
    const o = (asObject(parsed) ?? {}) as RawCongressTrendResponse;
    return {
        summaryKo: asString(o.summaryKo),
        notableMembersKo: normalizeStringArray(o.notableMembersKo),
        riskNoteKo: asString(o.riskNoteKo),
        overallSentiment: asEnum(o.overallSentiment, VALID_SENTIMENTS, 'neutral'),
    };
}
```

> `asArray`/`asEnum`/`asObject`/`asString`은 `./normalizePrimitives`, `extractJsonFromLlmResponse`는 `./promptFormat`에 존재(financials가 동일 import). 경로/시그니처를 normalizeFinancials.ts에서 확인 후 사용.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/__tests__/domain/analysis/normalizeCongressTrend.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis/normalizeCongressTrend.ts src/__tests__/domain/analysis/normalizeCongressTrend.test.ts
git commit -m "feat(congress): LLM 응답 방어 정규화(normalizeCongressTrendResponse)"
```

## Task A7: AI 잡 (submit/poll/cancel) + 캐시 설정

> financials `application/financials/*`를 미러. 구조가 복잡(worker 큐·Redis 잡 lifecycle·responseSchema·systemPrompt)하므로 **먼저 `src/application/financials/submitFinancialsAnalysis.ts`, `pollFinancialsAnalysis.ts`, `cancelFinancialsAnalysisJob.ts`, `types.ts`, 그리고 `src/infrastructure/cache/config.ts`의 financials 캐시 키/TTL/버전 정의를 정독**한다. congress는 scorecard가 없어 더 단순하다(snapshot=trades 배열, scorecard 주입 없음).

**Files:**
- Create: `src/application/congress/submitCongressTrend.ts`
- Create: `src/application/congress/pollCongressTrend.ts`
- Create: `src/application/congress/cancelCongressTrendJob.ts`
- Create: `src/application/congress/types.ts`
- Modify: `src/infrastructure/cache/config.ts`
- Test: `src/__tests__/application/congress/{submitCongressTrend,pollCongressTrend}.test.ts`

- [ ] **Step 1: 캐시 설정 추가** — `src/infrastructure/cache/config.ts`에 financials 정의 인근에 추가.

```typescript
export const CONGRESS_PROMPT_TEMPLATE_VERSION = 'p1' as const;
export const CONGRESS_CACHE_TTL_SECONDS = 86400; // 24h (공시지연 45일 — financials와 동일)

export function buildCongressTrendCacheKey(
    symbol: string,
    modelId: string,
    skillFingerprint: string
): string {
    return `congress-trend:${symbol.toUpperCase()}:${modelId}:${CONGRESS_PROMPT_TEMPLATE_VERSION}:${skillFingerprint}`;
}
```

> financials의 `buildFinancialsCacheKey` 시그니처(skillFingerprint 계산 방식, hashSkillCatalog 사용 여부)를 확인하고 동일 방식으로 fingerprint를 구성한다(메모리 `prompt_template_cache_version`: name/gating/tokenCost만 해싱).

- [ ] **Step 2: types.ts 작성** (financials types.ts 미러)

```typescript
import type { ModelId, Tier, TierConfig } from '@/domain/types';
import type { CongressTradesProvider } from '@/domain/ports/congressTradesProvider';
import type { CongressTrendResponse } from '@/domain/types';
import type { BackgroundTaskOptions } from '@/application/market/types'; // financials와 동일 경로 확인

export interface SubmitCongressTrendOptions extends BackgroundTaskOptions {
    symbol: string;
    modelId: ModelId;
    dataProvider: CongressTradesProvider;
    tier?: Tier;
    tierConfig?: TierConfig;
    userApiKey?: string;
    skipEnqueueIfMiss?: boolean;
    force?: boolean;
    limit?: number; // 기본 50 (부록 D #4)
}

export type SubmitCongressTrendResult =
    | { status: 'cached'; result: CongressTrendResponse }
    | { status: 'submitted'; jobId: string }
    | { status: 'miss_no_trigger' }
    | { status: 'no_trades' } // 거래 0건 → AI 생략(부록 D / 스펙 §6)
    | { status: 'error'; code: 'fetch_failed'; error?: string };

export type PollCongressTrendResult =
    | { status: 'processing' }
    | { status: 'done'; result: CongressTrendResponse }
    | { status: 'error'; error: string };
```

> financials `SubmitFinancialsAnalysisResult`의 usage_limit/userApiKey 변형이 congress(전체 공개·비목표 tier)에서 필요한지 확인. tier 게이팅이 congress 비목표(스펙 §2)이므로 usage_limit 변형은 생략 가능하나, 코어 공용 게이트를 재사용하면 financials와 동일 union을 그대로 채택한다.

- [ ] **Step 3: submitCongressTrend 작성** (financials submit 미러 + `no_trades` 분기)

`submitFinancialsAnalysis.ts`를 복제해 아래로 바꾼다:
- 6종 statement fetch → `getTrades(symbol,'senate',limit)` + `getTrades(symbol,'house',limit)` 병렬 → `normalizeCongressTrades`.
- **정규화 결과 trades.length === 0 → `return { status: 'no_trades' }`** (enqueue·LLM 호출 안 함).
- `computeFinancialsScorecard` 주입 제거. 대신 `summarizeCongressTrades(trades)` → `buildCongressTrendPrompt(symbol, trades, stats, skills)`.
- 캐시 키 `buildCongressTrendCacheKey`, `analysisType: 'congress'`, responseSchema/systemPrompt는 congress용으로 추가(financials의 responseSchemas.ts/systemPrompt.ts에 congress 항목 추가 — 해당 파일 구조 확인 후 미러).
- `skipEnqueueIfMiss` 분기는 financials와 동일(`miss_no_trigger`).

- [ ] **Step 4: pollCongressTrend / cancelCongressTrendJob 작성**

`pollCongressTrend.ts`: financials poll 미러, `normalizeCongressTrendResponse`로 정규화 + `CONGRESS_CACHE_TTL_SECONDS`로 캐시.
`cancelCongressTrendJob.ts`: financials처럼 공용 cancel 재-export.
```typescript
export { cancelAnalysisJob as cancelCongressTrendJob } from '@/application/market/cancelAnalysisJob';
```

- [ ] **Step 5: 테스트 작성·통과** (submitFinancialsAnalysis.test.ts / pollFinancialsAnalysis.test.ts 미러)

핵심 케이스:
- 캐시 HIT → `{status:'cached'}` (LLM 호출 0).
- 캐시 MISS + trades 있음 + `skipEnqueueIfMiss:false` → `{status:'submitted', jobId}`.
- 캐시 MISS + `skipEnqueueIfMiss:true` → `{status:'miss_no_trigger'}` (fetch·enqueue 0).
- **trades 0건 → `{status:'no_trades'}` (enqueue 0)** ← congress 특화, 양방향 테스트.
- poll done → `normalizeCongressTrendResponse` 적용 + 캐시 set.
- poll 깨진 LLM 출력 → 정규화로 안전 typed 반환.

Run: `npx vitest run src/__tests__/application/congress/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/application/congress src/infrastructure/cache/config.ts src/__tests__/application/congress
git commit -m "feat(congress): AI 동향 잡 submit/poll/cancel + 캐시 설정(no_trades 분기)"
```

## Task A8: public barrel export + 빌드 검증

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: export 추가** (financials export 인근, 동일 tier 구획에)

```typescript
// application
export { submitCongressTrend } from './application/congress/submitCongressTrend';
export { pollCongressTrend } from './application/congress/pollCongressTrend';
export { cancelCongressTrendJob } from './application/congress/cancelCongressTrendJob';
// domain
export { normalizeCongressTrades } from './domain/analysis/normalizeCongressTrades';
export { summarizeCongressTrades } from './domain/analysis/summarizeCongressTrades';
export { buildCongressTrendPrompt } from './domain/analysis/congressTrendPrompt';
export { normalizeCongressTrendResponse } from './domain/analysis/normalizeCongressTrend';
// types
export type {
    SubmitCongressTrendOptions,
    SubmitCongressTrendResult,
    PollCongressTrendResult,
} from './application/congress/types';
export type {
    Chamber,
    CongressTradeSide,
    CongressOwner,
    CongressSentiment,
    CongressTrendDirection,
    CongressAmountRange,
    CongressTrade,
    RawCongressTrade,
    CongressTradeStats,
    CongressTrendResponse,
} from './domain/types';
export type { CongressTradesProvider } from './domain/ports/congressTradesProvider';
```

- [ ] **Step 2: 전체 빌드 + 테스트 + 커버리지**

Run: `npm run build && npx vitest run --coverage`
Expected: 빌드 PASS, dist 생성, congress 파일 커버리지 ≥90%

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(congress): public API barrel export"
```

## Task A9: core 빌드 → siglens overlay (병목 최소화) + 사용자 publish 병행

> 사용자 지침: **publish를 기다리지 않고** core dist를 overlay해 Part B를 즉시 시작한다. publish는 사용자가 병행. Claude는 publish 명령을 실행하지 않는다(메모리 `user_handles_core_publish`).

- [ ] **Step 1: core 빌드 + dist overlay** — Part B를 즉시 언블록.

```bash
# core 레포에서
cd /Users/y0ngha/Project/siglens-core && npm run build
# siglens 워크트리 node_modules에 dist + types 오버레이
cp -R /Users/y0ngha/Project/siglens-core/dist/* \
  /Users/y0ngha/Project/siglens/.claude/worktrees/feat+symbol-congress/node_modules/@y0ngha/siglens-core/dist/
```
> dist 외에 `package.json`의 `main`/`types`가 가리키는 경로가 모두 갱신됐는지 확인. 타입(`*.d.ts`)도 함께 복사돼야 siglens 타입체크가 새 congress export를 본다.

- [ ] **Step 2: overlay 해석 smoke** — siglens 워크트리에서 새 export 해석 확인.

Run: 워크트리에서 `yarn tsc --noEmit -e "import { normalizeCongressTrades } from '@y0ngha/siglens-core'; void normalizeCongressTrades;"` 류 스크래치, 또는 Task B2 첫 import가 해석되는지로 갈음.
Expected: `normalizeCongressTrades`/`CongressTradesProvider`/`CongressTrade` 등 타입·런타임 해석 OK.

- [ ] **Step 3: 사용자에게 publish 요청(병행, 비차단)**

사용자에게 보고(STOP 아님): "core congress 모듈 구현·테스트·overlay 완료. Part B는 overlay 위에서 진행합니다. 편하실 때 `npm version <minor>` + `git push --tags`로 GitHub Packages 릴리스를 진행해 주시고, 배포된 버전(예: 0.24.0)을 알려주세요 — 최종 검증/PR 직전에 핀을 그 버전으로 갱신하고 clean install로 일치를 확인하겠습니다." → **Part B 계속 진행**(publish 대기 없음).

---

# PART B — siglens (앱)

> 작업 디렉토리: 워크트리 `.claude/worktrees/feat+symbol-congress`. 테스트: `yarn test <file>`(vitest). 린트: `yarn lint`. **`--no-verify` 금지**(메모리). 커밋은 git-agent 라우팅.

## Task B0: overlay 위에서 Part B 시작 (publish 대기 없음)

> Task A9에서 core dist를 이미 overlay했으므로 Part B는 즉시 시작한다. **버전 핀 갱신 + clean install은 이 태스크가 아니라 Task B12.5(최종 검증 직전)에서** 사용자 publish 후 수행한다.

- [ ] **Step 1: overlay 상태 확인** — `node_modules/@y0ngha/siglens-core/dist`에 congress 산출물이 있는지 확인(Task A9 Step 1 완료 전제). 없으면 A9 Step 1 재실행.
- [ ] **Step 2: 기존 스위트 회귀 0 확인** — overlay가 기존 financials 등 core 소비를 깨지 않았는지.

Run: `yarn test src/shared/api/fmp` (또는 빠른 부분 스위트)
Expected: PASS (overlay된 core가 기존 export를 보존)

## Task B1: CONGRESS_REVALIDATE_SECONDS 상수

**Files:**
- Modify: `src/shared/config/time.ts`
- Test: `src/shared/config/__tests__/time.test.ts` (있으면 보강, 없으면 생략)

- [ ] **Step 1: 상수 추가** (FMP_STATEMENTS_REVALIDATE_SECONDS 인근)

```typescript
export const CONGRESS_REVALIDATE_SECONDS = SECONDS_PER_DAY; // 24h — 의회 거래 공시지연 ~45일
```

- [ ] **Step 2: 컴파일 확인** → `yarn tsc --noEmit`
- [ ] **Step 3: Commit** → `git commit -m "feat(congress): revalidate 상수 추가"`

## Task B2: FMP 어댑터 (congressTradesClient)

> `financialStatementsClient.ts` 패턴: `fmpGet`, `num()`/`asString` 좌표, raw→domain은 **core `normalizeCongressTrades`에 위임**하지 않고 어댑터는 **raw 배열만 반환**할지 결정. financials 어댑터는 도메인 Row를 직접 만든다. 그러나 congress 정규화(chamber 합치기·정렬)는 core에 있으므로, **어댑터는 chamber별 raw 배열을 그대로 반환**하고 정규화는 상위(`getCongressTrades`)에서 `normalizeCongressTrades(senate, house)` 호출이 깔끔하다.

**결정(이 계획 확정):** 어댑터 `congressTradesClient.getTradesRaw(symbol, chamber, limit): Promise<RawCongressTrade[]>` — FMP 호출 + JSON 반환만. 정규화는 entity 레이어(`getCongressTrades`)에서.
하지만 port `CongressTradesProvider.getTrades`는 **도메인 `CongressTrade[]`** 를 반환해야 캐시 단위가 도메인 모델이 된다. → 어댑터가 `CongressTradesProvider`를 구현하되, 단일 chamber 정규화를 위해 core에 `normalizeChamberTrades(raw, chamber)`를 노출하거나, 어댑터에서 `normalizeCongressTrades(raw, [])`/`normalizeCongressTrades([], raw)`로 chamber별 정규화한다(후자: 추가 core export 불필요).

**Files:**
- Create: `src/shared/api/fmp/congressTrades.types.ts` (raw 타입 재-export 또는 생략 — core `RawCongressTrade` 사용)
- Create: `src/shared/api/fmp/congressTradesClient.ts`
- Test: `src/shared/api/fmp/__tests__/congressTradesClient.test.ts`

- [ ] **Step 1: 실패 테스트 작성** (financialStatementsClient.test.ts의 global fetch mock 스타일)

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FmpCongressTradesClient } from '@/shared/api/fmp/congressTradesClient';

const mockFetch = vi.fn();

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

function mockOk(body: unknown) {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => body } as Response);
}

const sampleSenate = [{
    symbol: 'AAPL', senateID: 'C001047', disclosureDate: '2026-05-07', transactionDate: '2026-04-17',
    firstName: 'Shelley', lastName: 'Capito', office: 'Shelley Capito', district: 'WV', owner: 'Spouse',
    assetDescription: 'Apple Inc', assetType: 'Stock', type: 'Sale', amount: '$1,001 - $15,000',
    capitalGainsOver200USD: 'False', comment: '', link: 'https://efd',
}];

describe('FmpCongressTradesClient', () => {
    it('senate chamber는 /stable/senate-trades를 symbol과 함께 호출한다', async () => {
        mockOk(sampleSenate);
        const client = new FmpCongressTradesClient();
        const out = await client.getTrades('aapl', 'senate', 50);
        const url = String(mockFetch.mock.calls[0][0]);
        expect(url).toContain('/stable/senate-trades');
        expect(url).toContain('symbol=AAPL');
        expect(out[0].chamber).toBe('senate');
        expect(out[0].side).toBe('sell');
    });

    it('house chamber는 /stable/house-trades를 호출한다', async () => {
        mockOk([]);
        const client = new FmpCongressTradesClient();
        await client.getTrades('AAPL', 'house', 50);
        expect(String(mockFetch.mock.calls[0][0])).toContain('/stable/house-trades');
    });

    it('빈 배열 응답은 빈 배열 반환(throw 금지)', async () => {
        mockOk([]);
        const out = await new FmpCongressTradesClient().getTrades('ZZZZ', 'senate', 50);
        expect(out).toEqual([]);
    });

    it('FMP 5xx는 throw(swallow 금지 — 장애 표면화)', async () => {
        mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response);
        await expect(new FmpCongressTradesClient().getTrades('AAPL', 'senate', 50)).rejects.toBeDefined();
    });
});
```

- [ ] **Step 2: 실패 확인** → `yarn test src/shared/api/fmp/__tests__/congressTradesClient.test.ts` → FAIL
- [ ] **Step 3: 구현 작성**

```typescript
import { normalizeCongressTrades } from '@y0ngha/siglens-core';
import type { Chamber, CongressTrade, RawCongressTrade } from '@y0ngha/siglens-core';
import { CONGRESS_REVALIDATE_SECONDS } from '@/shared/config/time';
import { fmpGet } from './httpClient';
import type { CongressTradesProvider } from '@y0ngha/siglens-core';

const ENDPOINT: Record<Chamber, string> = {
    senate: 'senate-trades',
    house: 'house-trades',
};

export class FmpCongressTradesClient implements CongressTradesProvider {
    async getTrades(symbol: string, chamber: Chamber, limit: number): Promise<CongressTrade[]> {
        const upper = symbol.toUpperCase();
        const raw = await fmpGet<RawCongressTrade[]>(
            ENDPOINT[chamber],
            { symbol: upper },
            { revalidate: CONGRESS_REVALIDATE_SECONDS }
        );
        const rows = Array.isArray(raw) ? raw : [];
        const normalized = chamber === 'senate'
            ? normalizeCongressTrades(rows, [])
            : normalizeCongressTrades([], rows);
        return normalized.slice(0, limit);
    }
}
```

> `fmpGet` 시그니처는 `httpClient.ts` 확인(`fmpGet<T>(path, query, opts)`). FMP는 `limit` 쿼리를 지원하지 않을 수 있어(Phase 0에서 최대 100 반환) 클라가 `.slice(0, limit)`로 상한 적용. 단일 chamber만 정규화하므로 빈 배열 인자를 반대편에 넣는다.

- [ ] **Step 4: 통과 확인** → `yarn test src/shared/api/fmp/__tests__/congressTradesClient.test.ts` → PASS
- [ ] **Step 5: Commit** → `git commit -m "feat(congress): FMP senate/house-trades 어댑터"`

## Task B3: CachedCongressTradesProvider (2키 캐시, throw 표면화) ⚠️핵심 deviation

> **financials와의 유일한 의도적 차이.** financials CachedProvider는 `throw→[]` graceful이지만, congress는 정상 `[]`(거래 없음)와 장애를 구분해야 하므로 **장애를 throw로 표면화**(graceful catch 안 함). 정상 `[]`는 캐시 허용. 0건↔장애 구분은 상위 resilient 래퍼(Task B4)가 담당.

**Files:**
- Create: `src/shared/api/fmp/CachedCongressTradesProvider.ts`
- Test: `src/shared/api/fmp/__tests__/CachedCongressTradesProvider.test.ts`

- [ ] **Step 1: 실패 테스트 작성** (CachedFinancialStatementsProvider.test.ts의 in-memory fake Redis 스타일)

```typescript
import { describe, expect, it, vi } from 'vitest';
// fake Redis + getOrSetCache 모킹은 financials 테스트와 동일 셋업(vi.hoisted Map store) 사용.
import { CachedCongressTradesProvider } from '@/shared/api/fmp/CachedCongressTradesProvider';
import type { Chamber, CongressTrade } from '@y0ngha/siglens-core';

function fakeInner(impl: (s: string, c: Chamber) => CongressTrade[] | Promise<never>) {
    return { getTrades: vi.fn(async (s: string, c: Chamber) => impl(s, c)) };
}

describe('CachedCongressTradesProvider', () => {
    it('캐시 키는 congress:<chamber>:<SYM> 형식(대문자)', async () => {
        // getOrSetCache 모킹이 첫 인자(key)를 캡처하도록 셋업 후
        const inner = fakeInner(() => []);
        await new CachedCongressTradesProvider(inner).getTrades('aapl', 'senate', 50);
        // expect captured key === 'congress:senate:AAPL'
    });

    it('정상 빈 배열([])은 캐시한다(거래 없음=정상)', async () => {
        const inner = fakeInner(() => []);
        const p = new CachedCongressTradesProvider(inner);
        const a = await p.getTrades('AAPL', 'senate', 50);
        const b = await p.getTrades('AAPL', 'senate', 50);
        expect(a).toEqual([]);
        expect(b).toEqual([]);
        // React.cache dedup으로 inner 1회 (per-request)
    });

    it('inner throw는 표면화(rethrow), 캐시 set 안 함', async () => {
        const inner = fakeInner(() => Promise.reject(new Error('FMP 500')) as Promise<never>);
        await expect(new CachedCongressTradesProvider(inner).getTrades('AAPL', 'house', 50)).rejects.toThrow('FMP 500');
        // 새 provider가 다시 inner를 호출(poison 캐시 없음)
    });
});
```

- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현 작성** (CachedFinancialStatementsProvider 미러, **단 `.catch(()=>[])` 제거**)

```typescript
import { cache } from 'react';
import { getOrSetCache } from '@/shared/cache/getOrSetCache'; // financials와 동일 경로 확인
import { CONGRESS_REVALIDATE_SECONDS } from '@/shared/config/time';
import type { Chamber, CongressTrade, CongressTradesProvider } from '@y0ngha/siglens-core';

function key(symbol: string, chamber: Chamber): string {
    return `congress:${chamber}:${symbol.toUpperCase()}`;
}

/**
 * 2계층 캐시 데코레이터. financials와 달리 **장애를 throw로 표면화**한다.
 * 거래 0건(정상 []) → 캐시 허용 / FMP 장애(throw) → 캐시 미오염 + rethrow.
 * 0건↔장애 구분은 상위 getCongressTradesResilient가 담당한다(부록 B.6).
 */
export class CachedCongressTradesProvider implements CongressTradesProvider {
    constructor(private readonly inner: CongressTradesProvider) {}

    private readonly cachedSenate = cache((symbol: string, limit: number) =>
        getOrSetCache(key(symbol, 'senate'), CONGRESS_REVALIDATE_SECONDS, () =>
            this.inner.getTrades(symbol, 'senate', limit)
        )
    );
    private readonly cachedHouse = cache((symbol: string, limit: number) =>
        getOrSetCache(key(symbol, 'house'), CONGRESS_REVALIDATE_SECONDS, () =>
            this.inner.getTrades(symbol, 'house', limit)
        )
    );

    getTrades(symbol: string, chamber: Chamber, limit: number): Promise<CongressTrade[]> {
        return chamber === 'senate'
            ? this.cachedSenate(symbol, limit)
            : this.cachedHouse(symbol, limit);
    }
}
```

> `getOrSetCache` 정확 시그니처(인자 순서·TTL 위치)와 fetcher throw 시 set 스킵·rethrow 동작을 financials 구현/테스트에서 확인. financials가 `getOrSetCache(...).catch(()=>[])`로 감쌌다면 **여기선 그 catch를 의도적으로 생략**한다. `cache((s, n) => ...)`로 인자 2개를 받는 형태가 React.cache에서 동작하는지(financials는 메서드별 cache) 확인 후 맞춘다.

- [ ] **Step 4: 통과 확인** → PASS (특히 throw 표면화·정상 [] 캐시 양방향)
- [ ] **Step 5: Commit** → `git commit -m "feat(congress): 2키 캐시 데코(장애 throw 표면화, 0건 캐시)"`

## Task B4: getCongressTradesResilient (0건↔장애 구분 래퍼) ⚠️핵심

> `getProfileResilient` 패턴 미러. provider가 throw하면 `degraded:true`, 정상이면(빈 배열 포함) `degraded:false`. **이 분기가 페이지 degrade·noindex의 단일 소스.**

**Files:**
- Create: `src/entities/congress-trades/lib/getCongressTrades.ts`
- Create: `src/entities/congress-trades/lib/getCongressTradesResilient.ts`
- Create: `src/entities/congress-trades/index.ts`
- Test: `src/entities/congress-trades/lib/__tests__/getCongressTradesResilient.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/fmp/getCongressTradesProvider', () => ({
    getCongressTradesProvider: vi.fn(),
}));
import { getCongressTradesProvider } from '@/shared/api/fmp/getCongressTradesProvider';
import { getCongressTradesResilient } from '@/entities/congress-trades';

describe('getCongressTradesResilient', () => {
    it('정상 빈 결과는 degraded:false, trades:[] (거래 없음=정상)', async () => {
        vi.mocked(getCongressTradesProvider).mockReturnValue({ getTrades: vi.fn(async () => []) });
        const r = await getCongressTradesResilient('AAPL');
        expect(r).toEqual({ trades: [], degraded: false });
    });

    it('provider throw는 degraded:true, trades:[]', async () => {
        vi.mocked(getCongressTradesProvider).mockReturnValue({
            getTrades: vi.fn(async () => { throw new Error('FMP 500'); }),
        });
        const r = await getCongressTradesResilient('AAPL');
        expect(r.degraded).toBe(true);
        expect(r.trades).toEqual([]);
    });

    it('한쪽(senate)만 throw해도 degraded:true (부분 장애 보수적 처리)', async () => {
        const getTrades = vi.fn(async (_s: string, chamber: string) => {
            if (chamber === 'senate') throw new Error('FMP 500');
            return [];
        });
        vi.mocked(getCongressTradesProvider).mockReturnValue({ getTrades });
        const r = await getCongressTradesResilient('AAPL');
        expect(r.degraded).toBe(true);
    });
});
```

- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현 작성**

`getCongressTrades.ts` — 정규화된 통합 trades (장애 throw 표면화):
```typescript
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { getCongressTradesProvider } from '@/shared/api/fmp/getCongressTradesProvider';
import type { CongressTrade } from '@y0ngha/siglens-core';

const CONGRESS_TRADE_LIMIT = 50; // 부록 D #4

export async function getCongressTrades(symbol: string): Promise<CongressTrade[]> {
    const upper = symbol.toUpperCase();
    const provider = getCongressTradesProvider();
    const [senate, house] = await Promise.all([
        staticSymbolCache(['congress:senate', upper], upper,
            () => provider.getTrades(upper, 'senate', CONGRESS_TRADE_LIMIT), ['congress:' + upper]),
        staticSymbolCache(['congress:house', upper], upper,
            () => provider.getTrades(upper, 'house', CONGRESS_TRADE_LIMIT), ['congress:' + upper]),
    ]);
    // 두 chamber는 이미 각자 정렬됨 → 병합 후 거래일 desc 재정렬
    return [...senate, ...house].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}
```

`getCongressTradesResilient.ts` — degrade 판정 (getProfileResilient 미러):
```typescript
import { isDynamicServerError } from 'next/dist/client/components/hooks-server-context'; // getProfileResilient와 동일 import 확인
import { isE2E } from '@/shared/api/e2eEnv';
import type { CongressTrade } from '@y0ngha/siglens-core';
import { getCongressTrades } from './getCongressTrades';

export interface ResilientCongressTrades {
    trades: CongressTrade[];
    degraded: boolean; // true = FMP 인프라 장애(throw). false = 정상(0건 포함)
}

export async function getCongressTradesResilient(symbol: string): Promise<ResilientCongressTrades> {
    try {
        return { trades: await getCongressTrades(symbol), degraded: false };
    } catch (e) {
        if (isDynamicServerError(e)) throw e;
        if (!isE2E()) {
            console.error('[getCongressTradesResilient] FMP 의회 거래 장애, degrade:', e);
        }
        return { trades: [], degraded: true };
    }
}
```

`index.ts` barrel:
```typescript
export { getCongressTrades } from './lib/getCongressTrades';
export { getCongressTradesResilient } from './lib/getCongressTradesResilient';
export type { ResilientCongressTrades } from './lib/getCongressTradesResilient';
```

> `isDynamicServerError`의 정확 import 경로는 `getProfileResilient.ts`에서 복사. `staticSymbolCache` 시그니처(keyParts, symbol, fetcher, extraTags)는 확인됨(siglens 보고). `Promise.all`이 한쪽 reject 시 전체 reject → resilient catch가 degraded 처리(테스트 3 케이스).

- [ ] **Step 4: 통과 확인** → PASS
- [ ] **Step 5: Commit** → `git commit -m "feat(congress): resilient 래퍼(0건↔장애 구분)"`

## Task B5: 팩토리 + Fake provider

**Files:**
- Create: `src/shared/api/fmp/getCongressTradesProvider.ts`
- Create: `src/shared/api/fmp/FakeCongressTradesProvider.ts`
- Test: `src/shared/api/fmp/__tests__/FakeCongressTradesProvider.test.ts`

- [ ] **Step 1: Fake provider 작성** (FakeFinancialStatementsProvider 미러, 결정론 픽스처)

```typescript
import type { Chamber, CongressTrade, CongressTradesProvider } from '@y0ngha/siglens-core';

const SENATE_FIXTURE: CongressTrade[] = [{
    chamber: 'senate', firstName: 'Shelley', lastName: 'Capito', office: 'Shelley Capito',
    district: 'WV', owner: 'spouse', side: 'buy', rawType: 'Purchase',
    amount: { min: 1001, max: 15000, label: '$1,001 - $15,000' }, assetType: 'Stock',
    assetDescription: 'Apple Inc', transactionDate: '2026-04-17', disclosureDate: '2026-05-07',
    link: 'https://efdsearch.senate.gov/x', capitalGainsOver200USD: false,
}];
const HOUSE_FIXTURE: CongressTrade[] = [{
    chamber: 'house', firstName: 'Tim', lastName: 'Walberg', office: 'Tim Walberg',
    district: '', owner: 'joint', side: 'sell', rawType: 'Sale (Partial)',
    amount: { min: 15001, max: 50000, label: '$15,001 - $50,000' }, assetType: 'Stock',
    assetDescription: 'Apple Inc', transactionDate: '2025-02-07', disclosureDate: '2026-06-04',
    link: 'https://disclosures-clerk.house.gov/x.pdf', capitalGainsOver200USD: false,
}];

export class FakeCongressTradesProvider implements CongressTradesProvider {
    async getTrades(symbol: string, chamber: Chamber, limit: number): Promise<CongressTrade[]> {
        // 희소/0건 E2E를 위한 심볼 분기: 'EMPTYX'는 빈 결과
        if (symbol.toUpperCase() === 'EMPTYX') return [];
        const src = chamber === 'senate' ? SENATE_FIXTURE : HOUSE_FIXTURE;
        return src.slice(0, limit);
    }
}
```

- [ ] **Step 2: 팩토리 작성** (getFinancialStatementsProvider 미러)

```typescript
import { isE2E } from '@/shared/api/e2eEnv';
import type { CongressTradesProvider } from '@y0ngha/siglens-core';
import { CachedCongressTradesProvider } from './CachedCongressTradesProvider';
import { FmpCongressTradesClient } from './congressTradesClient';

let singleton: CongressTradesProvider | null = null;

export function getCongressTradesProvider(): CongressTradesProvider {
    if (singleton) return singleton;
    if (isE2E()) {
        const { FakeCongressTradesProvider } = require('./FakeCongressTradesProvider');
        singleton = new FakeCongressTradesProvider();
    } else {
        singleton = new CachedCongressTradesProvider(new FmpCongressTradesClient());
    }
    return singleton;
}
```

> `require` 동적 로드는 getFinancialStatementsProvider의 정확한 형태(dynamic import vs require, 싱글톤 캐싱 방식)를 확인해 일치시킨다.

- [ ] **Step 3: Fake 테스트 통과** (fixture 결정론·limit slice·EMPTYX 빈 결과)
- [ ] **Step 4: Commit** → `git commit -m "feat(congress): provider 팩토리 + Fake(E2E)"`

## Task B6: AI 잡 server actions

**Files:**
- Create: `src/entities/analysis/actions/submitCongressTrendAction.ts`
- Create: `src/entities/analysis/actions/pollCongressTrendAction.ts`
- Create: `src/entities/analysis/actions/cancelCongressTrendJobAction.ts`
- Modify: `src/entities/analysis/actions.ts` (barrel)
- Modify: `src/shared/api/e2eAnalysisStub.ts`
- Test: `src/entities/analysis/actions/__tests__/submitCongressTrendAction.test.ts`

- [ ] **Step 1: e2e stub 추가** — `e2eAnalysisStub.ts`에 congress 항목(financials 미러)

```typescript
export const E2E_FORCE_CONGRESS_ERROR_COOKIE = 'e2e_force_congress_error';

export function e2eForcedCongressError() {
    return { status: 'error' as const, code: 'fetch_failed' as const, error: 'E2E 강제 의회 거래 분석 실패 (resilience 테스트용)' };
}
export function e2eCachedCongressTrend() {
    return { status: 'cached' as const, result: typedFixture.congressTrend }; // typedFixture에 congressTrend 추가
}
```
> `typedFixture` 구조에 `congressTrend: CongressTrendResponse` 픽스처를 추가(financials.fixture 인근).

- [ ] **Step 2: submit action 작성** (submitFinancialsAnalysisAction 미러)

```typescript
'use server';
import { cookies, headers } from 'next/headers';
import { waitUntil } from '@vercel/functions';
import { submitCongressTrend } from '@y0ngha/siglens-core';
import type { SubmitCongressTrendOptions } from '@y0ngha/siglens-core';
import { isBot } from '@/shared/api/isBot';
import { isE2E } from '@/shared/api/e2eEnv';
import { getCongressTradesProvider } from '@/shared/api/fmp/getCongressTradesProvider';
import { resolveTierAndByok } from '@/entities/analysis/lib/resolveTierAndByok'; // financials와 동일 경로 확인

export type SubmitCongressTrendActionResult = Awaited<ReturnType<typeof submitCongressTrend>>;

export async function submitCongressTrendAction(
    symbol: string,
    modelId: SubmitCongressTrendOptions['modelId']
): Promise<SubmitCongressTrendActionResult> {
    if (isE2E()) {
        const stub = await import('@/shared/api/e2eAnalysisStub');
        const forceError = (await cookies()).get(stub.E2E_FORCE_CONGRESS_ERROR_COOKIE);
        return forceError ? stub.e2eForcedCongressError() : stub.e2eCachedCongressTrend();
    }
    const requestHeaders = await headers();
    const skipEnqueueIfMiss = isBot(requestHeaders);
    const gate = await resolveTierAndByok(undefined, modelId); // congress=전체 공개; financials gate 형태 확인
    if (gate.kind === 'blocked') return { status: 'error', code: 'fetch_failed', error: gate.error };
    return await submitCongressTrend({
        symbol,
        modelId,
        dataProvider: getCongressTradesProvider(),
        waitUntil,
        tier: gate.tier,
        skipEnqueueIfMiss,
        ...(gate.userApiKey !== undefined ? { userApiKey: gate.userApiKey } : {}),
    });
}
```

> congress가 tier 게이팅 비목표(스펙 §2)이므로, financials의 gate가 무거우면 congress는 gate 생략 + 기본 tier로 단순화 가능. 단 core submit 시그니처가 tier를 요구하면 `DEFAULT_TIER`를 넘긴다. financials action을 정독해 최소 형태로 맞춘다.

- [ ] **Step 3: poll/cancel action 작성** (financials 미러)

```typescript
// pollCongressTrendAction.ts
'use server';
import { pollCongressTrend } from '@y0ngha/siglens-core';
import type { PollCongressTrendResult } from '@y0ngha/siglens-core';
export async function pollCongressTrendAction(jobId: string): Promise<PollCongressTrendResult> {
    try {
        return await pollCongressTrend(jobId);
    } catch (error) {
        console.error('[pollCongressTrendAction] poll failed:', jobId, error);
        return { status: 'error', error: '동향 해석을 가져오지 못했습니다.' };
    }
}
// cancelCongressTrendJobAction.ts
'use server';
import { cancelCongressTrendJob } from '@y0ngha/siglens-core';
export async function cancelCongressTrendJobAction(jobId: string): Promise<void> {
    try { await cancelCongressTrendJob(jobId); }
    catch (error) { console.warn('[cancelCongressTrendJobAction] 취소 실패:', jobId, error); }
}
```

- [ ] **Step 4: barrel export** — `actions.ts`에 3개 action + result 타입 추가.
- [ ] **Step 5: 테스트 작성·통과** — submit action: E2E stub 분기(정상/강제에러 쿠키), isBot→skipEnqueueIfMiss 전달, no_trades 패스스루.
- [ ] **Step 6: Commit** → `git commit -m "feat(congress): AI 동향 잡 server actions + e2e stub"`

## Task B7: queryConfig 키

**Files:**
- Modify: `src/shared/config/queryConfig.ts`

- [ ] **Step 1: 키 추가** (financialsAnalysis 인근)

```typescript
congressTrend: (symbol: string, modelId: string) => ['congress-trend', symbol, modelId] as const,
```

- [ ] **Step 2: 컴파일 확인 + Commit** → `git commit -m "feat(congress): react-query 키 추가"`

## Task B8: useCongressTrend 훅 + AI 요약 위젯

**Files:**
- Create: `src/widgets/congress/hooks/useCongressTrend.ts`
- Create: `src/widgets/congress/CongressTrendSummary.tsx`
- Create: `src/widgets/congress/CongressTrendSummarySkeleton.tsx`
- Create: `src/widgets/congress/CongressTrendSummaryError.tsx`
- Create: `src/widgets/congress/utils/buildChatState.ts`
- Test: `src/widgets/congress/hooks/__tests__/useCongressTrend.test.tsx`, `src/widgets/congress/utils/__tests__/buildChatState.test.ts`

- [ ] **Step 1: 훅 작성** (useFinancialsAnalysis 미러 + `no_trades` 상태 추가)

상태 union:
```typescript
export type CongressTrendState =
    | { status: 'loading' }
    | { status: 'done'; result: CongressTrendResponse }
    | { status: 'no_trades' }      // 거래 0건 — AI 생략(스펙 §6)
    | { status: 'bot_blocked' }
    | { status: 'error'; error: Error; retry: () => void };
```
submit 결과 `miss_no_trigger`→`bot_blocked`(financials와 동일 매핑), `no_trades`→`no_trades`, `cached`/`submitted`→poll. 나머지 submit/poll/cancel·usePageHideCancel·`enabled:false`+`refetch`·`retry:false`·`staleTime:Infinity` 배선은 useFinancialsAnalysis 정독 후 동일하게.

- [ ] **Step 2: buildChatState 작성** (financials 미러)

```typescript
import type { CongressTrendResponse } from '@y0ngha/siglens-core';
import type { SymbolChatState } from '@/widgets/symbol-page/...'; // financials와 동일 타입 경로
import type { CongressTrendState } from '../hooks/useCongressTrend';

export function buildChatState(state: CongressTrendState): SymbolChatState {
    if (state.status === 'done') {
        return { context: { kind: 'congress', payload: state.result }, timeframe: null, isAnalysisReady: true };
    }
    return { context: null, timeframe: null, isAnalysisReady: false };
}
```
> **core chat 통합 의존**: `SymbolChatState`의 `context.kind` union에 `'congress'`가 있어야 한다. 이는 core `CurrentAnalysisContext` union 확장이 필요(스펙 §7). **Part A에서 누락됐다면 Task A1에 `{ kind:'congress'; payload: CongressTrendResponse }` union 확장 + chat 프롬프트 빌더 처리를 추가**하고 core를 재릴리스해야 한다. → **B8 착수 전 core chat union을 확인**하고, 없으면 Part A로 돌아가 추가(아래 "미해결/리스크" 참고).

- [ ] **Step 3: 요약/스켈레톤/에러 컴포넌트 작성** (FinancialsAiSummary 3종 미러). `no_trades`면 "최근 의회 거래가 없어 동향 해석을 생성하지 않았어요" 안내. `usePublishSymbolChat(buildChatState(state))` 호출.
- [ ] **Step 4: 테스트 통과** (훅 cached/submitted/poll/bot/no_trades/abort, buildChatState done/non-done)
- [ ] **Step 5: Commit** → `git commit -m "feat(congress): AI 동향 훅·요약 위젯·chatState"`

## Task B9: CongressTradesTable (SSR 거래 표)

**Files:**
- Create: `src/widgets/congress/CongressTradesTable.tsx`
- Create: `src/widgets/congress/congressTooltips.tsx`
- Create: `src/widgets/congress/index.ts` (barrel)
- Test: `src/widgets/congress/__tests__/CongressTradesTable.test.tsx`

- [ ] **Step 1: 실패 테스트 작성** (RTL render — 컬럼·배지·빈 상태)

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CongressTradesTable } from '@/widgets/congress';
import type { CongressTrade } from '@y0ngha/siglens-core';

const trades: CongressTrade[] = [{
    chamber: 'senate', firstName: 'Shelley', lastName: 'Capito', office: 'Shelley Capito',
    district: 'WV', owner: 'spouse', side: 'buy', rawType: 'Purchase',
    amount: { min: 1001, max: 15000, label: '$1,001 - $15,000' }, assetType: 'Stock Option',
    assetDescription: 'Apple Inc', transactionDate: '2026-04-17', disclosureDate: '2026-05-07',
    link: 'https://efd', capitalGainsOver200USD: false,
}];

describe('CongressTradesTable', () => {
    it('핵심 컬럼을 렌더한다(의원·금액 구간·거래일)', () => {
        render(<CongressTradesTable trades={trades} />);
        expect(screen.getByText('Shelley Capito')).toBeInTheDocument();
        expect(screen.getByText('$1,001 - $15,000')).toBeInTheDocument();
        expect(screen.getByText('2026-04-17')).toBeInTheDocument();
    });
    it('assetType 옵션 라벨을 노출한다(부록 D #2)', () => {
        render(<CongressTradesTable trades={trades} />);
        expect(screen.getByText(/Stock Option|옵션/)).toBeInTheDocument();
    });
    it('공시 원본 링크는 rel=noopener noreferrer 외부 링크', () => {
        render(<CongressTradesTable trades={trades} />);
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
        expect(link).toHaveAttribute('target', '_blank');
    });
    it('빈 배열이면 "거래 내역 없음" 안내', () => {
        render(<CongressTradesTable trades={[]} />);
        expect(screen.getByText(/거래 내역(이)? 없/)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현 작성** — UI 스킬 적용. 컬럼: chamber 배지(상원/하원)·office(+district)·side 배지(매수=`text-chart-bullish`/매도=`text-chart-bearish`)·amount.label(`font-mono tabular-nums`)·assetType 배지·transactionDate·disclosureDate·owner·link(외부)·assetDescription. 빈 배열→"거래 내역 없음" 카드. 카드 스타일 `border-secondary-700 bg-secondary-800 rounded-xl border`. a11y: `<table>` 시맨틱·`scope="col"`·링크 aria-label.

> 구현 전 `frontend-design`→`web-design-guidelines` 스킬 호출(CLAUDE.md). financials `StatementTable.tsx`·`PeersTable` 패턴 참고. `congressTooltips.tsx`: 금액 구간·공시지연·STOCK Act 용어 `InfoTooltip`(`~이에요`체).

- [ ] **Step 4: 통과 확인** → PASS
- [ ] **Step 5: Commit** → `git commit -m "feat(congress): 거래 표 위젯 + 용어 툴팁"`

## Task B10: 페이지 + SEO/ISR + degrade

**Files:**
- Create: `src/app/[symbol]/congress/page.tsx`
- Create: `src/app/[symbol]/congress/congressData.ts`
- Create: `src/app/[symbol]/congress/CongressDegraded.tsx`
- Create: `src/app/[symbol]/congress/opengraph-image.tsx`, `twitter-image.tsx`
- Modify: SEO 빌더 위치(`buildSymbolCongressSeoContent`)
- Test: `src/app/[symbol]/congress/__tests__/page.metadata.test.ts`

- [ ] **Step 1: congressData 로더 작성**

```typescript
import { getCongressTradesResilient, type ResilientCongressTrades } from '@/entities/congress-trades';

export type CongressPageData = ResilientCongressTrades;

export async function getCongressPageData(symbol: string): Promise<CongressPageData> {
    return getCongressTradesResilient(symbol);
}
```

- [ ] **Step 2: SEO 콘텐츠 빌더 + metadata 테스트 작성** (degrade=noindex, 0건=색인 허용 분기)

핵심: `generateMetadata`가 ① 무효 ticker→`NOINDEX_SYMBOL_METADATA`, ② `getProfileResilient().degraded || profile===null`→noindex, ③ `getCongressTradesResilient().degraded`→noindex, ④ **정상(0건 포함)→정상 색인 metadata**. financials와 다른 점: **빈 trades는 noindex 아님**(부록 D #1·B.6).

- [ ] **Step 3: page.tsx 작성** (financials page.tsx 미러)

```typescript
export const revalidate = 86400; // 24h 리터럴 (import 금지 — ISR)
export async function generateStaticParams(): Promise<SymbolRouteParams[]> { return []; }
```
본문 분기:
- `getProfileResilient(upper)`: `degraded`→`<CongressDegraded/>`(200,noindex), `profile===null`→`notFound()`(404).
- `getCongressPageData(symbol)`: `degraded`→`<CongressDegraded/>`(200,noindex).
- 정상(trades.length≥0): `<h1>{displayName} 의회 거래</h1>` + `<CongressTrendSummary symbol modelId/>`(Suspense) + `<CongressTradesTable trades/>`. **trades.length===0이어도 정상 렌더**("거래 내역 없음" 표). 
- JsonLd: `WebPage` + `BreadcrumbList`([{symbol},{의회 거래}]).
- `connection()`/`cookies()`/`headers()` 본문 미사용(메모리 `isr_connection_coldgen_500`).

> `generateMetadata`와 본문이 **동일 소스로 degrade 판정**(축 일치). `getProfileResilient`/`NOINDEX_SYMBOL_METADATA`/`SymbolRouteParams`/`buildSymbolOgImage` 경로는 financials page.tsx에서 그대로 가져온다.

- [ ] **Step 4: CongressDegraded + og/twitter image 작성** (FinancialsDegraded·image 미러, 라벨 '의회 거래')
- [ ] **Step 5: 테스트 통과** (metadata noindex 3분기 + 0건 색인 허용)
- [ ] **Step 6: Commit** → `git commit -m "feat(congress): 페이지·SEO·ISR·degrade(0건 색인/장애 noindex)"`

## Task B11: 탭 내비 등록

**Files:**
- Modify: `src/widgets/symbol-page/utils/symbolTabsConfig.ts`
- Test: `src/widgets/symbol-page/utils/__tests__/symbolTabsConfig.test.ts` (있으면 보강)

- [ ] **Step 1: TABS 항목 추가** (financials 다음)

```typescript
{ key: 'congress', label: '의회 거래', hrefBuilder: (s: string) => `/${s}/congress` },
```

- [ ] **Step 2: 탭 렌더/aria-current 테스트** → PASS
- [ ] **Step 3: Commit** → `git commit -m "feat(congress): 종목 탭 내비에 의회 거래 추가"`

## Task B12: sitemap / CrossLinkCards / ISR 문서

**Files:**
- Modify: `src/app/sitemap.ts`, CrossLinkCards 컴포넌트, `docs/architecture/ISR_REVALIDATE.md`

- [ ] **Step 1: 롱테일 라우트 추가** — financials가 `LONGTAIL_ENTRIES_PER_TICKER`·CrossLinkCards에 들어간 방식 확인 후 congress 행 추가(메모리 `isr_cost_seo_r2`: 롱테일 sitemap 정책 주의 — 메인 색인 보존 방침과 충돌 없는지 확인. 충돌 시 CrossLinkCards만 추가하고 sitemap은 보류).
- [ ] **Step 2: ISR_REVALIDATE.md에 congress 행 추가**(24h, 근거: 공시지연 45일).
- [ ] **Step 3: Commit** → `git commit -m "feat(congress): sitemap·crosslink·ISR 문서 반영"`

## Task B12.5: core 버전 핀 갱신 + clean install (사용자 publish 후) ⛔게이트

> Task A9에서 사용자에게 요청한 publish가 완료돼 **배포 버전을 받은 시점**에 수행한다. overlay와 정식 패키지의 일치를 보증하고, 워크트리 node_modules 무결성을 회복한다(메모리 `worktree_core_version_mismatch`).

- [ ] **Step 1: publish 여부 확인** — 사용자가 배포 버전(예: 0.24.0)을 알려줬는지. 미완료면 사용자에게 재요청 후 대기(이 게이트는 PR 전 반드시 통과).
- [ ] **Step 2: 핀 갱신** — `package.json`의 `"@y0ngha/siglens-core": "0.23.0"` → 배포 버전.
- [ ] **Step 3: clean install** (overlay 잔재 제거 + 정식 패키지로 교체)

```bash
cd /Users/y0ngha/Project/siglens/.claude/worktrees/feat+symbol-congress
rm -rf node_modules && yarn install
```
Expected: 배포 버전 설치, congress export 정식 해석. overlay 임시본과 동일 동작.

- [ ] **Step 4: 회귀 0 확인** — `yarn test` (전체) → PASS. 차이 발생 시 overlay와 배포본 불일치 → 사용자에게 보고(메모리 `worktree_core_version_mismatch` 트랩).
- [ ] **Step 5: Commit (git-agent)** → `git commit -m "chore(congress): siglens-core <버전> 핀 갱신"`

## Task B13: 전체 단위 테스트 + 린트 + 빌드

- [ ] **Step 1: 전체 vitest** → `yarn test` → PASS, congress 커버리지 ≥90%
- [ ] **Step 2: 린트/스타일** → `yarn lint && yarn lint:style` → 0 error (FSD 경계 위반 0)
- [ ] **Step 3: 타입체크 + 빌드** → `yarn build > /tmp/build.log 2>&1; echo $?` (파이프 없이 exit code 캡처 — 메모리 `build_exit_code_pipe_masks_failure`) → exit 0, congress 라우트 `● SSG`/ISR 확인
- [ ] **Step 4: Commit** (필요 시 수정분) 

## Task B14: E2E (Playwright) + prod-like 실증

**Files:**
- Create: `e2e/congress.spec.ts` (기존 e2e 디렉토리 규약 확인)

- [ ] **Step 1: E2E 스펙 작성** (메모리 `e2e_suite_landed` 패턴: workers:1, HYBRID, Fake provider)
  - happy: 탭 진입 → 거래 표 SSR 노출 → AI 동향 폴링 완료.
  - 0건: `EMPTYX` 심볼 → "거래 내역 없음" 표 + degrade 아님(색인 가능 상태).
  - 장애: `E2E_FORCE_CONGRESS_ERROR_COOKIE` → AI 에러 UI / `CongressDegraded`(provider 장애 주입 시).
  - 봇: AI 봇 UA → BotBlockedNotice + 표는 SSR 노출.
- [ ] **Step 2: E2E 실행** → `yarn e2e` (또는 레포 규약) → PASS
- [ ] **Step 3: prod-like 실증** (메모리 `worktree_node_modules_prod_verify`)
  - `E2E_TEST=1 yarn build` 후 실 심볼 `curl`로 `x-nextjs-cache: HIT`·DSU 0·거래 표 SSR HTML 확인 + Chrome 실측.
- [ ] **Step 4: Commit** → `git commit -m "test(congress): E2E happy/0건/장애/봇 + 실증"`

## Task B15: 리뷰 → mistake → PR (CLAUDE.md 라우팅)

- [ ] **Step 1:** 구현 완료 신호 → `review-agent` 호출(Opus 4.8, modified_files 전달).
- [ ] **Step 2:** findings 직접 수정 → re-review(APPROVED까지). 회귀 발견 시 사용자 알림(메모리).
- [ ] **Step 3:** `mistake-managing-agent` → `git-agent`(PR 생성, push 검증 ls-remote).
- [ ] **Step 4:** PR 리뷰 봇 코멘트 반영(메모리 `pr_review_reflection_workflow`·`verify_review_bot_claims`).

---

## 미해결 / 리스크 (구현 중 확정)

1. **core chat union 확장(스펙 §7)**: `CurrentAnalysisContext`에 `{kind:'congress'}` 추가 + `buildChatPrompt`/`requestChatCompletion` 처리. **Part A에 별도 태스크로 포함돼야 함** — Task A1 타입 추가 시 `CurrentAnalysisContext` union도 확장하고, chat 프롬프트 빌더(core)가 congress kind를 처리하도록 추가. 누락 시 B8 buildChatState가 타입 에러. → **Part A 진행 시 financials가 chat union에 어떻게 들어갔는지 먼저 확인하고 동일 위치에 congress 추가**.
2. **core responseSchema/systemPrompt**: financials AI 잡이 worker로 보내는 `responseSchema`·`system` 정의 위치(responseSchemas.ts/systemPrompt.ts) 확인 후 congress 항목 추가(Task A7).
3. **tier 게이팅**: congress=전체 공개(비목표). core submit이 tier 필수면 `DEFAULT_TIER` 주입. resolveTierAndByok 재사용 여부는 financials action 정독 후 최소화.
4. **FMP `limit` 미지원**: senate/house-trades가 limit 쿼리를 무시할 수 있음(Phase 0=최대 100 반환). 클라 `.slice`로 상한 적용(B2). 50건 초과 종목은 최신 50건만.
5. **롱테일 sitemap 정책 충돌**(메모리 `isr_cost_seo_r2`): 롱테일 라우트 축소 방침과 충돌 시 sitemap 보류, CrossLinkCards만(B12).

## Self-Review 결과 (작성자 점검)

- **스펙 커버리지**: §4 페이지(B10)·§5 데이터/2키캐시/0건구분(B2~B4)·§6 AI 0건생략(A7 no_trades, B8)·§7 chat(B8+리스크1)·§8 SEO/ISR(B10)·§9 체크리스트(양방향 테스트 A3/A7/B3/B4/B10)·§10 Phase(A1~B15)·부록 D 6결정(드롭=A1/B9, 건수=A4, 옵션라벨=B9, 2키=B3, 50건정렬=B4/B9, owner+link+assetDesc=B9) 모두 태스크 매핑됨.
- **타입 일관성**: `CongressTrade`/`CongressTradeStats`/`CongressTrendResponse`/`CongressTradesProvider.getTrades` 시그니처가 A1~A8과 B2~B8에서 동일.
- **placeholder 점검**: 모든 코드 스텝에 실제 코드 포함. "financials 정독 후 맞춤" 지시는 실재 파일(보고서로 경로·시그니처 확인됨) 참조이므로 미정의 참조 아님.
- **잔여 의존**: 리스크 1(chat union)은 Part A 내 처리 필요 — B8 착수 전 게이트로 명시함.

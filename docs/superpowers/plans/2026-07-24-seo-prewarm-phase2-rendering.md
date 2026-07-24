# SEO Pre-warm Phase 2 (Rendering/SEO) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스냅샷을 실제 SEO 가치로 전환 — robots OG 차단, 스냅샷 SSR 가시 섹션(7탭), hasSnapshot degraded 가드, 유니크 meta description, news 목록 SSR, fear-greed factor 강화, e2e.

**Architecture:** 스펙 `docs/superpowers/specs/2026-07-24-seo-recovery-bot-ssr-prewarm-design.md`(v3) §7·§10. 스냅샷 read는 `staticSymbolCache` 계열(`unstable_cache` + `seo-snapshot:{SYM}` 태그)로 정적화(NB-2 — ISR dynamic 회귀 방지). 섹션은 봇·사용자 동일 HTML(클로킹 제로), `useSearchParams` CSR bailout 밖 Suspense fallback에 서버 컴포넌트로 배치(app/CLAUDE.md 축 2 — `TechnicalFactsSummary` 선례).

**Tech Stack:** Next 16.2 RSC, `staticSymbolCache`(src/shared/cache/staticSymbolCache.ts), vitest, Playwright(HYBRID·no-FMP).

**Branch:** `feat/seo-prewarm-rendering` (Phase 1 머지 후 분기 — snapshot 테이블·repository 의존)

**전제:** Phase 1 완료(테이블·repository·cron 존재). Phase 2는 read 경로만 추가.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/app/robots.ts` (수정) | Googlebot 전용 그룹 — OG/twitter 이미지 disallow |
| `src/entities/seo-snapshot/lib/getSnapshotStatic.ts` | `staticSymbolCache` 래핑 read (server-only, barrel 제외) |
| `src/entities/symbol-indexability/model.ts` (수정) | `hasSnapshot` 입력 추가 |
| `src/entities/symbol-indexability/lib/evaluateSymbolIndexability.ts` (수정) | degraded && whitelisted && hasSnapshot → indexable |
| `src/app/[symbol]/symbolIndexabilityMetadata.ts` (수정) | hasSnapshot 스레딩 (스냅샷 read 정적화) |
| `src/views/symbol/snapshot/SnapshotSummarySection.tsx` | 공통 가시 섹션 셸("최근 분석 요약 · 전일 장마감 기준") |
| `src/views/symbol/snapshot/renderers/*.tsx` | 탭별 산문 렌더러 7종 |
| 각 탭 `page.tsx` (수정 7개) | 섹션 장착 + hasSnapshot 스레딩 |
| `src/shared/lib/seo.ts` (수정) | 스냅샷 기반 유니크 description |
| fear-greed `page.tsx` (수정) | 서버 계산 factor 서술 강화 |
| `e2e/` 신규 spec | 시드 스냅샷 SSR 검증 |

---

### Task 1: robots.ts — Googlebot 그룹 + OG 이미지 차단

**Files:**
- Modify: `src/app/robots.ts`
- Test: robots 테스트 파일(기존 위치 확인: `grep -rln "robots" src/app/__tests__ src/app/*test* --include="*.ts*"` — 없으면 `src/app/__tests__/robots.test.ts` 신규)

- [ ] **Step 1: 실패하는 테스트 작성** — baseline 패리티 단언 포함(spec §7 풋건):

```ts
import { describe, expect, it } from 'vitest';
import robots from '../robots';

function findGroup(userAgent: string) {
    const { rules } = robots();
    return rules.find(r =>
        Array.isArray(r.userAgent)
            ? r.userAgent.includes(userAgent)
            : r.userAgent === userAgent
    );
}

describe('robots — Googlebot OG-image 차단 (spec 2026-07-24 §7)', () => {
    it('Googlebot 전용 그룹이 존재하고 OG/twitter 이미지를 disallow한다', () => {
        const g = findGroup('Googlebot');
        expect(g).toBeDefined();
        expect(g?.disallow).toEqual(
            expect.arrayContaining(['/*/opengraph-image', '/*/twitter-image'])
        );
    });
    it('⚠️ baseline 패리티: Googlebot 그룹은 * 그룹의 규칙(allow /, disallow /api/)을 복제한다', () => {
        const star = findGroup('*');
        const g = findGroup('Googlebot');
        expect(g?.allow).toEqual(star?.allow);
        // * 그룹의 모든 disallow가 Googlebot 그룹에도 포함돼야 한다 (그룹 배타성 —
        // Googlebot은 자기 그룹만 읽는다. * 에만 추가된 미래 규칙은 여기서 깨진다)
        const starDisallow = Array.isArray(star?.disallow) ? star.disallow : [star?.disallow];
        for (const rule of starDisallow) {
            expect(g?.disallow).toContain(rule);
        }
    });
    it('Googlebot 그룹은 사이트 루트를 여전히 허용한다 (검색 색인 보존)', () => {
        expect(findGroup('Googlebot')?.allow).toBe('/');
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/app/__tests__/robots.test.ts` / Expected: FAIL

- [ ] **Step 3: 구현** — `robots.ts`의 `rules` 배열에 `*` 그룹 바로 다음 위치로 추가:

```ts
{
    // Googlebot 전용 그룹 (spec 2026-07-24 §7): 크롤 예산의 ~70%가 OG/twitter
    // 이미지 PNG에 소모되는 낭비를 차단한다. ⚠️ 그룹 배타성 — Googlebot은 이
    // 그룹만 읽고 `*`를 상속하지 않으므로 baseline(allow /, disallow /api/)을
    // 반드시 복제한다. `*`에만 규칙을 추가하면 Googlebot에는 적용되지 않는다
    // (robots.test.ts의 패리티 단언이 감지). Googlebot-Image는 Googlebot 그룹으로
    // 폴백하므로 별도 그룹 불필요. 트레이드오프: Google Images 노출 상실(허용).
    // 소셜 크롤러(Twitterbot/facebookexternalhit)는 영향 없음 — 자기 그룹/무시.
    userAgent: 'Googlebot',
    allow: '/',
    disallow: ['/api/', '/*/opengraph-image', '/*/twitter-image'],
},
```

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/app/__tests__/robots.test.ts` (기존 robots 관련 테스트 전부 포함) / Expected: PASS
- [ ] **Step 5: 라이브 형태 확인** — Run: `yarn dev` 후 `curl -s localhost:4200/robots.txt` / Expected: `User-Agent: Googlebot` 그룹에 3개 disallow.
- [ ] **Step 6: Commit** — `feat(seo): block Googlebot OG/twitter-image crawl (budget reclaim)`

### Task 2: 스냅샷 정적 read 헬퍼

**Files:**
- Create: `src/entities/seo-snapshot/lib/getSnapshotStatic.ts`
- Test: `src/entities/seo-snapshot/__tests__/getSnapshotStatic.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — `staticSymbolCache`·repository mock, 키·태그 단언:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const staticSymbolCache = vi.fn((keyParts, symbol, fetcher) => fetcher());
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: (...a: unknown[]) => staticSymbolCache(...a),
}));
const findBySymbol = vi.fn().mockResolvedValue([]);
vi.mock('@/entities/seo-snapshot/api', () => ({
    DrizzleSeoSnapshotRepository: vi.fn(() => ({ findBySymbol })),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import { getSeoSnapshotsStatic } from '../lib/getSnapshotStatic';

beforeEach(() => vi.clearAllMocks());

describe('getSeoSnapshotsStatic (spec §5 NB-2)', () => {
    it('staticSymbolCache로 감싸고 seo-snapshot:{SYM} 태그를 단다', async () => {
        await getSeoSnapshotsStatic('aapl', 21600);
        expect(staticSymbolCache).toHaveBeenCalledWith(
            ['seo-snapshots', 'AAPL'],
            'AAPL',
            expect.any(Function),
            ['seo-snapshot:AAPL'],
            21600
        );
    });
    it('DB 에러는 빈 배열로 degrade (fail-open — placeholder fallback 경로)', async () => {
        findBySymbol.mockRejectedValueOnce(new Error('db down'));
        await expect(getSeoSnapshotsStatic('AAPL', 21600)).resolves.toEqual([]);
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/seo-snapshot/__tests__/getSnapshotStatic.test.ts` / Expected: FAIL

- [ ] **Step 3: 구현**

```ts
import 'server-only';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import type { SeoAnalysisSnapshot } from '../model';

/**
 * ISR static-safe 스냅샷 read (spec 2026-07-24 §5 NB-2). 비캐시 DB read가 정적
 * 경로에 들어가면 DYNAMIC_SERVER_USAGE로 [symbol] ISR이 dynamic으로 회귀하므로
 * (app/CLAUDE.md 축 1) 반드시 이 헬퍼로 읽는다. revalidateSeconds는 호출 페이지의
 * 선언 revalidate와 일치시킨다(짧으면 라우트 s-maxage가 clamp됨 —
 * staticSymbolCache doc 참조). pre-warm cron이 심볼 완료 시
 * revalidateTag('seo-snapshot:{SYM}','max')로 on-demand 무효화한다.
 * 에러는 빈 배열로 degrade — 섹션은 placeholder fallback을 렌더한다(fail-open).
 */
export function getSeoSnapshotsStatic(
    symbol: string,
    revalidateSeconds: number
): Promise<SeoAnalysisSnapshot[]> {
    const upper = symbol.toUpperCase();
    return staticSymbolCache(
        ['seo-snapshots', upper],
        upper,
        async () => {
            try {
                const { db } = getDatabaseClient();
                return await new DrizzleSeoSnapshotRepository(db).findBySymbol(upper);
            } catch (error) {
                console.error('[getSeoSnapshotsStatic] read failed, degrading:', error);
                return [];
            }
        },
        [`seo-snapshot:${upper}`],
        revalidateSeconds
    );
}
```

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/entities/seo-snapshot` / Expected: PASS
- [ ] **Step 5: Commit** — `feat(seo-snapshot): ISR-safe static snapshot read helper`

### Task 3: hasSnapshot degraded 가드

**Files:**
- Modify: `src/entities/symbol-indexability/model.ts` (`SymbolIndexabilityInput`에 `hasSnapshot` 추가)
- Modify: `src/entities/symbol-indexability/lib/evaluateSymbolIndexability.ts`
- Modify: `src/app/[symbol]/symbolIndexabilityMetadata.ts`
- Test: `src/entities/symbol-indexability/__tests__/evaluateSymbolIndexability.test.ts` (확장)

- [ ] **Step 1: 실패하는 테스트 추가** — 기존 테스트 파일에 케이스 추가:

```ts
describe('degraded + hasSnapshot 가드 (spec 2026-07-24 §7 G4)', () => {
    const base = { symbol: 'AAPL', assetInfo: validAssetInfo }; // 기존 픽스처 재사용
    it('degraded여도 화이트리스트 + 스냅샷 보유면 indexable', () => {
        expect(
            evaluateSymbolIndexability({ ...base, degraded: true, hasSnapshot: true })
        ).toEqual({ indexable: true, reason: 'degraded-with-snapshot' });
    });
    it('degraded + 스냅샷 없음 → 기존대로 noindex (thin 페이지 index 금지)', () => {
        expect(
            evaluateSymbolIndexability({ ...base, degraded: true, hasSnapshot: false })
        ).toEqual({ indexable: false, reason: 'degraded' });
    });
    it('degraded + 스냅샷 있어도 화이트리스트 밖이면 noindex', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'ZZZQ', assetInfo: validAssetInfo,
                degraded: true, hasSnapshot: true,
            }).indexable
        ).toBe(false);
    });
    it('hasSnapshot 미전달(기존 호출부) → 기존 동작 유지', () => {
        expect(
            evaluateSymbolIndexability({ ...base, degraded: true })
        ).toEqual({ indexable: false, reason: 'degraded' });
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/entities/symbol-indexability` / Expected: FAIL

- [ ] **Step 3: 구현** — model에 `hasSnapshot?: boolean` 추가, evaluate의 degraded 분기 교체:

```ts
if (degraded) {
    // spec 2026-07-24 §7: 화이트리스트 심볼이 스냅샷을 보유하면 일시 degraded로
    // noindex를 ISR에 동결시키지 않는다 — 본문은 스냅샷 섹션을 렌더하므로 thin이
    // 아니다. 스냅샷 없으면 기존대로 noindex(빈 degraded 페이지 index 금지).
    // 순서 주의: 화이트리스트 판정을 여기서 함께 해야 한다 — 단순히 degraded
    // 체크를 화이트리스트 뒤로 옮기면 "스냅샷 없는 degraded 인기 심볼"이 index된다.
    const whitelisted =
        POPULAR_TICKER_SET.has(upper) ||
        POPULAR_CRYPTO_SET.has(upper) ||
        APPROVED_LONGTAIL_SET.has(upper);
    if (hasSnapshot === true && whitelisted) {
        return { indexable: true, reason: 'degraded-with-snapshot' };
    }
    return { indexable: false, reason: 'degraded' };
}
```

`SymbolIndexabilityDecision`의 reason 유니온에 `'degraded-with-snapshot'` 추가.

- [ ] **Step 4: 콜러 스레딩** — `symbolIndexabilityMetadata.ts`의 `getBlockedSymbolMetadata`를 async로 바꾸고 스냅샷 존재를 정적 read로 확인:

```ts
export async function getBlockedSymbolMetadata({
    symbol, assetInfo, degraded, revalidateSeconds,
}: BlockedSymbolMetadataInput): Promise<Metadata | null> {
    // hasSnapshot은 degraded일 때만 조회한다 — 비degraded 경로에 DB read를 얹지
    // 않는다(판정에 불필요). 조회는 getSeoSnapshotsStatic(정적화)로만 (NB-2).
    const hasSnapshot = degraded
        ? (await getSeoSnapshotsStatic(symbol, revalidateSeconds)).length > 0
        : undefined;
    const decision = evaluateSymbolIndexability({ symbol, assetInfo, degraded, hasSnapshot });
    return decision.indexable ? null : NOINDEX_SYMBOL_METADATA;
}
```

호출부(7개 탭 `generateMetadata`)에 `await` + 페이지별 `revalidateSeconds` 리터럴(app/CLAUDE.md 페이지별 표와 동일 값) 전달. 각 호출부는 `grep -rn "getBlockedSymbolMetadata" src/app`으로 전수 확인.

- [ ] **Step 5: 통과 확인** — Run: `yarn test src/entities/symbol-indexability src/app/[symbol]` / Expected: PASS
- [ ] **Step 6: Commit** — `feat(seo): degraded-with-snapshot stays indexable (G4 guard)`

### Task 4: 공통 섹션 셸 + technical 렌더러

**Files:**
- Create: `src/views/symbol/snapshot/SnapshotSummarySection.tsx`
- Create: `src/views/symbol/snapshot/renderers/TechnicalSnapshotProse.tsx`
- Test: `src/views/symbol/snapshot/__tests__/SnapshotSummarySection.test.tsx`, `.../TechnicalSnapshotProse.test.tsx`

**섹션 계약 (전 탭 공통)**:
- RSC(서버 전용 아님 — 순수 프리젠테이션, `TechnicalFactsSummary` 스타일과 동일한 배치 가능성 유지)
- props: `{ snapshot: SeoAnalysisSnapshot | null; symbol: string; displayName: string; children?: never }` + 탭별 프로즈 렌더러를 내부 분기 대신 **탭별 컴포넌트가 셸을 감싸는 구조**(셸은 제목·생성시각 공시·프레임만)
- 스냅샷 null → **기존 placeholder 유지**(섹션 자체를 렌더하지 않음 — 현행 fallback 무변경)
- 제목: `최근 분석 요약`, 공시: `전일 장마감 기준 · {generatedAt을 KST로 표시}` (시간 포맷은 `src/shared/lib/timeFormat` 기존 유틸 재사용 — grep으로 시그니처 확인)
- 클로킹 제로: UA 분기 금지 — 모든 방문자 동일 렌더

- [ ] **Step 1: 실패하는 테스트 작성** — 핵심 단언: **비공백 가시 텍스트**(spec §7):

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TechnicalSnapshotProse } from '../renderers/TechnicalSnapshotProse';

// core FilteredAnalysisResult 픽스처 — free 필터 통과 후 형태(summary 유지,
// keyLevels 등 null — spec §7 free-tier 산문 검증). 실제 타입은
// @y0ngha/siglens-core d.ts에서 import해 픽스처에 타입 체크를 건다.
const fixture = {
    direction: 'bullish',
    summary: 'AAPL은 상승 추세가 지속되는 흐름입니다. 거래량이 늘며 저항선 돌파를 시도하고 있습니다.',
    skill_detection: null,
} as const;

describe('TechnicalSnapshotProse', () => {
    it('summary 산문을 가시 텍스트로 렌더한다 (비공백 단언 — spec §7)', () => {
        render(<TechnicalSnapshotProse content={fixture} symbol="AAPL" displayName="애플" />);
        const text = document.body.textContent ?? '';
        expect(text.trim().length).toBeGreaterThan(50);
        expect(text).toContain('상승 추세');
    });
    it('summary가 비면 null 렌더 (placeholder 경로로 fallback)', () => {
        const { container } = render(
            <TechnicalSnapshotProse content={{ ...fixture, summary: '' }} symbol="AAPL" displayName="애플" />
        );
        expect(container.textContent?.trim()).toBe('');
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/views/symbol/snapshot` / Expected: FAIL

- [ ] **Step 3: 구현** — 셸: 헤딩 + 공시 라인 + children. 렌더러: `content`를 core `FilteredAnalysisResult`로 좁혀 `direction`(한국어 라벨 매핑) + `summary` 문단 렌더. 스타일은 `TechnicalFactsSummary.tsx`의 마크업 관례(시맨틱 `<section>`+`<h2>`, DESIGN.md 색상 토큰)를 따른다.

- [ ] **Step 4: 통과 확인 + Commit** — `feat(views): snapshot summary section shell + technical prose renderer`

### Task 5: overall 렌더러

**Files:**
- Create: `src/views/symbol/snapshot/renderers/OverallSnapshotProse.tsx`
- Test: `src/views/symbol/snapshot/__tests__/OverallSnapshotProse.test.tsx`

- [ ] **Step 1: core overall 결과 타입 확인** — Run: `grep -n "headlineKo\|integratedConclusionKo\|BulletsKo" node_modules/@y0ngha/siglens-core/dist/domain/types.d.ts | head -20` — **overall에는 `summary` 필드가 없다**(3차 검토 G3). 렌더 필드: `headlineKo`(헤드라인), `integratedConclusionKo`(종합 결론), `bullishBulletsKo[]`/`bearishBulletsKo[]`(시나리오 불릿) — 실제 필드명은 d.ts 확인 결과로 확정.

- [ ] **Step 2: 실패하는 테스트** — Task 4와 동일 패턴: 타입드 픽스처 → 비공백 단언 + 헤드라인·결론·불릿 각각 존재 단언. free 필터 통과 형태 픽스처 사용.

- [ ] **Step 3: 구현** — 헤드라인 `<h3>`, 결론 문단, 강세/약세 불릿 `<ul>` 2개. 빈 콘텐츠 → null.

- [ ] **Step 4: 통과 확인 + Commit** — `feat(views): overall snapshot prose renderer`

### Task 6: fundamental·financials·congress·options·news 렌더러 (신규 5종)

**Files:**
- Create: `src/views/symbol/snapshot/renderers/{Fundamental,Financials,Congress,Options,News}SnapshotProse.tsx`
- Test: 각 `__tests__/*.test.tsx`

fundamental·financials·congress·options 4탭은 **SSR facts 섹션 자체가 처음**이고, news는 뉴스 목록 facts는 있으나 **AI 뉴스 분석 스냅샷 렌더러는 신규**다(3차 검토 G3). 각 탭마다:

- [ ] **Step 1: core 결과 타입 확인** — 각 탭의 정규화 결과 d.ts(`grep -rn "FundamentalAnalysis\|FinancialsAnalysis\|CongressTrend\|OptionsAnalysis" node_modules/@y0ngha/siglens-core/dist --include="*.d.ts" -l`)에서 **free 필터 통과 후 잔존하는 산문 필드**를 확정한다. 산문 필드가 전부 stripped면 STOP — 스펙 §7 "free-tier 산문 검증" 실패 보고(해당 탭은 스냅샷 저장은 하되 섹션 보류).
- [ ] **Step 2: 실패하는 테스트** — Task 4 패턴(타입드 픽스처, 비공백 ≥50자, 핵심 필드 존재, 빈 콘텐츠→null).
- [ ] **Step 3: 구현** — 탭 도메인에 맞는 시맨틱 구조(요약 문단 + 핵심 수치 `<dl>`).
- [ ] **Step 4: 4탭 각각 통과 확인 후 개별 Commit** — `feat(views): {tab} snapshot prose renderer`

### Task 7: 7개 탭 page.tsx 섹션 장착

**Files:**
- Modify: `src/app/[symbol]/page.tsx`, `overall/page.tsx`, `fundamental/page.tsx`, `financials/page.tsx`, `congress/page.tsx`, `news/page.tsx`, `options/page.tsx`
- Test: 각 페이지의 기존 `__tests__/page*.test.ts*`에 케이스 추가

각 페이지 공통 절차:

- [ ] **Step 1: 실패하는 테스트 추가** — 기존 page 테스트의 mock 세트에 `getSeoSnapshotsStatic` mock 추가, 두 케이스: (a) 스냅샷 존재 → 섹션 텍스트 렌더 (b) 스냅샷 없음 → 기존 placeholder 유지(기존 단언 무회귀).
- [ ] **Step 2: 장착** — `getSeoSnapshotsStatic(symbol, <페이지 revalidate 리터럴>)`을 페이지 데이터 수집부에 추가하고 해당 탭 스냅샷을 골라 셸+렌더러를 **`useSearchParams` CSR bailout 밖**(축 2 — `TechnicalFactsSummary`/`OverallFactsSummary`가 이미 자리한 Suspense fallback/정적 영역과 같은 곳)에 배치. technical·overall은 **snapshot-first, 기존 peek fallback 유지**(spec §7): 스냅샷 있으면 스냅샷, 없으면 기존 peek 결과 → 그것도 없으면 기존 placeholder. **peek 모델 정합 단언(spec §7 5축)**: technical·overall 페이지 테스트에 "스냅샷 생성 모델 상수와 peek 호출 모델 상수가 동일 참조(`DEEPSEEK_V4_FLASH_MODEL`)"임을 단언하는 케이스 추가.
- [ ] **Step 3: degraded 분기에서도 섹션 렌더** — 각 페이지의 degraded 렌더 경로에 스냅샷 섹션 포함(spec §7: "metadata와 페이지 본문 양쪽").
- [ ] **Step 4: news 탭 추가 강화** — `news/page.tsx`는 스냅샷 섹션에 더해 DB 뉴스 목록(제목·요약 — 기존 `getNewsList` 정적화 경로 재사용)을 SSR 가시 텍스트로 노출(spec §7). 이미 노출 중이면 무변경 확인만.
- [ ] **Step 5: 페이지별 통과 확인** — Run: `yarn test src/app/[symbol]` / Expected: PASS (기존 factlayer·guard 테스트 포함 무회귀)
- [ ] **Step 6: ISR 무회귀 실측** — Run: `yarn build > /tmp/build.log 2>&1; echo $?` / Expected: exit 0 + `[symbol]` 라우트들이 여전히 `● (SSG)`. `grep -c "DYNAMIC_SERVER_USAGE" /tmp/build.log` = 0.
- [ ] **Step 7: Commit** (페이지별 또는 일괄) — `feat(symbol): mount snapshot summary sections across 7 tabs`

### Task 8: 유니크 meta description

**Files:**
- Modify: `src/shared/lib/seo.ts` (`buildSymbolDescription` 계열 — `grep -n "buildSymbolDescription" src/shared/lib/seo.ts`)
- Modify: 각 탭 `generateMetadata`(스냅샷 스레딩)
- Test: `src/shared/lib/__tests__/seo.test.ts` 확장

- [ ] **Step 1: 실패하는 테스트** — (a) 스냅샷 summary가 있으면 description이 그것으로 시작(150자 내 절단·말줄임) (b) 없으면 기존 템플릿 유지 (c) 탭별 적합 필드(technical=summary, overall=headlineKo).
- [ ] **Step 2: 구현** — `buildSymbolDescription(displayName, sector, snapshotExcerpt?: string)` 형태로 옵셔널 인자 추가(기존 호출부 무변경 — 하위호환). 155자 안전 절단 유틸 포함.
- [ ] **Step 3: generateMetadata 스레딩** — 각 탭에서 `getSeoSnapshotsStatic`(이미 Task 3·7에서 read 중 — 같은 unstable_cache라 추가 비용 없음) 결과의 excerpt 전달.
- [ ] **Step 4: 통과 확인 + Commit** — `feat(seo): snapshot-derived unique meta descriptions`

### Task 9: fear-greed factor SSR 강화

**Files:**
- Modify: `src/app/[symbol]/fear-greed/page.tsx`
- Create(필요 시): `src/views/symbol/fearGreed/FearGreedFactsSummary.tsx`
- Test: fear-greed 기존 `__tests__` 확장

- [ ] **Step 1: 현행 SSR 확인** — fear-greed 점수·5 factor(Volume z-score, Buy/Sell 불균형, POC 거리, MA200 이격, 52주 위치)가 서버에서 이미 계산되는지 페이지 데이터 흐름을 읽고 확인. 계산이 클라 전용이면 서버 계산 경로(core 함수)를 `staticSymbolCache`로 정적화해 추가.
- [ ] **Step 2: 실패하는 테스트** — 점수·factor 수치가 SSR 가시 텍스트로 존재(비공백 단언 + 수치 포맷).
- [ ] **Step 3: 구현** — `TechnicalFactsSummary` 스타일의 factor 서술 섹션: 점수(0~100)+단계 라벨+factor별 값·1줄 해석. **AI 불필요 — 렌더 타임 계산**(spec §7).
- [ ] **Step 4: 통과 확인 + Commit** — `feat(fear-greed): server-computed factor narrative SSR`

### Task 10: e2e

**Files:**
- Create: `e2e/seo-snapshot.spec.ts` (기존 e2e 명명·구조 관례는 `e2e/` 디렉토리에서 확인)
- Modify(필요 시): e2e DB 시드 헬퍼

**제약**: E2E 환경은 FMP/AI 키 없음(no-FMP 설계) — 스냅샷 행을 **테스트 DB에 직접 시드**하고 SSR만 검증한다. cron 라우트는 e2e에서 실행하지 않는다.

- [ ] **Step 1: 시드 헬퍼** — 기존 e2e 시드 패턴(FakeNewsClient 시드 방식 참조)으로 AAPL technical+overall 스냅샷 2행 삽입.
- [ ] **Step 2: 실패하는 spec 작성** — 케이스:

```ts
test('시드된 스냅샷이 /AAPL SSR 가시 텍스트로 노출된다', async ({ page }) => {
    // JS 비활성 컨텍스트 또는 초기 HTML 검증(request.get + 텍스트 파싱)으로
    // hydration 이전 SSR 텍스트를 단언 — normalizeReactSsrText 유틸 재사용
    const html = await (await page.request.get('/AAPL')).text();
    expect(html).toContain('최근 분석 요약');
    expect(html).toContain('상승 추세'); // 시드 summary 발췌
});
test('스냅샷 없는 인기 심볼은 placeholder를 유지한다', ...);
test('롱테일 심볼 noindex는 불변이다', async ({ page }) => {
    const html = await (await page.request.get('/MMLP')).text();
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
});
```

- [ ] **Step 3: 실행 확인** — Run: `yarn e2e e2e/seo-snapshot.spec.ts` (프로젝트 e2e 실행 스크립트명 확인) / Expected: PASS. ⚠️ workers:1·공유 DB — 시드가 다른 spec의 단언을 흔들지 않는지 확인(SSR fallback 2변형 flaky 전례). ⚠️ `normalizeReactSsrText`는 현재 `e2e/specs/symbol-seo.spec.ts` 내부 정의 — 공용 헬퍼로 추출해 import(중복 정의 금지).
- [ ] **Step 4: Commit** — `test(e2e): seeded snapshot SSR + longtail noindex invariants`

### Task 11: Phase 2 마무리 게이트

- [ ] **Step 1**: `yarn test src/views src/app src/entities/symbol-indexability src/entities/seo-snapshot src/shared/lib` → PASS
- [ ] **Step 2**: 커버리지 (spec §10) — `yarn test-coverage` 후 신규 모듈 ≥90% 확인
- [ ] **Step 3**: `yarn tsc --noEmit` → 0 에러
- [ ] **Step 4**: `yarn lint` → 0 에러
- [ ] **Step 5**: `yarn build > /tmp/build.log 2>&1; echo $?` → 0, DYNAMIC_SERVER_USAGE 0, `[symbol]` SSG 유지
- [ ] **Step 6**: **PR 전 감사·실증 프로토콜 수행** — Phase 1 플랜 말미의 「PR 전 감사·실증 프로토콜」 섹션과 동일(5종 fresh-context Opus 감사 → findings 0 루프 → 실증 Spec+Test Case 선행 생성 → prod-like 빌드 + curl + Chrome 실증) → mistake-managing-agent → git-agent(PR)

---

## 배포·운영 (플랜 밖 — 사용자 개입 체크리스트, spec §11)

1. SSM `/siglens/CRON_SECRET` 실값 주입 → `infra/aws/13-seo-prewarm.sh` 실행(딜리버리 스파이크 먼저)
2. `yarn db:migrate` 프로덕션 적용
3. **prod-like 검증(spec §11)**: ① `after()` 내 `revalidatePath`/`revalidateTag` 실동작 ② S3 cacheHandler 경유 revalidate 반영(`x-nextjs-cache` HIT→revalidate 후 MISS→재HIT) — 스테이징/첫 배포 직후 curl로 확인
4. 첫 cron 사이클 카운트 로그·FMP 402/429 알람 확인 · 워커 처리량 실측(§9 — 심볼/틱 조정 판단)
5. `/AAPL` 가시 텍스트 증가 실측(현 677자 대비)
6. GSC 5/22 프리픽스 삭제 요청 취소 · ALB 액세스 로그 활성화

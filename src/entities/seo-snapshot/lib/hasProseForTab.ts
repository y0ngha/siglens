import type { SeoSnapshotTab } from '@/entities/seo-snapshot/model';
import { hasTechnicalProse } from './technicalContent';
import { hasOverallProse } from './overallContent';
import { hasCongressProse } from './congressContent';
import { hasFundamentalProse } from './fundamentalContent';
import { hasFinancialsProse } from './financialsContent';
import { hasNewsProse } from './newsContent';
import { hasOptionsProse } from './optionsContent';

/**
 * Tab → renderability predicate map (audit fix FIX 1). Each entry delegates to
 * the SAME `has*Prose` predicate its `*SnapshotProse` renderer uses internally
 * to decide whether to return `null` — so this map and the renderer it backs
 * can never disagree on whether a given row's `content` produces visible
 * prose.
 *
 * Consumed by `src/app/[locale]/[symbol]/symbolIndexabilityMetadata.ts`, the
 * sitemap prose gate (`entities/sitemap-entry/lib/proseGate.ts`) and the
 * pre-warm harvest to gate indexability/persistence on RENDERABILITY, not row
 * existence: a `seo_analysis_snapshots`
 * row can exist for a tab while its `content` fails that tab's narrowing (a
 * malformed JSONB write, a core schema drift) — in that case the page body
 * falls back to the thin degraded shell, and this map must report `false` so
 * the page is not falsely marked indexable.
 *
 * ⚠️ 판별 로직(`narrow*`/`has*Prose`)은 `entities/seo-snapshot/lib/*Content.ts`에
 * 둔다 — views의 렌더러 `.tsx`에서 가져오면 판별 함수 하나 때문에 React 컴포넌트
 * 트리가 통째로 딸려 오고(`SnapshotSummarySection` → `PlainAnalysisSwitch` →
 * `AnalysisViewToggle`, 스냅샷을 렌더하지 않는 라우트가 쉽게보기 번역 키를 요구하게
 * 됐다), entities(sitemap·harvest)는 views를 import할 수 없다. 렌더러와 이 맵이
 * 같은 `narrow*`를 공유하므로 둘이 어긋날 수 없다.
 */
const PROSE_PREDICATE_BY_TAB: Record<
    SeoSnapshotTab,
    (content: unknown) => boolean
> = {
    technical: hasTechnicalProse,
    overall: hasOverallProse,
    congress: hasCongressProse,
    fundamental: hasFundamentalProse,
    financials: hasFinancialsProse,
    news: hasNewsProse,
    options: hasOptionsProse,
};

/**
 * Returns whether `content` renders visible prose for the given snapshot
 * `tab`. `tab` is typed as `SeoSnapshotTab`, but this function is called with
 * DB-sourced row data (`getSeoSnapshotsStatic` results) that isn't
 * compiler-checked at the call site — an unrecognized tab string must return
 * `false`, not throw, so a malformed/legacy row can never crash metadata
 * generation (PR #698 round-2 review FIX 1).
 */
export function hasProseForTab(tab: SeoSnapshotTab, content: unknown): boolean {
    const predicate = PROSE_PREDICATE_BY_TAB[tab];
    return predicate !== undefined && predicate(content);
}

/**
 * sitemap 로더가 DB에서 **필드만 골라** 읽는 탭의 산문 원천 필드.
 *
 * 렌더 가능성 판정(`hasProseForTab`)은 `content` 전체가 아니라 아래 필드만 본다 — sitemap은
 * 수백 행을 한 번에 훑으므로 JSONB 본문 전체(차트 탭은 키 레벨·추세선까지 수십 KB)를 끌어오지
 * 않고 SQL(`jsonb_build_object`)에서 이 필드만 투영해 같은 판정 함수를 돌린다.
 *
 * ⚠️ `narrow*Content`가 산문 근거로 읽는 필드가 늘면 여기도 함께 늘려야 한다. 어긋나면 sitemap이
 * 페이지보다 보수적(산문이 있는데 없다고 판정)이 된다 — `hasProseForTab.test.ts`가 "이 필드만
 * 남겨도 판정이 같고, 이 필드를 빼면 거짓"을 픽스처로 고정한다.
 */
export const PROSE_SOURCE_FIELDS = {
    technical: ['summary', 'patternSummaries', 'strategyResults'],
    news: ['currentDriverKo', 'keyEventsKo', 'upcomingEventsKo'],
} as const satisfies Partial<Record<SeoSnapshotTab, readonly string[]>>;

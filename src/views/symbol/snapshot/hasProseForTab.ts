import type { SeoSnapshotTab } from '@/entities/seo-snapshot';
import { hasTechnicalProse } from './renderers/technicalContent';
import { hasOverallProse } from './renderers/overallContent';
import { hasCongressProse } from './renderers/congressContent';
import { hasFundamentalProse } from './renderers/fundamentalContent';
import { hasFinancialsProse } from './renderers/financialsContent';
import { hasNewsProse } from './renderers/newsContent';
import { hasOptionsProse } from './renderers/optionsContent';

/**
 * Tab → renderability predicate map (audit fix FIX 1). Each entry delegates to
 * the SAME `has*Prose` predicate its `*SnapshotProse` renderer uses internally
 * to decide whether to return `null` — so this map and the renderer it backs
 * can never disagree on whether a given row's `content` produces visible
 * prose.
 *
 * Consumed by `src/app/[symbol]/symbolIndexabilityMetadata.ts` to gate
 * indexability on RENDERABILITY, not row existence: a `seo_analysis_snapshots`
 * row can exist for a tab while its `content` fails that tab's narrowing (a
 * malformed JSONB write, a core schema drift) — in that case the page body
 * falls back to the thin degraded shell, and this map must report `false` so
 * the page is not falsely marked indexable.
 *
 * ⚠️ **렌더러 `.tsx`가 아니라 `*Content.ts`에서 가져온다.** 이 맵은 서버 전용
 * 메타데이터 경로(`symbolIndexabilityMetadata.ts`)가 소비하는데, 렌더러에서
 * 가져오면 판별 함수 하나 때문에 React 컴포넌트 트리가 통째로 딸려 온다.
 * 실제로 그 체인이 `SnapshotSummarySection` → `PlainAnalysisSwitch` →
 * `AnalysisViewToggle`까지 이어져, 스냅샷을 렌더하지도 않는 `fear-greed`·
 * `position` 라우트가 쉽게보기 번역 키를 요구하게 됐다(i18n 커버리지 가드가
 * 잡았다). 판별 로직은 컴포넌트 없는 `.ts`에 두고 양쪽이 그것을 공유한다.
 *
 * Lives in `src/views/**` (not `src/entities/seo-snapshot`) because the
 * narrowing modules are a `views` concern; `app/` may import `views/**`
 * directly.
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

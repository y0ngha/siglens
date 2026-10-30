import type { SeoSnapshotTab } from '../model';
import { hasCongressProse } from './congressContent';
import { hasFinancialsProse } from './financialsContent';
import { hasFundamentalProse } from './fundamentalContent';
import { hasNewsProse } from './newsContent';
import { hasOptionsProse } from './optionsContent';
import { hasOverallProse } from './overallContent';
import { hasTechnicalProse } from './technicalContent';

/**
 * 탭 → 렌더 가능성 판정 맵. 각 항목은 해당 `*SnapshotProse` 렌더러가 `null`을 반환할지 정할 때
 * 내부에서 쓰는 **같은** `has*Prose` 술어에 위임하므로, 이 맵과 렌더러는 어떤 행의 `content`가
 * 보이는 산문을 만드는지에 대해 어긋날 수 없다.
 *
 * 색인 가능 여부와 영속화를 행 존재가 아니라 **렌더 가능성**으로 게이팅하는 곳에서 쓴다 —
 * `src/app/[locale]/[symbol]/symbolIndexabilityMetadata.ts`, sitemap 산문 게이트
 * (`entities/sitemap-entry/lib/proseGate.ts`), 프리웜 harvest. 행이 있어도 `content`가 그 탭의
 * 좁힘을 통과하지 못할 수 있다(손상된 JSONB 쓰기, core 스키마 드리프트). 그러면 페이지 본문은
 * 얇은 degraded shell로 폴백하므로 이 맵이 `false`를 보고해야 페이지가 잘못 indexable로
 * 표시되지 않는다.
 *
 * ⚠️ 판별 로직(`narrow*`/`has*Prose`)은 `entities/seo-snapshot/lib/*Content.ts`에 둔다 —
 * views의 렌더러 `.tsx`에서 가져오면 판별 함수 하나 때문에 React 컴포넌트 트리가 통째로 딸려 오고
 * (`SnapshotSummarySection` → `PlainAnalysisSwitch` → `AnalysisViewToggle`, 스냅샷을 렌더하지
 * 않는 라우트가 쉽게보기 번역 키를 요구하게 됐다), entities(sitemap·harvest)는 views를 import할
 * 수 없다.
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
 * `content`가 해당 스냅샷 `tab`에서 보이는 산문을 렌더하는지 돌려준다. `tab`은
 * `SeoSnapshotTab`으로 타입이 걸려 있지만 호출부는 컴파일러가 검사하지 못하는 DB 행
 * (`getSeoSnapshotsStatic` 결과)을 넘긴다 — 알 수 없는 탭 문자열은 던지지 않고 `false`를
 * 돌려줘, 손상·레거시 행이 메타데이터 생성을 깨뜨리지 못하게 한다.
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

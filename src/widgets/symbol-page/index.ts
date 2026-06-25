// symbol-page widget barrel — public API for cross-widget consumers.
// Heavy components (SymbolPageClient, ChartContent, MobileAnalysisSheet, etc.)
// are imported directly by app routes, not re-exported here, to keep the
// barrel tree-shake-friendly and avoid Jest ESM resolution issues.

export { SymbolPageProvider, useSymbolPageContext } from './SymbolPageContext';
export { SymbolModelProvider, useSymbolModel } from './SymbolModelContext';

export { CrossLinkCards } from './CrossLinkCards';
export { SymbolPageHeading } from './ui/SymbolPageHeading';
// 차트 라우트 h1 텍스트 단일 소스 — SSR fallback h1(page.tsx)과 가시 h1(SymbolPageClient)
// 일치 보장(cloaking 방지). 순수 string 헬퍼라 barrel 노출 안전.
export { buildChartPageHeading } from './utils/chartPageHeading';
// 경량 순수 컴포넌트(priceFormat/technicalFacts util만 의존) — heavy 컴포넌트 deep-import
// 정책에 해당하지 않아 barrel로 노출한다. app route의 FactLayer SSR fallback이 소비.
export { TechnicalFactsSummary } from './TechnicalFactsSummary';

// Types re-exported for cross-widget consumption
export type { CooldownNotice } from './types';

// Hooks re-exported for cross-widget consumption.
// NOTE: useAssetInfo, useBars, useDefaultModelId are NOT re-exported here
// because their transitive server-side dependencies (entity actions ->
// @google/genai ESM) break Jest module resolution. Cross-widget consumers
// import them directly via deep path, with widgets excluded from the
// no-restricted-imports rule for @/widgets/*/hooks/*.
export {
    useAnalysisProgress,
    ANALYSIS_PHASES,
    ANALYSIS_TIPS,
} from './hooks/useAnalysisProgress';

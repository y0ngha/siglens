// symbol-page widget barrel — public API for cross-widget consumers.
// Heavy components (SymbolPageClient, ChartContent, MobileAnalysisSheet, etc.)
// are imported directly by app routes, not re-exported here, to keep the
// barrel tree-shake-friendly and avoid Jest ESM resolution issues.

export {
    SymbolPageProvider,
    useSymbolPageContext,
} from './SymbolPageContext';
export {
    SymbolModelProvider,
    useSymbolModel,
} from './SymbolModelContext';

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

// Exceptions re-exported for cross-widget consumption
export { BotBlockedError } from './exceptions/BotBlockedError';

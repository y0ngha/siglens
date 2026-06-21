// NOTE: api.ts is server-only (transitively imports @/shared/db/client → clientTest.ts).
// Do NOT re-export anything from './api' here — this barrel is imported by client
// components (useRecentSearches, TickerAutocomplete, SymbolSearchPanel).
// Server consumers must import from '@/entities/ticker/api' directly.

export {
    getAssetInfoResilient,
    type ResilientAssetInfo,
} from './lib/getAssetInfoResilient';

export {
    translateCompanyNames,
    translateCompanyDescription,
} from './lib/koreanTranslator';

export {
    getRecentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    RECENT_SEARCHES_STORAGE_KEY,
    MAX_RECENT_SEARCHES,
} from './lib/recentSearches';

export {
    buildDisplayName,
    deduplicateResults,
    isKoreanInput,
} from './lib/ticker';

export {
    buildAssetAboutNode,
    classifyAsset,
    type AssetCategory,
    type CorporationAboutNode,
} from './lib/assetClassification';

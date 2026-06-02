export {
    DrizzleKoreanTickerRepository,
    DrizzleAssetTranslationRepository,
    DrizzleProfileDescriptionTranslationRepository,
} from './api';

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
    isValidTickerFormat,
} from './lib/ticker';

export {
    buildAssetAboutNode,
    classifyAsset,
    type AssetCategory,
    type CorporationAboutNode,
} from './lib/assetClassification';

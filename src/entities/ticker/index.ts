// NOTE: api.ts is server-only (transitively imports @/shared/db/client → clientTest.ts).
// Do NOT re-export anything from './api' here — this barrel is imported by client
// components (useRecentSearches, TickerAutocomplete, SymbolSearchPanel).
// Server consumers must import from '@/entities/ticker/api' directly.

// useAssetInfo hook는 barrel에서 제외 — actions/ barrel이 @google/genai ESM을 전이적으로
// pull-in하여 Jest 모듈 해석이 깨진다.
// 소비자는 @/entities/ticker/hooks/useAssetInfo 에서 직접 deep import한다.

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
    shouldShowEnglishName,
} from './lib/ticker';

// fireAndForget — SIGTERM drain 카운터에 백그라운드 promise를 등록하는 유틸.
// backgroundTask.ts는 Node.js 전용 API를 사용하지 않으므로 barrel에서 안전하게 노출 가능.
// 클라이언트 번들에 포함돼도 module-level 상태(pendingTasks Set)만 초기화될 뿐 동작에
// 영향 없음 — 클라이언트에서 SIGTERM drain이 의미 없으므로 no-op에 가깝다.
export { fireAndForget } from './lib/backgroundTask';

export {
    buildAssetAboutNode,
    classifyAsset,
    type AssetCategory,
    type CorporationAboutNode,
} from './lib/assetClassification';

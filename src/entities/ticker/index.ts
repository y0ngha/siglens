// NOTE: api.ts is server-only (transitively imports @/shared/db/client → clientTest.ts).
// Do NOT re-export anything from './api' here — this barrel is imported by client
// components (useRecentSearches, TickerAutocomplete, SymbolSearchPanel).
// Server consumers must import from '@/entities/ticker/api' directly.

// useAssetInfo hook는 barrel에서 제외 — actions/ barrel이 @google/genai ESM을 전이적으로
// pull-in하여 Jest 모듈 해석이 깨진다.
// 소비자는 @/entities/ticker/hooks/useAssetInfo 에서 직접 deep import한다.

// translateCompanyNames / translateCompanyDescription도 barrel에서 제외 — koreanTranslator.ts가
// @/entities/llm-provider를 통해 @anthropic-ai/sdk + openai + @google/genai를 전이적으로
// pull-in한다. 이 barrel은 'use client' 컴포넌트(TickerAutocomplete 등)가 import하므로,
// 여기서 재노출하면 세 SDK가 통째로 클라이언트 번들에 유입된다.
// 소비자는 @/entities/ticker/lib/koreanTranslator 에서 직접 deep import한다.

export {
    getAssetInfoResilient,
    type ResilientAssetInfo,
} from './lib/getAssetInfoResilient';

export {
    getRecentSearches,
    type RecentSearchEntry,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    RECENT_SEARCHES_STORAGE_KEY,
    MAX_RECENT_SEARCHES,
} from './lib/recentSearches';

export {
    buildDisplayName,
    pickAssetName,
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

// 접미사→거래소 매핑의 유일한 출처. 자동완성 배지가 `.KQ`를 자체 판정하면
// canonical 정규식보다 느슨한 두 번째 표가 생긴다(MISTAKES.md §16.5).
export { krExchangeOf, type KrExchange } from './lib/krExchange';

/**
 * 번역 모델·키 설정.
 *
 * `ticker` 슬라이스에 있는 것은 이력 때문이다(회사명 한국어 번역이 첫 소비자였다).
 * 지금은 `entities/analysis-translation`도 같은 설정을 쓴다 — 둘 다
 * `DEEPSEEK_API_KEY` 하나로 같은 저가 모델을 부른다. 복제하면 `TRANSLATE_MODEL`
 * 검증 규칙이 두 벌이 되어 한쪽만 갱신되므로, 배럴로 내보내 공유한다.
 */
export { tryReadTranslatorConfig } from './lib/config';

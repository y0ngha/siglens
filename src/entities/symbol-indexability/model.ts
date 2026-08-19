import type { Locale } from '@/shared/i18n/locales';
import type { AssetInfo } from '@/shared/lib/types';

export interface SymbolIndexabilityInput {
    symbol: string;
    assetInfo: AssetInfo | null;
    degraded: boolean;
    hasSnapshot?: boolean;
    /**
     * 이 URL이 속한 로케일. 생략하면 기본 로케일로 본다(기존 호출부 호환).
     *
     * 본문(AI 분석 산문)이 아직 한국어로만 생성되므로, 준비되지 않은 로케일은
     * 다른 모든 조건을 만족해도 색인하지 않는다 — 영어 껍데기 안의 한국어 본문이
     * 색인되면 thin content로 취급된다.
     */
    locale?: Locale;
}

export type SymbolIndexabilityReason =
    | 'popular'
    | 'curated-crypto'
    | 'approved-longtail'
    | 'invalid-symbol'
    | 'asset-missing'
    | 'degraded'
    | 'degraded-with-snapshot'
    | 'longtail-default-blocked'
    | 'locale-not-ready';

export interface SymbolIndexabilityDecision {
    indexable: boolean;
    reason: SymbolIndexabilityReason;
}

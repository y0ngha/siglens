import type { Locale } from '@/shared/i18n/locales';
import type { AssetInfo } from '@/shared/lib/types';

export interface SymbolIndexabilityInput {
    symbol: string;
    assetInfo: AssetInfo | null;
    degraded: boolean;
    hasSnapshot?: boolean;
    /**
     * 이 URL이 속한 로케일. **필수다** — 생략 가능하게 두면 호출부에서 빠져도
     * 컴파일이 통과하고, 그 순간 모든 로케일이 색인 대상이 된다(비-ko URL에
     * 한국어 본문이 담긴 채로). 실증: `overall/page.tsx`에서 `locale`만 빼도
     * 227개 테스트가 전부 통과했다.
     *
     * 본문(AI 분석 산문)이 아직 한국어로만 생성되므로, 준비되지 않은 로케일은
     * 다른 모든 조건을 만족해도 색인하지 않는다 — 영어 껍데기 안의 한국어 본문이
     * 색인되면 thin content로 취급된다.
     */
    locale: Locale;
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

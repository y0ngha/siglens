import type { AssetInfo } from '@/shared/lib/types';

export interface SymbolIndexabilityInput {
    symbol: string;
    assetInfo: AssetInfo | null;
    degraded: boolean;
    hasSnapshot?: boolean;
    /**
     * 이 심볼에 가격 봉이 하나라도 있는가. **`false`면 화이트리스트 여부와
     * 무관하게 noindex**다.
     *
     * 화이트리스트 멤버십은 "색인할 가치가 있는 종목인가"만 답하고 "지금 이
     * 페이지에 콘텐츠가 있는가"는 답하지 않는다. 2026-08-24 프로덕션 전수
     * 조사에서 유니버스 431종 중 14종(ASSF·BSTG·CLAA·CTK·DIRV·DYFN·ENTF·
     * ESMT·GTS·HVBC·PSMC·SRYB·SWAR·TLIIX)이 봉이 전혀 없어 차트 페이지가
     * 제목 + sr-only 개요만 남은 **고유 330자짜리 껍데기**였는데, 전부
     * `index, follow`로 sitemap에 실려 있었다. 대부분 상장폐지·비상장 전환된
     * 티커다(`popular-tickers.ts`의 TODO가 예견한 케이스).
     *
     * 목록에서 손으로 지우지 않고 런타임 신호로 판정하는 이유는 **양방향
     * 자가치유** 때문이다. 새로 상장폐지되는 종목은 자동으로 빠지고, 데이터
     * 공급이 일시 중단됐다 복구된 종목은 자동으로 돌아온다. 손으로 지우면
     * 후자가 영구히 사라진다.
     *
     * 봉 유무를 볼 수 없는 라우트는 생략한다 — `undefined`면 기존 판정이
     * 그대로 유지된다(현재는 차트 라우트만 전달).
     */
    hasPriceData?: boolean;
}

export type SymbolIndexabilityReason =
    | 'popular'
    | 'curated-crypto'
    | 'approved-longtail'
    | 'invalid-symbol'
    | 'asset-missing'
    | 'no-price-data'
    | 'degraded'
    | 'degraded-with-snapshot'
    | 'longtail-default-blocked';

export interface SymbolIndexabilityDecision {
    indexable: boolean;
    reason: SymbolIndexabilityReason;
}

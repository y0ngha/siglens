import type {
    MarketBriefingContext,
    MarketSummaryData,
} from '@y0ngha/siglens-core';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';

/**
 * scope + 요약 → core `MarketBriefingContext`.
 *
 * **쓰기(`runBriefing`)와 읽기(`peekBriefingCache`)가 반드시 이 함수를 공유해야 한다.**
 * context는 `hashBriefingInput`에 접혀 들어가므로, 두 경로가 조금이라도 다르게
 * 조립하면 peek이 **아무도 쓴 적 없는 키**를 읽어 영원히 미스한다 — 화면은 정상이고
 * (클라가 submit으로 채운다) 로그도 조용해서, 늘어난 LLM 호출로만 드러난다.
 *
 * 변동성은 요약 안의 실제 시세에서 가져온다. `volatilityIndexSymbol`이 없거나
 * 그 심볼이 요약에 없으면 `null` — 프롬프트는 안 준 숫자를 묻지 않는다.
 * 조회 실패 sentinel(`price: 0`)이나 비유한값은 **프롬프트에서만** core sanitizer가
 * `null`로 눕힌다(`buildMarketBriefingPrompt`의 `isFinite && > 0` 게이트).
 * `hashBriefingInput`은 그런 검사 없이 값을 그대로 접으므로 캐시 키까지 정규화되지는
 * 않는다 — 다만 시세 조회가 실패하면 해시되는 `indices` 항목도 같이 0이 되어 키가
 * 어차피 갈리므로, 여기서 중복 검사하지 않는다.
 */
export function marketBriefingContextOf(
    scope: ClientDashboardScope,
    summary: MarketSummaryData
): MarketBriefingContext {
    const symbol = scope.volatilityIndexSymbol;
    if (symbol !== null) {
        const quote = summary.indices.find(index => index.symbol === symbol);
        if (quote !== undefined) {
            return {
                marketLabel: scope.marketLabel,
                volatility: { label: symbol, level: quote.price },
            };
        }
    }
    return { marketLabel: scope.marketLabel, volatility: null };
}

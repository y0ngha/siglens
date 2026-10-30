import 'server-only';
import { getAssetInfo } from '@/entities/ticker/server/getAssetInfo';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { quoteWithTimeout } from '@/shared/api/market/quoteTimeout';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';

/**
 * `FundamentalSnapshot.currentPrice`에 넣을 현재가. core의 fundamental 축에는 자체
 * 시세 provider가 없다. 에이전트 챗 도구(`getFundamentals.ts`/`getQuote.ts`)와 기술
 * 분석 SSE 라우트의 포지션 버킷 조회가 쓰는 것과 같은 symbol→fmpSymbol→quote 경로다.
 *
 * 실패·타임아웃·유효하지 않은 가격이면 무엇이든 `undefined`다. core도 비유한·0·음수를
 * 없는 값으로 취급하지만, 여기서 `undefined`로 풀어 실패한 조회가 옵션 객체에 아예
 * 닿지 않게 한다. 요청 경로 액션(`runFundamentalAnalysisAction`)과 SEO 프리웜 seam
 * (`prewarmFundamental`)이 함께 써서, 두 경로 모두 `## Derived Metrics`의 목표가
 * 상승여력 행을 채운다.
 *
 * `@/entities/analysis-plain`의 `resolveCurrentPrice(symbol, payload)`(payload를 받는
 * 다른 시그니처)와 이름이 겹치지 않도록 `fetchQuotePriceForAnalysis`라 부른다.
 */
export async function fetchQuotePriceForAnalysis(
    symbol: string
): Promise<number | undefined> {
    try {
        const [marketProfile, asset] = await Promise.all([
            resolveMarketProfile(symbol),
            getAssetInfo(symbol),
        ]);
        const quote = await quoteWithTimeout(
            getCachedMarketDataProvider(sessionSpecFor(marketProfile)),
            asset?.fmpSymbol ?? symbol
        );
        return quote && Number.isFinite(quote.price) && quote.price > 0
            ? quote.price
            : undefined;
    } catch (error) {
        // `logToolError`/`logToolDegrade`(`app/api/ai/chat/tools/logToolDegrade.ts`)와
        // 같은 프라이버시 규칙: 에러 객체·`.message`·`.stack`은 남기지 않고 `name`만
        // 남긴다 — `DrizzleQueryError` 메시지에 바인딩 파라미터가 실릴 수 있다. entities
        // 레이어는 그 app 레이어 헬퍼를 import할 수 없어 name 추출을 인라인한다.
        console.error(
            '[fetchQuotePriceForAnalysis] quote lookup failed, degrading to undefined:',
            { errorName: error instanceof Error ? error.name : 'unknown' }
        );
        return undefined;
    }
}

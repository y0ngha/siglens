import 'server-only';
import type { InvestorFlowsScorecard } from '@y0ngha/siglens-core';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { getInvestorFlowsScorecard } from './getInvestorFlowsScorecard';

/**
 * 종합 분석의 `investorFlowsScorecard` 입력 — core 계약의 세 값을 그대로 구분해 돌려준다:
 *
 * - `undefined`: 수급을 종합에 넣지 않는다. 미국 주식이 아니거나(크립토·한국 — 수급 탭 자체가 없다)
 *   인프라 장애일 때. core는 이 경우 프롬프트·스키마·캐시 키가 필드 도입 전과 **바이트 단위로 같다고**
 *   약속하므로, 장애가 "데이터 없음"으로 캐시에 굳지 않는다.
 * - `null`: 미국 주식인데 이 종목은 수급 데이터가 없다 — 프롬프트가 "데이터 없음"을 명시한다(중립이 아니다).
 *   단 13F 수집이 아직 안 끝났으면(`readiness.institutional === 'collecting'`) 스냅샷이 없는 것은 "이 종목에 데이터가
 *   없다"가 아니라 "아직 못 모았다"일 수 있어 `undefined`로 돌려 종합에 넣지 않는다(그래야 "데이터 없음"이 캐시에 굳지 않는다).
 * - 점수표: 가중치 안내와 기준일이 프롬프트에 들어간다.
 *
 * 웹 액션(`executeOverallAnalysis`), 공개 API, SEO 프리웜(`prewarmOverall`)이 모두 이 함수를 불러야
 * 세 경로의 inputHash(= 캐시 키)가 같다. 한 경로만 빠지면 프리웜이 데운 캐시를 사용자가 못 맞힌다.
 *
 * 예외는 던지지 않는다 — 수급이 실패해도 나머지 축으로 종합 분석은 계속된다.
 */
export async function getOverallInvestorFlowsScorecard(
    symbol: string,
    marketProfile: MarketProfileId
): Promise<InvestorFlowsScorecard | null | undefined> {
    if (marketProfile !== 'us-equity') return undefined;
    try {
        const { scorecard, degraded, readiness } =
            await getInvestorFlowsScorecard(symbol);
        if (degraded) return undefined;
        if (scorecard === null && readiness.institutional === 'collecting')
            return undefined;
        return scorecard;
    } catch (error) {
        console.warn(
            '[getOverallInvestorFlowsScorecard] investor flows scorecard failed:',
            error
        );
        return undefined;
    }
}

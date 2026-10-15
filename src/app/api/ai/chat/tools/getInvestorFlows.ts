import 'server-only';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { getInvestorFlowsScorecard } from '@/entities/investor-flows/server/getInvestorFlowsScorecard';
import { summarizeInvestorFlows } from '@/entities/investor-flows/lib/summarizeInvestorFlows';
import type { ToolExecutor } from '@/app/api/ai/chat/tools/chatTools';

const BASE_SOURCE =
    'SEC 13F (institutions, quarterly, filed up to ~45 days after quarter end), Form 4 and 13D/13G via FMP';
const FINRA_SOURCE = 'FINRA short interest/volume';

/**
 * 미국 주식의 수급(기관 13F · 내부자 Form 4 · 5% 대량보유 · FINRA 공매도) 요약.
 *
 * 서버 LLM을 부르지 않는다 — DB에 쌓인 13F·FINRA와 FMP 내부자 데이터를 읽어 `evaluateInvestorFlows`
 * 점수표(코드 계산)를 압축할 뿐이라 공개 API(`/api/v1`)에 그대로 내보내도 서버 키 비용이 없다.
 * 탭 게이트는 `get_congress_trades`/`get_options_summary`와 같다: 한국·크립토 심볼에는 수급 탭이 없다.
 *
 * `degraded:true`(인프라 장애)는 `available:false`로, 정상적인 "이 종목은 수급 데이터 없음"은
 * `available:true` + `noData:true`로 갈라 모델이 장애를 "데이터 없음"으로 말하지 않게 한다.
 */
export const getInvestorFlowsTool: ToolExecutor = async args => {
    const symbol = String(args.symbol).toUpperCase();
    if (!(await isTabAllowedForSymbol(symbol, 'flows')))
        return { symbol, available: false, reason: 'tab_not_available' };

    const { snapshot, scorecard, degraded, finraEnabled } =
        await getInvestorFlowsScorecard(symbol);
    if (degraded)
        return { symbol, available: false, reason: 'provider_failed' };

    // FINRA는 플래그가 켜져 있을 때만 출처로 밝힌다 — 꺼진 응답이 FINRA 데이터를 쓴 것처럼 말하면 안 된다.
    const source = finraEnabled
        ? `${BASE_SOURCE}, ${FINRA_SOURCE}`
        : BASE_SOURCE;
    if (snapshot === null || scorecard === null)
        return {
            asOf: new Date().toISOString(),
            source,
            symbol,
            available: true,
            noData: true,
        };

    return {
        asOf: snapshot.asOf,
        source,
        symbol,
        available: true,
        noData: false,
        ...summarizeInvestorFlows(snapshot, scorecard),
    };
};

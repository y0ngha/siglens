import 'server-only';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { getInvestorFlowsScorecard } from '@/entities/investor-flows/server/getInvestorFlowsScorecard';
import {
    maskUncollectedShort,
    resolveCollectingArms,
} from '@/entities/investor-flows/lib/investorFlowsReadiness';
import { summarizeInvestorFlows } from '@/entities/investor-flows/lib/summarizeInvestorFlows';
import type { InvestorFlowsSnapshot } from '@y0ngha/siglens-core';
import type { InvestorFlowsPipelineReadiness } from '@/entities/investor-flows/model';
import type { ToolExecutor } from '@/app/api/ai/chat/tools/chatTools';

const BASE_SOURCE =
    'SEC 13F (institutions, quarterly, filed up to ~45 days after quarter end), Form 4 and 13D/13G via FMP';
const FINRA_SOURCE = 'FINRA short interest/volume';
const COLLECTING_NOTE =
    'Initial SEC 13F / FINRA collection is still running for the axes marked collecting. Empty or insufficient data there means not collected yet, not that the stock has no institutional or short activity - say the data is still being collected.';

/**
 * 수집 파이프라인 상태를 모델에 알린다. `collecting`인 갈래의 빈 데이터는 "활동 없음"이 아니라 "아직 못 모았다"이므로
 * 모델이 그렇게 말해야 한다. **어느 한 갈래라도 수집 중일 때만** 싣는다 — 정상 상태(둘 다 `ready`/`unknown`)에서는
 * 키를 생략해 응답이 예전과 같다(도구 결과는 6,000자 상한에 여유가 600자뿐이라 매번 싣는 비용이 크다).
 * 그 종목의 해당 구간이 실제로 비어 있는 갈래만 싣는다(화면과 같은 `resolveCollectingArms` 판정) — 데이터가 있으면
 * 수집 중 표시여도, `unknown`(상태를 못 읽음)·FINRA 꺼짐이어도 그 갈래의 키는 없다.
 */
function buildDataStatus(
    snapshot: InvestorFlowsSnapshot | null,
    readiness: InvestorFlowsPipelineReadiness,
    finraEnabled: boolean
) {
    const arms = resolveCollectingArms({
        readiness,
        institutional: snapshot?.institutional ?? {
            quarters: [],
            topHolders: [],
            topHoldersPeriod: null,
        },
        shortInterest: snapshot?.shortInterest ?? [],
        shortVolume: snapshot?.shortVolume ?? [],
        finraEnabled,
    });
    if (!arms.institutional && !arms.short) return undefined;
    return {
        ...(arms.institutional ? { institutional: 'collecting' } : {}),
        ...(arms.short ? { short: 'collecting' } : {}),
        note: COLLECTING_NOTE,
    };
}

/**
 * 미국 주식의 수급(기관 13F · 내부자 Form 4 · 5% 대량보유 · FINRA 공매도) 요약.
 *
 * 서버 LLM을 부르지 않는다 — DB에 쌓인 13F·FINRA와 FMP 내부자 데이터를 읽어 `evaluateInvestorFlows`
 * 점수표(코드 계산)를 압축할 뿐이라 공개 API(`/api/v1`)에 그대로 내보내도 서버 키 비용이 없다.
 * 탭 게이트는 `get_congress_trades`/`get_options_summary`와 같다: 한국·크립토 심볼에는 수급 탭이 없다.
 *
 * `dataStatus`는 13F·FINRA 초기 수집이 아직 끝나지 않았을 때만 실린다(`collecting`). 그때 해당 축이 비어 있는 것은
 * 그 종목에 활동이 없어서가 아니므로 "데이터를 모으는 중"이라고 말해야 한다(공매도는 `short: null`로도 드러난다).
 * 키가 없으면 수집이 끝난 정상 상태다.
 *
 * `degraded:true`(인프라 장애)는 `available:false`로, 정상적인 "이 종목은 수급 데이터 없음"은
 * `available:true` + `noData:true`로 갈라 모델이 장애를 "데이터 없음"으로 말하지 않게 한다.
 */
export const getInvestorFlowsTool: ToolExecutor = async args => {
    const symbol = String(args.symbol).toUpperCase();
    if (!(await isTabAllowedForSymbol(symbol, 'flows')))
        return { symbol, available: false, reason: 'tab_not_available' };

    const { snapshot, scorecard, degraded, finraEnabled, readiness } =
        await getInvestorFlowsScorecard(symbol);
    if (degraded)
        return { symbol, available: false, reason: 'provider_failed' };

    // FINRA는 플래그가 켜져 있을 때만 출처로 밝힌다 — 꺼진 응답이 FINRA 데이터를 쓴 것처럼 말하면 안 된다.
    const source = finraEnabled
        ? `${BASE_SOURCE}, ${FINRA_SOURCE}`
        : BASE_SOURCE;
    const dataStatus = buildDataStatus(snapshot, readiness, finraEnabled);
    if (snapshot === null || scorecard === null)
        return {
            asOf: new Date().toISOString(),
            source,
            symbol,
            available: true,
            noData: true,
            ...(dataStatus === undefined ? {} : { dataStatus }),
        };

    return {
        asOf: snapshot.asOf,
        source,
        symbol,
        available: true,
        noData: false,
        ...(dataStatus === undefined ? {} : { dataStatus }),
        ...summarizeInvestorFlows(
            maskUncollectedShort(snapshot, readiness),
            scorecard
        ),
    };
};

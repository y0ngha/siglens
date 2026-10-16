import 'server-only';
import type { InvestorFlowsDataProvider } from '@y0ngha/siglens-core';
import { maskUncollectedSections } from '../lib/investorFlowsReadiness';
import { getInvestorFlowsPipelineReadiness } from './getInvestorFlowsPipelineReadiness';
import { getInvestorFlowsSnapshot } from './getInvestorFlowsSnapshot';

/**
 * AI 해석(`runInvestorFlowsAnalysis`)이 읽는 포트 — 페이지가 그리는 것과 **같은 캐시 스냅샷**을 돌려준다.
 *
 * 포트를 DB/FMP 구현(`getInvestorFlowsDataProvider`)에 직접 물리면 화면의 숫자와 AI가 해석한 숫자가
 * 최대 12시간 어긋날 수 있고, 같은 심볼의 AI 요청마다 DB와 FMP를 다시 때린다. 캐시를 거치면 둘이 같은
 * 스냅샷을 보고(`staticSymbolCache`, FINRA 플래그가 키에 들어 있다) 비용도 한 번이다. 인프라 장애는
 * 그대로 던진다 — core가 `fetch_failed`로 바꾼다.
 *
 * 첫 수집이 끝나기 전의 빈 구간(FINRA 공매도·FTD·Form 144·증자 공시)은 "조회 불가"로 바꿔 건넨다(`maskUncollectedSections`) —
 * 빈 배열은 core 프롬프트에서 "공매도 활동 없음"·"증자 공시 없음"처럼 읽힐 수 있다. 13F는 백필 중이면 행이 있어도 부분 집계라
 * 빈 기관 구간으로 바꾼다("기관 순매도"로 읽히지 않게). 화면 점수표(`getInvestorFlowsScorecard`)도
 * 같은 마스킹을 거쳐 둘이 같은 점수를 본다. 준비 상태를 못 읽으면(`unknown`) 스냅샷을 그대로 준다.
 */
export const investorFlowsCachedProvider: InvestorFlowsDataProvider = {
    getInvestorFlowsSnapshot: async symbol => {
        const [snapshot, readiness] = await Promise.all([
            getInvestorFlowsSnapshot(symbol),
            getInvestorFlowsPipelineReadiness(),
        ]);
        return snapshot === null
            ? null
            : maskUncollectedSections(snapshot, readiness);
    },
};

/** 종목별 무효화 그룹 태그 — 13F/FINRA 수집 직후 `revalidateTag(investorFlowsTag(sym), 'max')`로 쓴다. */
export const investorFlowsTag = (symbol: string): string =>
    `investor-flows:${symbol.toUpperCase()}`;

/**
 * 수집 파이프라인 준비 상태 캐시(`getInvestorFlowsPipelineReadiness`)의 태그. 종목과 무관한 전역 값이라 종목 태그와 따로
 * 둔다 — 13F 백필·FINRA 첫 수집이 끝난 cron이 이 태그를 무효화하면 "수집 중" 안내를 담은 모든 종목 페이지가 다음 요청에 갱신된다.
 */
export const INVESTOR_FLOWS_READINESS_TAG = 'investor-flows:pipeline-readiness';

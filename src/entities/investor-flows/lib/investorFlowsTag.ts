/** 종목별 무효화 그룹 태그 — 13F/FINRA 수집 직후 `revalidateTag(investorFlowsTag(sym), 'max')`로 쓴다. */
export const investorFlowsTag = (symbol: string): string =>
    `investor-flows:${symbol.toUpperCase()}`;

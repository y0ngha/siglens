import {
    portfolioCases,
    portfolioMaxCases,
    priceAlertCases,
    watchlistCases,
    watchlistMaxCases,
} from './cases/accountCases';
import { cachedAnalysisCases, freshAnalysisCases } from './cases/analysisCases';
import { barsCases } from './cases/barsCases';
import { showChartCases } from './cases/chartCases';
import { investorFlowsCases } from './cases/flowsCases';
import { fundamentalsCases } from './cases/fundamentalsCases';
import {
    indexHistoryCases,
    priceStatsCases,
    swingHistoryCases,
    themeSnapshotCases,
} from './cases/historyCases';
import { quoteCases, searchTickerCases } from './cases/lookupCases';
import {
    economyCases,
    marketOverviewCases,
    newsCases,
} from './cases/marketCases';
import { webSearchCases } from './cases/searchCases';
import {
    analystViewsCases,
    companyFilingsCases,
    congressCases,
    guideCases,
    macroQuotesCases,
    optionsCases,
    xPostsCases,
} from './cases/sourceCases';
import type { GoldenCase } from './goldenCase';

/** 모든 골든 사례. 도구마다 최소 3개(`toolGolden.test.ts`의 커버리지 메타 테스트). */
export const GOLDEN_CASES: readonly GoldenCase[] = [
    ...searchTickerCases,
    ...quoteCases,
    ...congressCases,
    ...xPostsCases,
    ...macroQuotesCases,
    ...companyFilingsCases,
    ...guideCases,
    ...analystViewsCases,
    ...optionsCases,
    ...indexHistoryCases,
    ...swingHistoryCases,
    ...priceStatsCases,
    ...themeSnapshotCases,
    ...portfolioCases,
    ...portfolioMaxCases,
    ...watchlistCases,
    ...watchlistMaxCases,
    ...priceAlertCases,
    ...marketOverviewCases,
    ...economyCases,
    ...newsCases,
    ...barsCases,
    ...cachedAnalysisCases,
    ...freshAnalysisCases,
    ...fundamentalsCases,
    ...investorFlowsCases,
    ...webSearchCases,
    ...showChartCases,
];

import type { AnalystTargetsSummary, AnalystViews } from '../model';

/** Yahoo 평균 목표가가 없으면(ETF·미커버 종목) 보여 줄 것이 없어 `null`. */
export function summarizeAnalystTargets(
    views: Pick<AnalystViews, 'targets'>
): AnalystTargetsSummary | null {
    const yahoo = views.targets.yahoo;
    if (yahoo === null || yahoo.mean === null) return null;
    return {
        yahooMean: yahoo.mean,
        yahooAnalysts: yahoo.analysts,
    };
}

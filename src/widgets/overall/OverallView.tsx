'use client';

/**
 * Pure presentational component for the "done" branch of OverallContent.
 * Renders the 9 result sections from an OverallAnalysisResponse.
 * Used by OverallContent and by the share/[id] kind panel registry.
 */

import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';
import { FinancialsSummary } from './sections/FinancialsSummary';
import { FundamentalSummary } from './sections/FundamentalSummary';
import { IntegratedConclusion } from './sections/IntegratedConclusion';
import { NewsSummary } from './sections/NewsSummary';
import { OptionsSummary } from './sections/OptionsSummary';
import { OverallSummary } from './sections/OverallSummary';
import { RiskFactors } from './sections/RiskFactors';
import { ScenarioAnalysis } from './sections/ScenarioAnalysis';
import { TechnicalSummary } from './sections/TechnicalSummary';

interface OverallViewProps {
    result: OverallAnalysisResponse;
    /**
     * Asset class controls which axes are rendered.
     * Defaults to 'equity' (shows options/fundamental/financials sections).
     */
    assetClass?: 'equity' | 'crypto';
}

export function OverallView({
    result,
    assetClass = 'equity',
}: OverallViewProps) {
    const r = result;
    const isEquity = assetClass === 'equity';
    const optionsOiStale = r.optionsOiStale ?? false;

    return (
        <div className="space-y-6">
            <OverallSummary headline={r.headlineKo} />
            <TechnicalSummary bullets={r.technicalBulletsKo} />
            {isEquity && (
                <>
                    <OptionsSummary
                        bullets={r.optionsBulletsKo}
                        oiStale={optionsOiStale}
                    />
                    <FundamentalSummary bullets={r.fundamentalBulletsKo} />
                    <FinancialsSummary bullets={r.financialsBulletsKo} />
                </>
            )}
            <NewsSummary bullets={r.newsBulletsKo} />
            <IntegratedConclusion text={r.integratedConclusionKo} />
            <ScenarioAnalysis scenarios={r.scenarios} />
            <RiskFactors factors={r.riskFactorsKo} />
        </div>
    );
}

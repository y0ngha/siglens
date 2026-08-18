'use client';

/**
 * Pure presentational component for the "done" branch of OverallContent.
 * Renders the 9 result sections from an OverallAnalysisResponse.
 * Used by OverallContent and by the share/[id] kind panel registry.
 */

import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';
import type { AssetClass } from '@/shared/config/marketProfile';
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
    assetClass?: AssetClass;
    /**
     * 옵션 탭이 실제로 존재하는지. `isEquity`(assetClass 이진 분류)만으로는
     * 한국 개별주식(assetClass는 'equity'지만 옵션 탭이 없음 —
     * `KR_EQUITY_DESCRIPTOR.tabs` 참고)을 걸러내지 못해, 결과가 없는 빈
     * "옵션 시장" 섹션 헤딩이 그대로 남는다(SEO 감사 2026-08-18).
     *
     * 이전엔 `true` 기본값이 있었다 — "marketProfile 정보가 없는 호출부"를
     * 위한 것이라는 전제였는데, 그 전제가 틀렸다: `OverallView`의 호출부는
     * 현재 딱 둘뿐이고(`OverallContent`, `kindPanelRegistry.tsx`의 `overall`
     * 엔트리) 둘 다 옵션 탭 존재 여부를 판정할 재료를 이미 갖고 있다
     * (`OverallContent`는 페이지가 넘긴 `getDescriptor(marketProfile).tabs`,
     * share 패널은 snapshot에서 threaded된 `symbol` → `isKrEquitySymbol`).
     * 그 기본값이 바로 이 버그가 감사 2라운드 연속 재발한 원인이었다 —
     * 새 호출부가 이 prop을 빠뜨려도 컴파일 에러 없이 조용히 "옵션 있음"으로
     * 흡수됐다. required로 바꿔 세 번째 조용한 재발을 컴파일 타임에 막는다.
     */
    hasOptions: boolean;
}

export function OverallView({
    result,
    assetClass = 'equity',
    hasOptions,
}: OverallViewProps) {
    const r = result;
    const isEquity = assetClass === 'equity';
    const optionsOiStale = r.optionsOiStale ?? false;

    return (
        <div className="space-y-6">
            <OverallSummary headline={r.headlineKo} />
            <TechnicalSummary bullets={r.technicalBulletsKo} />
            {isEquity && hasOptions && (
                <OptionsSummary
                    bullets={r.optionsBulletsKo}
                    oiStale={optionsOiStale}
                />
            )}
            {isEquity && (
                <>
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

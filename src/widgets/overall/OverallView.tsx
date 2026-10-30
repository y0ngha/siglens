'use client';

import { useTranslations } from 'next-intl';
import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';
import type { AssetClass } from '@/shared/config/marketProfile/types';
import { OptionsOiStaleBadge } from './ui/options/OptionsOiStaleBadge';
import { BulletSection } from './sections/BulletSection';
import { IntegratedConclusion } from './sections/IntegratedConclusion';
import { OverallSummary } from './sections/OverallSummary';
import { ScenarioAnalysis } from './sections/ScenarioAnalysis';
import { hasOptionsSection } from './utils/optionsSection';

interface OverallViewProps {
    result: OverallAnalysisResponse;
    /** 자산군. 기본 'equity'는 옵션·펀더멘털·재무·수급 섹션을 함께 그린다. */
    assetClass?: AssetClass;
    /**
     * 옵션 탭이 실제로 존재하는지. 자산군 이진 분류만으로는 옵션 탭이 없는 한국
     * 개별주식을 걸러내지 못해 결과 없는 빈 "옵션 시장" 섹션이 남는다. 호출부
     * (`OverallContent`, 공유 패널 레지스트리)가 모두 옵션 탭 유무를 판정할 재료를 갖고
     * 있으므로, 새 호출부가 빼먹어도 조용히 "옵션 있음"으로 흡수되지 않게 필수로 둔다.
     */
    hasOptions: boolean;
}

/**
 * 종합 분석 결과 섹션을 순서대로 그리는 표시 전용 컴포넌트. `OverallContent`의 done
 * 상태와 공유 페이지의 종류별 패널이 함께 쓴다. bullet이 빈 섹션은 섹션째 뺀다.
 */
export function OverallView({
    result,
    assetClass = 'equity',
    hasOptions,
}: OverallViewProps) {
    const t = useTranslations('widgets.overall');
    const r = result;
    const isEquity = assetClass === 'equity';

    return (
        <div className="space-y-6">
            <OverallSummary headline={r.headlineKo} />
            <BulletSection
                headingId="technical-summary-heading"
                title={t('TechnicalSummary.938737')}
                listLabel={t('TechnicalSummary.6d957a')}
                bullets={r.technicalBulletsKo}
            />
            {hasOptionsSection(assetClass, hasOptions) && (
                <BulletSection
                    headingId="overall-options-heading"
                    title={t('OptionsSummary.859330')}
                    listLabel={t('OptionsSummary.56f3e5')}
                    bullets={r.optionsBulletsKo}
                    badge={r.optionsOiStale ? <OptionsOiStaleBadge /> : null}
                />
            )}
            {isEquity && (
                <>
                    <BulletSection
                        headingId="fundamental-summary-heading"
                        title={t('FundamentalSummary.fd745f')}
                        listLabel={t('FundamentalSummary.c252e2')}
                        bullets={r.fundamentalBulletsKo}
                    />
                    <BulletSection
                        headingId="financials-summary-heading"
                        title={t('FinancialsSummary.9f2f34')}
                        listLabel={t('FinancialsSummary.ecbc52')}
                        bullets={r.financialsBulletsKo}
                    />
                    {/* 수급 요약은 선택 필드라 없거나 비면 BulletSection이 섹션째 뺀다. */}
                    <BulletSection
                        headingId="investor-flows-summary-heading"
                        title={t('InvestorFlowsSummary.title')}
                        listLabel={t('InvestorFlowsSummary.listLabel')}
                        bullets={r.investorFlowsBulletsKo ?? []}
                    />
                </>
            )}
            <BulletSection
                headingId="news-summary-heading"
                title={t('NewsSummary.218ec8')}
                listLabel={t('NewsSummary.2f750a')}
                bullets={r.newsBulletsKo}
            />
            <IntegratedConclusion text={r.integratedConclusionKo} />
            <ScenarioAnalysis scenarios={r.scenarios} />
            <BulletSection
                headingId="risk-factors-heading"
                title={t('RiskFactors.af0480')}
                listLabel={t('RiskFactors.b6fcf8')}
                bullets={r.riskFactorsKo}
            />
        </div>
    );
}

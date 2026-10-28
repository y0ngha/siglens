import { useTranslations } from 'next-intl';
import type { BacktestCase } from '@y0ngha/siglens-core';
import { EntryRecBadge } from './EntryRecBadge';
import { PriceLevels } from './PriceLevels';
import { RiskBadge } from './RiskBadge';
import { hasPriceLevels } from '../../utils/hasPriceLevels';

interface AiPredictionPanelProps {
    case_: BacktestCase;
}

/**
 * AI 예측 패널. 진입 권고 배지는 항상 그리고, 위험도 배지는 `riskLevel`이 있을 때만,
 * 가격 레벨 줄은 레벨이 하나라도 있을 때만 그린다.
 *
 * 면은 위 요약 밴드와 같은 `bg-secondary-700/40` 인셋이다. `bg-secondary-900/60`은 양 테마
 * 모두 카드와 1.02:1이라 패널로 읽히지 않는다.
 */
export function AiPredictionPanel({ case_: c }: AiPredictionPanelProps) {
    const t = useTranslations('widgets.backtesting');
    const { entryRecommendation, riskLevel } = c.aiAnalysis;

    return (
        <div className="mt-2 rounded bg-secondary-700/40 px-3 py-2 text-xs text-secondary-400">
            <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-semibold text-secondary-500">
                    {t('BacktestCaseCard.58b71d')}
                </span>
                <EntryRecBadge recommendation={entryRecommendation} />
                {riskLevel && <RiskBadge level={riskLevel} />}
            </div>
            {hasPriceLevels(c.aiAnalysis) && <PriceLevels case_={c} />}
        </div>
    );
}

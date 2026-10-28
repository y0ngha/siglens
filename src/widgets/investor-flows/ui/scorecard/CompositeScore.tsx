/**
 * 점수표 맨 위의 종합 점수 — 점수·방향 배지·산입 축 수, 점수가 없으면 부족 안내.
 */
import { useTranslations } from 'next-intl';
import type { InvestorFlowsComposite } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatSignedDecimal } from '../../utils/flowFormat';
import { LabelBadge } from './LabelBadge';

/** 종합 점수의 소수 자리. */
const COMPOSITE_SCORE_DIGITS = 1;

/** 종합 점수를 낼 수 없으면(`score === null`) 부족하다고만 말한다 — 0점으로 보이지 않게. */
export function CompositeScore({
    composite,
}: {
    readonly composite: InvestorFlowsComposite;
}) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    return (
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            {composite.score === null ? (
                <p className="text-sm text-secondary-300">
                    {t('scorecard.compositeInsufficient')}
                </p>
            ) : (
                <>
                    <p className="font-mono text-4xl font-semibold text-secondary-100 tabular-nums">
                        {formatSignedDecimal(
                            composite.score,
                            locale,
                            COMPOSITE_SCORE_DIGITS
                        )}
                    </p>
                    <div className="space-y-1">
                        <LabelBadge label={composite.label} />
                        <p className="text-xs text-secondary-400">
                            {t('scorecard.compositeCaption', {
                                count: composite.axesUsed.length,
                            })}
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

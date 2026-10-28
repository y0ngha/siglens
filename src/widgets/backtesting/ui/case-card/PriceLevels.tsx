import { useTranslations } from 'next-intl';
import type { BacktestCase } from '@y0ngha/siglens-core';
import { formatUsdCurrency } from '@/shared/lib/priceFormat';

interface PriceLevelsProps {
    case_: BacktestCase;
}

/**
 * AI가 제시한 가격 레벨(목표가·익절가·손절가)과 근거. 있는 줄만 그린다.
 *
 * `목표가:` 같은 한글 라벨이 한 줄에 섞여 있어 모노 서체를 걸 수 없다(Geist Mono에는
 * 한글 글리프가 없어 한 줄이 두 서체로 조판된다). 자릿수 정렬은 `tabular-nums`가 한다.
 */
export function PriceLevels({ case_: c }: PriceLevelsProps) {
    const t = useTranslations('widgets.backtesting');
    const firstBullishTarget = c.aiAnalysis.bullishTargets[0];
    const { takeProfit, stopLoss } = c.aiAnalysis;

    return (
        <>
            <div className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
                {firstBullishTarget && (
                    <div>
                        <span className="text-secondary-500">
                            {t('BacktestCaseCard.456225')}{' '}
                        </span>
                        <span className="text-ui-success-text">
                            {formatUsdCurrency(firstBullishTarget.price)}
                        </span>
                        {c.aiTrendHit && (
                            <span className="ml-1 text-ui-success-text">
                                {t('BacktestCaseCard.fa9de3')}
                            </span>
                        )}
                    </div>
                )}
                {takeProfit !== undefined && (
                    <div>
                        <span className="text-secondary-500">
                            {t('BacktestCaseCard.efb7c2')}{' '}
                        </span>
                        <span className="text-ui-success-text">
                            {formatUsdCurrency(takeProfit)}
                        </span>
                        {c.exitReason === 'take_profit' && (
                            <span className="ml-1 text-ui-success-text">✓</span>
                        )}
                    </div>
                )}
                {stopLoss !== undefined && (
                    <div>
                        <span className="text-secondary-500">
                            {t('BacktestCaseCard.315575')}{' '}
                        </span>
                        <span className="text-ui-danger-text">
                            {formatUsdCurrency(stopLoss)}
                        </span>
                        {c.exitReason === 'stop_loss' && (
                            <span className="ml-1 text-ui-danger-text">✓</span>
                        )}
                    </div>
                )}
            </div>

            {firstBullishTarget?.basis && (
                <p className="mt-1 text-xs text-secondary-500">
                    {t('BacktestCaseCard.75a556')} {firstBullishTarget.basis}
                </p>
            )}
        </>
    );
}

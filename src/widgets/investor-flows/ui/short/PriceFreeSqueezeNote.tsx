/**
 * 가격 입력이 없을 때의 숏스퀴즈 경고 — 잔고 비율·상환일수가 높다는 사실만 알린다.
 */
import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { ShortMetrics } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { FlowTooltip } from '../../investorFlowsTooltips';
import { formatDecimal, formatPercent } from '../../utils/flowFormat';

/** 값을 모르는 칸의 대시. */
const UNKNOWN = '–';
/** 유통주식 대비 잔고 %·상환일수의 소수 자리. */
const DIGITS = 1;

/** core의 가격 없는 판정(`metrics.squeezeRisk`)이 참일 때만 부모가 부른다. 점수가 있으면 점수 카드가 대신한다. */
export function PriceFreeSqueezeNote({
    metrics,
}: {
    readonly metrics: ShortMetrics;
}) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const squeezeId = useId();
    return (
        <div
            role="note"
            aria-labelledby={squeezeId}
            className="rounded-lg border border-ui-warning/40 bg-ui-warning/10 p-3"
        >
            <p
                id={squeezeId}
                className="text-sm font-medium text-ui-warning-text"
            >
                <span aria-hidden="true">⚠ </span>
                {t('short.squeezeBadge')}
                <FlowTooltip term="shortSqueeze" />
            </p>
            <p className="mt-1 text-xs text-secondary-300">
                {t('short.squeezeNote', {
                    pct:
                        metrics.shortInterestPctFloat === null
                            ? UNKNOWN
                            : formatPercent(
                                  metrics.shortInterestPctFloat,
                                  locale,
                                  DIGITS
                              ),
                    days:
                        metrics.daysToCover === null
                            ? UNKNOWN
                            : formatDecimal(
                                  metrics.daysToCover,
                                  locale,
                                  DIGITS
                              ),
                })}
            </p>
        </div>
    );
}

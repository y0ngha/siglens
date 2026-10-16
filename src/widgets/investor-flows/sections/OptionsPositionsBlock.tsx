import { useTranslations } from 'next-intl';
import type {
    InstitutionalMetrics,
    InstitutionalOptionsQuarter,
} from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import {
    formatDecimal,
    formatInteger,
    formatUsdCompact,
} from '../utils/flowFormat';
import { buildOptionsRows } from '../utils/options';

interface OptionsPositionsBlockProps {
    readonly quarters: readonly InstitutionalOptionsQuarter[];
    /** 점수표(core) 지표 — 풋/콜 명목 비율은 여기서만 읽는다(화면이 다시 나누지 않는다). */
    readonly metrics: InstitutionalMetrics;
}

/**
 * 13F 옵션 포지션(풋·콜 명목) — 분기마다 풋·콜을 보고한 기관 수와 기초자산 명목금액. 명목은 프리미엄이 아니고 헤지일 때가
 * 많다는 안내를 함께 둔다(core도 이 신호를 weak 상한으로 둔다). 보고된 분기가 없으면 아무것도 그리지 않는다.
 */
export function OptionsPositionsBlock({
    quarters,
    metrics,
}: OptionsPositionsBlockProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const rows = buildOptionsRows(quarters);
    if (rows.length === 0) return null;
    return (
        <div data-testid="flows-options">
            <h3 className={cn('mb-1', HEADING_SUBSECTION)}>
                {t('options.title')}
                <FlowTooltip term="optionsNotional" />
            </h3>
            <p className="mb-3 text-xs text-secondary-400">
                {t('options.caveat')}
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
                {rows.map(row => (
                    <li key={row.period} className={cn(SURFACE_NESTED, 'p-3')}>
                        <p className="text-xs text-secondary-300">
                            <span className="font-mono tabular-nums">
                                {row.period}
                            </span>
                            {!row.complete && (
                                <span className="ml-2 text-secondary-400">
                                    {t('flowChart.partial')}
                                </span>
                            )}
                        </p>
                        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                            <dt className="text-secondary-400">
                                {t('options.put')}
                            </dt>
                            <dd className="text-right text-secondary-200 tabular-nums">
                                {t('options.value', {
                                    amount: formatUsdCompact(
                                        row.putValueUsd,
                                        locale
                                    ),
                                    holders: formatInteger(
                                        row.putHolders,
                                        locale
                                    ),
                                })}
                            </dd>
                            <dt className="text-secondary-400">
                                {t('options.call')}
                            </dt>
                            <dd className="text-right text-secondary-200 tabular-nums">
                                {t('options.value', {
                                    amount: formatUsdCompact(
                                        row.callValueUsd,
                                        locale
                                    ),
                                    holders: formatInteger(
                                        row.callHolders,
                                        locale
                                    ),
                                })}
                            </dd>
                        </dl>
                    </li>
                ))}
            </ul>
            {metrics.optionsPeriod !== null &&
                metrics.putCallValueRatio !== null && (
                    <p className="mt-2 text-xs text-secondary-300 tabular-nums">
                        {metrics.priorPutCallValueRatio === null
                            ? t('options.ratio', {
                                  period: metrics.optionsPeriod,
                                  ratio: formatDecimal(
                                      metrics.putCallValueRatio,
                                      locale,
                                      2
                                  ),
                              })
                            : t('options.ratioWithPrior', {
                                  period: metrics.optionsPeriod,
                                  ratio: formatDecimal(
                                      metrics.putCallValueRatio,
                                      locale,
                                      2
                                  ),
                                  prior: formatDecimal(
                                      metrics.priorPutCallValueRatio,
                                      locale,
                                      2
                                  ),
                              })}
                    </p>
                )}
        </div>
    );
}

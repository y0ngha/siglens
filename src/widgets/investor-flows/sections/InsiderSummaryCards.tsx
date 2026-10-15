import { useTranslations } from 'next-intl';
import type { InsiderMetrics } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import { formatInteger, formatUsdCompact } from '../utils/flowFormat';
import { flowDirection, type FlowDirection } from '../utils/institutional';

function netClass(netValueUsd: number): string {
    if (netValueUsd > 0) return 'text-ui-success-text';
    if (netValueUsd < 0) return 'text-ui-danger-text';
    return 'text-secondary-100';
}

interface SideCardProps {
    readonly label: string;
    readonly count: number;
    readonly people: number;
    readonly valueUsd: number;
}

function SideCard({ label, count, people, valueUsd }: SideCardProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    return (
        <li className={cn(SURFACE_NESTED, 'p-3')}>
            <p className="text-xs text-secondary-300">{label}</p>
            <p className="mt-1 text-sm text-secondary-100 tabular-nums">
                {t('insider.summary', {
                    count: formatInteger(count, locale),
                    people: formatInteger(people, locale),
                    amount: formatUsdCompact(valueUsd, locale),
                })}
            </p>
        </li>
    );
}

interface InsiderSummaryCardsProps {
    readonly metrics: InsiderMetrics;
}

/** 90일 창의 순매수/순매도·매수·매도 요약 카드 3장과 클러스터 매수 배지(core `insider.metrics` 그대로). */
export function InsiderSummaryCards({ metrics }: InsiderSummaryCardsProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const net = metrics.netValueUsd;
    const amount = formatUsdCompact(Math.abs(net), locale);
    const netTexts: Record<FlowDirection, string> = {
        in: t('insider.netBuy', { amount }),
        out: t('insider.netSell', { amount }),
        flat: t('insider.netFlat'),
    };
    const netText = netTexts[flowDirection(net)];
    return (
        <div>
            <ul className="grid gap-2 sm:grid-cols-3">
                <li className={cn(SURFACE_NESTED, 'p-3')}>
                    <p className="text-xs text-secondary-300">
                        {t('insider.net')}
                    </p>
                    <p
                        className={cn(
                            'mt-1 text-lg font-semibold tabular-nums',
                            netClass(net)
                        )}
                    >
                        {netText}
                    </p>
                </li>
                <SideCard
                    label={t('insider.buys')}
                    count={metrics.buyCount}
                    people={metrics.buyerCount}
                    valueUsd={metrics.buyValueUsd}
                />
                <SideCard
                    label={t('insider.sells')}
                    count={metrics.sellCount}
                    people={metrics.sellerCount}
                    valueUsd={metrics.sellValueUsd}
                />
            </ul>
            {metrics.clusterBuy && (
                <p className="mt-3 inline-flex items-center gap-1 rounded bg-ui-success/10 px-2 py-1 text-xs font-medium text-ui-success-text">
                    <span aria-hidden="true">★</span>
                    {t('insider.clusterBadge', {
                        count: formatInteger(metrics.largestBuyCluster, locale),
                    })}
                    <FlowTooltip term="insiderCluster" />
                </p>
            )}
        </div>
    );
}

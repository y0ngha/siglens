/**
 * 진행 중(부분 집계) 분기 안내 — 아직 제출이 덜 모인 값임을 밝힌다.
 */
import { useTranslations } from 'next-intl';
import type { InstitutionalQuarter } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { FlowTooltip } from '../../investorFlowsTooltips';
import { formatInteger, formatSignedCompact } from '../../utils/flowFormat';
import { flowDirection, type FlowDirection } from '../../utils/institutional';

/** 진행 중 분기 안내 문단. */
export function PartialQuarterNote({
    quarter,
}: {
    readonly quarter: InstitutionalQuarter;
}) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const directionLabels: Record<FlowDirection, string> = {
        in: t('flowChart.in'),
        out: t('flowChart.out'),
        flat: t('flowChart.flat'),
    };
    return (
        <p
            className="rounded-lg bg-secondary-700/40 p-3 text-xs text-secondary-300"
            data-testid="flows-partial-quarter"
        >
            {t('institutional.partialNote', {
                period: quarter.period,
                holders: formatInteger(quarter.holders, locale),
                net: formatSignedCompact(quarter.netShareChange, locale),
                direction:
                    directionLabels[flowDirection(quarter.netShareChange)],
            })}
            <FlowTooltip term="partialAggregation" />
        </p>
    );
}

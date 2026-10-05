'use client';

import { useTranslations } from 'next-intl';
import type { OptionsExpirationMetrics } from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import type { OptionsExpirationSelector } from '@/shared/lib/types';
import {
    formatAtmIv,
    formatImpliedMove,
    formatMaxPain,
    formatPutCallRatio,
    METRIC_PLACEHOLDER,
} from '@/entities/options-chain/lib/optionsFormatters';
import {
    AtmIvTooltip,
    ImpliedMoveTooltip,
    MaxPainTooltip,
    PutCallRatioTooltip,
} from './utils/optionsTooltips';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { cn } from '@/shared/lib/cn';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatCapturedAtKst } from './utils/formatCapturedAtKst';

interface MetricCardProps {
    label: string;
    value: string;
    tooltip: React.ReactNode;
}

function MetricCard({ label, value, tooltip }: MetricCardProps) {
    return (
        <div className={cn(SURFACE_CARD, 'p-4')}>
            <div className="flex items-center">
                <span className="text-xs text-secondary-400">{label}</span>
                <InfoTooltip>{tooltip}</InfoTooltip>
            </div>
            <p className="mt-1 font-mono text-xl font-semibold text-secondary-100 tabular-nums">
                {value}
            </p>
        </div>
    );
}

interface OptionsMetricsRowProps {
    /** 'YYYY-MM-DD' or 'all'. */
    expirationDate: OptionsExpirationSelector;
    /** Pre-computed metrics from the parent (shared with chart/table). */
    metrics: OptionsExpirationMetrics | null;
    /** First-chain expiration date for the "종합 만기" caption. */
    nearestExpiry: string;
    /**
     * `true`이면 OI 스냅샷이 stale 상태(Yahoo 정규장 외 quote 클리어)로 판정되어
     * 카드의 모든 metric을 EM DASH로 표시한다. Max Pain·ATM IV·Imp. Move는
     * OI/IV에 직접 의존하므로 stale 데이터로 계산하면 사용자에게 잘못된 숫자
     * (예: $50, 0.0%)를 신뢰성 있게 보이도록 노출하게 된다.
     */
    oiStale: boolean;
    /**
     * 스냅샷 수집 시각(ISO). `showCapturedCaption`이 켜질 때만 읽는다.
     */
    capturedAt: string;
    /**
     * 미국 정규장이 닫혀 있는 동안 정상 데이터(OI가 채워진 것)를 보여 주는 중이면
     * `true` — "직전 정규장 기준"임을 중립적으로 밝히는 캡션을 켠다.
     *
     * 부모가 마운트 이후에만 켠다(`now`가 client-only). 서버·첫 클라이언트 렌더는
     * 항상 `false`라 하이드레이션 불일치가 없다.
     */
    showCapturedCaption: boolean;
}

export function OptionsMetricsRow({
    expirationDate,
    metrics,
    nearestExpiry,
    oiStale,
    capturedAt,
    showCapturedCaption,
}: OptionsMetricsRowProps) {
    const t = useTranslations('widgets.options');
    const locale = useResolvedLocale();
    const capturedAtKst = showCapturedCaption
        ? formatCapturedAtKst(capturedAt, locale)
        : null;
    // siglens-core R12: maxPain / putCallRatio are now `number | null`
    // (formatters tolerate the union explicitly), so pass through directly
    // without the legacy `?? NaN` coercion.
    const metricCards = [
        {
            label: t('OptionsMetricsRow.maxPain'),
            value: oiStale
                ? METRIC_PLACEHOLDER
                : formatMaxPain(metrics?.maxPain ?? null),
            tooltip: MaxPainTooltip,
        },
        {
            label: t('OptionsMetricsRow.putCallRatio'),
            value: oiStale
                ? METRIC_PLACEHOLDER
                : formatPutCallRatio(metrics?.putCallRatio ?? null),
            tooltip: PutCallRatioTooltip,
        },
        {
            label: t('OptionsMetricsRow.atmIv'),
            value: oiStale
                ? METRIC_PLACEHOLDER
                : formatAtmIv(metrics?.atmImpliedVolatility ?? null),
            tooltip: <AtmIvTooltip />,
        },
        {
            label: t('OptionsMetricsRow.impliedMove'),
            value: oiStale
                ? METRIC_PLACEHOLDER
                : formatImpliedMove(metrics?.impliedMovePercent ?? null),
            tooltip: <ImpliedMoveTooltip />,
        },
    ] as const;

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {metricCards.map(({ label, value, tooltip }) => (
                    <MetricCard
                        key={label}
                        label={label}
                        value={value}
                        tooltip={tooltip}
                    />
                ))}
            </div>
            {capturedAtKst !== null && (
                <p className="text-[10px] text-secondary-500">
                    {t('OptionsMetricsRow.previousSessionCaption', {
                        v0: capturedAtKst,
                    })}
                </p>
            )}
            {expirationDate === 'all' && nearestExpiry && (
                <p className="text-[10px] text-secondary-500">
                    {t('OptionsMetricsRow.6db40b', { v0: nearestExpiry })}
                </p>
            )}
        </div>
    );
}

'use client';

import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { EarningsReportComparisonItem } from '@/domain/types';
import type React from 'react';

const MATERIAL_SURPRISE_PCT = 2;

type SurpriseKind = 'surprise' | 'shock' | 'inline';

interface SurpriseBadge {
    kind: SurpriseKind;
    percent: number;
}

function formatShortDate(dateStr: string): string {
    return new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
    }).format(new Date(dateStr));
}

function formatCurrency(value: number | null): string {
    if (value === null) return '—';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
    }).format(value);
}

function formatRevenue(value: number | null): string {
    if (value === null) return '—';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}

interface EarningsReportComparisonProps {
    items: EarningsReportComparisonItem[];
}

function EarningsReportComparison({ items }: EarningsReportComparisonProps) {
    if (items.length === 0) return null;

    const maxEps = getMaxAbs(
        items.flatMap(item => [item.epsActual, item.epsEstimated])
    );
    const maxRevenue = getMaxAbs(
        items.flatMap(item => [item.revenueActual, item.revenueEstimated])
    );

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="text-secondary-400 flex gap-3 text-xs">
                    <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        실제
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-sky-400" />
                        컨센서스
                        <InfoTooltip className="ml-0 text-[11px]">
                            <p>
                                컨센서스는 여러 애널리스트가 예상한 EPS나 매출의
                                평균값이에요.
                            </p>
                            <p>
                                실제 발표값과 비교하면 시장 기대를 얼마나
                                웃돌거나 밑돌았는지 볼 수 있어요.
                            </p>
                        </InfoTooltip>
                    </span>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {items.map(item => (
                    <EarningsReportCard
                        key={`${item.symbol}-${item.earningsDate}`}
                        item={item}
                        maxEps={maxEps}
                        maxRevenue={maxRevenue}
                    />
                ))}
            </div>
        </div>
    );
}

interface EarningsReportCardProps {
    item: EarningsReportComparisonItem;
    maxEps: number;
    maxRevenue: number;
}

function EarningsReportCard({
    item,
    maxEps,
    maxRevenue,
}: EarningsReportCardProps) {
    const statusLabel = item.period === 'future' ? '예정' : '발표';
    const surpriseBadge = getSurpriseBadge(item);

    return (
        <article className="border-secondary-700 bg-secondary-800 rounded-lg border p-4">
            <div className="flex min-h-10 items-start justify-between gap-3">
                <div>
                    <p className="text-secondary-400 text-xs">{statusLabel}</p>
                    <time
                        dateTime={item.earningsDate}
                        className="font-semibold tabular-nums"
                    >
                        {formatShortDate(item.earningsDate)}
                    </time>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                    <span className="border-secondary-600 text-secondary-300 rounded-full border px-2 py-0.5 text-xs">
                        {item.period === 'future' ? '예정' : '과거'}
                    </span>
                    {surpriseBadge !== null ? (
                        <SurpriseBadge badge={surpriseBadge} />
                    ) : null}
                </div>
            </div>
            <div className="mt-4 space-y-4">
                <MetricBars
                    label="EPS"
                    actual={item.epsActual}
                    estimated={item.epsEstimated}
                    maxValue={maxEps}
                    format={formatCurrency}
                    signed
                />
                <MetricBars
                    label="매출"
                    actual={item.revenueActual}
                    estimated={item.revenueEstimated}
                    maxValue={maxRevenue}
                    format={formatRevenue}
                />
            </div>
        </article>
    );
}

interface SurpriseBadgeProps {
    badge: SurpriseBadge;
}

function SurpriseBadge({ badge }: SurpriseBadgeProps) {
    const className =
        badge.kind === 'surprise'
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            : badge.kind === 'shock'
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
              : 'border-secondary-500/40 bg-secondary-700/50 text-secondary-300';

    return (
        <span
            className={`rounded-full border px-2 py-0.5 text-xs tabular-nums ${className}`}
        >
            {getSurpriseLabel(badge.kind)} {formatSignedPercent(badge.percent)}
        </span>
    );
}

interface MetricBarsProps {
    label: string;
    actual: number | null;
    estimated: number | null;
    maxValue: number;
    format: (value: number | null) => string;
    signed?: boolean;
}

function MetricBars({
    label,
    actual,
    estimated,
    maxValue,
    format,
    signed = false,
}: MetricBarsProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-secondary-300 font-medium">{label}</span>
            </div>
            <div className="space-y-1.5">
                <MetricBar
                    label="실제"
                    value={actual}
                    maxValue={maxValue}
                    format={format}
                    className="bg-emerald-400"
                    signed={signed}
                />
                <MetricBar
                    label="컨센서스"
                    value={estimated}
                    maxValue={maxValue}
                    format={format}
                    className="bg-sky-400"
                    signed={signed}
                />
            </div>
        </div>
    );
}

interface MetricBarProps {
    label: string;
    value: number | null;
    maxValue: number;
    format: (value: number | null) => string;
    className: string;
    signed: boolean;
}

function MetricBar({
    label,
    value,
    maxValue,
    format,
    className,
    signed,
}: MetricBarProps) {
    const width = getBarWidth(value, maxValue, signed);
    const isNegative = value !== null && value < 0;
    const barClassName = isNegative ? 'bg-rose-400' : className;

    return (
        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center gap-2">
            <span className="text-secondary-500 text-xs">{label}</span>
            <div className="bg-secondary-900 relative h-2 rounded-full">
                {signed ? (
                    <span className="bg-secondary-600 absolute -top-0.5 -bottom-0.5 left-1/2 w-px" />
                ) : null}
                {value !== null ? (
                    <div
                        className={`absolute top-0 h-2 rounded-full ${barClassName}`}
                        style={getBarStyle(value, width, signed)}
                        aria-label={`${label}: ${format(value)}`}
                    />
                ) : null}
            </div>
            <span className="text-secondary-400 text-right text-xs tabular-nums">
                {format(value)}
            </span>
        </div>
    );
}

function getMaxAbs(values: (number | null)[]): number {
    return Math.max(
        0,
        ...values.flatMap(value => (value !== null ? [Math.abs(value)] : []))
    );
}

function getBarWidth(
    value: number | null,
    maxValue: number,
    signed: boolean
): number {
    if (value === null || maxValue === 0) return 0;
    const maxWidth = signed ? 50 : 100;
    return Math.max(
        6,
        Math.min(maxWidth, (Math.abs(value) / maxValue) * maxWidth)
    );
}

function getBarStyle(
    value: number,
    width: number,
    signed: boolean
): React.CSSProperties {
    if (!signed) return { left: 0, width: `${width}%` };
    if (value < 0) return { right: '50%', width: `${width}%` };
    return { left: '50%', width: `${width}%` };
}

function getSurpriseBadge(
    item: EarningsReportComparisonItem
): SurpriseBadge | null {
    if (item.period === 'future') return null;

    const surprisePercent =
        getSurprisePercent(item.epsActual, item.epsEstimated) ??
        getSurprisePercent(item.revenueActual, item.revenueEstimated);
    if (surprisePercent === null) return null;

    if (surprisePercent >= MATERIAL_SURPRISE_PCT) {
        return { kind: 'surprise', percent: surprisePercent };
    }
    if (surprisePercent <= -MATERIAL_SURPRISE_PCT) {
        return { kind: 'shock', percent: surprisePercent };
    }

    return { kind: 'inline', percent: surprisePercent };
}

function getSurpriseLabel(kind: SurpriseKind): string {
    const labels: Record<SurpriseKind, string> = {
        surprise: '서프라이즈',
        shock: '쇼크',
        inline: '예상치 부합',
    };
    return labels[kind];
}

function getSurprisePercent(
    actual: number | null,
    estimated: number | null
): number | null {
    if (actual === null || estimated === null || estimated === 0) return null;
    return ((actual - estimated) / Math.abs(estimated)) * 100;
}

function formatSignedPercent(value: number): string {
    const formatted = new Intl.NumberFormat('ko-KR', {
        signDisplay: 'always',
        maximumFractionDigits: 1,
    }).format(value);
    return `${formatted}%`;
}

interface EventCalendarProps {
    earningsReports: EarningsReportComparisonItem[];
}

export function EventCalendar({ earningsReports }: EventCalendarProps) {
    if (earningsReports.length === 0) {
        return null;
    }

    return (
        <section aria-labelledby="event-calendar-heading" className="space-y-3">
            <h2
                id="event-calendar-heading"
                className="text-lg font-semibold tracking-tight"
            >
                실적 발표
            </h2>
            <EarningsReportComparison items={earningsReports} />
        </section>
    );
}

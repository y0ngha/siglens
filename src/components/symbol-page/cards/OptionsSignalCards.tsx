'use client';

import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { useOptionsSignals } from '@/components/symbol-page/hooks/useOptionsSignals';
import {
    formatAtmIv,
    formatMaxPain,
    formatPutCallRatio,
} from '@/lib/options/optionsFormatters';
import {
    AtmIvTooltip,
    MaxPainTooltip,
    PutCallRatioTooltip,
} from '@/components/options/utils/optionsTooltips';

// ATM IV · Put/Call · Max Pain — the three chart-page chips this card row renders.
const SIGNAL_CARD_COUNT = 3;

interface OptionsSignalCardsProps {
    symbol: string;
}

/**
 * 차트 페이지 보조 카드 3종 (ATM IV · P/C Ratio · Max Pain).
 *
 * 옵션 시장이 없는 종목은 자리 차지 없이 null 반환 — 기존
 * FearGreedHeaderChip이 자체적으로 사라지는 패턴과 동일.
 *
 * 가장 가까운 만기의 데이터를 기준으로 한다. 만기 chip이나 종합/만기별 분기는
 * 별도 옵션 탭에서 다루므로 차트 페이지에서는 단순화된 단일 시점만 표시한다.
 */
export function OptionsSignalCards({ symbol }: OptionsSignalCardsProps) {
    const { data, isLoading } = useOptionsSignals(symbol);

    if (isLoading) return <OptionsSignalCardsSkeleton />;
    if (!data) return null;

    const SIGNAL_CARDS = [
        {
            label: 'ATM IV',
            value: formatAtmIv(data.atmIv),
            tooltip: AtmIvTooltip,
        },
        {
            label: 'Put/Call',
            value: formatPutCallRatio(data.putCallRatio),
            tooltip: PutCallRatioTooltip,
        },
        {
            label: 'Max Pain',
            value: formatMaxPain(data.maxPain),
            tooltip: MaxPainTooltip,
        },
    ] as const;

    return (
        <section
            aria-label={`${symbol} 옵션 보조 시그널`}
            className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
            {SIGNAL_CARDS.map(({ label, value, tooltip }) => (
                <SignalCard
                    key={label}
                    label={label}
                    value={value}
                    tooltip={tooltip}
                />
            ))}
        </section>
    );
}

interface SignalCardProps {
    label: string;
    value: string;
    tooltip: React.ReactNode;
}

function SignalCard({ label, value, tooltip }: SignalCardProps) {
    return (
        <div className="border-secondary-700 bg-secondary-800 rounded-xl border p-4">
            <div className="text-secondary-400 text-xs tracking-widest uppercase">
                {label}
                <InfoTooltip>{tooltip}</InfoTooltip>
            </div>
            <div className="text-secondary-100 mt-1 font-mono text-xl font-semibold tabular-nums">
                {value}
            </div>
        </div>
    );
}

function OptionsSignalCardsSkeleton() {
    return (
        <section
            className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
            aria-busy="true"
            aria-label="옵션 보조 시그널 불러오는 중"
        >
            {Array.from({ length: SIGNAL_CARD_COUNT }).map((_, i) => (
                <div
                    key={i}
                    className="border-secondary-700 bg-secondary-800 animate-pulse rounded-xl border p-4"
                >
                    <div className="bg-secondary-700 h-3 w-16 rounded" />
                    <div className="bg-secondary-700 mt-2 h-6 w-20 rounded" />
                </div>
            ))}
        </section>
    );
}

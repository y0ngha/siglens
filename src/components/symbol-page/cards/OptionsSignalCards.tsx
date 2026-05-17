'use client';

import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { useOptionsSignals } from '@/components/symbol-page/hooks/useOptionsSignals';
import {
    formatAtmIv,
    formatMaxPain,
    formatPutCallRatio,
} from '@/lib/options/optionsFormatters';
import { MaxPainTooltip } from '@/lib/options/optionsTooltips';

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

    const atmIvDisplay = formatAtmIv(data.atmIv);
    const pcDisplay = formatPutCallRatio(data.putCallRatio);
    const maxPainDisplay = formatMaxPain(data.maxPain);

    return (
        <section
            aria-label={`${symbol} 옵션 보조 시그널`}
            className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
            <SignalCard
                label="ATM IV"
                value={atmIvDisplay}
                tooltip={
                    <>
                        <p>
                            지금 옵션 시장이 보는 변동성이에요. 보통 20~30%가
                            평범한 편이고, 40% 넘으면 시장이 큰 움직임을
                            예상하고 있어요.
                        </p>
                        <p>어닝 발표 같은 큰 이벤트 직전에 보통 올라가요.</p>
                    </>
                }
            />
            <SignalCard
                label="Put/Call"
                value={pcDisplay}
                tooltip={
                    <>
                        <p>풋옵션 거래량을 콜옵션 거래량으로 나눈 값이에요.</p>
                        <p>
                            1보다 크면 풋(하락 베팅)이 더 많아 시장이
                            조심스럽다는 뜻이고, 1보다 작으면 콜(상승 베팅)이 더
                            많다는 뜻이에요.
                        </p>
                        <p>
                            너무 극단으로 치우치면 오히려 반대 신호로 해석하는
                            경우도 많아요.
                        </p>
                    </>
                }
            />
            <SignalCard
                label="Max Pain"
                value={maxPainDisplay}
                tooltip={MaxPainTooltip}
            />
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
            {[0, 1, 2].map(i => (
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

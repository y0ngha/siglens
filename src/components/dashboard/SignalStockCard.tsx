import type { ReactElement } from 'react';
import Link from 'next/link';
import { CARD_LINK_CLASSES } from '@/lib/cardStyles';
import { cn } from '@/lib/cn';
import { formatPriceChange, formatUsdPrice } from '@/lib/priceFormat';
import type { StockWithConflict } from '@/domain/types';
import { SignalBadge } from './SignalBadge';

interface SignalStockCardProps {
    data: StockWithConflict;
}

export function SignalStockCard({ data }: SignalStockCardProps): ReactElement {
    const { sign, colorClass, arrow, arrowLabel } = formatPriceChange(
        data.changePercent
    );

    return (
        <Link
            href={`/${data.symbol}`}
            title={`${data.koreanName} 분석`}
            className={cn(
                'border-secondary-700 bg-secondary-800/50 border p-3',
                CARD_LINK_CLASSES
            )}
        >
            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-1">
                    <span
                        translate="no"
                        className="text-secondary-100 font-mono text-xs font-semibold"
                    >
                        {data.symbol}
                    </span>
                    <span
                        className={cn(
                            'flex shrink-0 items-center gap-0.5 font-mono text-xs tabular-nums',
                            colorClass
                        )}
                    >
                        <span aria-hidden="true">{arrow}</span>
                        <span className="sr-only">{arrowLabel}</span>
                        {sign}
                        {data.changePercent.toFixed(2)}%
                    </span>
                </div>
                <p className="text-secondary-400 min-w-0 truncate text-xs">
                    {data.koreanName}
                </p>
                <p className="text-secondary-100 font-mono text-sm tabular-nums">
                    ${formatUsdPrice(data.price)}
                </p>
                {data.signals.length > 0 && (
                    <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 pt-1">
                        {data.signals.map((s, i) => (
                            <span key={`${s.type}-${i}`} className="contents">
                                {i > 0 && (
                                    <span
                                        className="text-secondary-600"
                                        aria-hidden="true"
                                    >
                                        ·
                                    </span>
                                )}
                                <SignalBadge type={s.type} />
                            </span>
                        ))}
                    </div>
                )}
                {data.conflict && (
                    <p className="text-secondary-500 mt-1 text-xs">
                        상승 {data.conflict.bullishCount}건 / 하락{' '}
                        {data.conflict.bearishCount}건 감지
                    </p>
                )}
            </div>
        </Link>
    );
}

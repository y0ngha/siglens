import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { StockSignalResult } from '@/domain/signals/types';
import { SignalBadge } from './SignalBadge';

interface SignalStockCardProps {
    data: StockSignalResult;
}

export function SignalStockCard({ data }: SignalStockCardProps) {
    const isUp = data.changePercent >= 0;
    const sign = isUp ? '+' : '';
    const changeColor = isUp ? 'text-chart-bullish' : 'text-chart-bearish';

    return (
        <Link
            href={`/${data.symbol}`}
            title={`${data.koreanName} 분석`}
            className={cn(
                'touch-manipulation block border border-secondary-700 bg-secondary-800/50',
                'rounded-lg p-3',
                'transition-[background-color,border-color,transform,box-shadow] duration-150',
                'hover:bg-secondary-800/70 hover:border-secondary-600 hover:-translate-y-px',
                'hover:shadow-lg hover:shadow-primary-950/40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                'motion-reduce:transition-none motion-reduce:hover:transform-none'
            )}
            style={{ transformOrigin: 'center' }}
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
                            changeColor
                        )}
                    >
                        <span aria-hidden="true">{isUp ? '▲' : '▼'}</span>
                        <span className="sr-only">{isUp ? '상승' : '하락'}</span>
                        {sign}
                        {data.changePercent.toFixed(2)}%
                    </span>
                </div>
                <p className="text-secondary-400 min-w-0 truncate text-xs">
                    {data.koreanName}
                </p>
                <p className="text-secondary-100 font-mono text-sm tabular-nums">
                    ${data.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </p>
                {data.signals.length > 0 && (
                    <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 pt-1">
                        {data.signals.map((s, i) => (
                            <span key={`${s.type}-${i}`} className="contents">
                                {i > 0 && <span className="text-secondary-600" aria-hidden="true">·</span>}
                                <SignalBadge type={s.type} />
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </Link>
    );
}

import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { MarketIndexData, MarketSectorData } from '@/domain/types';

type IndexCardData = MarketIndexData | MarketSectorData;

function getLabel(data: IndexCardData): string {
    return 'displayName' in data ? data.displayName : data.sectorName;
}

interface IndexCardProps {
    data: IndexCardData;
    href?: string;
}

export function IndexCard({ data, href }: IndexCardProps) {
    const isUp = data.changesPercentage >= 0;
    const sign = isUp ? '+' : '';
    const changeColor = isUp ? 'text-chart-bullish' : 'text-chart-bearish';
    const label = getLabel(data);

    const inner = (
        <div className="bg-secondary-800/50 border-secondary-700 flex flex-col gap-1 rounded-lg border p-3">
            {/* 티커 — 단독 행으로 overflow 방지 */}
            <span
                translate="no"
                className="text-secondary-100 font-mono text-xs font-semibold"
            >
                {data.symbol}
            </span>
            {/* 한국어 이름 + 변동폭 */}
            <div className="flex items-center justify-between gap-1">
                <p className="text-secondary-400 min-w-0 truncate text-xs">
                    {data.koreanName}
                </p>
                <span
                    className={cn(
                        'flex shrink-0 items-center gap-0.5 font-mono text-xs tabular-nums',
                        changeColor
                    )}
                >
                    <span aria-hidden="true">{isUp ? '▲' : '▼'}</span>
                    <span className="sr-only">{isUp ? '상승' : '하락'}</span>
                    {sign}
                    {data.changesPercentage.toFixed(2)}%
                </span>
            </div>
            {/* 가격 */}
            <p className="text-secondary-100 font-mono text-sm tabular-nums">
                $
                {data.price.toLocaleString('en-US', {
                    maximumFractionDigits: 2,
                })}
            </p>
        </div>
    );

    if (href) {
        return (
            <Link
                href={href}
                title={`${label} 분석`}
                style={{ transformOrigin: 'center' }}
                className={cn(
                    'block touch-manipulation rounded-lg',
                    'transition-[background-color,border-color,transform,box-shadow] duration-150',
                    'hover:bg-secondary-800/70 hover:border-secondary-600 hover:-translate-y-px',
                    'hover:shadow-primary-950/40 hover:shadow-lg',
                    'focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:outline-none',
                    'motion-reduce:transition-none motion-reduce:hover:transform-none'
                )}
            >
                {inner}
            </Link>
        );
    }

    return inner;
}

import Link from 'next/link';
import { CARD_LINK_CLASSES } from '@/lib/cardStyles';
import { cn } from '@/lib/cn';
import { formatPriceChange, formatUsdPrice } from '@/lib/priceFormat';
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
    const { sign, colorClass, arrow, arrowLabel } = formatPriceChange(
        data.changesPercentage
    );
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
                        colorClass
                    )}
                >
                    <span aria-hidden="true">{arrow}</span>
                    <span className="sr-only">{arrowLabel}</span>
                    {sign}
                    {data.changesPercentage.toFixed(2)}%
                </span>
            </div>
            {/* 가격 */}
            <p className="text-secondary-100 font-mono text-sm tabular-nums">
                ${formatUsdPrice(data.price)}
            </p>
        </div>
    );

    if (href) {
        return (
            <Link
                href={href}
                title={`${label} 분석`}
                className={CARD_LINK_CLASSES}
            >
                {inner}
            </Link>
        );
    }

    return inner;
}

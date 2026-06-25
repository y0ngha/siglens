import Link from 'next/link';
import { CARD_LINK_CLASSES } from '@/shared/lib/cardStyles';
import type { MarketIndexData, MarketSectorData } from '@y0ngha/siglens-core';
import { QuoteHeader } from './QuoteHeader';

type IndexCardData = MarketIndexData | MarketSectorData;

function getLabel(data: IndexCardData): string {
    return 'displayName' in data ? data.displayName : data.sectorName;
}

interface IndexCardProps {
    data: IndexCardData;
    href?: string;
}

export function IndexCard({ data, href }: IndexCardProps) {
    const label = getLabel(data);

    const inner = (
        <div className="bg-secondary-800/50 border-secondary-700 flex flex-col gap-1 rounded-lg border p-3">
            <QuoteHeader
                data={{
                    symbol: data.symbol,
                    koreanName: data.koreanName,
                    price: data.price,
                    changePercent: data.changesPercentage,
                }}
            />
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

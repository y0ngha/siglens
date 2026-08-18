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
    /** 가격 앞에 붙일 통화 기호. 시장마다 다르다(`DashboardScope.currencySymbol`). */
    currencySymbol: string;
}

export function IndexCard({ data, href, currencySymbol }: IndexCardProps) {
    const label = getLabel(data);

    const inner = (
        <div className="flex flex-col gap-1 rounded-lg border border-secondary-700 bg-secondary-800/50 p-3">
            <QuoteHeader
                data={{
                    symbol: data.symbol,
                    koreanName: data.koreanName,
                    price: data.price,
                    changePercent: data.changesPercentage,
                }}
                currencySymbol={currencySymbol}
            />
        </div>
    );

    if (href) {
        return (
            <Link
                href={href}
                title={`${label} 분석`}
                // 카드 그리드로 다수 렌더 — docs/architecture/CDN_CACHING.md §1
                prefetch={false}
                className={CARD_LINK_CLASSES}
            >
                {inner}
            </Link>
        );
    }

    return inner;
}

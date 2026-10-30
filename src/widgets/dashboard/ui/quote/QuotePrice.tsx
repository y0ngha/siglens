/**
 * 시세 카드의 가격 줄.
 */
import { formatUsdPrice } from '@/shared/lib/priceFormat';

interface QuotePriceProps {
    price: number;
    /** 가격 앞에 붙일 통화 기호. 시장마다 다르다. */
    currencySymbol: string;
}

/** 통화 기호 + 포맷된 가격. */
export function QuotePrice({ price, currencySymbol }: QuotePriceProps) {
    return (
        <p className="font-mono text-sm text-secondary-100 tabular-nums">
            {currencySymbol}
            {formatUsdPrice(price)}
        </p>
    );
}

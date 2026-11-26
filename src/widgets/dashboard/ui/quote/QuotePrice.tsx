/**
 * 시세 카드의 가격 줄.
 */
import { useTranslations } from 'next-intl';
import { formatUsdPrice } from '@/shared/lib/priceFormat';

interface QuotePriceProps {
    price: number;
    /** 가격 앞에 붙일 통화 기호. 시장마다 다르다. */
    currencySymbol: string;
}

/**
 * 통화 기호 + 포맷된 가격. 가격 0은 실제 시세가 아니라 조회 실패의 신호라(`hasMissingQuotes`)
 * `₩0`처럼 그리지 않고 `-`를 보인다.
 */
export function QuotePrice({ price, currencySymbol }: QuotePriceProps) {
    const t = useTranslations('widgets.dashboard');
    if (price === 0) {
        return (
            <p className="font-mono text-sm text-secondary-100 tabular-nums">
                <span aria-hidden="true">-</span>
                <span className="sr-only">{t('QuotePrice.unavailable')}</span>
            </p>
        );
    }
    return (
        <p className="font-mono text-sm text-secondary-100 tabular-nums">
            {currencySymbol}
            {formatUsdPrice(price)}
        </p>
    );
}

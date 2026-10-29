'use client';

import { useTranslations } from 'next-intl';
import { useWatchlistQuote } from '@/features/watchlist/hooks/useWatchlistQuote';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import {
    formatCurrencyForSymbol,
    formatSignedPercent,
    signColorClass,
} from '@/shared/lib/priceFormat';
import { PLACEHOLDER_ON_INSET } from '@/shared/lib/surfaceStyles';

interface RowQuoteProps {
    symbol: string;
    /** false면 시세를 요청하지 않고 자리표시자를 그린다(행이 아직 뷰포트 밖). */
    enabled: boolean;
}

/**
 * 관심 행의 현재가·등락률 한 줄. 자리표시자·"시세 없음"·시세의 세 상태가 같은 높이를 쓰도록
 * 부모가 고정 높이 줄(`h-5`)에 담는다.
 */
export function RowQuote({ symbol, enabled }: RowQuoteProps) {
    const t = useTranslations('features.watchlist');
    const locale = useResolvedLocale();
    const { quote, isSettled } = useWatchlistQuote(symbol, enabled);
    if (!isSettled) {
        return (
            <span
                aria-hidden="true"
                className={cn(
                    'inline-block h-4 w-24 animate-pulse rounded',
                    PLACEHOLDER_ON_INSET
                )}
            />
        );
    }
    if (quote === null) {
        return (
            <span className="text-xs text-secondary-400">
                {t('section.quoteUnavailable')}
            </span>
        );
    }
    return (
        <dl className="flex items-baseline gap-3 text-sm tabular-nums">
            <div className="flex items-baseline gap-1">
                <dt className="sr-only">{t('section.price')}</dt>
                <dd className="text-secondary-100">
                    {formatCurrencyForSymbol(quote.price, symbol, locale)}
                </dd>
            </div>
            {quote.changePct !== null && (
                <div className="flex items-baseline gap-1">
                    <dt className="sr-only">{t('section.change')}</dt>
                    <dd className={signColorClass(quote.changePct)}>
                        {formatSignedPercent(quote.changePct)}
                    </dd>
                </div>
            )}
        </dl>
    );
}

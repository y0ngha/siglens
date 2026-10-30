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
 * 시세 줄의 고정 높이. 자리표시자(`h-4`)·"시세 없음"(`text-xs`)·시세(`text-sm`)는 제 높이가
 * 서로 달라서, 시세가 도착할 때 행 높이가 흔들리지 않도록 세 상태를 모두 이 한 줄에 담는다.
 */
const QUOTE_LINE = 'mt-1 flex h-5 items-center';

/** 관심 행의 현재가·등락률 한 줄. 세 상태 모두 같은 고정 높이 줄(`QUOTE_LINE`)에 그린다. */
export function RowQuote({ symbol, enabled }: RowQuoteProps) {
    return (
        <div className={QUOTE_LINE}>
            <RowQuoteContent symbol={symbol} enabled={enabled} />
        </div>
    );
}

function RowQuoteContent({ symbol, enabled }: RowQuoteProps) {
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

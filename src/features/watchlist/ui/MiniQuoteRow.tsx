'use client';

import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import {
    formatCurrencyForSymbol,
    formatSignedPercent,
    signColorClass,
} from '@/shared/lib/priceFormat';
import { PLACEHOLDER_ON_CARD } from '@/shared/lib/surfaceStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import type { WatchlistPreviewItem } from '../hooks/useWatchlistPreview';
import { useWatchlistQuote } from '../hooks/useWatchlistQuote';
import { Sparkline } from './Sparkline';

interface MiniQuoteProps {
    symbol: string;
    /** false면 시세를 요청하지 않고 자리표시자를 그린다(팝오버가 닫혀 있는 동안 등). */
    enabled: boolean;
    align?: 'end' | 'start';
}

/** 가격 + 등락률 두 줄. 행과 홈 카드가 함께 쓴다. */
export function MiniQuote({ symbol, enabled, align = 'end' }: MiniQuoteProps) {
    const t = useTranslations('features.watchlist');
    const locale = useResolvedLocale();
    const { quote, isSettled } = useWatchlistQuote(symbol, enabled);
    const alignClass = align === 'end' ? 'items-end text-right' : 'items-start';

    if (!isSettled) {
        return (
            <span
                aria-hidden="true"
                className={cn('flex flex-col gap-1.5', alignClass)}
            >
                <span
                    className={cn(
                        'h-4 w-16 animate-pulse rounded',
                        PLACEHOLDER_ON_CARD
                    )}
                />
                <span
                    className={cn(
                        'h-3 w-10 animate-pulse rounded',
                        PLACEHOLDER_ON_CARD
                    )}
                />
            </span>
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
        <span className={cn('flex flex-col tabular-nums', alignClass)}>
            <span className="text-sm font-semibold text-secondary-50">
                {formatCurrencyForSymbol(quote.price, symbol, locale)}
            </span>
            {quote.changePct !== null && (
                <span
                    className={cn(
                        'text-xs font-medium',
                        signColorClass(quote.changePct)
                    )}
                >
                    {formatSignedPercent(quote.changePct)}
                </span>
            )}
        </span>
    );
}

interface MiniTrendProps {
    symbol: string;
    enabled: boolean;
    className?: string;
}

/** 미니 차트. 시세와 같은 쿼리 키라 추가 요청이 없다. */
export function MiniTrend({ symbol, enabled, className }: MiniTrendProps) {
    const { quote } = useWatchlistQuote(symbol, enabled);
    if (quote === null)
        return (
            <span
                aria-hidden="true"
                className={cn('h-6 w-16 shrink-0', className)}
            />
        );
    return (
        <Sparkline
            values={quote.trend}
            className={cn(signColorClass(quote.changePct ?? 0), className)}
        />
    );
}

interface MiniQuoteRowProps {
    item: WatchlistPreviewItem;
    quotesEnabled: boolean;
    onNavigate?: () => void;
}

/** 헤더 팝오버·모바일 시트·홈 모바일 카드의 한 행. 행 전체가 종목 페이지 링크다. */
export function MiniQuoteRow({
    item,
    quotesEnabled,
    onNavigate,
}: MiniQuoteRowProps) {
    return (
        <li>
            <Link
                href={`/${item.symbol}`}
                prefetch={false}
                onClick={onNavigate}
                className="flex min-h-14 touch-manipulation items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-secondary-700/40 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-secondary-50">
                        {item.name}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-secondary-400">
                        {item.symbol}
                    </span>
                </span>
                <MiniTrend symbol={item.symbol} enabled={quotesEnabled} />
                <span className="w-24 shrink-0">
                    <MiniQuote symbol={item.symbol} enabled={quotesEnabled} />
                </span>
            </Link>
        </li>
    );
}

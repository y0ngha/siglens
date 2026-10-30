'use client';

/**
 * 추세선 한 줄 — 방향 라벨·색 점과 시작→끝 가격.
 */
import { useTranslations } from 'next-intl';
import type {
    KrxTickTable,
    Trendline,
    TrendlineDirection,
} from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatAnalysisPrice } from '@/shared/lib/analysisPriceFormat';
import { cn } from '@/shared/lib/cn';
import { TRENDLINE_DIRECTION_LABEL_KEY } from '@/shared/lib/trendline';

const TRENDLINE_COLOR: Record<TrendlineDirection, string> = {
    ascending: 'text-ui-success-text',
    descending: 'text-ui-danger-text',
};

const TRENDLINE_BG_COLOR: Record<TrendlineDirection, string> = {
    ascending: 'bg-chart-bullish',
    descending: 'bg-chart-bearish',
};

// 방향 enum이 미래에 확장돼 ascending|descending 밖의 값이 들어오면 Record
// 조회는 undefined를 돌려준다. 라벨/색상에 fallback을 둬 undefined-class
// 크래시 없이 중립 표시로 degrade한다.
const TRENDLINE_FALLBACK_COLOR = 'text-secondary-400';
const TRENDLINE_FALLBACK_BG = 'bg-secondary-500';

interface TrendlineItemProps {
    trendline: Trendline;
    symbol: string;
    krxTickTable: KrxTickTable;
}

export function TrendlineItem({
    trendline,
    symbol,
    krxTickTable,
}: TrendlineItemProps) {
    const tTrendline = useTranslations('shared.lib.trendline');
    const locale = useResolvedLocale();
    const label = tTrendline(
        TRENDLINE_DIRECTION_LABEL_KEY[trendline.direction] ?? 'fallback'
    );
    const colorClass =
        TRENDLINE_COLOR[trendline.direction] ?? TRENDLINE_FALLBACK_COLOR;
    const bgClass =
        TRENDLINE_BG_COLOR[trendline.direction] ?? TRENDLINE_FALLBACK_BG;

    return (
        <div className="flex items-center gap-2 rounded bg-secondary-700/40 px-3 py-2">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', bgClass)} />
            <span className={cn('text-xs font-medium', colorClass)}>
                {label}
            </span>
            <span className="ml-auto text-xs text-secondary-500 tabular-nums">
                {formatAnalysisPrice(trendline.start.price, symbol, locale, {
                    trimTrailingZeros: true,
                    krxTickTable,
                })}
                {' → '}
                {formatAnalysisPrice(trendline.end.price, symbol, locale, {
                    trimTrailingZeros: true,
                    krxTickTable,
                })}
            </span>
        </div>
    );
}

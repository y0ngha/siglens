import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import type { WatchlistPreviewItem } from '../../hooks/useWatchlistPreview';
import { MiniQuote, MiniTrend } from '../MiniQuoteRow';

interface HomeWatchlistDesktopCardProps {
    /** 카드가 링크하는 종목. 시세는 카드가 그려질 때(PC 격자에 보일 때) 바로 읽는다. */
    item: WatchlistPreviewItem;
}

/** 홈 카드 PC 격자의 종목 한 칸 — 이름·심볼·미니 차트·시세. 칸 전체가 종목 페이지 링크다. */
export function HomeWatchlistDesktopCard({
    item,
}: HomeWatchlistDesktopCardProps) {
    return (
        <li>
            <Link
                href={`/${item.symbol}`}
                prefetch={false}
                className="flex h-full flex-col rounded-lg border border-border-control bg-secondary-900 p-3.5 transition-colors hover:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                <span className="truncate text-sm font-semibold text-secondary-50">
                    {item.name}
                </span>
                <span className="mt-0.5 font-mono text-xs text-secondary-400">
                    {item.symbol}
                </span>
                <MiniTrend
                    symbol={item.symbol}
                    enabled
                    className="mt-3 h-9 w-full"
                />
                <span className="mt-3">
                    <MiniQuote symbol={item.symbol} enabled align="start" />
                </span>
            </Link>
        </li>
    );
}

import type { ReactElement } from 'react';
import type { SignalEpisodeRow } from '@/entities/signal-history/types';
import type { Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { formatSignedPercent, signColorClass } from '@/shared/lib/priceFormat';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { signalHubRowLabel } from '../_lib/signalHubRowLabel';

interface SignalHubRowItemProps {
    readonly row: SignalEpisodeRow;
    readonly locale: Locale;
    /** 마지막 포착 세션이 첫 포착과 다를 때만 넘긴다("…까지 이어짐" 문구, 호출자가 번역한다). */
    readonly lastSeenLabel: string | null;
}

/** 신호 페이지 목록의 종목 한 줄 — 종목 페이지 링크, 신호가 이어진 날, 첫 포착 세션 등락률. */
export function SignalHubRowItem({
    row,
    locale,
    lastSeenLabel,
}: SignalHubRowItemProps): ReactElement {
    return (
        <li className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
                <Link
                    href={`/${row.symbol}`}
                    prefetch={false}
                    className="block truncate text-sm font-medium text-secondary-100 underline-offset-4 hover:text-primary-400 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {signalHubRowLabel(row, locale)}
                </Link>
                {lastSeenLabel !== null && (
                    <p className="mt-0.5 text-xs text-secondary-400">
                        {lastSeenLabel}
                    </p>
                )}
            </div>
            <span
                className={cn(
                    'shrink-0 font-mono text-xs',
                    signColorClass(row.changePercent)
                )}
            >
                {formatSignedPercent(row.changePercent)}
            </span>
        </li>
    );
}

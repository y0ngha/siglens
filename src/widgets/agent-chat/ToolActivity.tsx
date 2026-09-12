'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { ToolActivityItem } from '@/features/agent-chat';
import { cn } from '@/shared/lib/cn';

const ICON: Record<string, string> = {
    search_ticker: '🔎',
    get_quote: '💹',
    get_bars_indicators: '📊',
    get_cached_analysis: '🧠',
    get_news: '📰',
    get_options_summary: '🎯',
    get_my_portfolio: '💼',
    run_fresh_analysis: '⚙️',
    web_search: '🌐',
};

function label(t: ToolActivityItem): string {
    const symbol =
        typeof t.args.symbol === 'string'
            ? t.args.symbol
            : Array.isArray(t.args.symbols)
              ? (t.args.symbols as string[]).join(',')
              : '';
    return [
        t.name,
        symbol,
        typeof t.args.timeframe === 'string' ? t.args.timeframe : '',
    ]
        .filter(Boolean)
        .join(' ');
}

export function ToolActivity({
    tools,
}: {
    readonly tools: ToolActivityItem[];
}) {
    const t = useTranslations('widgets.agent-chat');
    const [open, setOpen] = useState<string | null>(null);
    if (tools.length === 0) return null;
    return (
        <ul
            className="mb-2 flex flex-wrap gap-1.5"
            aria-label={t('ToolActivity.b4c619')}
        >
            {tools.map(item => (
                <li key={item.id}>
                    <button
                        type="button"
                        onClick={() =>
                            setOpen(open === item.id ? null : item.id)
                        }
                        aria-expanded={open === item.id}
                        className={cn(
                            'rounded-full border border-control px-2 py-0.5 text-xs text-secondary-300 focus-visible:ring-2 focus-visible:ring-primary-500',
                            item.status === 'error' && 'text-ui-danger-text',
                            item.status === 'running' && 'animate-pulse'
                        )}
                    >
                        {ICON[item.name] ?? '🔧'} {label(item)}
                        {item.ms !== undefined
                            ? ` · ${(item.ms / 1000).toFixed(1)}s`
                            : ''}
                        {item.status === 'running' && item.estimatedSeconds
                            ? ` · ${t('ToolActivity.aboutSeconds', { n: item.estimatedSeconds })}`
                            : ''}
                    </button>
                    {open === item.id && item.summary ? (
                        <pre className="mt-1 max-w-full overflow-x-auto rounded bg-secondary-800 p-2 font-mono text-[10px] text-secondary-300">
                            {item.summary}
                        </pre>
                    ) : null}
                </li>
            ))}
        </ul>
    );
}

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

function formatSeconds(ms: number): string {
    return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * The tool calls behind one answer, folded into a single summary line the way
 * chat products show "thought for 3s" — the transcript stays readable, the
 * receipts (args, timing, result preview) are one click away.
 *
 * The summary keeps every tool NAME visible even while collapsed: the name is
 * the only cue a reader has for where a number came from, and the E2E suite
 * counts on it (`getByText(/get_quote/)` must resolve to exactly one node).
 */
export function ToolActivity({
    tools,
}: {
    readonly tools: ToolActivityItem[];
}) {
    const t = useTranslations('widgets.agent-chat');
    const [open, setOpen] = useState(false);
    const [detail, setDetail] = useState<string | null>(null);
    if (tools.length === 0) return null;
    const running = tools.find(item => item.status === 'running');
    const failed = tools.some(item => item.status === 'error');
    const totalMs = tools.reduce((sum, item) => sum + (item.ms ?? 0), 0);
    const names = [...new Set(tools.map(item => item.name))].join(', ');
    const summary = running
        ? `${t('ToolActivity.running')} · ${label(running)}${
              running.estimatedSeconds
                  ? ` · ${t('ToolActivity.aboutSeconds', { n: running.estimatedSeconds })}`
                  : ''
          }`
        : `${t('ToolActivity.summary', { n: tools.length })} · ${names}${
              totalMs > 0 ? ` · ${formatSeconds(totalMs)}` : ''
          }`;
    return (
        <div className="mb-3">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                className={cn(
                    'inline-flex min-h-8 max-w-full items-center gap-2 rounded px-1.5 py-1 text-xs text-secondary-400 hover:bg-secondary-800 hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                    failed && 'text-ui-danger-text'
                )}
            >
                <span
                    aria-hidden="true"
                    className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        running
                            ? 'bg-primary-400 motion-safe:animate-pulse'
                            : failed
                              ? 'bg-ui-danger'
                              : 'bg-ui-success'
                    )}
                />
                <span className="truncate">{summary}</span>
                <span
                    aria-hidden="true"
                    className={cn(
                        'shrink-0 transition-transform motion-reduce:transition-none',
                        open && 'rotate-180'
                    )}
                >
                    ▾
                </span>
            </button>
            {open ? (
                <ul
                    className="mt-1.5 flex flex-wrap gap-1.5"
                    aria-label={t('ToolActivity.b4c619')}
                >
                    {tools.map(item => (
                        <li key={item.id} className="max-w-full">
                            <button
                                type="button"
                                onClick={() =>
                                    setDetail(
                                        detail === item.id ? null : item.id
                                    )
                                }
                                aria-expanded={detail === item.id}
                                className={cn(
                                    'inline-flex min-h-8 max-w-full items-center gap-1 rounded-full border border-border-control px-2.5 py-0.5 text-xs text-secondary-300 hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                                    item.status === 'error' &&
                                        'text-ui-danger-text',
                                    item.status === 'running' &&
                                        'motion-safe:animate-pulse'
                                )}
                            >
                                <span aria-hidden="true">
                                    {ICON[item.name] ?? '🔧'}
                                </span>
                                <span className="truncate">{label(item)}</span>
                                {item.ms !== undefined ? (
                                    <span className="text-secondary-400 tabular-nums">
                                        {formatSeconds(item.ms)}
                                    </span>
                                ) : null}
                            </button>
                            {detail === item.id && item.summary ? (
                                <pre className="mt-1.5 max-h-48 max-w-full overflow-auto rounded border border-secondary-700 bg-secondary-800 p-2 font-mono text-[11px] leading-5 text-secondary-300">
                                    {item.summary}
                                </pre>
                            ) : null}
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}

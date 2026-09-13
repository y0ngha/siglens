'use client';

import { useTranslations } from 'next-intl';
import { useState, type ComponentType } from 'react';
import type { ToolActivityItem } from '@/features/agent-chat';
import { cn } from '@/shared/lib/cn';
import {
    CandlesIcon,
    CheckIcon,
    ChevronDownIcon,
    GlobeIcon,
    NewsIcon,
    OptionsIcon,
    PortfolioIcon,
    QuoteIcon,
    RefreshIcon,
    SearchIcon,
    SparkIcon,
} from './icons';

type IconComponent = ComponentType<{ className?: string }>;

const ICON: Record<string, IconComponent> = {
    search_ticker: SearchIcon,
    get_quote: QuoteIcon,
    get_bars_indicators: CandlesIcon,
    get_cached_analysis: SparkIcon,
    run_fresh_analysis: RefreshIcon,
    get_news: NewsIcon,
    get_options_summary: OptionsIcon,
    get_my_portfolio: PortfolioIcon,
    web_search: GlobeIcon,
};

/** What the call was about — the symbol(s) or the search query, never raw JSON. */
function subject(item: ToolActivityItem): string {
    const { args } = item;
    if (typeof args.symbol === 'string') return args.symbol;
    if (Array.isArray(args.symbols))
        return (args.symbols as unknown[])
            .filter(s => typeof s === 'string')
            .join(', ');
    if (typeof args.query === 'string') return `“${args.query}”`;
    return '';
}

/**
 * The data behind one answer, folded into one quiet line ("checked quote ·
 * news · 3.2s") the way chat products show their work. Tools are named in
 * the reader's language — the internal function names (`get_quote`) are an
 * implementation detail and read as leaked plumbing in an answer. Expanding
 * lists each lookup with what it was about and how long it took; raw tool
 * payloads are never shown.
 */
export function ToolActivity({
    tools,
}: {
    readonly tools: ToolActivityItem[];
}) {
    const t = useTranslations('widgets.agent-chat');
    const [open, setOpen] = useState(false);
    if (tools.length === 0) return null;
    // Built inside the component so each label is a real `t()` call the
    // extractor can find.
    const labels: Record<string, string> = {
        search_ticker: t('ToolActivity.toolSearchTicker'),
        get_quote: t('ToolActivity.toolQuote'),
        get_bars_indicators: t('ToolActivity.toolBars'),
        get_cached_analysis: t('ToolActivity.toolAnalysis'),
        run_fresh_analysis: t('ToolActivity.toolFreshAnalysis'),
        get_news: t('ToolActivity.toolNews'),
        get_options_summary: t('ToolActivity.toolOptions'),
        get_my_portfolio: t('ToolActivity.toolPortfolio'),
        web_search: t('ToolActivity.toolWebSearch'),
    };
    const labelOf = (name: string): string =>
        labels[name] ?? t('ToolActivity.toolOther');
    const seconds = (ms: number): string =>
        t('ToolActivity.seconds', { n: (ms / 1000).toFixed(1) });

    const running = tools.find(item => item.status === 'running');
    const failed = tools.some(item => item.status === 'error');
    const totalMs = tools.reduce((sum, item) => sum + (item.ms ?? 0), 0);
    const distinct = [...new Set(tools.map(item => labelOf(item.name)))];
    const summary = running
        ? [
              t('ToolActivity.checking', {
                  label: [labelOf(running.name), subject(running)]
                      .filter(Boolean)
                      .join(' '),
              }),
              running.estimatedSeconds
                  ? t('ToolActivity.aboutSeconds', {
                        n: running.estimatedSeconds,
                    })
                  : '',
          ]
        : [
              t('ToolActivity.checked', { sources: distinct.join(' · ') }),
              failed ? t('ToolActivity.partialFailure') : '',
              totalMs > 0 ? seconds(totalMs) : '',
          ];
    return (
        <div className="mb-3">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                className="group/tools inline-flex min-h-8 max-w-full items-center gap-2 rounded px-1.5 py-1 text-xs text-secondary-400 hover:bg-secondary-800 hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {/* A failed lookup is warning, not danger, on purpose: the
                    answer below is still written from the lookups that
                    succeeded, and the summary says "some failed". Danger red
                    is reserved for a turn that failed outright (the error
                    banner). */}
                <span
                    aria-hidden="true"
                    className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        running
                            ? 'bg-primary-400 motion-safe:animate-pulse'
                            : failed
                              ? 'bg-ui-warning'
                              : 'bg-ui-success'
                    )}
                />
                <span className="truncate">
                    {summary.filter(Boolean).join(' · ')}
                </span>
                <ChevronDownIcon
                    className={cn(
                        'size-3.5 shrink-0 transition-transform motion-reduce:transition-none',
                        open && 'rotate-180'
                    )}
                />
            </button>
            {open ? (
                <ol
                    aria-label={t('ToolActivity.b4c619')}
                    className="mt-1.5 ml-2.5 space-y-1 border-l border-secondary-700 pl-3"
                >
                    {tools.map(item => {
                        const Glyph = ICON[item.name] ?? SearchIcon;
                        return (
                            <li
                                key={item.id}
                                className="flex min-h-7 items-center gap-2 text-xs text-secondary-300"
                            >
                                <Glyph className="size-3.5 shrink-0 text-secondary-400" />
                                <span className="shrink-0 font-medium text-secondary-200">
                                    {labelOf(item.name)}
                                </span>
                                <span className="min-w-0 truncate text-secondary-400">
                                    {subject(item)}
                                </span>
                                <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-2 text-secondary-400 tabular-nums">
                                    {item.status === 'running' ? (
                                        <span className="motion-safe:animate-pulse">
                                            {t('ToolActivity.inProgress')}
                                        </span>
                                    ) : item.status === 'error' ? (
                                        <span className="text-ui-warning-text">
                                            {t('ToolActivity.failed')}
                                        </span>
                                    ) : (
                                        <CheckIcon className="size-3.5 text-ui-success-text" />
                                    )}
                                    {item.ms !== undefined
                                        ? seconds(item.ms)
                                        : null}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            ) : null}
        </div>
    );
}

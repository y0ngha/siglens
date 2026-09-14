import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import type { ToolActivityItem } from '../hooks/useAgentStream';

/** siglens.io symbol tabs an answer can point back to (`''` = the chart page). */
export type SymbolTab =
    | ''
    | 'overall'
    | 'fundamental'
    | 'financials'
    | 'news'
    | 'options'
    | 'congress';

export interface RelatedSymbolPage {
    readonly symbol: string;
    readonly tab: SymbolTab;
}

const ANALYSIS_TAB: Record<string, SymbolTab> = {
    technical: '',
    overall: 'overall',
    fundamental: 'fundamental',
    financials: 'financials',
    news: 'news',
    options: 'options',
    congress: 'congress',
};

function tabFor(item: ToolActivityItem): SymbolTab {
    if (item.name === 'get_news') return 'news';
    if (item.name === 'get_options_summary') return 'options';
    if (item.name === 'get_fundamentals') return 'fundamental';
    if (item.name === 'get_congress_trades') return 'congress';
    const key = item.args.tab ?? item.args.kind;
    if (
        (item.name === 'get_cached_analysis' ||
            item.name === 'run_fresh_analysis') &&
        typeof key === 'string'
    )
        return ANALYSIS_TAB[key] ?? '';
    return '';
}

function symbolsOf(item: ToolActivityItem): string[] {
    const { symbol, symbols } = item.args;
    const raw =
        typeof symbol === 'string'
            ? [symbol]
            : Array.isArray(symbols)
              ? symbols
              : [];
    return raw
        .filter((s): s is string => typeof s === 'string')
        .map(s => s.trim().toUpperCase())
        .filter(isAdmissibleSymbolShape);
}

/**
 * The siglens.io pages behind an answer: one per symbol the agent actually
 * looked up successfully, in the order it first appeared, pointing at the
 * most specific tab it read (analysis/news/options beat the chart page).
 *
 * Search, portfolio and web lookups name no page and are skipped; a failed
 * call proves nothing about the symbol, so it is skipped too.
 */
export function relatedSymbolPages(
    tools: readonly ToolActivityItem[],
    limit = 3
): RelatedSymbolPage[] {
    const bySymbol = new Map<string, SymbolTab>();
    for (const item of tools) {
        if (item.status !== 'ok') continue;
        const tab = tabFor(item);
        for (const symbol of symbolsOf(item)) {
            const current = bySymbol.get(symbol);
            if (current === undefined || (current === '' && tab !== ''))
                bySymbol.set(symbol, tab);
        }
    }
    return [...bySymbol]
        .slice(0, limit)
        .map(([symbol, tab]) => ({ symbol, tab }));
}

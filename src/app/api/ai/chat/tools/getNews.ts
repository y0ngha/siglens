import 'server-only';
import { DrizzleMarketNewsRepository } from '@/entities/market-news/api';
import { CATEGORY_CONFIG, categoryFromSlug } from '@/entities/market-news';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import type { NewsDisplayItem } from '@/shared/lib/types';
import {
    resolveNewsBody,
    resolveNewsSummary,
    resolveNewsTitle,
} from '@/shared/lib/news/resolveNewsTitle';
import { MS_PER_DAY } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import type { ToolExecutor } from './index';
import { fitToEscapedBudget, TOOL_RESULT_MAX_CHARS } from './truncate';

const DEFAULT_LOOKBACK_MS = 14 * MS_PER_DAY;
// The model fully controls `since`; without a ceiling it can force an
// unbounded DB scan (no repository-side LIMIT, body columns included in the
// row shape). 30 days matches the longest lookback any other news UI in
// this app requests.
const MAX_LOOKBACK_MS = 30 * MS_PER_DAY;
const DEFAULT_LIMIT = 5;
/** The model controls `limit`; `-1` would slice all-but-one and `NaN` none. */
const MAX_LIMIT = 20;

function clampLimit(raw: unknown): number {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_LIMIT;
    return Math.min(Math.max(Math.trunc(raw), 1), MAX_LIMIT);
}
const BODY_ITEMS = 3;
// Reserves room for the envelope + per-item JSON punctuation/escaping when
// splitting the remaining truncation budget across item bodies.
const BODY_BUDGET_SAFETY_MARGIN = 200;

function resolveSinceMs(
    since: unknown
): { ok: true; sinceMs: number } | { ok: false } {
    if (since === undefined) return { ok: true, sinceMs: DEFAULT_LOOKBACK_MS };
    if (typeof since !== 'string') return { ok: false };
    const parsed = Date.parse(since);
    if (Number.isNaN(parsed)) return { ok: false };
    const requestedMs = Math.max(0, Date.now() - parsed);
    // Clamp: a model-supplied ancient date (e.g. `2000-01-01`) must not turn
    // into an unbounded read — cap the window regardless of how far back
    // `since` asks to go.
    return { ok: true, sinceMs: Math.min(requestedMs, MAX_LOOKBACK_MS) };
}

export const getNewsTool: ToolExecutor = async (args, ctx) => {
    const { db } = getDatabaseClient();
    const sinceResult = resolveSinceMs(args.since);
    if (!sinceResult.ok)
        return {
            error: 'invalid_args',
            issues: [{ path: 'since', message: 'invalid date' }],
        };
    const sinceMs = sinceResult.sinceMs;
    const limit = clampLimit(args.limit);
    const query =
        typeof args.query === 'string' ? args.query.toLowerCase() : null;

    // `listCards*` already resolves title/summary/body to the request locale
    // via the shared `content_translations` sidecar (same helper the news
    // pages use) — no manual ko/en branching needed here.
    let rows: NewsDisplayItem[];
    if (typeof args.symbol === 'string') {
        rows = await new DrizzleNewsRepository(db).listCardsBySymbol(
            args.symbol.toUpperCase(),
            sinceMs,
            ctx.locale
        );
    } else if (typeof args.category === 'string') {
        const id = categoryFromSlug(args.category);
        if (id === null)
            return {
                error: 'invalid_args',
                issues: [{ path: 'category', message: 'unknown category' }],
            };
        rows = await new DrizzleMarketNewsRepository(db).listCardsByCategory(
            CATEGORY_CONFIG[id].sentinel,
            sinceMs,
            ctx.locale
        );
    } else {
        return {
            error: 'invalid_args',
            issues: [
                { path: 'symbol', message: 'symbol or category required' },
            ],
        };
    }
    const filtered = query
        ? rows.filter(r =>
              `${r.titleEn} ${r.titleKo ?? ''} ${r.summaryKo ?? ''}`
                  .toLowerCase()
                  .includes(query)
          )
        : rows;
    const page = filtered.slice(0, limit);
    const items = page.map(r => ({
        title: resolveNewsTitle(r, ctx.locale),
        summary: resolveNewsSummary(r),
        sentiment: r.sentiment,
        priceImpact: r.priceImpact,
        publishedAt: r.publishedAt,
        source: r.source,
        url: r.url,
    }));

    if (args.includeBody === true) {
        const bodyItemCount = Math.min(page.length, BODY_ITEMS);
        if (bodyItemCount > 0) {
            const envelopeLength = JSON.stringify({
                asOf: new Date().toISOString(),
                source: 'SIGLENS news',
                count: items.length,
                coverageLimited: items.length === 0,
                items,
            }).length;
            const remaining = Math.max(
                0,
                TOOL_RESULT_MAX_CHARS -
                    envelopeLength -
                    BODY_BUDGET_SAFETY_MARGIN
            );
            const perItemBodyCap = Math.floor(remaining / bodyItemCount);
            for (let i = 0; i < bodyItemCount; i++) {
                const body = resolveNewsBody(page[i]!);
                if (body && perItemBodyCap > 0) {
                    const fitted = fitToEscapedBudget(body, perItemBodyCap);
                    if (fitted !== '')
                        (items[i] as { body?: string }).body = fitted;
                }
            }
        }
    }

    return {
        asOf: new Date().toISOString(),
        source: 'SIGLENS news',
        count: items.length,
        coverageLimited: items.length === 0,
        items,
    };
};

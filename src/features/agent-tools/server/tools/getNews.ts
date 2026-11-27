import 'server-only';
import {
    alignNewsWithPriceMoves,
    type MarketDailyClose,
    type MarketSessionSpec,
    type NewsPriceMoves,
} from '@y0ngha/siglens-core';
import { lastBarIsForming } from '@/entities/bars/lib/quantizeBars';
import { getCachedBarsWithIndicators } from '@/entities/bars/server/barsDataCache';
import { peekMarketNewsDigestStatic } from '@/entities/market-news/api/marketNewsDigestStaticCache';
import { DrizzleMarketNewsRepository } from '@/entities/market-news/api/marketNewsRepository';
import {
    CATEGORY_CONFIG,
    categoryFromSlug,
} from '@/entities/market-news/lib/categoryConfig';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { resolveAssetInfoOrNull } from '@/entities/ticker/server/resolveAssetInfo';
import { barDate } from '@/features/agent-tools/lib/calendarChange';
import {
    fitToEscapedBudget,
    NEWS_ANNOTATE_HEADROOM_CHARS,
    NEWS_RESULT_MAX_CHARS,
} from '@/features/agent-tools/lib/truncate';
import type { ToolExecutor } from '@/features/agent-tools/model';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { MS_PER_DAY, MS_PER_HOUR } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { logToolDegrade } from '@/shared/lib/logToolDegrade';
import { zonedDate, zonedWallClockToUtc } from '@/shared/lib/marketSessionDate';
import {
    resolveNewsBody,
    resolveNewsSummary,
    resolveNewsTitle,
} from '@/shared/lib/news/resolveNewsTitle';
import type { NewsDisplayItem } from '@/shared/lib/types';

/** `get_news`'s `tally` field shape — sentiment/impact counts over the RETURNED page. */
interface NewsTallyView {
    bullish: number;
    bearish: number;
    neutral: number;
    highImpact: number;
}

/** `{ bullish, bearish, neutral, highImpact }` over the RETURNED items (spec §3.7, audit B9) — the same set the model sees, not the whole unpaginated match. */
function tallyOf(page: readonly NewsDisplayItem[]): NewsTallyView {
    return {
        bullish: page.filter(r => r.sentiment === 'bullish').length,
        bearish: page.filter(r => r.sentiment === 'bearish').length,
        neutral: page.filter(r => r.sentiment === 'neutral').length,
        highImpact: page.filter(r => r.priceImpact === 'high').length,
    };
}

/** Hours since `publishedAt`, rounded; `null` on an unparseable date (spec §0 null rule). */
function ageHoursOf(publishedAt: string): number | null {
    const t = Date.parse(publishedAt);
    if (Number.isNaN(t)) return null;
    return Math.round((Date.now() - t) / MS_PER_HOUR);
}

/** Symbol news default: "최근 1개월" is the common period question, and 30 days is already the hard cap below. */
const DEFAULT_SYMBOL_LOOKBACK_MS = 30 * MS_PER_DAY;
const DEFAULT_CATEGORY_LOOKBACK_MS = 14 * MS_PER_DAY;
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
    since: unknown,
    defaultMs: number
): { ok: true; sinceMs: number } | { ok: false } {
    if (since === undefined) return { ok: true, sinceMs: defaultMs };
    if (typeof since !== 'string') return { ok: false };
    const parsed = Date.parse(since);
    if (Number.isNaN(parsed)) return { ok: false };
    const requestedMs = Math.max(0, Date.now() - parsed);
    // Clamp: a model-supplied ancient date (e.g. `2000-01-01`) must not turn
    // into an unbounded read — cap the window regardless of how far back
    // `since` asks to go.
    return { ok: true, sinceMs: Math.min(requestedMs, MAX_LOOKBACK_MS) };
}

/**
 * The symbol window: the instant rows are kept from (`cutoffMs`) and the date `priceMoves` opens on (`windowStart`),
 * both derived from ONE instant so no kept row can fall before the window.
 *
 * A date-only `since` ("2026-09-10") means that calendar day in the MARKET's zone. `Date.parse` reads it as UTC
 * midnight, which is 20:00 ET the evening before (one extra US session, a stale evening of headlines) and 09:00 KST
 * the same day (the KR pre-open headlines would be cut). So with a date-only `since` and a known zone, rows are kept
 * from the local midnight that opens that date and the window starts on that date. The first window session's
 * headlines are then those published from local midnight to its close: ones published between the previous close
 * and that midnight (the evening before the period) are left out on purpose, they belong to the period before it.
 * Any other `since` (an ISO instant, or none: the default window) keeps its instant and the zone date of it.
 * The 30-day cap still wins, and a future date collapses to now.
 */
export function resolveNewsWindow(input: {
    since: unknown;
    nowMs: number;
    baselineSinceMs: number;
    zone: string | null;
}): { cutoffMs: number; windowStart: string } {
    const { since, nowMs, baselineSinceMs, zone } = input;
    if (
        zone !== null &&
        typeof since === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(since)
    ) {
        const dayStart = zonedWallClockToUtc(since, 0, zone).getTime();
        const cutoffMs = Math.min(
            Math.max(dayStart, nowMs - MAX_LOOKBACK_MS),
            nowMs
        );
        return {
            cutoffMs,
            windowStart:
                cutoffMs === dayStart
                    ? since
                    : zonedDate(new Date(cutoffMs), zone),
        };
    }
    const cutoffMs = nowMs - baselineSinceMs;
    return {
        cutoffMs,
        windowStart: zonedDate(new Date(cutoffMs), zone ?? 'UTC'),
    };
}

/** Longest headline printed (an item title or a `priceMoves` headline); keeps the fit's one-item floor under the cap. */
const NEWS_TITLE_MAX_CHARS = 200;
const clampTitle = (title: string): string =>
    fitToEscapedBudget(title, NEWS_TITLE_MAX_CHARS);

/** Self-fit: summaries are cut to this many chars before any item is dropped. */
const FIT_SUMMARY_CHARS = 100;

/** Daily closes handed to the alignment: enough for the 30-day window plus the session before it. */
const PRICE_MOVE_CLOSES = 40;

const PRICE_MOVES_BASIS =
    'daily close-to-close change of completed sessions; a headline belongs to the first session whose close came after it was published';

interface NewsItemView {
    title: string;
    summary: string | null;
    sentiment: NewsDisplayItem['sentiment'];
    priceImpact: NewsDisplayItem['priceImpact'];
    publishedAt: string;
    ageHours: number | null;
    /** Only when `priceMoves` is computed: `null` there = published after the last completed close. */
    session?: string | null;
    source: string;
    url: string;
    body?: string;
}

interface NewsMoveDayView {
    date: string;
    changePct: number;
    headlines: {
        title: string;
        publishedAt: string;
        sentiment: NewsDisplayItem['sentiment'];
    }[];
    moreHeadlines: number;
}

/** `get_news` `priceMoves`: the window's largest daily moves with the headlines published up to each close. */
interface NewsPriceMovesView {
    basis: typeof PRICE_MOVES_BASIS;
    window: { from: string; to: string; sessions: number };
    medianAbsDailyChangePct: number | null;
    moveDays: NewsMoveDayView[];
    afterLastClose: number;
}

/** What the price-move block needs from the market: the session spec and the completed daily closes. */
export interface NewsMarketContext {
    session: MarketSessionSpec;
    closes: MarketDailyClose[];
}

/**
 * Aligns the window's rows with completed sessions and shapes `priceMoves`. Pure function of its inputs, so the
 * evaluation replay calls it on recorded rows and closes.
 *
 * `rows` is the whole filtered window (not the returned page): a move day's headlines come from every row, even
 * ones the `limit` page left out. `windowStart` is the zone date of the instant the `since` filter used, so no row
 * can fall before the window (`beforeWindowCount` stays 0). Returns `null` when there are fewer than 2 sessions
 * in the window.
 */
function enrichNewsWithPriceMoves(input: {
    rows: readonly NewsDisplayItem[];
    locale: Parameters<typeof resolveNewsTitle>[1];
    market: NewsMarketContext;
    windowStart: string;
}): { priceMoves: NewsPriceMovesView; itemSessions: (string | null)[] } | null {
    const { rows, locale, market, windowStart } = input;
    const aligned: NewsPriceMoves | null = alignNewsWithPriceMoves({
        closes: market.closes,
        publishedAt: rows.map(r => r.publishedAt),
        session: market.session,
        windowStart,
    });
    if (aligned === null) return null;
    const moveDays = aligned.moveDays.map((d): NewsMoveDayView => ({
        date: d.date,
        changePct: d.changePct,
        headlines: d.itemIndexes.flatMap(i => {
            const row = rows[i];
            return row === undefined
                ? []
                : [
                      {
                          title: clampTitle(resolveNewsTitle(row, locale)),
                          publishedAt: row.publishedAt,
                          sentiment: row.sentiment,
                      },
                  ];
        }),
        moreHeadlines: d.itemCount - d.itemIndexes.length,
    }));
    return {
        priceMoves: {
            basis: PRICE_MOVES_BASIS,
            window: aligned.window,
            medianAbsDailyChangePct: aligned.medianAbsDailyChangePct,
            moveDays,
            afterLastClose: aligned.afterLastCloseCount,
        },
        itemSessions: aligned.itemSessions,
    };
}

/**
 * The session spec and the last completed daily closes of a symbol, from the same cached daily series
 * `get_fundamentals` and `get_bars_indicators` read. A forming (live) bar is dropped: its close is a quote.
 * Never throws: `null` (logged) on any failure, so the news list still goes out without `priceMoves`.
 */
async function loadNewsMarketContext(
    symbol: string
): Promise<NewsMarketContext | null> {
    try {
        const [profile, asset] = await Promise.all([
            resolveMarketProfile(symbol),
            resolveAssetInfoOrNull(symbol, 'get_news'),
        ]);
        const session = sessionSpecFor(profile);
        const { bars } = await getCachedBarsWithIndicators(
            getCachedMarketDataProvider(session),
            symbol,
            '1Day',
            asset?.fmpSymbol,
            session
        );
        const completed = lastBarIsForming(bars, session, new Date())
            ? bars.slice(0, -1)
            : bars;
        return {
            session,
            closes: completed
                .slice(-PRICE_MOVE_CLOSES)
                .map(bar => ({ date: barDate(bar), close: bar.close })),
        };
    } catch (error) {
        logToolDegrade('get_news', 'price moves', error);
        return null;
    }
}

/** Local calendar zone of a session: its exchange zone, UTC for an always-open market. */
const zoneOf = (session: MarketSessionSpec): string =>
    session.kind === 'scheduled' ? session.timeZone : 'UTC';

/**
 * Fits the result under `budget` chars (serialized) so the registry never replaces it with the front-cut
 * truncation envelope: first every summary is cut to `FIT_SUMMARY_CHARS`, then the OLDEST items (the list is
 * newest first) are dropped one by one, always keeping one. `assemble` rebuilds the result for a given item list
 * and the number of items dropped (`itemsTrimmed`).
 */
function fitNewsItems<R>(
    items: readonly NewsItemView[],
    budget: number,
    assemble: (kept: NewsItemView[], dropped: number) => R
): R {
    const fits = (result: R): boolean =>
        JSON.stringify(result).length <= budget;
    const full = assemble([...items], 0);
    if (fits(full)) return full;
    const shortened = items.map(item => ({
        ...item,
        summary:
            item.summary === null
                ? null
                : fitToEscapedBudget(item.summary, FIT_SUMMARY_CHARS),
    }));
    const keep =
        Array.from(
            { length: shortened.length },
            (_, i) => shortened.length - i
        ).find(n =>
            fits(assemble(shortened.slice(0, n), shortened.length - n))
        ) ?? Math.min(1, shortened.length);
    return assemble(shortened.slice(0, keep), shortened.length - keep);
}

export const getNewsTool: ToolExecutor = async (args, ctx, runtime) => {
    const { db } = getDatabaseClient();
    const isSymbolQuery = typeof args.symbol === 'string';
    const sinceResult = resolveSinceMs(
        args.since,
        isSymbolQuery
            ? DEFAULT_SYMBOL_LOOKBACK_MS
            : DEFAULT_CATEGORY_LOOKBACK_MS
    );
    if (!sinceResult.ok)
        return {
            error: 'invalid_args',
            issues: [{ path: 'since', message: 'invalid date' }],
        };
    const nowMs = Date.now();
    const limit = clampLimit(args.limit);
    const query =
        typeof args.query === 'string' ? args.query.toLowerCase() : null;

    // `listCards*` already resolves title/summary/body to the request locale
    // via the shared `content_translations` sidecar (same helper the news
    // pages use) — no manual ko/en branching needed here.
    let rows: NewsDisplayItem[];
    /**
     * The category feed's own AI digest — the same one `/news/[category]`
     * renders. `peek` is cache-read-only (zero LLM cost, no enqueue), so the
     * agent gets the synthesis the page already has instead of re-deriving it
     * from the item list. Stays `null` for a symbol query (the digest is
     * per-category) and on a cold cache.
     */
    let digest: Awaited<ReturnType<typeof peekMarketNewsDigestStatic>> = null;
    const symbolArg =
        typeof args.symbol === 'string' ? args.symbol.toUpperCase() : null;
    // The daily closes load beside the ingest; the loader never rejects.
    const marketPending =
        symbolArg === null ? null : loadNewsMarketContext(symbolArg);
    // **읽기 전에** 적재한다. 이 툴은 DB만 읽으므로, 적재를 트리거하는 다른
    // 경로(뉴스 탭 방문·prewarm cron)가 최근에 안 돌았으면 며칠 묵은 목록이
    // 그대로 답이 된다 — 실측(2026-09-21): 당일 보도자료가 FMP에는 있는데
    // 챗은 "최신이 89시간 전"이라고 답했다. `ensureSymbolData`는 Redis TTL로
    // 10분에 1회로 접히고 절대 reject하지 않으므로, 실패해도 아래 DB 읽기로
    // 그대로 진행된다.
    if (symbolArg !== null) await runtime.ensureSymbolData(symbolArg);
    // `market` and `window` are computed ONCE and reused: the DB bound and the `priceMoves` window start come from
    // the same instant. The window needs the market's zone, so the DB read waits for the (already running) closes load.
    // A category query has no window: it reads from `sinceResult.sinceMs` directly.
    const market = marketPending === null ? null : await marketPending;
    const window =
        symbolArg === null
            ? null
            : resolveNewsWindow({
                  since: args.since,
                  nowMs,
                  baselineSinceMs: sinceResult.sinceMs,
                  zone: market === null ? null : zoneOf(market.session),
              });
    if (symbolArg !== null && window !== null) {
        rows = await new DrizzleNewsRepository(db).listCardsBySymbol(
            symbolArg,
            Math.max(0, nowMs - window.cutoffMs),
            ctx.locale
        );
    } else if (typeof args.category === 'string') {
        const id = categoryFromSlug(args.category);
        if (id === null)
            return {
                error: 'invalid_args',
                issues: [{ path: 'category', message: 'unknown category' }],
            };
        [rows, digest] = await Promise.all([
            new DrizzleMarketNewsRepository(db).listCardsByCategory(
                CATEGORY_CONFIG[id].sentinel,
                sinceResult.sinceMs,
                ctx.locale
            ),
            // `peekMarketNewsDigestStatic`은 자체 try/catch로 실패를 삼켜
            // `null`로 resolve한다(그쪽에서 이미 로그도 남긴다). 이 `.catch`는
            // **그 계약이 바뀔 때를 위한 여분**이다 — `Promise.all`은 형제 하나가
            // reject하면 통째로 무너지므로, 다이제스트 하나 때문에 기사 목록까지
            // 잃는 경로를 만들지 않는다. 형제인 `getMarketOverview`의 브리핑 peek은
            // 내부 try/catch가 없어 그쪽 `.catch`는 실제로 동작한다.
            peekMarketNewsDigestStatic(id, ctx.locale).catch(error => {
                logToolDegrade('get_news', 'digest peek', error);
                return null;
            }),
        ]);
    } else {
        return {
            error: 'invalid_args',
            issues: [
                { path: 'symbol', message: 'symbol or category required' },
            ],
        };
    }
    const queried = query
        ? rows.filter(r =>
              `${r.titleEn} ${r.titleKo ?? ''} ${r.summaryKo ?? ''}`
                  .toLowerCase()
                  .includes(query)
          )
        : rows;
    // The symbol window is exactly [cutoff, now]: the repository bound can sit a few ms off the cutoff, and a
    // row older than it would fall before `priceMoves`' first session. An unparseable date stays (unknown).
    const filtered =
        window !== null
            ? queried.filter(r => {
                  const t = Date.parse(r.publishedAt);
                  return Number.isNaN(t) || t >= window.cutoffMs;
              })
            : queried;
    const page = filtered.slice(0, limit);
    // Computed over ALL of `filtered` (before the page and before any self-fit trimming), so move-day headlines
    // exist even when they fall outside the page.
    const enriched =
        market === null || window === null
            ? null
            : enrichNewsWithPriceMoves({
                  rows: filtered,
                  locale: ctx.locale,
                  market,
                  windowStart: window.windowStart,
              });
    const items: NewsItemView[] = page.map((r, i) => ({
        title: clampTitle(resolveNewsTitle(r, ctx.locale)),
        summary: resolveNewsSummary(r),
        sentiment: r.sentiment,
        priceImpact: r.priceImpact,
        publishedAt: r.publishedAt,
        ageHours: ageHoursOf(r.publishedAt),
        // No `session` key without `priceMoves`: a `null` there would read as "after the last close".
        ...(enriched === null
            ? {}
            : { session: enriched.itemSessions[i] ?? null }),
        source: r.source,
        url: r.url,
    }));
    const asOf = new Date().toISOString();
    const digestView = digest && {
        driver: digest.currentDriverKo,
        keyEvents: digest.keyEventsKo,
        upcomingEvents: digest.upcomingEventsKo,
        overallSentiment: digest.overallSentiment,
    };
    const assemble = (kept: NewsItemView[], dropped: number) => ({
        asOf,
        source: 'SIGLENS news',
        count: kept.length,
        coverageLimited: page.length === 0,
        // Over the items actually returned, after any trimming.
        tally: tallyOf(page.slice(0, kept.length)),
        digest: digestView,
        ...(isSymbolQuery
            ? { priceMoves: enriched === null ? null : enriched.priceMoves }
            : {}),
        items: kept,
        ...(dropped > 0 ? { itemsTrimmed: dropped } : {}),
    });
    const budget = NEWS_RESULT_MAX_CHARS - NEWS_ANNOTATE_HEADROOM_CHARS;

    const bodyItemCount =
        args.includeBody === true ? Math.min(page.length, BODY_ITEMS) : 0;
    // Bodies share what the envelope leaves of the budget; the escaped size is what counts.
    const perItemBodyCap =
        bodyItemCount === 0
            ? 0
            : Math.floor(
                  Math.max(
                      0,
                      budget -
                          JSON.stringify(assemble(items, 0)).length -
                          BODY_BUDGET_SAFETY_MARGIN
                  ) / bodyItemCount
              );
    const withBodies = items.map((item, i): NewsItemView => {
        const source = i < bodyItemCount ? page[i] : undefined;
        const body = source === undefined ? null : resolveNewsBody(source);
        const fitted =
            body && perItemBodyCap > 0
                ? fitToEscapedBudget(body, perItemBodyCap)
                : '';
        return fitted === '' ? item : { ...item, body: fitted };
    });
    return fitNewsItems(withBodies, budget, assemble);
};

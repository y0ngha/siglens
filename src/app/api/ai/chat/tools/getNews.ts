import 'server-only';
import { DrizzleMarketNewsRepository } from '@/entities/market-news/api';
import { peekMarketNewsDigestStatic } from '@/entities/market-news/api/marketNewsDigestStaticCache';
import { CATEGORY_CONFIG, categoryFromSlug } from '@/entities/market-news';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import type { NewsDisplayItem } from '@/shared/lib/types';
import {
    resolveNewsBody,
    resolveNewsSummary,
    resolveNewsTitle,
} from '@/shared/lib/news/resolveNewsTitle';
import { MS_PER_DAY, MS_PER_HOUR } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import type { ToolExecutor } from './index';
import { logToolDegrade } from './logToolDegrade';
import { fitToEscapedBudget, TOOL_RESULT_MAX_CHARS } from './truncate';

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

export const getNewsTool: ToolExecutor = async (args, ctx, runtime) => {
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
    /**
     * The category feed's own AI digest — the same one `/news/[category]`
     * renders. `peek` is cache-read-only (zero LLM cost, no enqueue), so the
     * agent gets the synthesis the page already has instead of re-deriving it
     * from the item list. Stays `null` for a symbol query (the digest is
     * per-category) and on a cold cache.
     */
    let digest: Awaited<ReturnType<typeof peekMarketNewsDigestStatic>> = null;
    if (typeof args.symbol === 'string') {
        const symbol = args.symbol.toUpperCase();
        // **읽기 전에** 적재한다. 이 툴은 DB만 읽으므로, 적재를 트리거하는 다른
        // 경로(뉴스 탭 방문·prewarm cron)가 최근에 안 돌았으면 며칠 묵은 목록이
        // 그대로 답이 된다 — 실측(2026-09-21): 당일 보도자료가 FMP에는 있는데
        // 챗은 "최신이 89시간 전"이라고 답했다. `ensureSymbolData`는 Redis TTL로
        // 10분에 1회로 접히고 절대 reject하지 않으므로, 실패해도 아래 DB 읽기로
        // 그대로 진행된다.
        await runtime.ensureSymbolData(symbol);
        rows = await new DrizzleNewsRepository(db).listCardsBySymbol(
            symbol,
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
        [rows, digest] = await Promise.all([
            new DrizzleMarketNewsRepository(db).listCardsByCategory(
                CATEGORY_CONFIG[id].sentinel,
                sinceMs,
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
        ageHours: ageHoursOf(r.publishedAt),
        source: r.source,
        url: r.url,
    }));
    const tally = tallyOf(page);
    const digestView = digest && {
        driver: digest.currentDriverKo,
        keyEvents: digest.keyEventsKo,
        upcomingEvents: digest.upcomingEventsKo,
        overallSentiment: digest.overallSentiment,
    };

    if (args.includeBody === true) {
        const bodyItemCount = Math.min(page.length, BODY_ITEMS);
        if (bodyItemCount > 0) {
            const envelopeLength = JSON.stringify({
                asOf: new Date().toISOString(),
                source: 'SIGLENS news',
                count: items.length,
                coverageLimited: items.length === 0,
                tally,
                digest: digestView,
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
        tally,
        digest: digestView,
        items,
    };
};

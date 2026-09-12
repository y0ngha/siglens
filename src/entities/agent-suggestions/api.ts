import 'server-only';
import {
    buildSuggestionsPrompt,
    getEtSessionStatus,
    parseSuggestions,
    type SuggestionHeadline,
} from '@y0ngha/siglens-core';
import { AGENT_MODEL, getAgentProvider } from '@/entities/llm-provider';
import {
    CATEGORY_CONFIG,
    type MarketNewsCardItem,
} from '@/entities/market-news';
import { DrizzleMarketNewsRepository } from '@/entities/market-news/api';
import { getRedisClient } from '@/shared/cache/redisClient';
import { MS_PER_HOUR } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import type { Locale } from '@/shared/i18n/locales';
import { resolveNewsTitle } from '@/shared/lib/news/resolveNewsTitle';
import { suggestionsCacheKey } from './lib/cacheKey';
import type { AgentSuggestionsInput } from './model';

const HEADLINES_LOOKBACK_MS = 48 * MS_PER_HOUR;
const HEADLINES_MAX = 8;
const MIN_SUGGESTIONS = 3;
const CACHE_TTL_SECONDS = 3_600;
/**
 * A failed or too-short generation is remembered briefly as `[]`. Without it a
 * run of bad model output would re-invoke the paid provider on every page load
 * for the rest of the hour — the one thing the hourly key exists to prevent.
 */
const NEGATIVE_TTL_SECONDS = 300;
const PROVIDER_TIMEOUT_MS = 8_000;
const PROVIDER_MAX_OUTPUT_TOKENS = 400;

/**
 * Feed categories mixed into the headline pool — general market + individual
 * stock news, the two `market-news` buckets that read as generic "what's
 * happening" material rather than a single-symbol story. Not `news-article`
 * (that entity is scoped to a single symbol's own news, e.g. `getNewsList`);
 * `general`/`stock` are `market-news`'s category sentinels
 * (`CATEGORY_CONFIG`).
 */
const HEADLINE_CATEGORY_IDS = ['general', 'stock'] as const;

// ponytail: cross-instance stampede on a cache miss is ignored — traffic is
// bounded to <=4 locales x 1 generation/hour, so a duplicate provider call
// from another instance is rare and cheap. Upgrade to a Redis lock if this
// key space grows (e.g. per-user fan-out at scale).
const inFlight = new Map<string, Promise<string[] | null>>();

function warn(context: string, error: unknown): void {
    // Never log `error.message` — for DB errors it can embed SQL/bound
    // params (see `route.ts`'s `isConversationGone` comment for the same
    // rule applied to the stream route).
    console.warn(
        `[agent-suggestions] ${context}:`,
        error instanceof Error ? error.name : 'unknown'
    );
}

async function fetchHeadlines(locale: Locale): Promise<SuggestionHeadline[]> {
    try {
        const { db } = getDatabaseClient();
        const repo = new DrizzleMarketNewsRepository(db);
        const perCategory = await Promise.all(
            HEADLINE_CATEGORY_IDS.map(categoryId =>
                repo
                    .listCardsByCategory(
                        CATEGORY_CONFIG[categoryId].sentinel,
                        HEADLINES_LOOKBACK_MS,
                        locale
                    )
                    .then(rows => rows.map(row => ({ row, categoryId })))
                    // One category failing (e.g. a bad sentinel) must not
                    // blank out the other's headlines.
                    .catch((error: unknown) => {
                        warn(`headlines(${categoryId}) failed`, error);
                        return [];
                    })
            )
        );
        const merged: Array<{
            row: MarketNewsCardItem;
            categoryId: (typeof HEADLINE_CATEGORY_IDS)[number];
        }> = perCategory.flat();
        // Newest first across both categories — publishedAt is an ISO-8601
        // string (see `toNewsRow`), so lexical order is chronological order.
        merged.sort((a, b) => (a.row.publishedAt < b.row.publishedAt ? 1 : -1));
        return merged.slice(0, HEADLINES_MAX).map(({ row, categoryId }) => ({
            title: resolveNewsTitle(row, locale),
            category: categoryId,
            ...(row.tickers[0] !== undefined ? { symbol: row.tickers[0] } : {}),
        }));
    } catch (error) {
        warn('headlines failed', error);
        return [];
    }
}

async function generate(
    input: AgentSuggestionsInput,
    now: Date,
    cacheKey: string,
    redis: ReturnType<typeof getRedisClient>
): Promise<string[] | null> {
    try {
        const headlines = await fetchHeadlines(input.locale);
        const { system, user } = buildSuggestionsPrompt({
            locale: input.locale,
            now,
            etSessionStatus: getEtSessionStatus(now),
            headlines,
            ...(input.portfolioSymbols.length > 0
                ? { portfolioSymbols: input.portfolioSymbols }
                : {}),
        });
        const result = await getAgentProvider()({
            apiKey: '',
            model: AGENT_MODEL,
            system,
            messages: [{ role: 'user', content: user }],
            tools: [],
            maxOutputTokens: PROVIDER_MAX_OUTPUT_TOKENS,
            signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
            onEvent: () => {},
        });
        const items = parseSuggestions(result.text);
        if (items.length < MIN_SUGGESTIONS) {
            await writeCache(redis, cacheKey, [], NEGATIVE_TTL_SECONDS);
            return null;
        }
        await writeCache(redis, cacheKey, items, CACHE_TTL_SECONDS);
        return items;
    } catch (error) {
        warn('generation failed', error);
        await writeCache(redis, cacheKey, [], NEGATIVE_TTL_SECONDS);
        return null;
    }
}

async function writeCache(
    redis: ReturnType<typeof getRedisClient>,
    cacheKey: string,
    value: readonly string[],
    ttlSeconds: number
): Promise<void> {
    if (!redis) return;
    try {
        await redis.set(cacheKey, value, { ex: ttlSeconds });
    } catch (error) {
        warn('cache write failed', error);
    }
}

/**
 * AI-generated suggested questions for the empty screen (spec §4-3).
 *
 * `null` means "show the static six" — every failure mode (kill switch, Redis
 * down, provider timeout/error, a too-short parse) degrades to that rather
 * than surfacing an error to the user; see `EmptyState`'s `suggestions` prop.
 */
export async function getAgentSuggestions(
    input: AgentSuggestionsInput
): Promise<string[] | null> {
    if (process.env.AGENT_CHAT_DISABLED === '1') return null;

    const now = new Date();
    const cacheKey = suggestionsCacheKey({ ...input, now });
    const redis = getRedisClient();

    if (redis) {
        try {
            const cached = await redis.get<string[]>(cacheKey);
            if (Array.isArray(cached)) {
                // `[]` is the negative marker (see NEGATIVE_TTL_SECONDS).
                if (cached.length === 0) return null;
                if (cached.length >= MIN_SUGGESTIONS) return cached;
            }
        } catch (error) {
            warn('cache read failed', error);
        }
    }

    const existing = inFlight.get(cacheKey);
    if (existing) return existing;

    const promise = generate(input, now, cacheKey, redis).finally(() => {
        inFlight.delete(cacheKey);
    });
    inFlight.set(cacheKey, promise);
    return promise;
}

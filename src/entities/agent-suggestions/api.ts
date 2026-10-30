import 'server-only';
import {
    buildSuggestionsPrompt,
    getEtSessionStatus,
    parseSuggestions,
    type SuggestionHeadline,
} from '@y0ngha/siglens-core';
import { AGENT_MODEL } from '@/entities/llm-provider/api/agent/router';
import { getAgentProvider } from '@/entities/llm-provider/api/agent/getAgentProvider';
import { CATEGORY_CONFIG } from '@/entities/market-news/lib/categoryConfig';
import { DrizzleMarketNewsRepository } from '@/entities/market-news/api/marketNewsRepository';
import { getRedisClient } from '@/shared/cache/redisClient';
import { MS_PER_HOUR } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import type { Locale } from '@/shared/i18n/locales';
import { createSingleFlight } from '@/shared/lib/singleFlight';
import { suggestionsCacheKey } from './lib/cacheKey';
import { MIN_SUGGESTIONS } from './lib/constants';
import { mergeHeadlines } from './lib/mergeHeadlines';
import { readCachedSuggestions } from './lib/readCachedSuggestions';
import type { AgentSuggestionsInput } from './model';

const HEADLINES_LOOKBACK_MS = 48 * MS_PER_HOUR;
const HEADLINES_MAX = 8;
const CACHE_TTL_SECONDS = 3_600;
/**
 * 실패하거나 너무 짧은 생성 결과는 `[]`로 잠깐 기억한다. 없으면 모델 출력이
 * 계속 나쁠 때 그 시간대 내내 페이지 로드마다 유료 provider를 다시 호출하게 되어,
 * 시간 단위 키가 막으려는 바로 그 일이 벌어진다.
 */
const NEGATIVE_TTL_SECONDS = 300;
const PROVIDER_TIMEOUT_MS = 8_000;
const PROVIDER_MAX_OUTPUT_TOKENS = 400;

/**
 * 헤드라인 풀에 섞는 피드 카테고리 — 시장 일반 + 개별 종목 뉴스. 단일 종목
 * 스토리가 아니라 "지금 무슨 일이 있나" 소재로 읽히는 `market-news`의 두 버킷이다.
 * 종목 하나의 뉴스에 한정된 `news-article`은 쓰지 않는다. `general`/`stock`은
 * `market-news`의 카테고리 센티넬 키(`CATEGORY_CONFIG`)이기도 하다.
 */
const HEADLINE_CATEGORY_IDS = ['general', 'stock'] as const;

// 인스턴스 간 캐시 미스 중복 생성은 허용한다 — 로케일 4개 x 시간당 1회로
// 트래픽이 제한되어 다른 인스턴스의 중복 provider 호출은 드물고 저렴하다.
// 키 공간이 커지면(예: 사용자별 fan-out) Redis 락으로 올린다.
const inFlight = createSingleFlight<string[] | null>();

/** 에러 이름만 경고로 남긴다. */
function warn(context: string, error: unknown): void {
    // DB 에러의 `message`에는 SQL/바인딩 파라미터가 섞일 수 있어 이름만 남긴다.
    console.warn(
        `[agent-suggestions] ${context}:`,
        error instanceof Error ? error.name : 'unknown'
    );
}

/** 두 카테고리 헤드라인을 가져온다. 어떤 실패도 빈 목록으로 흡수한다. */
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
                    // 한 카테고리가 실패해도 다른 카테고리의 헤드라인은 살린다.
                    .catch((error: unknown) => {
                        warn(`headlines(${categoryId}) failed`, error);
                        return [];
                    })
            )
        );
        return mergeHeadlines(perCategory.flat(), locale, HEADLINES_MAX);
    } catch (error) {
        warn('headlines failed', error);
        return [];
    }
}

/** provider로 추천 질문을 생성해 캐시에 쓴다. 실패·부족 시 음성 마커를 쓰고 `null`을 반환한다. */
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

/** 캐시 쓰기 실패는 경고만 남기고 삼킨다. */
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
 * ai.siglens.io 빈 화면에 보여줄 AI 생성 추천 질문. `/ai/[locale]` 페이지가 호출한다.
 *
 * `null`은 "정적 6개를 보여준다"는 뜻이다 — 킬 스위치, Redis 장애, provider
 * 타임아웃/에러, 너무 짧은 파싱 결과 모두 사용자에게 에러를 노출하지 않고 이쪽으로 떨어진다.
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
            const cached = readCachedSuggestions(
                await redis.get<unknown>(cacheKey)
            );
            if (cached.kind === 'negative') return null;
            if (cached.kind === 'hit') return cached.items;
        } catch (error) {
            warn('cache read failed', error);
        }
    }

    return inFlight.run(cacheKey, () => generate(input, now, cacheKey, redis));
}

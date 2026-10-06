import 'server-only';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import { createRedisSlot } from '@/shared/cache/createRedisSlot';
import { readHubSsrSeed, writeHubSsrSeed } from '@/shared/cache/hubSsrSeed';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import type { NewsFeedCategoryId } from '../lib/categoryConfig';

/**
 * 카테고리 다이제스트의 방문자 생성 간격(1시간, 카테고리 × 로케일별).
 *
 * 다이제스트의 core 캐시 키는 기사 목록(`news`)에서 파생된다. 새 기사가 분석될 때마다
 * 집합이 바뀌어 키가 갈리고, 그때마다 첫 방문자가 LLM 호출을 일으켰다(2026-10 비용
 * 감사). 페이지 ISR이 12시간이라 그보다 자주 만들어도 정적 화면은 바뀌지 않는다 —
 * 1시간은 "새 기사가 화면에 늦게 반영되는 최대 지연"과 비용 사이의 절충이다.
 *
 * 크론(`hubs.ts`)은 이 슬롯을 보지 않는다 — 크론은 루트 락으로 한 번에 하나만 돌고
 * 색인 로케일(`ko`) 한 벌만 굽는다. 대신 생성할 때 마지막 생성본을 남겨, 슬롯에 막힌
 * 방문자가 그 값을 받게 한다.
 */
const MARKET_NEWS_DIGEST_COOLDOWN_SECONDS = SECONDS_PER_HOUR;

interface DigestScope {
    readonly category: NewsFeedCategoryId;
    readonly locale: Locale;
}

const digestSlot = createRedisSlot(
    ({ category, locale }: DigestScope) =>
        `market-news:digest-cooldown:${category}:${locale}`,
    MARKET_NEWS_DIGEST_COOLDOWN_SECONDS,
    '[market-news-digest-cooldown]'
);

/** 마지막 생성본 seed 키. 로케일별 본문이 다르므로 키에 로케일이 들어간다. */
function latestDigestSurface({ category, locale }: DigestScope): string {
    return `market-news-digest-latest:${category}:${locale}`;
}

/**
 * 이번 시간의 생성 슬롯을 잡는다. Redis를 쓸 수 없으면 fail-open(true)이다.
 *
 * @returns 슬롯을 잡았으면 true. 이번 시간에 누군가 이미 만들었으면 false.
 */
export function tryAcquireMarketNewsDigestSlot(
    category: NewsFeedCategoryId,
    locale: Locale
): Promise<boolean> {
    return digestSlot.tryAcquire({ category, locale });
}

/** 생성 실패 시 슬롯을 돌려줘 다음 방문자가 다시 시도하게 한다. */
export function releaseMarketNewsDigestSlot(
    category: NewsFeedCategoryId,
    locale: Locale
): Promise<void> {
    return digestSlot.release({ category, locale });
}

/** 슬롯에 막힌 방문자에게 돌려줄 마지막 생성본. 없거나 Redis를 쓸 수 없으면 `null`. */
export function readLatestMarketNewsDigest(
    category: NewsFeedCategoryId,
    locale: Locale
): Promise<NewsAnalysisResponse | null> {
    return readHubSsrSeed<NewsAnalysisResponse>(
        latestDigestSurface({ category, locale })
    );
}

/** 실제로 생성(`done`)됐을 때만 부른다. 실패는 삼킨다(`writeHubSsrSeed`). */
export function writeLatestMarketNewsDigest(
    category: NewsFeedCategoryId,
    locale: Locale,
    digest: NewsAnalysisResponse
): Promise<void> {
    return writeHubSsrSeed(latestDigestSurface({ category, locale }), digest);
}

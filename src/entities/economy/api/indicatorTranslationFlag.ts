import 'server-only';
import { createRedisFlag } from '@/shared/cache/createRedisFlag';
import {
    INDICATOR_TRANSLATION_FLAG_PREFIX,
    INDICATOR_TRANSLATION_FLAG_TTL_SECONDS,
} from '../lib/indicatorTranslationConstants';

const _flag = createRedisFlag(
    (normalizedName: string) =>
        `${INDICATOR_TRANSLATION_FLAG_PREFIX}:${normalizedName}`,
    INDICATOR_TRANSLATION_FLAG_TTL_SECONDS,
    '[indicatorTranslationFlag]'
);

/**
 * 해당 지표명의 AI 번역이 최근 TTL 내에 제출됐는지 — Redis 실패/미구성 시 false
 * (항상 제출 시도). market-news `isRecentlyFetched` 미러.
 */
export const isIndicatorTranslationPending = _flag.isSet;

/** "이 지표명 번역 제출함" 마킹 — Redis 실패 시 noop. */
export const markIndicatorTranslationPending = _flag.mark;

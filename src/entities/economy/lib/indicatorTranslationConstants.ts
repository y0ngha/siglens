import { SECONDS_PER_DAY, SECONDS_PER_MINUTE } from '@/shared/config/time';

/**
 * revalidateTag 대상 — indicator 번역 캐시만 무효화한다(캘린더 데이터 캐시와 분리).
 * AI 번역이 새로 캐시되면 다음 렌더에서 reader가 한국어를 집어 오도록 이 태그를 bust.
 */
export const INDICATOR_TRANSLATION_CACHE_TAG = 'economy:indicator-translation';

/** Redis pending-flag 키 prefix — 동일 지표명의 동시 AI 제출을 dedupe. */
export const INDICATOR_TRANSLATION_FLAG_PREFIX = 'economy:indicator-xlate';

const INDICATOR_TRANSLATION_FLAG_TTL_MINUTES = 10;

/**
 * pending-flag TTL — 이 윈도 안에 같은 지표명이 다시 miss로 들어와도 AI 재제출을
 * 건너뛴다(in-flight 또는 직전 실패 쿨다운). market-news refresh-flag 패턴 미러.
 */
export const INDICATOR_TRANSLATION_FLAG_TTL_SECONDS =
    INDICATOR_TRANSLATION_FLAG_TTL_MINUTES * SECONDS_PER_MINUTE;

/**
 * 번역 reader의 `unstable_cache` revalidate — 24h, /economy revalidate(86400)와 단일
 * TTL 공유. 신선도는 `ensureIndicatorTranslatedAction`의 revalidateTag가 책임진다.
 */
export const INDICATOR_TRANSLATION_REVALIDATE_SECONDS = SECONDS_PER_DAY;

/** poll loop 간격 — core 번역 워커 완료 대기. news 분석 패턴 미러. */
export const INDICATOR_TRANSLATION_POLL_INTERVAL_MS = 2_000;

/** poll 최대 시도 횟수 — 이 초 수(×interval) 후 timeout 경고 + 포기. */
export const INDICATOR_TRANSLATION_POLL_MAX_ATTEMPTS = 30;

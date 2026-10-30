import {
    PUBLIC_API_RATE_BUCKETS,
    PUBLIC_API_RATE_LIMITS,
    type PublicApiRateBucket,
} from '@/shared/config/publicApi';
import {
    MS_PER_SECOND,
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
    SECONDS_PER_MINUTE,
} from '@/shared/config/time';

const KEY_PREFIX = 'siglens-api:rl:';
/** 창이 끝난 뒤에도 키가 잠시 남는 여유 — 시계 오차로 창 경계에서 키가 먼저 사라지지 않게. */
const MINUTE_KEY_TTL_SECONDS = SECONDS_PER_MINUTE * 2;
const DAY_KEY_TTL_SECONDS = SECONDS_PER_DAY + SECONDS_PER_HOUR;

const RATE_LIMIT_WINDOWS = ['minute', 'day'] as const;
/** 한도를 세는 창 종류. 분 창이 먼저 소비된다. */
export type RateLimitWindow = (typeof RATE_LIMIT_WINDOWS)[number];

/** `consumeRateLimit`의 판정. 호출부가 응답 헤더와 429 본문을 만드는 데 쓴다. */
export interface RateLimitVerdict {
    allowed: boolean;
    /** 이번 응답 헤더가 가리키는 창. 허용이면 항상 `minute`, 거절이면 한도를 넘긴 창. */
    window: RateLimitWindow;
    limit: number;
    remaining: number;
    /** 창이 끝나는 시각(epoch seconds). */
    resetAtEpochSeconds: number;
    /** 거절일 때만 의미 있다: 다음 창까지 남은 초(≥1). */
    retryAfterSeconds: number;
}

/** `/api/v1/me`가 보여 주는 창 하나의 남은 한도. */
export interface RateWindowSnapshot {
    limit: number;
    remaining: number;
    resetAtEpochSeconds: number;
}

/** 버킷×창별 남은 한도. `peekRateLimits`가 만들어 `/api/v1/me`에 싣는다. */
export type RateLimitSnapshot = Record<
    PublicApiRateBucket,
    Record<RateLimitWindow, RateWindowSnapshot>
>;

/** 시각이 속한 고정 창. `id`가 카운터 키에 들어가 창이 바뀌면 키도 바뀐다. */
export interface WindowId {
    window: RateLimitWindow;
    id: number;
    resetAtEpochSeconds: number;
    ttlSeconds: number;
}

/** 버킷×창 한 칸. `w`가 그 칸의 현재 창이다. */
export interface RateSlot {
    bucket: PublicApiRateBucket;
    window: RateLimitWindow;
    w: WindowId;
}

/** UTC 기준 분·일 고정 창. 일 창은 UTC 자정에 리셋되고, 키 TTL은 창 길이보다 조금 길다. */
export function windowId(window: RateLimitWindow, now: Date): WindowId {
    const nowSec = Math.floor(now.getTime() / MS_PER_SECOND);
    const length = window === 'minute' ? SECONDS_PER_MINUTE : SECONDS_PER_DAY;
    const id = Math.floor(nowSec / length);
    return {
        window,
        id,
        resetAtEpochSeconds: (id + 1) * length,
        ttlSeconds:
            window === 'minute' ? MINUTE_KEY_TTL_SECONDS : DAY_KEY_TTL_SECONDS,
    };
}

/** Redis 카운터 키. 형식(`siglens-api:rl:<userId>:<bucket>:<m|d>:<windowId>`)이 저장된 데이터라 바꾸면 카운터가 초기화된다. */
export function counterKey(
    userId: string,
    bucket: PublicApiRateBucket,
    w: WindowId
): string {
    return `${KEY_PREFIX}${userId}:${bucket}:${w.window === 'minute' ? 'm' : 'd'}:${w.id}`;
}

function limitFor(
    bucket: PublicApiRateBucket,
    window: RateLimitWindow
): number {
    const limits = PUBLIC_API_RATE_LIMITS[bucket];
    return window === 'minute' ? limits.perMinute : limits.perDay;
}

/** 증가 직후 카운터 값으로 한 창의 허용 여부와 헤더용 수치를 계산한다. */
export function verdictFor(
    bucket: PublicApiRateBucket,
    w: WindowId,
    count: number,
    now: Date
): RateLimitVerdict {
    const limit = limitFor(bucket, w.window);
    const allowed = count <= limit;
    const retryAfterSeconds = Math.max(
        1,
        w.resetAtEpochSeconds - Math.floor(now.getTime() / MS_PER_SECOND)
    );
    return {
        allowed,
        window: w.window,
        limit,
        remaining: Math.max(0, limit - count),
        resetAtEpochSeconds: w.resetAtEpochSeconds,
        retryAfterSeconds,
    };
}

/** 모든 버킷×창 조합. `peekRateLimits`의 MGET 키 순서와 `buildRateLimitSnapshot`의 인덱스가 이 순서를 공유한다. */
export function listRateSlots(now: Date): RateSlot[] {
    return PUBLIC_API_RATE_BUCKETS.flatMap(bucket =>
        RATE_LIMIT_WINDOWS.map(window => ({
            bucket,
            window,
            w: windowId(window, now),
        }))
    );
}

/** `listRateSlots`와 같은 순서의 카운터 값(없으면 `null`)으로 남은 한도 스냅샷을 만든다. */
export function buildRateLimitSnapshot(
    slots: readonly RateSlot[],
    counts: readonly (number | string | null)[]
): RateLimitSnapshot {
    const snapshotOf = (
        bucket: PublicApiRateBucket,
        window: RateLimitWindow
    ): RateWindowSnapshot => {
        const index = slots.findIndex(
            slot => slot.bucket === bucket && slot.window === window
        );
        const limit = limitFor(bucket, window);
        return {
            limit,
            remaining: Math.max(0, limit - Number(counts[index] ?? 0)),
            resetAtEpochSeconds: slots[index].w.resetAtEpochSeconds,
        };
    };
    return {
        data: {
            minute: snapshotOf('data', 'minute'),
            day: snapshotOf('data', 'day'),
        },
        ai: {
            minute: snapshotOf('ai', 'minute'),
            day: snapshotOf('ai', 'day'),
        },
    };
}

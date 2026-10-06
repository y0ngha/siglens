import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    MS_PER_HOUR,
    MS_PER_MINUTE,
    SECONDS_PER_DAY,
} from '@/shared/config/time';

/**
 * 카드 분석에 실패한 기사의 재시도 간격(네거티브 캐시).
 *
 * 실패한 기사는 `analyzedAt`이 비어 있어 다음 방문(10분 뒤)·다음 prewarm이 다시
 * 집는다. 응답이 계속 깨지는 기사(본문이 프롬프트를 망가뜨리는 경우 등)는 그렇게
 * 영원히 10분마다 LLM 왕복을 태운다(감사 L1). 실패 횟수만큼 간격을 늘려 비용을
 * 기하급수적으로 줄이되, 일시 장애로 실패한 기사는 첫 재시도에서 회복되게 한다.
 */
const FIRST_RETRY_DELAY_MS = 30 * MS_PER_MINUTE;
const MAX_RETRY_DELAY_MS = 24 * MS_PER_HOUR;
const BACKOFF_FACTOR = 2;

/**
 * 실패 기록의 보존 기간. 뉴스 분석 창(30일)보다 짧아도 된다 — 이 기간이 지나면
 * 실패 횟수가 초기화돼 첫 간격부터 다시 시작할 뿐이다.
 */
const FAILURE_RECORD_TTL_SECONDS = 7 * SECONDS_PER_DAY;

export interface NewsCardFailureState {
    /** 연속 실패 횟수(1부터). */
    readonly attempts: number;
    /** 이 시각(epoch ms) 전에는 다시 분석하지 않는다. */
    readonly retryAfter: number;
}

function failureKey(id: string): string {
    return `news:card:fail:${id}`;
}

/** 실패 `attempts`회 뒤의 대기 간격 — 30분부터 2배씩, 24시간 상한. */
export function retryDelayMs(attempts: number): number {
    return Math.min(
        FIRST_RETRY_DELAY_MS * BACKOFF_FACTOR ** (attempts - 1),
        MAX_RETRY_DELAY_MS
    );
}

/** 직전 기록에 실패 1회를 더한 다음 상태. */
export function nextFailureState(
    previous: NewsCardFailureState | undefined,
    now: number
): NewsCardFailureState {
    const attempts = (previous?.attempts ?? 0) + 1;
    return { attempts, retryAfter: now + retryDelayMs(attempts) };
}

function isFailureState(value: unknown): value is NewsCardFailureState {
    return (
        typeof value === 'object' &&
        value !== null &&
        'attempts' in value &&
        'retryAfter' in value &&
        typeof value.attempts === 'number' &&
        typeof value.retryAfter === 'number'
    );
}

/**
 * 기사 id별 실패 기록을 읽는다. Redis 미설정·장애면 빈 맵 — 백오프 없이 예전처럼
 * 재시도한다(백오프는 비용 절감이지 정합성 장치가 아니다).
 */
export async function loadNewsCardFailures(
    ids: readonly string[]
): Promise<ReadonlyMap<string, NewsCardFailureState>> {
    const redis = getRedisClient();
    if (redis === null || ids.length === 0) return new Map();
    try {
        const values = await redis.mget<unknown[]>(...ids.map(failureKey));
        return new Map(
            ids.flatMap((id, i) => {
                const value = values[i];
                return isFailureState(value) ? [[id, value] as const] : [];
            })
        );
    } catch (error) {
        console.error('[newsCardFailureBackoff] load failed', error);
        return new Map();
    }
}

/** 실패한 기사들의 다음 상태를 기록한다. 실패해도 던지지 않는다. */
export async function recordNewsCardFailures(
    ids: readonly string[],
    previous: ReadonlyMap<string, NewsCardFailureState>,
    now: number = Date.now()
): Promise<void> {
    const redis = getRedisClient();
    if (redis === null || ids.length === 0) return;
    try {
        const pipeline = redis.pipeline();
        for (const id of ids) {
            pipeline.set(
                failureKey(id),
                nextFailureState(previous.get(id), now),
                {
                    ex: FAILURE_RECORD_TTL_SECONDS,
                }
            );
        }
        await pipeline.exec();
    } catch (error) {
        console.error('[newsCardFailureBackoff] record failed', error);
    }
}

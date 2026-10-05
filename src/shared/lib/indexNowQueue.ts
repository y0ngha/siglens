import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    MS_PER_DAY,
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
} from '@/shared/config/time';
import {
    submitIndexNow,
    type IndexNowOutcome,
    type IndexNowResult,
} from './indexNow';

/**
 * IndexNow 제출 대기열 — Redis sorted set(`indexnow:pending`).
 *
 * ## 왜 큐인가
 *
 * 프리웜이 스냅샷을 구운 **직후** 제출하면 검색엔진이 가져가는 시점에 페이지가 아직 옛 ISR
 * 렌더를 서빙하고 있을 수 있다(태그 무효화는 다음 요청 때 재생성한다). 그래서 URL마다
 * "이 시각 이후에 보내라"(`notBefore`, 페이지 revalidate 주기에서 파생 — `indexNowDelays`)를
 * 점수로 두고, 매 tick 만기가 된 것만 꺼내 보낸다. 제출이 실패(429·장애)해도 대기열에 남아
 * 다음 tick이 이어받는다 — 예전 "배치 끝에 한 번 보내고 끝"은 한 번의 실패가 그 URL의 알림을
 * 영영 잃는 것이었다.
 *
 * ## 값 정규화
 *
 * Upstash는 응답을 `JSON.parse`한다. URL은 유효한 JSON이 아니라 문자열로 남지만, 규약을 지키려고
 * (`lock.ts`의 같은 함정) 읽은 값은 항상 `String()`으로 정규화한다.
 */

export const INDEXNOW_PENDING_KEY = 'indexnow:pending';
export const INDEXNOW_BACKOFF_KEY = 'indexnow:backoff';

/** 대기열 상한 — 넘으면 가장 오래된(점수 낮은) 쪽부터 버린다. */
export const INDEXNOW_QUEUE_MAX_ENTRIES = 20_000;
/** 만기 후 이만큼 지나도 못 보낸 항목은 버린다(재시도해도 늦었다). */
const MAX_OVERDUE_MS = 7 * MS_PER_DAY;
/** 키 TTL — 쓰기가 14일간 없으면 대기열째 사라진다(청소용). */
const QUEUE_KEY_TTL_SECONDS = 14 * SECONDS_PER_DAY;
/** 한 번의 drain이 꺼내는 최대 URL 수(IndexNow 요청 하나의 상한과 같다). */
export const INDEXNOW_DRAIN_LIMIT = 10_000;

/** `Retry-After`가 없을 때 쉬는 시간. */
const DEFAULT_BACKOFF_SECONDS = SECONDS_PER_HOUR;
/** 서버가 터무니없이 긴 `Retry-After`를 줘도 하루 넘게 멈추지 않는다. */
const MAX_BACKOFF_SECONDS = SECONDS_PER_DAY;

export interface IndexNowQueueEntry {
    readonly url: string;
    /** 이 시각(epoch ms) 이후에 제출한다. */
    readonly notBeforeMs: number;
}

/**
 * 대기열에 넣는다. **이미 있는 URL은 건드리지 않는다**(`ZADD NX`) — 같은 URL이 tick마다
 * 다시 들어와도 만기가 계속 뒤로 밀리지 않는다.
 *
 * 넣은 뒤 같은 호출에서 두 가지를 정리한다: 만기 후 7일 넘은 항목 제거, 20,000개 초과분
 * (가장 오래된 순) 제거. Redis가 없으면 아무것도 하지 않는다.
 *
 * @returns 새로 들어간 URL 수.
 */
export async function enqueueIndexNow(
    entries: readonly IndexNowQueueEntry[],
    now: Date
): Promise<number> {
    const redis = getRedisClient();
    if (redis === null || entries.length === 0) return 0;

    const byUrl = new Map<string, number>();
    for (const { url, notBeforeMs } of entries) {
        if (!byUrl.has(url)) byUrl.set(url, notBeforeMs);
    }
    const [first, ...rest] = [...byUrl].map(([member, score]) => ({
        member,
        score,
    }));
    const added = await redis.zadd(
        INDEXNOW_PENDING_KEY,
        { nx: true },
        first,
        ...rest
    );

    await redis.zremrangebyscore(
        INDEXNOW_PENDING_KEY,
        '-inf',
        now.getTime() - MAX_OVERDUE_MS
    );
    const size = await redis.zcard(INDEXNOW_PENDING_KEY);
    if (size > INDEXNOW_QUEUE_MAX_ENTRIES) {
        await redis.zremrangebyrank(
            INDEXNOW_PENDING_KEY,
            0,
            size - INDEXNOW_QUEUE_MAX_ENTRIES - 1
        );
    }
    await redis.expire(INDEXNOW_PENDING_KEY, QUEUE_KEY_TTL_SECONDS);
    return added ?? 0;
}

export interface IndexNowDrainResult {
    /** 이번 drain이 보낸 URL 수(만기가 된 것). */
    readonly submitted: number;
    readonly ok: number;
    readonly failed: number;
    /** 제출을 하지 않은 사유. 제출했으면 `null`. */
    readonly skipped: 'backoff' | 'nothing-due' | null;
    readonly outcome: IndexNowOutcome | null;
}

const NOT_RUN: IndexNowDrainResult = {
    submitted: 0,
    ok: 0,
    failed: 0,
    skipped: 'nothing-due',
    outcome: null,
};

/** 400·422는 **URL 자체**가 잘못이다 — 다시 보내도 같은 답이라 대기열에서 지운다. */
function isUnsubmittableOutcome(outcome: IndexNowOutcome): boolean {
    return (
        outcome.kind === 'empty' ||
        (outcome.kind === 'rejected' &&
            (outcome.status === 400 || outcome.status === 422))
    );
}

function backoffSecondsFor(retryAfterSeconds: number | null): number {
    const requested = retryAfterSeconds ?? DEFAULT_BACKOFF_SECONDS;
    return Math.min(Math.max(requested, 1), MAX_BACKOFF_SECONDS);
}

/** 대기열 상태를 **순수 JSON 한 줄**로 남긴다(CloudWatch JSON 메트릭 필터가 읽는다). */
function logDrain(fields: {
    readonly now: Date;
    readonly due: number;
    readonly pending: number;
    readonly oldestDueAgeMs: number;
    readonly outcome: string;
    readonly status?: number | null;
}): void {
    console.log(
        JSON.stringify({
            event: 'indexnow.drain',
            outcome: fields.outcome,
            ...(fields.status === undefined ? {} : { status: fields.status }),
            due: fields.due,
            pending: fields.pending,
            oldestDueAgeMs: fields.oldestDueAgeMs,
        })
    );
}

async function readQueueState(
    now: Date
): Promise<{ pending: number; oldestDueAgeMs: number }> {
    const redis = getRedisClient();
    if (redis === null) return { pending: 0, oldestDueAgeMs: 0 };
    const [pending, oldest] = await Promise.all([
        redis.zcard(INDEXNOW_PENDING_KEY),
        redis.zrange<unknown[]>(INDEXNOW_PENDING_KEY, 0, 0, {
            withScores: true,
        }),
    ]);
    // `withScores`는 [member, score]를 평탄하게 돌려준다.
    const oldestScore = Number(oldest[1]);
    const oldestDueAgeMs =
        oldest.length >= 2 && Number.isFinite(oldestScore)
            ? Math.max(0, now.getTime() - oldestScore)
            : 0;
    return { pending, oldestDueAgeMs };
}

/**
 * 만기가 된 URL을 최대 10,000개 꺼내 제출한다. 결과에 따라 대기열을 정리한다:
 *
 *  - `ok`: 가져온 멤버 **전부** 지운다.
 *  - `rateLimited`(429): 지우지 않고 `indexnow:backoff`를 세운다(`Retry-After ?? 3600`초).
 *    backoff 중에는 제출하지 않는다.
 *  - `rejected` 400·422 / `empty`: 이 URL들은 다시 보내도 소용없다 — 지우고 에러를 남긴다.
 *  - `rejected` 403(키 검증 실패)·`transient`: 지우지 않는다. URL이 아니라 설정·상대 쪽 문제다.
 *  - `disabled`: 아무것도 하지 않는다.
 *
 * 제출이 끝난 **뒤에만** 지운다 — 5초 타임아웃에 걸려 이 함수가 중단돼도 대기열은 그대로라
 * 다음 tick이 같은 URL을 다시 보낸다(IndexNow는 같은 URL을 중복 받아도 무해하다).
 */
export async function drainIndexNow(
    now: Date,
    submit: (
        urls: readonly string[]
    ) => Promise<IndexNowResult> = submitIndexNow
): Promise<IndexNowDrainResult> {
    const redis = getRedisClient();
    if (redis === null) return NOT_RUN;

    if ((await redis.get(INDEXNOW_BACKOFF_KEY)) !== null) {
        const state = await readQueueState(now);
        logDrain({ now, due: 0, outcome: 'backoff', ...state });
        return { ...NOT_RUN, skipped: 'backoff' };
    }

    const dueRaw = await redis.zrange<unknown[]>(
        INDEXNOW_PENDING_KEY,
        0,
        now.getTime(),
        { byScore: true, offset: 0, count: INDEXNOW_DRAIN_LIMIT }
    );
    const due = dueRaw.map(String);
    if (due.length === 0) {
        const state = await readQueueState(now);
        logDrain({ now, due: 0, outcome: 'nothing-due', ...state });
        return NOT_RUN;
    }

    const result = await submit(due);
    const { outcome } = result;

    if (outcome.kind === 'ok') {
        await redis.zrem(INDEXNOW_PENDING_KEY, ...due);
    } else if (isUnsubmittableOutcome(outcome)) {
        await redis.zrem(INDEXNOW_PENDING_KEY, ...due);
        console.error('[indexnow] dropped unsubmittable URLs from queue', {
            count: due.length,
            outcome: outcome.kind,
            status: outcome.kind === 'rejected' ? outcome.status : null,
        });
    } else if (outcome.kind === 'rateLimited') {
        await redis.set(INDEXNOW_BACKOFF_KEY, '1', {
            ex: backoffSecondsFor(outcome.retryAfterSeconds),
        });
    }

    const state = await readQueueState(now);
    logDrain({
        now,
        due: due.length,
        outcome: outcome.kind,
        ...(outcome.kind === 'rejected' || outcome.kind === 'transient'
            ? { status: outcome.status }
            : {}),
        ...state,
    });
    return {
        submitted: result.submitted,
        ok: result.ok,
        failed: result.failed,
        skipped: null,
        outcome,
    };
}

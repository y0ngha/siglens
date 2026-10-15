import {
    consumeRateLimit,
    RateLimiterUnavailableError,
    type RateLimitVerdict,
} from '@/entities/siglens-api-key/server/rateLimit';
import type { PublicApiRateBucket } from '@/shared/config/publicApi';
import { apiError, API_STATUS } from './apiResponse';

/** Redis 장애 시 클라이언트가 기다릴 초. */
const LIMITER_UNAVAILABLE_RETRY_SECONDS = 30;

export function rateLimitHeaders(
    verdict: RateLimitVerdict
): Record<string, string> {
    return {
        'X-RateLimit-Limit': String(verdict.limit),
        'X-RateLimit-Remaining': String(verdict.remaining),
        'X-RateLimit-Reset': String(verdict.resetAtEpochSeconds),
    };
}

/**
 * `X-RateLimit-Limit` → `X-RateLimit-AI-Limit`. 응답의 기본 `X-RateLimit-*`는 `data` 버킷이라, 같은 응답에 `ai`
 * 버킷 상태를 실을 때 이름이 겹치지 않게 접두를 붙인다.
 */
export function prefixRateLimitHeaders(
    headers: Record<string, string>,
    bucketLabel: string
): Record<string, string> {
    return Object.fromEntries(
        Object.entries(headers).flatMap(([name, value]) =>
            name.startsWith('X-RateLimit-')
                ? [
                      [
                          `X-RateLimit-${bucketLabel}-${name.slice('X-RateLimit-'.length)}`,
                          value,
                      ],
                  ]
                : []
        )
    );
}

export type RateLimitOutcome =
    | { ok: true; headers: Record<string, string> }
    | { ok: false; response: Response };

/** `enforceRateLimit`의 응답 이전 형태 — 도구 결과(`PublicToolOutcome`)에도 같은 거절을 싣기 위해 분리했다. */
export type RateLimitDecision =
    | { ok: true; headers: Record<string, string> }
    | {
          ok: false;
          status: number;
          code: 'rate_limited' | 'rate_limiter_unavailable';
          message: string;
          headers: Record<string, string>;
      };

/**
 * 회원 단위 한도를 소비한다(키를 돌려써도 같은 카운터). 초과는 429 + `Retry-After`, 한도 저장소 장애는 503
 * `rate_limiter_unavailable`(fail-open 하지 않는다 — 외부 공개면에서는 무제한 개방보다 거절이 안전).
 */
export async function decideRateLimit(
    userId: string,
    bucket: PublicApiRateBucket
): Promise<RateLimitDecision> {
    let verdict: RateLimitVerdict;
    try {
        verdict = await consumeRateLimit(userId, bucket);
    } catch (error) {
        if (!(error instanceof RateLimiterUnavailableError)) throw error;
        return {
            ok: false,
            status: API_STATUS.serviceUnavailable,
            code: 'rate_limiter_unavailable',
            message: 'Rate limiting is temporarily unavailable. Retry shortly.',
            headers: {
                'Retry-After': String(LIMITER_UNAVAILABLE_RETRY_SECONDS),
            },
        };
    }
    const headers = rateLimitHeaders(verdict);
    if (verdict.allowed) return { ok: true, headers };
    return {
        ok: false,
        status: API_STATUS.tooManyRequests,
        code: 'rate_limited',
        message: `Rate limit exceeded (${bucket} bucket, ${verdict.window} window). Retry after ${verdict.retryAfterSeconds} seconds.`,
        headers: {
            ...headers,
            'Retry-After': String(verdict.retryAfterSeconds),
        },
    };
}

export async function enforceRateLimit(
    userId: string,
    bucket: PublicApiRateBucket
): Promise<RateLimitOutcome> {
    const decision = await decideRateLimit(userId, bucket);
    if (decision.ok) return decision;
    return {
        ok: false,
        response: apiError(decision.status, decision.code, decision.message, {
            headers: decision.headers,
        }),
    };
}

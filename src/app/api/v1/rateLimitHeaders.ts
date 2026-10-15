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

export type RateLimitOutcome =
    | { ok: true; headers: Record<string, string> }
    | { ok: false; response: Response };

/**
 * 회원 단위 한도를 소비한다(키를 돌려써도 같은 카운터). 초과는 429 + `Retry-After`, 한도 저장소 장애는 503
 * `rate_limiter_unavailable`(fail-open 하지 않는다 — 외부 공개면에서는 무제한 개방보다 거절이 안전).
 */
export async function enforceRateLimit(
    userId: string,
    bucket: PublicApiRateBucket
): Promise<RateLimitOutcome> {
    let verdict: RateLimitVerdict;
    try {
        verdict = await consumeRateLimit(userId, bucket);
    } catch (error) {
        if (!(error instanceof RateLimiterUnavailableError)) throw error;
        return {
            ok: false,
            response: apiError(
                API_STATUS.serviceUnavailable,
                'rate_limiter_unavailable',
                'Rate limiting is temporarily unavailable. Retry shortly.',
                {
                    headers: {
                        'Retry-After': String(
                            LIMITER_UNAVAILABLE_RETRY_SECONDS
                        ),
                    },
                }
            ),
        };
    }
    const headers = rateLimitHeaders(verdict);
    if (verdict.allowed) return { ok: true, headers };
    return {
        ok: false,
        response: apiError(
            API_STATUS.tooManyRequests,
            'rate_limited',
            `Rate limit exceeded (${verdict.window} window). Retry after ${verdict.retryAfterSeconds} seconds.`,
            {
                headers: {
                    ...headers,
                    'Retry-After': String(verdict.retryAfterSeconds),
                },
            }
        ),
    };
}

/**
 * `/api/analysis/stream`의 생성 한도 신호 — 서버(라우트·`heartbeatStream`)와
 * 클라이언트(`runAnalysisStream`·가입 유도 모달)가 함께 쓰는 계약.
 *
 * 서버 전용 의존이 없어야 한다. 클라이언트 번들에도 실린다.
 */

/** SSE 이벤트 이름. `done`/`error`와 같은 층위의 종료 이벤트다. */
export const RATE_LIMITED_SSE_EVENT = 'rate_limited';

/**
 * 누가 한도에 걸렸는가. 화면 반응이 갈린다 — 비회원(`guest`)은 가입 유도 모달,
 * 회원(`member`)은 "잠시 후 다시" 안내만 받는다.
 */
export type AnalysisRateLimitAudience = 'guest' | 'member';

/**
 * 왜 거절됐는가. `quota`는 한도 소진(비회원이면 가입 유도 모달), `unavailable`은
 * 한도 저장소 장애·지연이다 — 사용자가 한도를 쓴 게 아니므로 가입을 권하지 않고
 * "잠시 후 다시" 안내만 한다.
 */
export type AnalysisRateLimitReason = 'quota' | 'unavailable';

export interface AnalysisRateLimitPayload {
    readonly audience: AnalysisRateLimitAudience;
    readonly reason: AnalysisRateLimitReason;
    /** 새 생성이 다시 가능해지는 시각(epoch ms). */
    readonly retryAt: number;
}

/**
 * 한도 초과로 캐시만 조회했는데 캐시도 없을 때 라우트가 던진다.
 *
 * `heartbeatStream`이 이 타입을 보고 `error`가 아니라 `rate_limited` 이벤트로
 * 보낸다 — 실패가 아니라 정책 거절이라 `[analysis-stream] failed` 알람에도
 * 세지 않는다(그 마커가 분석 전면 장애를 잡는 유일한 신호다).
 */
export class RateLimitedStreamError extends Error {
    readonly payload: AnalysisRateLimitPayload;

    constructor(payload: AnalysisRateLimitPayload) {
        super('analysis rate limited');
        this.name = 'RateLimitedStreamError';
        this.payload = payload;
    }
}

/** `rate_limited` 프레임의 `data`가 계약 모양인지 검사한다(클라이언트 파서용). */
export function isAnalysisRateLimitPayload(
    value: unknown
): value is AnalysisRateLimitPayload {
    if (typeof value !== 'object' || value === null) return false;
    if (
        !('audience' in value) ||
        !('retryAt' in value) ||
        !('reason' in value)
    ) {
        return false;
    }
    const { audience, retryAt, reason } = value;
    return (
        (audience === 'guest' || audience === 'member') &&
        (reason === 'quota' || reason === 'unavailable') &&
        typeof retryAt === 'number' &&
        Number.isFinite(retryAt)
    );
}

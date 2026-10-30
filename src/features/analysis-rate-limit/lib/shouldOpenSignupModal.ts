import type { AnalysisRateLimitPayload } from '@/shared/lib/sse/analysisRateLimit';

/**
 * 한도 거절 알림이 가입 유도 모달을 열어야 하는지 판단한다.
 *
 * 비회원의 한도 소진(`guest` + `quota`)만 연다 — 회원과 저장소 장애(`unavailable`)는
 * 가입을 권할 이유가 없어 각 위젯의 배너 문구만 받는다. 이미 보여 준 재시도 시각보다
 * 늦은 거절만 새 한도 창으로 보고 연다(시간 한도 → 일 한도처럼).
 *
 * @param lastShownRetryAt 마지막으로 모달을 연 알림의 `retryAt`(epoch ms). 없으면 0.
 */
export function shouldOpenSignupModal(
    payload: AnalysisRateLimitPayload,
    lastShownRetryAt: number
): boolean {
    if (payload.audience !== 'guest') return false;
    if (payload.reason !== 'quota') return false;
    return payload.retryAt > lastShownRetryAt;
}

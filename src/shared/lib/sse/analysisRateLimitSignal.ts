import type { AnalysisRateLimitPayload } from '@/shared/lib/sse/analysisRateLimit';

type Listener = (payload: AnalysisRateLimitPayload) => void;

/**
 * `rate_limited` 이벤트를 받은 사실을 화면 전체에 알리는 작은 발행/구독 채널.
 *
 * 분석 스트림은 아홉 개 훅이 각자 소비하는데(`runAnalysisStream` 호출부), 가입 유도
 * 모달은 레이아웃에 **하나만** 있어야 한다 — 탭 하나에서 여러 축이 동시에 한도에
 * 걸리면 모달이 겹쳐 포커스 트랩·Esc를 다툰다. 훅마다 모달 상태를 끌어올리는 대신
 * 스트림 헬퍼가 여기에 발행하고 레이아웃의 호스트 하나가 구독한다.
 *
 * 모듈 상태라 서버에서 import돼도 무해하다 — 발행은 클라이언트에서만 일어난다.
 */
const listeners = new Set<Listener>();

export function publishAnalysisRateLimited(
    payload: AnalysisRateLimitPayload
): void {
    listeners.forEach(listener => listener(payload));
}

/** 구독하고, 해제 함수를 돌려준다. */
export function subscribeAnalysisRateLimited(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

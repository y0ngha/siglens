import { onFirstInteraction } from '@/shared/lib/onFirstInteraction';

/**
 * 비콘 타임아웃. 이 요청은 화면에 아무 영향이 없으므로 오래 매달려 있을 이유가
 * 없다 — 느린 네트워크에서 커넥션을 붙잡고 있으면 정작 필요한 요청이 밀린다.
 * 놓친 집계는 다음 페이지 로드가 다시 시도한다.
 */
const BEACON_TIMEOUT_MS = 5000;

interface BeaconRequest {
    url: string;
    /** JSON으로 직렬화해 보낸다. 없으면 본문 없이 보낸다. */
    body?: unknown;
    /**
     * 서버가 2xx로 받았을 때만 호출한다 — 하루 한 번 중복 방지 기록을 남기는 자리다.
     * 실패는 기록하지 않는다: pepper 미설정 같은 배포 오류가 다음 로드에서 다시
     * 드러나야 한다. 중복 방지가 필요 없는 비콘(퍼널 이벤트)은 생략한다.
     */
    onDelivered?: () => void;
}

/**
 * 화면에 영향 없는 집계 비콘을 보낸다. `keepalive`라 페이지를 떠나도 전송이 이어진다.
 *
 * 어떤 실패도 밖으로 던지지 않는다 — 차단기·오프라인·타임아웃으로 집계 하나
 * 놓치는 편이 화면을 깨뜨리는 것보다 낫다. `onDelivered`의 예외(스토리지 쓰기
 * 실패 등)도 같은 이유로 삼킨다.
 */
export function postBeacon({ url, body, onDelivered }: BeaconRequest): void {
    void fetch(url, {
        method: 'POST',
        keepalive: true,
        ...(body === undefined
            ? {}
            : {
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify(body),
              }),
        signal: AbortSignal.timeout(BEACON_TIMEOUT_MS),
    })
        .then(response => {
            if (!response.ok || onDelivered === undefined) return;
            try {
                onDelivered();
            } catch {
                // 기록 실패(프라이빗 모드 등)는 다음 로드에서 한 번 더 보내는 것으로 끝난다.
            }
        })
        .catch(() => {
            // 차단기·오프라인·타임아웃.
        });
}

/**
 * 방문 비콘 공통 봇 필터: 자동화 브라우저(`navigator.webdriver`)는 아예 보내지 않고,
 * 나머지는 첫 신뢰 입력 뒤에만 보낸다(`onFirstInteraction` JSDoc 참고).
 * 사람 수를 세는 것이 목적이다 — Playwright·Puppeteer는 사람이 아니다.
 *
 * `useEffect` 정리 함수로 그대로 돌려줄 수 있게 대기 리스너 해제 함수를 반환한다.
 */
export function sendOnHumanInteraction(
    send: () => void
): (() => void) | undefined {
    if (navigator.webdriver) return undefined;
    return onFirstInteraction(send);
}

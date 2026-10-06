/** PWA 설치 배너를 닫았다(또는 설치를 수락했다)는 사실을 남기는 localStorage 키. */
export const PWA_BANNER_DISMISSED_STORAGE_KEY = 'siglens:pwa-banner-dismissed';

const DISMISSED_VALUE = '1';

/**
 * 이 브라우저에서 배너를 이미 닫았는지 읽는다.
 *
 * 예전에는 닫기가 메모리 상태뿐이라 **새로고침·전체 이동마다** 첫 입력에 배너가
 * 다시 떴다. 한 번 닫은 사용자에게 같은 권유를 계속 들이미는 것은 소음이라
 * localStorage에 남겨 다시 띄우지 않는다. 설치를 수락한 경우도 같은 키로 막는다 —
 * 설치 후에도 브라우저 탭으로 들어오면 `display-mode: standalone`이 아니라
 * 배너 조건을 다시 통과하기 때문이다.
 *
 * 저장소 접근은 throw할 수 있다(Safari 프라이빗 모드, 차단된 사이트 데이터).
 * 읽기 실패는 "닫은 적 없음"으로 본다 — 최악의 경우가 예전 동작(다음 로드에
 * 다시 뜸)이라 사용자에게 오류를 보일 이유가 없다.
 */
export function readBannerDismissed(): boolean {
    try {
        return (
            localStorage.getItem(PWA_BANNER_DISMISSED_STORAGE_KEY) ===
            DISMISSED_VALUE
        );
    } catch {
        return false;
    }
}

/**
 * 배너를 닫았거나 설치를 수락했음을 기록해 다음 로드부터 띄우지 않게 한다.
 *
 * 쓰기 실패(Safari 프라이빗 모드, 차단된 사이트 데이터)는 조용히 무시한다 —
 * 이번 페이지에서만 닫힌 상태로 남고 다음 로드에 다시 뜨는 예전 동작으로 돌아갈
 * 뿐이다.
 */
export function writeBannerDismissed(): void {
    try {
        localStorage.setItem(PWA_BANNER_DISMISSED_STORAGE_KEY, DISMISSED_VALUE);
    } catch {
        // 저장할 수 없는 환경 — 이번 페이지에서만 닫힌 상태로 남는다.
    }
}

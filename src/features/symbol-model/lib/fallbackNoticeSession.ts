import { SESSION_STORAGE_MODEL_FALLBACK_NOTICE_KEY } from '@/shared/lib/storageKeys';

/**
 * "고른 모델이 일시 중단됐다" 안내를 이번 탭 세션에 띄울 차례인지 확인하고, 그렇다면 띄운
 * 것으로 기록한다. `true`면 지금 띄운다.
 *
 * 안내는 탭 세션당 한 번이다. `[symbol]` 레이아웃은 종목을 옮길 때마다 다시 마운트되므로
 * 컴포넌트 상태로 두면 종목마다 같은 토스트가 뜬다. 저장소가 막힌 브라우저(시크릿 모드
 * 등)는 `SecurityError`를 던지므로, 그때는 "아직 안 띄웠다"로 보고 띄운다 — 안내가 한 번
 * 더 뜨는 편이 아예 안 뜨는 편보다 낫다.
 */
export function claimFallbackNotice(): boolean {
    try {
        if (sessionStorage.getItem(SESSION_STORAGE_MODEL_FALLBACK_NOTICE_KEY))
            return false;
        sessionStorage.setItem(SESSION_STORAGE_MODEL_FALLBACK_NOTICE_KEY, '1');
    } catch {
        // 위 JSDoc — 저장소 차단은 띄우는 쪽으로 처리한다.
    }
    return true;
}

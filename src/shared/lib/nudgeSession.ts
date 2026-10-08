import { SESSION_STORAGE_NUDGE_SHOWN_KEY } from '@/shared/lib/storageKeys';

/**
 * 한 탭 세션에 넛지 모달은 하나만 — 비회원 가입 넛지와 회원 메일 리포트 넛지가 같은
 * 세션에서 연달아 뜨지 않게 한다. 저장소가 막혀 있으면(사파리 개인 정보 보호 등)
 * "아직 안 띄움"으로 본다: 최악의 경우 한 번 더 뜰 뿐 기능이 깨지지는 않는다.
 */
export function hasNudgeShownThisSession(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return sessionStorage.getItem(SESSION_STORAGE_NUDGE_SHOWN_KEY) === '1';
    } catch {
        return false;
    }
}

export function markNudgeShownThisSession(): void {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(SESSION_STORAGE_NUDGE_SHOWN_KEY, '1');
    } catch {
        // storage blocked — 다음 넛지가 같은 세션에 한 번 더 뜰 수 있을 뿐이다.
    }
}

import { LOCAL_STORAGE_FUNNEL_LAST_GATE_KEY } from '@/shared/lib/storageKeys';
import {
    FUNNEL_LAST_GATES,
    isOneOf,
    type FunnelLastGate,
} from './funnelEvents';

/**
 * 비회원이 마지막으로 누른 게이트·넛지를 기억한다. `trackFunnelEvent`가 `nudge_shown`·
 * `gate_clicked`마다 덮어쓰고, `FunnelSignupPing`이 가입 완료에 붙인 뒤 지운다.
 * 저장소가 막혀 있으면(프라이빗 모드) 가입 경로 하나를 모를 뿐이다 — 던지지 않는다.
 */
export function rememberLastGate(gate: FunnelLastGate): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(LOCAL_STORAGE_FUNNEL_LAST_GATE_KEY, gate);
    } catch {
        // 저장소 차단 — 가입 경로를 모르는 것으로 끝난다.
    }
}

/** 카탈로그 밖의 값(조작·구버전)은 null로 접는다 — 라우트 검증과 같은 집합을 쓴다. */
export function readLastGate(): FunnelLastGate | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(
            LOCAL_STORAGE_FUNNEL_LAST_GATE_KEY
        );
        return isOneOf(FUNNEL_LAST_GATES, raw) ? raw : null;
    } catch {
        return null;
    }
}

export function clearLastGate(): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(LOCAL_STORAGE_FUNNEL_LAST_GATE_KEY);
    } catch {
        // 저장소 차단 — 다음 가입에 옛 값이 한 번 더 붙을 수 있을 뿐이다.
    }
}

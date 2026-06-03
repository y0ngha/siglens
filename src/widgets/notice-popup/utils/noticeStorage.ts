/** "다시 보지 않기"한 공지 ID 목록을 담는 localStorage 키. */
export const DISMISSED_NOTICES_STORAGE_KEY = 'siglens_dismissed_notices';

/** 영구 dismiss된 공지 ID 목록을 반환한다. 손상/비정상 데이터는 빈 배열로 graceful fallback. */
export function loadDismissedNoticeIds(): string[] {
    /* v8 ignore next */
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(DISMISSED_NOTICES_STORAGE_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((id): id is string => typeof id === 'string');
    } catch {
        return [];
    }
}

/** 공지 ID를 dismiss 목록에 추가한다(중복 무시). 저장 실패(quota 등)는 조용히 무시. */
export function dismissNotice(id: string): void {
    /* v8 ignore next */
    if (typeof window === 'undefined') return;
    try {
        const current = loadDismissedNoticeIds();
        if (current.includes(id)) return;
        localStorage.setItem(
            DISMISSED_NOTICES_STORAGE_KEY,
            JSON.stringify([...current, id])
        );
    } catch (err) {
        // localStorage 용량 초과 등 — 조용히 무시하되 디버깅 가능하도록 warn
        console.warn('[dismissNotice] storage write failed:', err);
    }
}

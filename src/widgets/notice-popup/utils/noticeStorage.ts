/**
 * "다시 보지 않기"한 공지 ID 목록을 담는 localStorage 키.
 * 키 이름에 포맷 버전을 넣는다 — 값의 모양을 바꿀 때 키를 올리면 낡은 데이터를
 * 파싱할 필요 자체가 없어진다(구 키는 아래 LEGACY_KEYS에서 읽기만 지원).
 */
export const DISMISSED_NOTICES_STORAGE_KEY = 'siglens_dismissed_notices_v1';

/** 버전 없는 구 키. 읽기만 지원하고 새로 쓰지 않는다(자연 소멸). */
const LEGACY_DISMISSED_NOTICES_KEYS = ['siglens_dismissed_notices'] as const;

/**
 * 저장 포맷 버전. 값의 모양을 바꿀 때 올린다 — 읽기 쪽이 모르는 버전을 만나면
 * 빈 목록으로 시작하므로(폐기) 낡은 브라우저 데이터가 깨진 상태로 해석되지 않는다.
 * v1 이전에는 문자열 배열을 그대로 저장했다(버전 없음) — 그 형태도 계속 읽어 준다.
 */
const DISMISSED_NOTICES_VERSION = 1;

interface DismissedNoticesPayload {
    v: number;
    ids: string[];
}

function toIds(value: unknown): string[] {
    if (Array.isArray(value)) {
        // 레거시(버전 없는 배열) 포맷.
        return value.filter((id): id is string => typeof id === 'string');
    }
    if (typeof value !== 'object' || value === null) return [];
    const payload = value as Partial<DismissedNoticesPayload>;
    if (payload.v !== DISMISSED_NOTICES_VERSION) return [];
    if (!Array.isArray(payload.ids)) return [];
    return payload.ids.filter((id): id is string => typeof id === 'string');
}

/** 영구 dismiss된 공지 ID 목록을 반환한다. 손상/비정상 데이터는 빈 배열로 graceful fallback. */
export function loadDismissedNoticeIds(): string[] {
    /* v8 ignore next */
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(DISMISSED_NOTICES_STORAGE_KEY);
        if (raw) return toIds(JSON.parse(raw));
        for (const legacyKey of LEGACY_DISMISSED_NOTICES_KEYS) {
            const legacyRaw = localStorage.getItem(legacyKey);
            if (legacyRaw) return toIds(JSON.parse(legacyRaw));
        }
        return [];
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
        const payload: DismissedNoticesPayload = {
            v: DISMISSED_NOTICES_VERSION,
            ids: [...current, id],
        };
        localStorage.setItem(
            DISMISSED_NOTICES_STORAGE_KEY,
            JSON.stringify(payload)
        );
    } catch (err) {
        // localStorage 용량 초과 등 — 조용히 무시하되 디버깅 가능하도록 warn
        console.warn('[dismissNotice] storage write failed:', err);
    }
}

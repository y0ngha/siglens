import { API_KEY_NAME_MAX_LENGTH } from '@/shared/config/publicApi';

const FIRST_PRINTABLE_CODE = 0x20;
const DELETE_CODE = 0x7f;

/** 줄바꿈·탭 등 제어 문자는 목록 표시와 로그를 깨뜨린다. */
function hasControlCharacter(value: string): boolean {
    return [...value].some(char => {
        const code = char.charCodeAt(0);
        return code < FIRST_PRINTABLE_CODE || code === DELETE_CODE;
    });
}

/**
 * 키 이름을 검증한다: 타입 → 길이 → 내용 순(SERVER.md#SA-7). 공백만인 값은 서버에서도
 * 거절한다(클라이언트 trim에 기대지 않는다, SERVER.md#SA-9). 통과하면 trim한 이름.
 */
export function validateKeyName(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    if (raw.length > API_KEY_NAME_MAX_LENGTH * 2) return null;
    const name = raw.trim();
    if (name.length === 0 || name.length > API_KEY_NAME_MAX_LENGTH) return null;
    return hasControlCharacter(name) ? null : name;
}

import {
    API_KEY_PREFIX,
    API_KEY_RANDOM_LENGTH,
} from '@/shared/config/publicApi';

const WELL_FORMED_KEY = new RegExp(
    `^${API_KEY_PREFIX}[0-9A-Za-z]{${API_KEY_RANDOM_LENGTH}}$`
);
const BEARER_PATTERN = /^Bearer[ ]+(\S+)$/i;

/** 형식이 맞지 않는 값은 해시·DB 조회 전에 거절한다. */
export function isWellFormedApiKey(value: string): boolean {
    return WELL_FORMED_KEY.test(value);
}

/**
 * `Authorization` 헤더에서 Bearer 토큰만 꺼낸다. 헤더가 없거나 형식이 다르거나
 * 키 형식이 아니면 `null` — 호출부는 사유를 구분하지 않고 같은 401을 낸다.
 */
export function parseBearerApiKey(header: string | null): string | null {
    if (header === null) return null;
    const token = BEARER_PATTERN.exec(header.trim())?.[1];
    if (token === undefined || !isWellFormedApiKey(token)) return null;
    return token;
}

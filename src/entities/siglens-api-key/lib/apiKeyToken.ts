import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import {
    API_KEY_DISPLAY_PREFIX_LENGTH,
    API_KEY_PREFIX,
    API_KEY_RANDOM_LENGTH,
} from '@/shared/config/publicApi';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
/** 256보다 작은 62의 최대 배수 — 이 이상의 바이트는 버려 modulo bias를 없앤다. */
const BASE62_REJECT_FROM = 248;
/** 거절 표본 때문에 모자랄 때를 대비해 한 번에 넉넉히 뽑는 바이트 수의 배수. */
const OVERSAMPLE_FACTOR = 2;

const WELL_FORMED_KEY = new RegExp(
    `^${API_KEY_PREFIX}[0-9A-Za-z]{${API_KEY_RANDOM_LENGTH}}$`
);
const BEARER_PATTERN = /^Bearer[ ]+(\S+)$/i;

export interface GeneratedApiKey {
    /** 사용자에게 한 번만 보여 주는 원문. 저장하지 않는다. */
    rawKey: string;
    keyPrefix: string;
    keyHash: string;
}

function randomBase62(length: number): string {
    let out = '';
    while (out.length < length) {
        const bytes = randomBytes(length * OVERSAMPLE_FACTOR);
        for (const byte of bytes) {
            if (byte >= BASE62_REJECT_FROM) continue;
            out += BASE62[byte % BASE62.length];
            if (out.length === length) break;
        }
    }
    return out;
}

/**
 * sha256 hex. 키가 고엔트로피 무작위라 느린 해시(bcrypt)가 필요 없고, 결정적이라
 * 해시로 곧바로 조회할 수 있다(`entities/auth/lib/tokenUtils.ts`의 이메일 토큰과 같은 방식).
 */
export function hashApiKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
}

export function generateApiKey(): GeneratedApiKey {
    const rawKey = `${API_KEY_PREFIX}${randomBase62(API_KEY_RANDOM_LENGTH)}`;
    return {
        rawKey,
        keyPrefix: rawKey.slice(0, API_KEY_DISPLAY_PREFIX_LENGTH),
        keyHash: hashApiKey(rawKey),
    };
}

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

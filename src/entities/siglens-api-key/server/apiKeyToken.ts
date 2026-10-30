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

/** 발급 직후 한 번만 존재하는 키 묶음. 원문은 저장하지 않고 접두·해시만 DB에 간다. */
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

/**
 * 새 API 키를 만든다. CSPRNG 바이트에서 modulo bias 없이 base62 문자를 뽑는다.
 * 발급 액션만 부르며 `lib/`가 아닌 곳에 두는 것은 난수 의존 때문이다.
 */
export function generateApiKey(): GeneratedApiKey {
    const rawKey = `${API_KEY_PREFIX}${randomBase62(API_KEY_RANDOM_LENGTH)}`;
    return {
        rawKey,
        keyPrefix: rawKey.slice(0, API_KEY_DISPLAY_PREFIX_LENGTH),
        keyHash: hashApiKey(rawKey),
    };
}

// OAuth 토큰·LLM API 키 암호화의 단일 구현. `@y0ngha/siglens-core`는 이 헬퍼를 공개 API로 내보내지 않는다.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTE_LENGTH = 12;
const SEPARATOR = ':';
const PARTS_COUNT = 3;

/** AES-256-GCM으로 평문 토큰을 암호화해 `iv:ciphertext:tag`(각각 base64) 문자열로 돌려준다. IV는 호출마다 새로 뽑는다. */
export function encryptToken(plaintext: string, keyHex: string): string {
    const key = Buffer.from(keyHex, 'hex');
    const iv = randomBytes(IV_BYTE_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
        iv.toString('base64'),
        ciphertext.toString('base64'),
        tag.toString('base64'),
    ].join(SEPARATOR);
}

/** {@link encryptToken}이 만든 문자열을 복호화한다. 형식 오류·키 불일치·변조(GCM 태그 불일치)는 던지지 않고 `null`을 돌려준다. */
export function decryptToken(encrypted: string, keyHex: string): string | null {
    const parts = encrypted.split(SEPARATOR);
    const [ivPart, ciphertextPart, tagPart] = parts;
    if (
        parts.length !== PARTS_COUNT ||
        ivPart === undefined ||
        ciphertextPart === undefined ||
        tagPart === undefined
    ) {
        return null;
    }

    try {
        const key = Buffer.from(keyHex, 'hex');
        const iv = Buffer.from(ivPart, 'base64');
        const ciphertext = Buffer.from(ciphertextPart, 'base64');
        const tag = Buffer.from(tagPart, 'base64');
        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]).toString('utf8');
    } catch {
        return null;
    }
}

const ENCRYPTION_KEY_BYTE_LENGTH = 32;

/** 32바이트 AES-256 hex 키를 검증한다. 유효하면 원문 hex를, 없거나 길이가 다르면 `null`을 돌려준다. */
function tryParseEncryptionKey(raw: string | undefined): string | null {
    if (!raw) {
        return null;
    }
    const bytes = Buffer.from(raw, 'hex');
    return bytes.length === ENCRYPTION_KEY_BYTE_LENGTH ? raw : null;
}

/** 환경변수 `OAUTH_TOKEN_ENCRYPTION_KEY`를 읽어 검증한다. 유효한 hex 키 또는 `null`. */
export function tryReadEncryptionKey(): string | null {
    return tryParseEncryptionKey(process.env.OAUTH_TOKEN_ENCRYPTION_KEY);
}

/** OAuth 토큰 암호화 키를 읽되 없거나 유효하지 않으면 던진다. 토큰을 조용히 `null`로 저장하면 안 되는 경로(OAuth 가입 시 토큰 저장)용. */
export function requireOauthTokenEncryptionKey(): string {
    const encryptionKey = tryReadEncryptionKey();
    if (encryptionKey === null) {
        throw new Error(
            'OAUTH_TOKEN_ENCRYPTION_KEY environment variable is required for OAuth token encryption'
        );
    }
    return encryptionKey;
}

/** 환경변수 `LLM_API_KEY_ENCRYPTION_KEY`를 읽어 검증한다. 유효한 hex 키 또는 `null`. */
export function tryReadLlmApiKeyEncryptionKey(): string | null {
    return tryParseEncryptionKey(process.env.LLM_API_KEY_ENCRYPTION_KEY);
}

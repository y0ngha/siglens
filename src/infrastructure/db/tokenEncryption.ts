// Deliberate duplicate of @y0ngha/siglens-core's pre-Phase-6 internal helpers (tokenEncryption.ts: encryptToken/decryptToken/tryParseEncryptionKey + db/config.ts tryReadEncryptionKey).
// Core no longer ships these (not part of its public API); siglens owns the canonical copy here as of Phase 6 scope-realignment.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTE_LENGTH = 12;
const SEPARATOR = ':';
const PARTS_COUNT = 3;

/** @internal Encrypt a plain-text OAuth token using AES-256-GCM; returns `iv:ciphertext:tag` base64 string. */
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

/** @internal Decrypt a token produced by {@link encryptToken}; returns plaintext, or null when decryption fails. */
export function decryptToken(encrypted: string, keyHex: string): string | null {
    const parts = encrypted.split(SEPARATOR);
    if (parts.length !== PARTS_COUNT) {
        return null;
    }

    try {
        const key = Buffer.from(keyHex, 'hex');
        const iv = Buffer.from(parts[0]!, 'base64');
        const ciphertext = Buffer.from(parts[1]!, 'base64');
        const tag = Buffer.from(parts[2]!, 'base64');
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

/** @internal Validate a 32-byte AES-256 hex key; returns the raw hex string when valid, or null when absent or incorrectly sized. */
function tryParseEncryptionKey(raw: string | undefined): string | null {
    if (!raw) {
        return null;
    }
    const bytes = Buffer.from(raw, 'hex');
    return bytes.length === ENCRYPTION_KEY_BYTE_LENGTH ? raw : null;
}

/** @internal Read and validate the OAuth token encryption key from the environment; returns the hex key string when valid, or null otherwise. */
export function tryReadEncryptionKey(): string | null {
    return tryParseEncryptionKey(process.env.OAUTH_TOKEN_ENCRYPTION_KEY);
}

/** @internal Read and validate the LLM API key encryption key from the environment; returns the hex key string when valid, or null otherwise. */
export function tryReadLlmApiKeyEncryptionKey(): string | null {
    return tryParseEncryptionKey(process.env.LLM_API_KEY_ENCRYPTION_KEY);
}

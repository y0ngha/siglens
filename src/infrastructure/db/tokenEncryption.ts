/**
 * Deliberate duplicate of OAuth token encryption helpers from `@y0ngha/siglens-core`.
 *
 * Source files in the core repo:
 * - `src/infrastructure/db/tokenEncryption.ts` (`encryptToken`, `decryptToken`,
 *   `tryParseEncryptionKey`)
 * - `src/infrastructure/db/config.ts` (`tryReadEncryptionKey`)
 *
 * These helpers are not part of the core library's public API surface, so they
 * cannot be imported from `@y0ngha/siglens-core`. Phase 6 of the scope-realignment
 * refactor will move the DB layer fully into siglens and dedupe this file.
 *
 * Sync obligation: if the core copy changes, update this file to match.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTE_LENGTH = 12;
const SEPARATOR = ':';
const PARTS_COUNT = 3;

/**
 * @internal Encrypt a plain-text OAuth token using AES-256-GCM.
 * Returns a `iv:ciphertext:tag` base64 string suitable for database storage.
 */
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

/**
 * @internal Decrypt a token produced by {@link encryptToken}.
 * Returns the plaintext, or null when decryption fails (wrong key, corrupted data).
 */
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

/**
 * @internal Validate a 32-byte AES-256 key supplied as a hex string. Returns
 * the raw hex string when the decoded byte length is exactly 32 bytes, or
 * `null` when absent or incorrectly sized.
 */
function tryParseEncryptionKey(raw: string | undefined): string | null {
    if (!raw) {
        return null;
    }
    const bytes = Buffer.from(raw, 'hex');
    return bytes.length === ENCRYPTION_KEY_BYTE_LENGTH ? raw : null;
}

/**
 * @internal Read and validate the OAuth token encryption key from the environment.
 * Returns the hex key string when valid, or null when absent or incorrectly sized.
 */
export function tryReadEncryptionKey(): string | null {
    return tryParseEncryptionKey(process.env.OAUTH_TOKEN_ENCRYPTION_KEY);
}

/**
 * @internal Read and validate the LLM API key encryption key from the
 * environment. Returns the hex key string when valid, or null when absent or
 * incorrectly sized.
 */
export function tryReadLlmApiKeyEncryptionKey(): string | null {
    return tryParseEncryptionKey(process.env.LLM_API_KEY_ENCRYPTION_KEY);
}

import { randomBytes } from 'node:crypto';
import {
    decryptToken,
    encryptToken,
    requireOauthTokenEncryptionKey,
    tryReadEncryptionKey,
    tryReadLlmApiKeyEncryptionKey,
} from '@/shared/db/tokenEncryption';

/** Generate a valid 32-byte hex key for AES-256. */
function generateKeyHex(): string {
    return randomBytes(32).toString('hex');
}

describe('encryptToken / decryptToken', () => {
    const keyHex = generateKeyHex();

    describe('라운드 트립', () => {
        it('암호화 후 복호화하면 원본을 반환한다', () => {
            const plaintext = 'my-secret-oauth-token';
            const encrypted = encryptToken(plaintext, keyHex);
            expect(decryptToken(encrypted, keyHex)).toBe(plaintext);
        });

        it('빈 문자열도 라운드 트립이 성공한다', () => {
            const encrypted = encryptToken('', keyHex);
            expect(decryptToken(encrypted, keyHex)).toBe('');
        });

        it('유니코드(한국어)도 라운드 트립이 성공한다', () => {
            const plaintext = '안녕하세요 토큰 암호화 테스트';
            const encrypted = encryptToken(plaintext, keyHex);
            expect(decryptToken(encrypted, keyHex)).toBe(plaintext);
        });

        it('긴 문자열도 라운드 트립이 성공한다', () => {
            const plaintext = 'a'.repeat(10_000);
            const encrypted = encryptToken(plaintext, keyHex);
            expect(decryptToken(encrypted, keyHex)).toBe(plaintext);
        });
    });

    describe('랜덤 IV', () => {
        it('동일한 평문을 두 번 암호화하면 서로 다른 암호문을 생성한다', () => {
            const plaintext = 'same-text';
            const encrypted1 = encryptToken(plaintext, keyHex);
            const encrypted2 = encryptToken(plaintext, keyHex);
            expect(encrypted1).not.toBe(encrypted2);
        });
    });

    describe('암호문 형식', () => {
        it("':'으로 구분된 3개의 base64 파트를 반환한다", () => {
            const encrypted = encryptToken('test', keyHex);
            const parts = encrypted.split(':');
            expect(parts).toHaveLength(3);
            for (const part of parts) {
                // base64 문자만 포함하는지 확인
                expect(part).toMatch(/^[A-Za-z0-9+/=]+$/);
            }
        });
    });

    describe('잘못된 입력에 대한 복호화', () => {
        it("':'가 없는 문자열에 대해 null을 반환한다", () => {
            expect(decryptToken('not-valid-format', keyHex)).toBeNull();
        });

        it('파트가 2개뿐인 문자열에 대해 null을 반환한다', () => {
            expect(decryptToken('part1:part2', keyHex)).toBeNull();
        });

        it('파트가 4개인 문자열에 대해 null을 반환한다', () => {
            expect(decryptToken('a:b:c:d', keyHex)).toBeNull();
        });

        it('손상된 암호문에 대해 null을 반환한다', () => {
            const encrypted = encryptToken('test', keyHex);
            const parts = encrypted.split(':');
            // tag를 손상시킨다
            const corrupted = [
                parts[0],
                parts[1],
                'AAAAAAAAAAAAAAAAAAAAAA==',
            ].join(':');
            expect(decryptToken(corrupted, keyHex)).toBeNull();
        });
    });

    describe('잘못된 키로 복호화', () => {
        it('다른 키로 복호화하면 null을 반환한다', () => {
            const otherKey = generateKeyHex();
            const encrypted = encryptToken('secret', keyHex);
            expect(decryptToken(encrypted, otherKey)).toBeNull();
        });
    });
});

describe('tryReadEncryptionKey', () => {
    const originalEnv = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.OAUTH_TOKEN_ENCRYPTION_KEY = originalEnv;
        } else {
            delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
        }
    });

    it('유효한 32바이트 hex 키가 있으면 키를 반환한다', () => {
        const validKey = generateKeyHex();
        process.env.OAUTH_TOKEN_ENCRYPTION_KEY = validKey;
        expect(tryReadEncryptionKey()).toBe(validKey);
    });

    it('환경변수가 없으면 null을 반환한다', () => {
        delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
        expect(tryReadEncryptionKey()).toBeNull();
    });

    it('빈 문자열이면 null을 반환한다', () => {
        process.env.OAUTH_TOKEN_ENCRYPTION_KEY = '';
        expect(tryReadEncryptionKey()).toBeNull();
    });

    it('길이가 틀린 hex 키면 null을 반환한다', () => {
        // 16바이트(32 hex chars) — AES-256에는 부족
        process.env.OAUTH_TOKEN_ENCRYPTION_KEY =
            randomBytes(16).toString('hex');
        expect(tryReadEncryptionKey()).toBeNull();
    });
});

describe('requireOauthTokenEncryptionKey', () => {
    const originalEnv = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.OAUTH_TOKEN_ENCRYPTION_KEY = originalEnv;
        } else {
            delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
        }
    });

    it('유효한 키가 있으면 키를 반환한다', () => {
        const validKey = generateKeyHex();
        process.env.OAUTH_TOKEN_ENCRYPTION_KEY = validKey;
        expect(requireOauthTokenEncryptionKey()).toBe(validKey);
    });

    it('키가 없으면 에러를 던진다', () => {
        delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
        expect(() => requireOauthTokenEncryptionKey()).toThrow(
            'OAUTH_TOKEN_ENCRYPTION_KEY'
        );
    });

    it('잘못된 길이의 키면 에러를 던진다', () => {
        process.env.OAUTH_TOKEN_ENCRYPTION_KEY = 'tooshort';
        expect(() => requireOauthTokenEncryptionKey()).toThrow(
            'OAUTH_TOKEN_ENCRYPTION_KEY'
        );
    });
});

describe('tryReadLlmApiKeyEncryptionKey', () => {
    const originalEnv = process.env.LLM_API_KEY_ENCRYPTION_KEY;

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.LLM_API_KEY_ENCRYPTION_KEY = originalEnv;
        } else {
            delete process.env.LLM_API_KEY_ENCRYPTION_KEY;
        }
    });

    it('유효한 32바이트 hex 키가 있으면 키를 반환한다', () => {
        const validKey = generateKeyHex();
        process.env.LLM_API_KEY_ENCRYPTION_KEY = validKey;
        expect(tryReadLlmApiKeyEncryptionKey()).toBe(validKey);
    });

    it('환경변수가 없으면 null을 반환한다', () => {
        delete process.env.LLM_API_KEY_ENCRYPTION_KEY;
        expect(tryReadLlmApiKeyEncryptionKey()).toBeNull();
    });

    it('길이가 틀린 hex 키면 null을 반환한다', () => {
        process.env.LLM_API_KEY_ENCRYPTION_KEY = 'abc123';
        expect(tryReadLlmApiKeyEncryptionKey()).toBeNull();
    });
});

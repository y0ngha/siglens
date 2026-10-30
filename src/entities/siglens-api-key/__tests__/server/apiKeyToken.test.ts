import { createHash } from 'node:crypto';
import { isWellFormedApiKey } from '@/entities/siglens-api-key/lib/apiKeyToken';
import {
    generateApiKey,
    hashApiKey,
} from '@/entities/siglens-api-key/server/apiKeyToken';
import {
    API_KEY_DISPLAY_PREFIX_LENGTH,
    API_KEY_PREFIX,
    API_KEY_RANDOM_LENGTH,
} from '@/shared/config/publicApi';

describe('generateApiKey', () => {
    it('slk_ 접두 + base62 40자 형식의 원문을 만든다', () => {
        const { rawKey } = generateApiKey();
        expect(rawKey).toMatch(/^slk_[0-9A-Za-z]{40}$/);
        expect(rawKey).toHaveLength(
            API_KEY_PREFIX.length + API_KEY_RANDOM_LENGTH
        );
    });

    it('해시는 원문의 sha256 hex이고 원문이 아니다', () => {
        const { rawKey, keyHash } = generateApiKey();
        expect(keyHash).toBe(createHash('sha256').update(rawKey).digest('hex'));
        expect(keyHash).not.toContain(rawKey);
        expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('표시용 접두는 원문의 앞 10자이고 인증에는 못 쓴다', () => {
        const { rawKey, keyPrefix } = generateApiKey();
        expect(keyPrefix).toBe(rawKey.slice(0, API_KEY_DISPLAY_PREFIX_LENGTH));
        expect(keyPrefix).toHaveLength(10);
        expect(isWellFormedApiKey(keyPrefix)).toBe(false);
    });

    it('호출마다 다른 키를 만든다', () => {
        const keys = new Set(
            Array.from({ length: 50 }, () => generateApiKey().rawKey)
        );
        expect(keys.size).toBe(50);
    });

    it('문자 분포가 base62 전체에 퍼진다(편향된 고정 문자 방지)', () => {
        const chars = new Set(
            Array.from({ length: 200 }, () => generateApiKey().rawKey.slice(4))
                .join('')
                .split('')
        );
        expect(chars.size).toBeGreaterThan(55);
    });
});

describe('hashApiKey', () => {
    it('같은 입력은 같은 해시, 다른 입력은 다른 해시', () => {
        expect(hashApiKey('slk_a')).toBe(hashApiKey('slk_a'));
        expect(hashApiKey('slk_a')).not.toBe(hashApiKey('slk_b'));
    });

    it('저장된 해시와 맞도록 sha256 hex 형식을 유지한다', () => {
        expect(hashApiKey('slk_a')).toBe(
            'd77d4ae59b70c17e3487a821ad021694ff52b124a988f987ace0e427953c70b1'
        );
    });
});

import type { Redis } from '@upstash/redis';
import type { EmailMessage } from '../types';
import {
    E2eEmailDispatcher,
    buildEmailDebugKey,
    extractEmailDebugRecord,
} from '../E2eEmailDispatcher';
import { buildEmailVerificationEmail } from '@/entities/email-token/templates/emailVerificationEmail';
import { buildPasswordResetEmail } from '@/entities/email-token/templates/passwordResetEmail';

describe('buildEmailDebugKey', () => {
    it('recipient을 prefix와 결합한 키를 만든다', () => {
        expect(buildEmailDebugKey('user@example.com')).toBe(
            'email_debug:user@example.com'
        );
    });
});

describe('extractEmailDebugRecord', () => {
    it('인증 이메일에서 6자리 코드를 추출한다 (token 없음)', () => {
        const message = buildEmailVerificationEmail({
            to: 'verify@test.com',
            code: '482917',
        });
        const record = extractEmailDebugRecord(message);
        expect(record.code).toBe('482917');
        expect(record.token).toBeUndefined();
        expect(record.raw).toBe(message.text);
    });

    it('비밀번호 재설정 이메일에서 token을 추출한다 (code 없음)', () => {
        const message = buildPasswordResetEmail({
            email: 'reset@test.com',
            token: 'raw-reset-token-123',
        });
        const record = extractEmailDebugRecord(message);
        expect(record.token).toBe('raw-reset-token-123');
        expect(record.code).toBeUndefined();
        expect(record.raw).toBe(message.text);
    });

    it('URL 인코딩된 reset token을 디코드해 추출한다', () => {
        // The reset link encodes the token via encodeURIComponent; the extractor
        // must decode it back to the raw value the store expects.
        const token = 'a+b/c=d&e';
        const message = buildPasswordResetEmail({
            email: 'reset2@test.com',
            token,
        });
        const record = extractEmailDebugRecord(message);
        expect(record.token).toBe(token);
    });

    it('라벨이 없어도 standalone 6자리 코드를 fallback으로 추출한다', () => {
        const message: EmailMessage = {
            to: 't@t.com',
            subject: 's',
            text: '당신의 코드는 123456 입니다',
            html: '<p>123456</p>',
        };
        const record = extractEmailDebugRecord(message);
        expect(record.code).toBe('123456');
    });

    it('코드도 token도 없으면 raw만 채운다', () => {
        const message: EmailMessage = {
            to: 't@t.com',
            subject: 's',
            text: 'no secrets here',
            html: '<p>nothing</p>',
        };
        const record = extractEmailDebugRecord(message);
        expect(record.code).toBeUndefined();
        expect(record.token).toBeUndefined();
        expect(record.raw).toBe('no secrets here');
    });
});

describe('E2eEmailDispatcher', () => {
    interface RedisStub {
        redis: Redis;
        setMock: ReturnType<typeof vi.fn>;
    }

    function createRedisStub(): RedisStub {
        const setMock = vi.fn().mockResolvedValue('OK');
        const redis = { set: setMock } as unknown as Redis;
        return { redis, setMock };
    }

    it('인증 이메일 발송 시 코드를 debug 키에 쓰고 true를 반환한다', async () => {
        const { redis, setMock } = createRedisStub();
        const dispatcher = new E2eEmailDispatcher(redis);
        const message = buildEmailVerificationEmail({
            to: 'verify@test.com',
            code: '654321',
        });

        await expect(dispatcher.sendEmail(message)).resolves.toBe(true);
        expect(setMock).toHaveBeenCalledWith(
            'email_debug:verify@test.com',
            expect.objectContaining({ code: '654321', raw: message.text }),
            expect.objectContaining({ ex: expect.any(Number) })
        );
    });

    it('재설정 이메일 발송 시 token을 debug 키에 쓴다', async () => {
        const { redis, setMock } = createRedisStub();
        const dispatcher = new E2eEmailDispatcher(redis);
        const message = buildPasswordResetEmail({
            email: 'reset@test.com',
            token: 'tok-789',
        });

        await dispatcher.sendEmail(message);
        expect(setMock).toHaveBeenCalledWith(
            'email_debug:reset@test.com',
            expect.objectContaining({ token: 'tok-789' }),
            expect.anything()
        );
    });
});

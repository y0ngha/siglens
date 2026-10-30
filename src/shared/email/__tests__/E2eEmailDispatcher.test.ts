import type { Redis } from '@upstash/redis';
import { E2eEmailDispatcher } from '../E2eEmailDispatcher';
import { buildEmailVerificationEmail } from '@/entities/email-token/templates/emailVerificationEmail';
import { buildPasswordResetEmail } from '@/entities/email-token/templates/passwordResetEmail';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';

const tMail = catalogTranslator('entities.email-token.email');

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
            t: tMail,
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
            t: tMail,
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

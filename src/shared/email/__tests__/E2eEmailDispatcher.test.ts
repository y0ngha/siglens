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
        incrMock: ReturnType<typeof vi.fn>;
        expireMock: ReturnType<typeof vi.fn>;
    }

    function createRedisStub(): RedisStub {
        const setMock = vi.fn().mockResolvedValue('OK');
        const incrMock = vi.fn().mockResolvedValue(1);
        const expireMock = vi.fn().mockResolvedValue(1);
        const redis = {
            set: setMock,
            incr: incrMock,
            expire: expireMock,
        } as unknown as Redis;
        return { redis, setMock, incrMock, expireMock };
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

    const plainMessage = {
        to: 'alert@test.com',
        subject: 's',
        html: '<p>h</p>',
        text: 'body',
    };

    it('발송마다 수신자별 카운터를 올리고 만료를 건다', async () => {
        const { redis, incrMock, expireMock } = createRedisStub();
        const dispatcher = new E2eEmailDispatcher(redis);

        await dispatcher.sendEmail(plainMessage);

        expect(incrMock).toHaveBeenCalledWith(
            'email_debug_count:alert@test.com'
        );
        expect(expireMock).toHaveBeenCalledWith(
            'email_debug_count:alert@test.com',
            expect.any(Number)
        );
    });

    it('멱등 키는 처음 본 것만 NX로 기록하고 메일을 남긴다', async () => {
        const { redis, setMock, incrMock } = createRedisStub();
        const dispatcher = new E2eEmailDispatcher(redis);

        await expect(
            dispatcher.sendEmail({ ...plainMessage, idempotencyKey: 'k/1/d' })
        ).resolves.toBe(true);

        expect(setMock).toHaveBeenCalledWith(
            'email_debug_idem:k/1/d',
            '1',
            expect.objectContaining({ nx: true, ex: expect.any(Number) })
        );
        expect(setMock).toHaveBeenCalledWith(
            'email_debug:alert@test.com',
            expect.objectContaining({ raw: 'body' }),
            expect.anything()
        );
        expect(incrMock).toHaveBeenCalledTimes(1);
    });

    it('이미 본 멱등 키는 true를 돌려주지만 기록도 카운터도 바꾸지 않는다', async () => {
        const { redis, setMock, incrMock } = createRedisStub();
        setMock.mockResolvedValueOnce(null);
        const dispatcher = new E2eEmailDispatcher(redis);

        await expect(
            dispatcher.sendEmail({ ...plainMessage, idempotencyKey: 'k/1/d' })
        ).resolves.toBe(true);

        expect(setMock).toHaveBeenCalledTimes(1);
        expect(incrMock).not.toHaveBeenCalled();
    });

    it('멱등 키가 없으면 NX 표지를 쓰지 않는다', async () => {
        const { redis, setMock } = createRedisStub();
        const dispatcher = new E2eEmailDispatcher(redis);

        await dispatcher.sendEmail(plainMessage);

        expect(setMock).not.toHaveBeenCalledWith(
            expect.stringContaining('email_debug_idem'),
            expect.anything(),
            expect.anything()
        );
    });
});

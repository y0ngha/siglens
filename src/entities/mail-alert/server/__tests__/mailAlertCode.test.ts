import { createHash } from 'node:crypto';
import { hashEmailToken } from '@/entities/auth/lib/tokenUtils';
import type {
    EmailTokenPurpose,
    EmailTokenStore,
    EmailTokenValue,
} from '@/entities/email-token/types';
import { MAIL_ALERT_RATE_LIMITS } from '@/entities/mail-alert/lib/mailAlertConstants';
import {
    confirmMailAlertCode,
    requestMailAlertCode,
    type MailAlertCodeDeps,
    type MailAlertRateLimiter,
} from '@/entities/mail-alert/server/mailAlertCode';
import type { EmailMessage } from '@/shared/email/types';

const IP_HASH = 'iphash-1';
const EMAIL = 'someone@example.com';
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const EMAIL_HASH = sha(EMAIL);
const RECORD_KEY = `mail_alert:${EMAIL_HASH}`;
const ATTEMPTS_KEY = `mail-alert:verify:e:${EMAIL_HASH}`;

/** 메모리 토큰 저장소 — (용도, 키)가 키라 용도가 다르면 서로 보이지 않는다. `getCalls`로 비교 횟수를 센다. */
function memoryTokens(): EmailTokenStore & {
    readonly entries: Map<string, EmailTokenValue>;
    readonly getCalls: { count: number };
} {
    const entries = new Map<string, EmailTokenValue>();
    const getCalls = { count: 0 };
    const keyOf = (purpose: EmailTokenPurpose, key: string) =>
        `${purpose}:${key}`;
    return {
        entries,
        getCalls,
        async set(purpose, key, value) {
            entries.set(keyOf(purpose, key), value);
        },
        async get(purpose, key) {
            getCalls.count += 1;
            // 실제 Redis처럼 한 번 쉬어, 동시 요청이 서로 끼어들 틈을 준다.
            await Promise.resolve();
            return entries.get(keyOf(purpose, key)) ?? null;
        },
        async delete(purpose, key) {
            entries.delete(keyOf(purpose, key));
        },
        async consume(purpose, key) {
            const value = entries.get(keyOf(purpose, key)) ?? null;
            entries.delete(keyOf(purpose, key));
            return value;
        },
    };
}

/** 고정 창 한도의 흉내: 호출 즉시(동기로) 카운트를 올리고 `count <= limit`이면 허용 — 진짜 헬퍼와 같은 규칙. */
function countingLimiter(): {
    readonly rateLimit: MailAlertRateLimiter;
    readonly resetCounter: (key: string) => Promise<void>;
    /** 지금까지 센 키들(호출 순서). */
    readonly keys: () => string[];
    readonly counts: Map<string, number>;
} {
    const counts = new Map<string, number>();
    const rateLimit = vi.fn<MailAlertRateLimiter>(async ({ key, limit }) => {
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        return count <= limit;
    });
    return {
        keys: () => rateLimit.mock.calls.map(([rule]) => rule.key),
        counts,
        rateLimit,
        resetCounter: async key => {
            counts.delete(key);
        },
    };
}

function makeDeps(overrides: Partial<MailAlertCodeDeps> = {}) {
    const tokens = memoryTokens();
    const sendEmail = vi.fn().mockResolvedValue(true);
    const limiter = countingLimiter();
    const deps: MailAlertCodeDeps = {
        emailTokens: tokens,
        emailDispatcher: { sendEmail },
        rateLimit: limiter.rateLimit,
        resetCounter: limiter.resetCounter,
        ipHash: IP_HASH,
        buildMessage: (to, code): EmailMessage => ({
            to,
            subject: 'code',
            html: code,
            text: code,
        }),
        ...overrides,
    };
    return { deps, tokens, sendEmail, limiter };
}

/** 대기 중인 코드의 평문은 저장소에 없으므로, 마지막 메일 본문에서 읽는다. */
function sentCode(sendEmail: ReturnType<typeof vi.fn>): string {
    const message = sendEmail.mock.calls
        .filter(
            (call): call is [EmailMessage] => typeof call[0]?.text === 'string'
        )
        .at(-1)?.[0];
    return message?.text ?? '';
}

const wrongOf = (code: string) => (code === '000000' ? '000001' : '000000');

describe('requestMailAlertCode', () => {
    it('형식이 틀린 주소는 한도도 쓰지 않고 거절한다', async () => {
        const { deps, sendEmail, limiter } = makeDeps();

        await expect(requestMailAlertCode('nope', deps)).resolves.toEqual({
            status: 'invalid_email',
        });
        expect(limiter.keys()).toEqual([]);
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('코드 기록은 mail_alert 용도에 주소 해시를 키로 저장한다(평문 주소는 Redis 키에 없다)', async () => {
        const { deps, tokens, sendEmail } = makeDeps();

        const result = await requestMailAlertCode(
            `  ${EMAIL.toUpperCase()} `,
            deps
        );

        expect(result).toEqual({ status: 'code_sent', email: EMAIL });
        expect([...tokens.entries.keys()]).toEqual([RECORD_KEY]);
        expect(RECORD_KEY).not.toContain(EMAIL);
        const code = sentCode(sendEmail);
        expect(code).toMatch(/^\d{6}$/);
        expect(tokens.entries.get(RECORD_KEY)).toEqual({
            status: 'pending',
            tokenHash: hashEmailToken(code),
        });
        expect(sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({ to: EMAIL })
        );
    });

    it('한도 키에는 주소·IP 원문이 아니라 해시만 담긴다', async () => {
        const { deps, limiter } = makeDeps();

        await requestMailAlertCode(EMAIL, deps);

        expect(limiter.keys()).toEqual([
            `mail-alert:code:ip:${IP_HASH}`,
            `mail-alert:code:e:${EMAIL_HASH}`,
        ]);
        limiter.keys().forEach(key => expect(key).not.toContain(EMAIL));
    });

    it('새 코드를 보내면 그 주소의 확인 시도 카운터를 0으로 되돌린다', async () => {
        const { deps, limiter } = makeDeps();
        limiter.counts.set(ATTEMPTS_KEY, 5);

        await requestMailAlertCode(EMAIL, deps);

        expect(limiter.counts.has(ATTEMPTS_KEY)).toBe(false);
    });

    it('주소당 시간당 3회를 넘으면 rate_limited이고 네 번째는 보내지 않는다', async () => {
        const { deps, sendEmail } = makeDeps();
        const { limit } = MAIL_ALERT_RATE_LIMITS.codePerEmail;

        const results = await Array.from({ length: limit + 1 }).reduce<
            Promise<string[]>
        >(
            async previous => [
                ...(await previous),
                (await requestMailAlertCode(EMAIL, deps)).status,
            ],
            Promise.resolve([])
        );

        expect(results).toEqual([
            ...Array.from({ length: limit }, () => 'code_sent'),
            'rate_limited',
        ]);
        expect(sendEmail).toHaveBeenCalledTimes(limit);
    });

    it('IP당 시간당 한도를 넘으면 주소가 달라도 rate_limited이고, 막힌 요청은 주소 칸을 쓰지 않는다', async () => {
        const { deps, sendEmail, limiter } = makeDeps();
        const { limit } = MAIL_ALERT_RATE_LIMITS.codePerIp;
        const addresses = Array.from(
            { length: limit + 1 },
            (_, index) => `user${index}@example.com`
        );

        const statuses = await addresses.reduce<Promise<string[]>>(
            async (previous, address) => [
                ...(await previous),
                (await requestMailAlertCode(address, deps)).status,
            ],
            Promise.resolve([])
        );

        expect(statuses.at(-1)).toBe('rate_limited');
        expect(sendEmail).toHaveBeenCalledTimes(limit);
        expect(limiter.keys()).not.toContain(
            `mail-alert:code:e:${sha(addresses.at(-1) ?? '')}`
        );
    });

    it('메일 발송이 거절되면 unavailable이다(오지 않을 코드를 기다리게 하지 않는다)', async () => {
        const { deps } = makeDeps({
            emailDispatcher: { sendEmail: vi.fn().mockResolvedValue(false) },
        });

        await expect(requestMailAlertCode(EMAIL, deps)).resolves.toEqual({
            status: 'unavailable',
        });
    });

    it('발송이 던져도 던지지 않고 unavailable이며 로그에 질의 값이 없다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { deps } = makeDeps({
            emailDispatcher: {
                sendEmail: vi.fn().mockRejectedValue(new Error('smtp')),
            },
        });

        await expect(requestMailAlertCode(EMAIL, deps)).resolves.toEqual({
            status: 'unavailable',
        });
        expect(warn).toHaveBeenCalledWith(
            '[requestMailAlertCode] emailDispatcher.sendEmail failed',
            expect.anything()
        );
        warn.mockRestore();
    });
});

describe('confirmMailAlertCode', () => {
    async function pendingCode(
        context: ReturnType<typeof makeDeps>
    ): Promise<string> {
        await requestMailAlertCode(EMAIL, context.deps);
        return sentCode(context.sendEmail);
    }

    it('맞는 코드는 verified이고 대기 코드를 꺼내 지운다(verified 마커를 쓰지 않는다)', async () => {
        const context = makeDeps();
        const code = await pendingCode(context);

        await expect(
            confirmMailAlertCode(EMAIL, ` ${code} `, context.deps)
        ).resolves.toEqual({ status: 'verified', email: EMAIL });
        expect([...context.tokens.entries.keys()]).toEqual([]);
    });

    it('같은 코드는 한 번만 통한다', async () => {
        const context = makeDeps();
        const code = await pendingCode(context);

        await confirmMailAlertCode(EMAIL, code, context.deps);

        await expect(
            confirmMailAlertCode(EMAIL, code, context.deps)
        ).resolves.toEqual({ status: 'expired' });
    });

    it('틀린 코드는 wrong_code이고 대기 코드를 지우지 않는다', async () => {
        const context = makeDeps();
        const code = await pendingCode(context);

        await expect(
            confirmMailAlertCode(EMAIL, wrongOf(code), context.deps)
        ).resolves.toEqual({ status: 'wrong_code' });
        expect(context.tokens.entries.has(RECORD_KEY)).toBe(true);
    });

    it('다섯 번까지는 비교하고, 여섯 번째는 맞는 코드여도 비교 없이 too_many이며 대기 코드를 지운다', async () => {
        const context = makeDeps();
        const code = await pendingCode(context);
        const { limit } = MAIL_ALERT_RATE_LIMITS.wrongCodePerEmail;

        const first = await Array.from({ length: limit }).reduce<
            Promise<string[]>
        >(
            async previous => [
                ...(await previous),
                (await confirmMailAlertCode(EMAIL, wrongOf(code), context.deps))
                    .status,
            ],
            Promise.resolve([])
        );
        expect(first).toEqual(
            Array.from({ length: limit }, () => 'wrong_code')
        );
        expect(context.tokens.getCalls.count).toBe(limit);

        await expect(
            confirmMailAlertCode(EMAIL, code, context.deps)
        ).resolves.toEqual({ status: 'too_many' });
        expect(context.tokens.getCalls.count).toBe(limit);
        expect(context.tokens.entries.has(RECORD_KEY)).toBe(false);
    });

    it('동시에 들어온 시도도 한도 밖에서는 비교되지 않는다(비교 전에 센다)', async () => {
        const context = makeDeps();
        const code = await pendingCode(context);
        const { limit } = MAIL_ALERT_RATE_LIMITS.wrongCodePerEmail;

        const outcomes = await Promise.all(
            Array.from({ length: limit * 3 }, () =>
                confirmMailAlertCode(EMAIL, wrongOf(code), context.deps)
            )
        );

        // 비교 뒤에 세던 옛 순서라면 모두가 같은 카운터를 보고 비교(get)까지 갔다.
        expect(context.tokens.getCalls.count).toBeLessThanOrEqual(limit);
        expect(outcomes.filter(o => o.status === 'too_many')).toHaveLength(
            limit * 2
        );
    });

    it('새 코드를 받으면 시도 횟수가 처음부터다', async () => {
        const context = makeDeps();
        const first = await pendingCode(context);
        await Promise.all(
            Array.from({ length: 6 }, () =>
                confirmMailAlertCode(EMAIL, wrongOf(first), context.deps)
            )
        );

        const second = await pendingCode(context);

        await expect(
            confirmMailAlertCode(EMAIL, second, context.deps)
        ).resolves.toEqual({ status: 'verified', email: EMAIL });
    });

    it('IP당 확인 시도 한도를 넘으면 주소 카운터를 쓰지 않고 rate_limited다', async () => {
        const context = makeDeps();
        const code = await pendingCode(context);
        const { limit } = MAIL_ALERT_RATE_LIMITS.confirmPerIp;
        context.limiter.counts.set(`mail-alert:verify:ip:${IP_HASH}`, limit);

        await expect(
            confirmMailAlertCode(EMAIL, code, context.deps)
        ).resolves.toEqual({ status: 'rate_limited' });
        expect(context.limiter.counts.has(ATTEMPTS_KEY)).toBe(false);
        expect(context.tokens.entries.has(RECORD_KEY)).toBe(true);
    });

    it('저장돼 있는 verified 값은 받아들이지 않는다(틀린 코드여도 만료로 처리, 통과 아님)', async () => {
        const { deps, tokens } = makeDeps();
        await tokens.set(
            'mail_alert',
            EMAIL_HASH,
            {
                status: 'verified',
                tokenHash: 'a'.repeat(64),
                bindingHash: 'b'.repeat(64),
            },
            60
        );

        await expect(
            confirmMailAlertCode(EMAIL, '123456', deps)
        ).resolves.toEqual({ status: 'expired' });
    });

    it('대기 코드가 없으면 expired다', async () => {
        const { deps } = makeDeps();

        await expect(
            confirmMailAlertCode(EMAIL, '123456', deps)
        ).resolves.toEqual({ status: 'expired' });
    });

    it('가입 인증 코드는 알림 메일 확인에 쓸 수 없다', async () => {
        const { deps, tokens } = makeDeps();
        await tokens.set(
            'email_verification',
            EMAIL,
            { status: 'pending', tokenHash: hashEmailToken('123456') },
            60
        );

        await expect(
            confirmMailAlertCode(EMAIL, '123456', deps)
        ).resolves.toEqual({ status: 'expired' });
    });

    it('꺼내는 순간 다른 요청이 이미 가져갔으면 verified가 아니다(같은 코드 동시 사용)', async () => {
        const context = makeDeps();
        const code = await pendingCode(context);
        const stolen: EmailTokenStore = {
            ...context.tokens,
            consume: async () => null,
        };

        await expect(
            confirmMailAlertCode(EMAIL, code, {
                ...context.deps,
                emailTokens: stolen,
            })
        ).resolves.toEqual({ status: 'expired' });
    });

    it('형식이 틀린 주소는 invalid_email이다', async () => {
        const { deps } = makeDeps();

        await expect(
            confirmMailAlertCode('nope', '123456', deps)
        ).resolves.toEqual({ status: 'invalid_email' });
    });
});

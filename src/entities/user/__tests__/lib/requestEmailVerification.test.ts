import { requestEmailVerification } from '@/entities/user/lib/requestEmailVerification';
import type { RequestEmailVerificationDependencies } from '@/entities/user/lib/authUseCaseTypes';
import { EMAIL_VERIFICATION_PENDING_TTL_SECONDS } from '@/entities/user/lib/authUseCaseConstants';
import { hashEmailToken } from '@/entities/session/lib/tokenUtils';
import type { EmailMessage } from '@/shared/email/types';

function makeBuildMessage(): {
    buildMessage: (code: string) => EmailMessage;
    calls: string[];
} {
    const calls: string[] = [];
    return {
        buildMessage: (code: string) => {
            calls.push(code);
            return {
                to: 'user@example.com',
                subject: 'Verify your email',
                html: `<p>Code: <strong>${code}</strong></p>`,
                text: `Code: ${code}`,
            };
        },
        calls,
    };
}

function makeDependencies(options?: {
    sendEmailResolves?: boolean;
    sendEmailThrows?: boolean;
}): {
    dependencies: RequestEmailVerificationDependencies;
    setToken: ReturnType<typeof jest.fn>;
    sendEmail: ReturnType<typeof jest.fn>;
} {
    const setToken = jest.fn().mockResolvedValue(undefined);
    const sendEmailThrows = options?.sendEmailThrows ?? false;
    const sendEmailResolves = options?.sendEmailResolves ?? true;
    const sendEmail = sendEmailThrows
        ? jest.fn().mockRejectedValue(new Error('smtp'))
        : jest.fn().mockResolvedValue(sendEmailResolves);

    return {
        dependencies: {
            emailTokens: {
                set: setToken,
                get: jest.fn(),
                delete: jest.fn(),
                consume: jest.fn(),
            },
            emailDispatcher: { sendEmail },
        },
        setToken,
        sendEmail,
    };
}

describe('requestEmailVerification', () => {
    it('returns codeIssued false for an invalid email without dispatching', async () => {
        const { dependencies, setToken, sendEmail } = makeDependencies();
        const { buildMessage, calls } = makeBuildMessage();

        const result = await requestEmailVerification(
            { email: 'not-an-email' },
            dependencies,
            { buildMessage }
        );

        expect(result).toEqual({
            ok: true,
            codeIssued: false,
            emailDispatched: false,
        });
        expect(setToken).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
        expect(calls).toHaveLength(0);
    });

    it('persists a hashed pending code, dispatches email, and reports emailDispatched true', async () => {
        const { dependencies, setToken, sendEmail } = makeDependencies();
        const { buildMessage, calls } = makeBuildMessage();

        const result = await requestEmailVerification(
            { email: ' Tester@Example.COM ' },
            dependencies,
            { buildMessage }
        );

        expect(result.ok).toBe(true);
        expect(result.codeIssued).toBe(true);
        expect(result.emailDispatched).toBe(true);

        expect(calls).toHaveLength(1);
        const code = calls[0]!;
        expect(code).toMatch(/^\d{6}$/);

        expect(setToken).toHaveBeenCalledTimes(1);
        const [purpose, email, value, ttl] = setToken.mock.calls[0] as [
            string,
            string,
            { status: 'pending'; tokenHash: string },
            number,
        ];
        expect(purpose).toBe('email_verification');
        expect(email).toBe('tester@example.com');
        expect(value.status).toBe('pending');
        expect(value.tokenHash).toBe(hashEmailToken(code));
        expect(ttl).toBe(EMAIL_VERIFICATION_PENDING_TTL_SECONDS);

        expect(sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({ subject: 'Verify your email' })
        );
    });

    it('reports emailDispatched false when the dispatcher resolves false', async () => {
        const { dependencies } = makeDependencies({ sendEmailResolves: false });
        const { buildMessage } = makeBuildMessage();

        const result = await requestEmailVerification(
            { email: 'user@example.com' },
            dependencies,
            { buildMessage }
        );

        expect(result).toEqual({
            ok: true,
            codeIssued: true,
            emailDispatched: false,
        });
    });

    it('keeps codeIssued true and reports emailDispatched false when the dispatcher throws', async () => {
        const { dependencies, setToken } = makeDependencies({
            sendEmailThrows: true,
        });
        const { buildMessage } = makeBuildMessage();

        const result = await requestEmailVerification(
            { email: 'user@example.com' },
            dependencies,
            { buildMessage }
        );

        expect(setToken).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            ok: true,
            codeIssued: true,
            emailDispatched: false,
        });
    });
});

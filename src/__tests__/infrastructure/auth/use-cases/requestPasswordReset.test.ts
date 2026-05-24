import { requestPasswordReset } from '@/infrastructure/auth/use-cases/requestPasswordReset';
import type { RequestPasswordResetDependencies } from '@/infrastructure/auth/use-cases/types';
import { PASSWORD_RESET_TTL_SECONDS } from '@/infrastructure/auth/use-cases/constants';
import { hashEmailToken } from '@/infrastructure/auth/tokenUtils';
import type { EmailMessage } from '@/shared/email/types';
import type { EmailAuthUserRecord } from '@/shared/db/types';

const createdAt = new Date('2026-04-27T00:00:00.000Z');
const updatedAt = new Date('2026-04-27T00:00:01.000Z');

const user: EmailAuthUserRecord = {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'existing-password-hash',
    name: null,
    avatarUrl: null,
    tier: 'free',
    emailVerified: true,
    createdAt,
    updatedAt,
};

function makeBuildMessage(): {
    buildMessage: (token: string) => EmailMessage;
    calls: string[];
} {
    const calls: string[] = [];
    return {
        buildMessage: (token: string) => {
            calls.push(token);
            return {
                to: 'user@example.com',
                subject: 'Reset your password',
                html: `<a href="https://example.com/reset?token=${token}">Reset</a>`,
                text: `Reset: https://example.com/reset?token=${token}`,
            };
        },
        calls,
    };
}

function makeDependencies(options?: {
    user?: EmailAuthUserRecord | null;
    sendEmailResolves?: boolean;
    sendEmailThrows?: boolean;
}): {
    dependencies: RequestPasswordResetDependencies;
    findEmailAuthUserByEmail: ReturnType<typeof jest.fn>;
    setToken: ReturnType<typeof jest.fn>;
    sendEmail: ReturnType<typeof jest.fn>;
} {
    const foundUser = options && 'user' in options ? options.user : user;
    const findEmailAuthUserByEmail = jest.fn().mockResolvedValue(foundUser);
    const setToken = jest.fn().mockResolvedValue(undefined);

    const sendEmailThrows = options?.sendEmailThrows ?? false;
    const sendEmailResolves = options?.sendEmailResolves ?? true;
    const sendEmail = sendEmailThrows
        ? jest.fn().mockRejectedValue(new Error('smtp error'))
        : jest.fn().mockResolvedValue(sendEmailResolves);

    return {
        dependencies: {
            users: { findEmailAuthUserByEmail },
            emailTokens: {
                set: setToken,
                get: jest.fn(),
                delete: jest.fn(),
                consume: jest.fn(),
            },
            emailDispatcher: { sendEmail },
        },
        findEmailAuthUserByEmail,
        setToken,
        sendEmail,
    };
}

describe('requestPasswordReset', () => {
    it('returns tokenIssued false for an invalid email without repository access', async () => {
        const { dependencies, findEmailAuthUserByEmail, setToken, sendEmail } =
            makeDependencies();
        const { buildMessage, calls } = makeBuildMessage();

        const result = await requestPasswordReset(
            { email: 'not-an-email' },
            dependencies,
            { buildMessage }
        );

        expect(result).toEqual({
            ok: true,
            tokenIssued: false,
            emailDispatched: false,
        });
        expect(findEmailAuthUserByEmail).not.toHaveBeenCalled();
        expect(setToken).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
        expect(calls).toHaveLength(0);
    });

    it('returns tokenIssued false when no account matches the email', async () => {
        const { dependencies, findEmailAuthUserByEmail, setToken, sendEmail } =
            makeDependencies({ user: null });
        const { buildMessage } = makeBuildMessage();

        const result = await requestPasswordReset(
            { email: ' Missing@Example.COM ' },
            dependencies,
            { buildMessage }
        );

        expect(result).toEqual({
            ok: true,
            tokenIssued: false,
            emailDispatched: false,
        });
        expect(findEmailAuthUserByEmail).toHaveBeenCalledWith(
            'missing@example.com'
        );
        expect(setToken).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('returns tokenIssued false for OAuth-only accounts without a password hash', async () => {
        const { dependencies, setToken, sendEmail } = makeDependencies({
            user: { ...user, passwordHash: null },
        });
        const { buildMessage } = makeBuildMessage();

        const result = await requestPasswordReset(
            { email: 'user@example.com' },
            dependencies,
            { buildMessage }
        );

        expect(result).toEqual({
            ok: true,
            tokenIssued: false,
            emailDispatched: false,
        });
        expect(setToken).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('persists a token hash, dispatches the email, and reports emailDispatched true', async () => {
        const { dependencies, setToken, sendEmail } = makeDependencies();
        const { buildMessage, calls } = makeBuildMessage();

        const result = await requestPasswordReset(
            { email: ' User@Example.COM ' },
            dependencies,
            { buildMessage }
        );

        expect(result.ok).toBe(true);
        expect(result.tokenIssued).toBe(true);
        expect(result.emailDispatched).toBe(true);

        expect(setToken).toHaveBeenCalledTimes(1);
        const [purpose, email, value, ttl] = setToken.mock.calls[0] as [
            string,
            string,
            { status: 'pending'; tokenHash: string },
            number,
        ];
        expect(purpose).toBe('password_reset');
        expect(email).toBe('user@example.com');
        expect(value.status).toBe('pending');
        expect(value.tokenHash).toBe(hashEmailToken(calls[0]!));
        expect(ttl).toBe(PASSWORD_RESET_TTL_SECONDS);

        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'user@example.com',
                subject: 'Reset your password',
            })
        );
    });

    it('reports emailDispatched false when the dispatcher resolves false', async () => {
        const { dependencies } = makeDependencies({ sendEmailResolves: false });
        const { buildMessage } = makeBuildMessage();

        const result = await requestPasswordReset(
            { email: 'user@example.com' },
            dependencies,
            { buildMessage }
        );

        expect(result).toEqual({
            ok: true,
            tokenIssued: true,
            emailDispatched: false,
        });
    });

    it('keeps tokenIssued true and reports emailDispatched false when the dispatcher throws', async () => {
        const { dependencies, setToken } = makeDependencies({
            sendEmailThrows: true,
        });
        const { buildMessage } = makeBuildMessage();

        const result = await requestPasswordReset(
            { email: 'user@example.com' },
            dependencies,
            { buildMessage }
        );

        expect(setToken).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            ok: true,
            tokenIssued: true,
            emailDispatched: false,
        });
    });
});

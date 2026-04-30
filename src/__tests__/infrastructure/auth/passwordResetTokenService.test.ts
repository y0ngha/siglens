import {
    passwordResetTokenGenerator,
    passwordResetTokenHasher,
} from '@/infrastructure/auth/passwordResetTokenService';

describe('passwordResetTokenService', () => {
    describe('passwordResetTokenGenerator', () => {
        it('base64url 문자열을 반환한다', async () => {
            const token =
                await passwordResetTokenGenerator.generatePasswordResetToken();
            expect(typeof token).toBe('string');
            expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
        });

        it('호출할 때마다 서로 다른 값을 반환한다', async () => {
            const a =
                await passwordResetTokenGenerator.generatePasswordResetToken();
            const b =
                await passwordResetTokenGenerator.generatePasswordResetToken();
            expect(a).not.toBe(b);
        });

        it('256bit entropy에 해당하는 길이(43자 이상)를 가진다', async () => {
            const token =
                await passwordResetTokenGenerator.generatePasswordResetToken();
            expect(token.length).toBeGreaterThanOrEqual(43);
        });
    });

    describe('passwordResetTokenHasher', () => {
        it('동일 입력에 대해 동일한 sha256 해시를 반환한다', async () => {
            const token = 'abc123';
            const a =
                await passwordResetTokenHasher.hashPasswordResetToken(token);
            const b =
                await passwordResetTokenHasher.hashPasswordResetToken(token);
            expect(a).toBe(b);
        });

        it('서로 다른 입력에 대해 다른 해시를 반환한다', async () => {
            const a =
                await passwordResetTokenHasher.hashPasswordResetToken('abc');
            const b =
                await passwordResetTokenHasher.hashPasswordResetToken('abd');
            expect(a).not.toBe(b);
        });

        it('64자 hex 문자열(sha256)을 반환한다', async () => {
            const hash =
                await passwordResetTokenHasher.hashPasswordResetToken('xyz');
            expect(hash).toMatch(/^[a-f0-9]{64}$/);
        });
    });
});

import {
    loginEmailIpKey,
    loginEmailKey,
    loginIpDayKey,
    loginIpKey,
    passwordResetConfirmIpKey,
    passwordResetCooldownKey,
    passwordResetEmailDayKey,
    passwordResetEmailHourKey,
    passwordResetIpDayKey,
    passwordResetIpHourKey,
} from '@/entities/auth/lib/authRateLimitKeys';
import { hashEmailToken } from '@/entities/auth/lib/tokenUtils';

describe('authRateLimitKeys', () => {
    it('pins the key layout the operators and the unlock path rely on', () => {
        expect(passwordResetIpHourKey('ip')).toBe('auth:reset-req:ip:h:ip');
        expect(passwordResetIpDayKey('ip')).toBe('auth:reset-req:ip:d:ip');
        expect(passwordResetCooldownKey('e')).toBe('auth:reset-req:e:cd:e');
        expect(passwordResetEmailHourKey('e')).toBe('auth:reset-req:e:h:e');
        expect(passwordResetEmailDayKey('e')).toBe('auth:reset-req:e:d:e');
        expect(passwordResetConfirmIpKey('ip')).toBe(
            'auth:reset-confirm:ip:ip'
        );
        expect(loginIpKey('ip')).toBe('auth:login:ip:ip');
        expect(loginIpDayKey('ip')).toBe('auth:login:ip:d:ip');
        expect(loginEmailKey('e')).toBe('auth:login:e:e');
    });

    it('derives the pair key from both hashes, so another IP gets another key', () => {
        expect(loginEmailIpKey('e', 'ip')).toBe(
            `auth:login:ei:${hashEmailToken('e:ip')}`
        );
        expect(loginEmailIpKey('e', 'ip')).not.toBe(
            loginEmailIpKey('e', 'other')
        );
    });
});

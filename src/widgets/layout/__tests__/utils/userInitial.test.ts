import { getUserInitial } from '../../utils/userInitial';

const base = {
    email: 'alice@example.com',
    tier: 'free' as const,
    avatarUrl: null,
};

describe('getUserInitial', () => {
    it('이름이 있으면 이름의 첫 글자를 대문자로', () => {
        expect(getUserInitial({ ...base, name: 'yongha' })).toBe('Y');
    });

    it('이름이 null이면 이메일의 첫 글자', () => {
        expect(getUserInitial({ ...base, name: null })).toBe('A');
    });

    it('이름이 빈 문자열이면 이메일의 첫 글자', () => {
        expect(getUserInitial({ ...base, name: '' })).toBe('A');
    });
});

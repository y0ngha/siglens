import { localePathToLogin } from '../localePathToLogin';

describe('localePathToLogin', () => {
    it('ko는 접두사 없는 로그인 경로에 돌아올 경로를 인코딩해 단다', () => {
        expect(localePathToLogin('ko', '/account')).toBe(
            '/login?next=%2Faccount'
        );
    });

    it('비-ko는 로그인 경로와 돌아올 경로 둘 다 로케일 접두사를 단다', () => {
        expect(localePathToLogin('en', '/email-report')).toBe(
            '/en/login?next=%2Fen%2Femail-report'
        );
    });

    it('중첩 경로도 그대로 돌아올 경로로 싣는다', () => {
        expect(localePathToLogin('ja', '/account/delete')).toBe(
            '/ja/login?next=%2Fja%2Faccount%2Fdelete'
        );
    });
});

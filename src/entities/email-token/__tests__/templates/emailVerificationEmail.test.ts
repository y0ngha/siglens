import { buildEmailVerificationEmail } from '@/entities/email-token/templates/emailVerificationEmail';

describe('buildEmailVerificationEmail', () => {
    const baseInput = {
        to: 'user@example.com',
        code: '482917',
    };

    it('수신자 이메일을 to에 그대로 설정한다', () => {
        const message = buildEmailVerificationEmail(baseInput);
        expect(message.to).toBe('user@example.com');
    });

    it('subject는 한국어로 회원가입 인증을 명시한다', () => {
        const message = buildEmailVerificationEmail(baseInput);
        expect(message.subject).toContain('회원가입 인증');
    });

    it('html과 text 모두에 인증 코드가 포함된다', () => {
        const message = buildEmailVerificationEmail(baseInput);
        expect(message.html).toContain('482917');
        expect(message.text).toContain('482917');
    });

    it('text는 안내 문구를 포함한다', () => {
        const message = buildEmailVerificationEmail(baseInput);
        expect(message.text).toContain('인증 코드');
        expect(message.text).toContain('30분');
    });
});

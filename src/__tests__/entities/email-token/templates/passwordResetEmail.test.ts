import {
    DEFAULT_SITE_URL,
    buildPasswordResetEmail,
} from '@/entities/email-token';

describe('buildPasswordResetEmail', () => {
    const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;

    afterEach(() => {
        process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
    });

    const baseInput = {
        email: 'user@example.com',
        token: 'raw-token-123',
    };

    it('수신자 이메일을 to에 그대로 설정한다', () => {
        const message = buildPasswordResetEmail(baseInput);
        expect(message.to).toBe('user@example.com');
    });

    it('subject는 한국어로 비밀번호 재설정을 명시한다', () => {
        const message = buildPasswordResetEmail(baseInput);
        expect(message.subject).toContain('비밀번호 재설정');
    });

    it('NEXT_PUBLIC_SITE_URL 미설정 시 기본 도메인으로 reset URL을 생성한다', () => {
        delete process.env.NEXT_PUBLIC_SITE_URL;
        const message = buildPasswordResetEmail(baseInput);
        const expectedUrl = `${DEFAULT_SITE_URL}/reset-password?email=user%40example.com&token=raw-token-123`;
        expect(message.html).toContain(expectedUrl);
        expect(message.text).toContain(expectedUrl);
    });

    it('NEXT_PUBLIC_SITE_URL 설정 시 해당 도메인으로 reset URL을 생성한다', () => {
        process.env.NEXT_PUBLIC_SITE_URL = 'https://custom.example.com';
        const message = buildPasswordResetEmail(baseInput);
        const expectedUrl =
            'https://custom.example.com/reset-password?email=user%40example.com&token=raw-token-123';
        expect(message.html).toContain(expectedUrl);
        expect(message.text).toContain(expectedUrl);
    });

    it('NEXT_PUBLIC_SITE_URL 끝의 슬래시는 중복하지 않는다', () => {
        process.env.NEXT_PUBLIC_SITE_URL = 'https://custom.example.com/';
        const message = buildPasswordResetEmail(baseInput);
        expect(message.html).not.toContain('//reset-password');
        expect(message.html).toContain(
            'https://custom.example.com/reset-password'
        );
    });

    it('token에 URL 예약 문자가 있어도 이스케이프된다', () => {
        delete process.env.NEXT_PUBLIC_SITE_URL;
        const message = buildPasswordResetEmail({
            ...baseInput,
            token: 'a+b/c=',
        });
        expect(message.html).toContain('token=a%2Bb%2Fc%3D');
        expect(message.text).toContain('token=a%2Bb%2Fc%3D');
    });

    it('html은 자체 안내 문구와 본인 미요청 안내를 포함한다', () => {
        const message = buildPasswordResetEmail(baseInput);
        expect(message.html).toContain('새 비밀번호 설정');
        expect(message.html).toContain('본인이 요청하지 않았다면');
    });
});

import { buildPasswordResetEmail } from '@/infrastructure/email/passwordResetEmail';

describe('buildPasswordResetEmail', () => {
    const baseInput = {
        to: 'user@example.com',
        token: 'raw-token-123',
        expiresAt: new Date('2026-05-01T00:00:00Z'),
        siteUrl: 'https://siglens.io',
        siteName: 'Siglens',
    };

    it('수신자 이메일을 to에 그대로 설정한다', () => {
        const message = buildPasswordResetEmail(baseInput);
        expect(message.to).toBe('user@example.com');
    });

    it('subject는 한국어로 비밀번호 재설정을 명시한다', () => {
        const message = buildPasswordResetEmail(baseInput);
        expect(message.subject).toContain('비밀번호 재설정');
    });

    it('html과 text 모두에 token이 포함된 reset URL이 들어간다', () => {
        const message = buildPasswordResetEmail(baseInput);
        const expectedUrl =
            'https://siglens.io/reset-password?token=raw-token-123';
        expect(message.html).toContain(expectedUrl);
        expect(message.text).toContain(expectedUrl);
    });

    it('siteUrl 끝의 슬래시는 중복하지 않는다', () => {
        const message = buildPasswordResetEmail({
            ...baseInput,
            siteUrl: 'https://siglens.io/',
        });
        expect(message.text).toContain(
            'https://siglens.io/reset-password?token=raw-token-123'
        );
    });

    it('token에 URL 예약 문자가 있어도 이스케이프된다', () => {
        const message = buildPasswordResetEmail({
            ...baseInput,
            token: 'a+b/c=',
        });
        expect(message.html).toContain('token=a%2Bb%2Fc%3D');
        expect(message.text).toContain('token=a%2Bb%2Fc%3D');
    });

    it('만료 시각을 한국 시간 형식으로 표기한다', () => {
        const message = buildPasswordResetEmail(baseInput);
        expect(message.text).toContain('2026년');
    });

    it('html은 자체 안내 문구와 본인 미요청 안내를 포함한다', () => {
        const message = buildPasswordResetEmail(baseInput);
        expect(message.html).toContain('새 비밀번호 설정');
        expect(message.html).toContain('본인이 요청하지 않았다면');
    });
});

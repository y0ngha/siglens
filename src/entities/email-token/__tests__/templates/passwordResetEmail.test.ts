import { buildPasswordResetEmail } from '@/entities/email-token';
import { DEFAULT_SITE_URL } from '../../templates/passwordResetEmail';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';

/**
 * 메일 본문은 이제 카탈로그에서 온다 — 예전엔 템플릿 안에 한국어 리터럴이라
 * `/ja/forgot-password`에서 요청해도 한국어 메일이 나갔다. 테스트는 ko 번역자로
 * 기존 계약(문구·링크·이스케이프)을 그대로 지키고, en 번역자로 본문 언어가
 * 실제로 갈리는지를 함께 본다.
 */
const NS = 'entities.email-token.email';
const tKo = catalogTranslator(NS, 'ko');
const tEn = catalogTranslator(NS, 'en');

describe('buildPasswordResetEmail', () => {
    const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;

    afterEach(() => {
        process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
    });

    const baseInput = {
        email: 'user@example.com',
        token: 'raw-token-123',
        t: tKo,
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

    it('en 번역자를 받으면 본문·제목이 영어로 나가고 링크만 로케일 접두사를 갖는다', () => {
        delete process.env.NEXT_PUBLIC_SITE_URL;
        const message = buildPasswordResetEmail({
            ...baseInput,
            locale: 'en',
            t: tEn,
        });
        expect(message.subject).toContain('password reset');
        expect(message.text).not.toMatch(/[가-힣]/);
        expect(message.html).not.toMatch(/[가-힣]/);
        expect(message.html).toContain('<html lang="en">');
        expect(message.text).toContain(`${DEFAULT_SITE_URL}/en/reset-password`);
    });
});

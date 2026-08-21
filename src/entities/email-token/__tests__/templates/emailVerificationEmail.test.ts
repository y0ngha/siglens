import { buildEmailVerificationEmail } from '@/entities/email-token';
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

describe('buildEmailVerificationEmail', () => {
    const baseInput = {
        to: 'user@example.com',
        code: '482917',
        t: tKo,
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

    it('en 번역자를 받으면 본문·제목이 영어로 나가고 한글이 남지 않는다', () => {
        const message = buildEmailVerificationEmail({
            ...baseInput,
            locale: 'en',
            t: tEn,
        });
        expect(message.subject).toContain('verification code');
        expect(message.text).not.toMatch(/[가-힣]/);
        expect(message.html).not.toMatch(/[가-힣]/);
    });

    it('`<html lang>`이 발송 로케일을 따른다', () => {
        expect(buildEmailVerificationEmail(baseInput).html).toContain(
            '<html lang="ko">'
        );
        expect(
            buildEmailVerificationEmail({
                ...baseInput,
                locale: 'ja',
                t: tEn,
            }).html
        ).toContain('<html lang="ja">');
    });
});

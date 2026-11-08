import { buildInquiryNotification } from '../templates/operator-mail/buildInquiryNotification';

describe('buildInquiryNotification', () => {
    it('제목·이메일·본문을 text 에 싣고 이메일을 replyTo 로 둔다', () => {
        const mail = buildInquiryNotification({
            title: '문의',
            content: '본문입니다',
            email: 'v@example.com',
        });
        expect(mail.subject).toBe('[SIGLENS 문의] 문의');
        expect(mail.text).toContain('이메일: v@example.com');
        expect(mail.text).toContain('본문입니다');
        expect(mail.replyTo).toBe('v@example.com');
    });

    it('이메일이 null 이면 "이메일 없음"이고 replyTo 키가 없다', () => {
        const mail = buildInquiryNotification({
            title: 't',
            content: 'c',
            email: null,
        });
        expect(mail.text).toContain('이메일: 이메일 없음');
        expect(mail).not.toHaveProperty('replyTo');
    });

    it('공백뿐인 이메일도 이메일 없음으로 취급한다', () => {
        const mail = buildInquiryNotification({
            title: 't',
            content: 'c',
            email: '  ',
        });
        expect(mail.html).toContain('이메일 없음');
        expect(mail).not.toHaveProperty('replyTo');
    });

    it('HTML 본문에서 사용자 입력을 이스케이프한다', () => {
        const mail = buildInquiryNotification({
            title: '<b>x</b>',
            content: '<script>alert(1)</script>',
            email: null,
        });
        expect(mail.html).not.toContain('<script>');
        expect(mail.html).toContain('&lt;script&gt;');
        expect(mail.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    });

    it('제목의 개행을 공백으로 접는다', () => {
        const mail = buildInquiryNotification({
            title: 'a\r\nBcc: x',
            content: 'c',
            email: null,
        });
        expect(mail.subject).toBe('[SIGLENS 문의] a Bcc: x');
    });
});

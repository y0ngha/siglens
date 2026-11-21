import { buildMailAlertCodeEmail } from '@/entities/mail-alert/templates/mailAlertCodeEmail';
import { extractEmailDebugRecord } from '@/shared/email/emailDebugRecord';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';

const NS = 'entities.mail-alert.codeEmail';
const tKo = catalogTranslator(NS, 'ko');
const tEn = catalogTranslator(NS, 'en');

const base = { to: 'user@example.com', code: '482917', t: tKo };

describe('buildMailAlertCodeEmail', () => {
    it('수신자와 제목, 코드가 들어간다', () => {
        const message = buildMailAlertCodeEmail(base);

        expect(message.to).toBe('user@example.com');
        expect(message.subject).toBe('[시그렌즈] 알림 메일 인증 코드');
        expect(message.html).toContain('482917');
        expect(message.text).toContain('인증 코드: 482917');
    });

    it('코드 유효 시간은 코드 저장 수명(분)에서 온다', () => {
        expect(buildMailAlertCodeEmail(base).text).toContain(
            '코드는 30분 동안 쓸 수 있어요.'
        );
    });

    it('E2E 코드 추출기가 본문에서 같은 코드를 읽는다', () => {
        const message = buildMailAlertCodeEmail(base);

        expect(extractEmailDebugRecord(message).code).toBe('482917');
    });

    it('트랜잭셔널 메일이라 수신거부 헤더도 홍보 문구도 없다', () => {
        const message = buildMailAlertCodeEmail(base);

        expect(message.headers).toBeUndefined();
        expect(message.text).not.toContain('광고');
        expect(message.text).not.toContain('회원가입');
    });

    it('로케일에 따라 본문 언어와 html lang이 갈린다', () => {
        const message = buildMailAlertCodeEmail({
            ...base,
            t: tEn,
            locale: 'en',
        });

        expect(message.subject).toBe('[SIGLENS] Alert email verification code');
        expect(message.text).toContain('Verification code: 482917');
        expect(message.html).toContain('<html lang="en">');
    });
});

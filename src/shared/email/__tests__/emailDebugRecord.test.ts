import type { EmailMessage } from '../types';
import {
    buildEmailDebugKey,
    extractEmailDebugRecord,
} from '../emailDebugRecord';
import { buildEmailVerificationEmail } from '@/entities/email-token/templates/emailVerificationEmail';
import { buildPasswordResetEmail } from '@/entities/email-token/templates/passwordResetEmail';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';

const tMail = catalogTranslator('entities.email-token.email');

describe('buildEmailDebugKey', () => {
    it('recipient을 prefix와 결합한 키를 만든다', () => {
        expect(buildEmailDebugKey('user@example.com')).toBe(
            'email_debug:user@example.com'
        );
    });
});

describe('extractEmailDebugRecord', () => {
    it('인증 이메일에서 6자리 코드를 추출한다 (token 없음)', () => {
        const message = buildEmailVerificationEmail({
            t: tMail,
            to: 'verify@test.com',
            code: '482917',
        });
        const record = extractEmailDebugRecord(message);
        expect(record.code).toBe('482917');
        expect(record.token).toBeUndefined();
        expect(record.raw).toBe(message.text);
    });

    it('비밀번호 재설정 이메일에서 token을 추출한다 (code 없음)', () => {
        const message = buildPasswordResetEmail({
            t: tMail,
            email: 'reset@test.com',
            token: 'raw-reset-token-123',
        });
        const record = extractEmailDebugRecord(message);
        expect(record.token).toBe('raw-reset-token-123');
        expect(record.code).toBeUndefined();
        expect(record.raw).toBe(message.text);
    });

    it('URL 인코딩된 reset token을 디코드해 추출한다', () => {
        // 재설정 링크는 토큰을 encodeURIComponent로 인코딩하므로, 추출기가 저장소가
        // 기대하는 원본 값으로 되돌려야 한다.
        const token = 'a+b/c=d&e';
        const message = buildPasswordResetEmail({
            t: tMail,
            email: 'reset2@test.com',
            token,
        });
        const record = extractEmailDebugRecord(message);
        expect(record.token).toBe(token);
    });

    it('잘못된 %-인코딩 토큰은 던지지 않고 원본 값을 쓴다', () => {
        const message: EmailMessage = {
            to: 't@t.com',
            subject: 's',
            text: 'https://siglens.io/reset-password?email=a&token=bad%E0%A4%A',
            html: '',
        };
        expect(extractEmailDebugRecord(message).token).toBe('bad%E0%A4%A');
    });

    it('라벨이 없어도 standalone 6자리 코드를 fallback으로 추출한다', () => {
        const message: EmailMessage = {
            to: 't@t.com',
            subject: 's',
            text: '당신의 코드는 123456 입니다',
            html: '<p>123456</p>',
        };
        const record = extractEmailDebugRecord(message);
        expect(record.code).toBe('123456');
    });

    it('코드도 token도 없으면 raw만 채운다', () => {
        const message: EmailMessage = {
            to: 't@t.com',
            subject: 's',
            text: 'no secrets here',
            html: '<p>nothing</p>',
        };
        const record = extractEmailDebugRecord(message);
        expect(record.code).toBeUndefined();
        expect(record.token).toBeUndefined();
        expect(record.raw).toBe('no secrets here');
    });
});

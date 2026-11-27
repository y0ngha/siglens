import { EMAIL_VERIFICATION_PENDING_TTL_SECONDS } from '@/entities/auth/lib/authUseCaseConstants';
import type { EmailTranslator } from '@/entities/email-token/templates/emailTranslator';
import { SECONDS_PER_MINUTE } from '@/shared/config/time';
import type { EmailMessage } from '@/shared/email/types';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';

interface BuildMailAlertCodeEmailInput {
    to: string;
    code: string;
    /** 발송 시점의 로케일. 본문 언어와 `<html lang>`이 함께 굳는다. */
    locale?: Locale;
    /** `entities.mail-alert.codeEmail` 네임스페이스 번역자. */
    t: EmailTranslator;
}

const CODE_VALID_MINUTES = String(
    EMAIL_VERIFICATION_PENDING_TTL_SECONDS / SECONDS_PER_MINUTE
);

/**
 * 알림 메일 신청의 인증 코드 메일(제목·HTML·텍스트). 가입 인증 메일과 같은 모양이다.
 * 신청한 사람이 직접 요청한 트랜잭셔널 메일이라 홍보 문구도 수신거부 헤더도 싣지 않는다.
 * 본문의 `인증 코드: {code}` 줄은 E2E 코드 추출기가 읽는 형식이라 번역에서도 이 줄을 지켜야 한다.
 * `code`는 서버가 만든 숫자라 이스케이프 없이 넣는다 — 사용자 입력을 넘기면 안 된다.
 */
export function buildMailAlertCodeEmail({
    to,
    code,
    locale = DEFAULT_LOCALE,
    t,
}: BuildMailAlertCodeEmailInput): EmailMessage {
    const heading = t('heading', { v0: brandName(locale) });
    const intro = t('intro');
    const expiry = t('expiry', { v0: CODE_VALID_MINUTES });
    const ignore = t('ignore');
    const text = [
        heading,
        '',
        intro,
        '',
        t('codeLine', { v0: code }),
        '',
        `${expiry} ${ignore}`,
    ].join('\n');
    const html = `<!doctype html><html lang="${locale}"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding:32px;">
<div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;">
  <h1 style="font-size:18px;margin:0 0 16px;color:#f1f5f9;">${heading}</h1>
  <p style="font-size:14px;line-height:1.6;color:#cbd5e1;margin:0 0 16px;">${intro}</p>
  <p style="font-size:32px;line-height:1.2;letter-spacing:0.25em;font-weight:700;color:#f1f5f9;background:#0f172a;border-radius:8px;padding:16px 24px;text-align:center;margin:24px 0;font-family:ui-monospace,Menlo,Consolas,monospace;">${code}</p>
  <p style="font-size:12px;color:#94a3b8;margin:0;">${expiry}</p>
  <p style="font-size:12px;color:#64748b;margin:24px 0 0;">${ignore}</p>
</div></body></html>`;
    return {
        to,
        subject: t('subject', { v0: brandName(locale) }),
        html,
        text,
    };
}

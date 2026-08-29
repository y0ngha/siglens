import type { EmailMessage } from '@/shared/email';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import type { EmailTranslator } from './emailTranslator';

// Duplicates @/shared/lib/seo SITE_NAME and passwordResetEmail.ts — update all three if changed.
const SITE_NAME = 'Siglens';

interface BuildEmailVerificationEmailInput {
    to: string;
    code: string;
    /**
     * 발송 시점의 로케일. 본문 언어와 `<html lang>`을 함께 정한다 —
     * `lang`만 `ko`로 굳어 있으면 수신함 자동 번역이 영어 본문을 한국어로
     * 오인해 다시 번역한다.
     */
    locale?: Locale;
    /** `entities.email-token.email` 네임스페이스 번역자. */
    t: EmailTranslator;
}

export function buildEmailVerificationEmail({
    to,
    code,
    locale = DEFAULT_LOCALE,
    t,
}: BuildEmailVerificationEmailInput): EmailMessage {
    const heading = t('verifyHeading', { v0: SITE_NAME });
    const intro = t('verifyIntro');
    const expiry = t('verifyExpiry');
    const ignore = t('verifyIgnore');
    const text = [
        heading,
        '',
        intro,
        '',
        t('verifyCodeLine', { v0: code }),
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
    return { to, subject: t('verifySubject', { v0: SITE_NAME }), html, text };
}

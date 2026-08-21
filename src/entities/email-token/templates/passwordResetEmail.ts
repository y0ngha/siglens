import type { EmailMessage } from '@/shared/email';
import { DEFAULT_LOCALE, localePath, type Locale } from '@/shared/i18n/locales';
import type { EmailTranslator } from './emailTranslator';

// Duplicates @/shared/lib/seo SITE_NAME/SITE_URL — update both if changed.
const SITE_NAME = 'Siglens';

// Matches SITE_URL in @/shared/lib/seo — update both when the default URL changes.
export const DEFAULT_SITE_URL = 'https://siglens.io';

// Resolved per-call so tests can override NEXT_PUBLIC_SITE_URL via process.env (Domain #3).
function buildSiteUrl(): string {
    return (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(
        /\/$/,
        ''
    );
}

interface BuildPasswordResetEmailInput {
    /** 수신자 이메일. reset URL 파라미터로도 사용된다 (항상 동일한 값). */
    email: string;
    /** 코어가 발급한 raw 토큰 (해시 전). */
    token: string;
    /**
     * 요청이 시작된 로케일. 재설정 링크에 접두사를 붙이는 데 쓴다.
     *
     * 빼면 `/ja/forgot-password`에서 요청한 사용자가 메일 링크를 눌렀을 때
     * **한국어** `/reset-password`에 떨어진다 — 로케일이 메일 왕복 전체에서
     * 사라진다. 본문 번역은 별도 작업이지만(설계 §13 Phase), 착지 지점이
     * 어긋나는 것은 그와 무관한 결함이다.
     */
    locale?: Locale;
    /** `entities.email-token.email` 네임스페이스 번역자. */
    t: EmailTranslator;
}

const RESET_PATH = '/reset-password';
// Redis TTL 전환 이후 코어가 expiresAt를 전달하지 않으므로 만료 시각을 표시하지 않는다.

export function buildPasswordResetEmail({
    email,
    token,
    locale = DEFAULT_LOCALE,
    t,
}: BuildPasswordResetEmailInput): EmailMessage {
    const link = `${buildSiteUrl()}${localePath(locale, RESET_PATH)}?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
    const heading = t('resetHeading', { v0: SITE_NAME });
    const expiry = t('resetExpiry');
    const ignore = t('resetIgnore');
    const text = [
        heading,
        '',
        t('resetIntroText'),
        link,
        '',
        expiry,
        ignore,
    ].join('\n');
    const html = `<!doctype html><html lang="${locale}"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding:32px;">
<div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;">
  <h1 style="font-size:18px;margin:0 0 16px;color:#f1f5f9;">${heading}</h1>
  <p style="font-size:14px;line-height:1.6;color:#cbd5e1;margin:0 0 16px;">${t('resetIntroHtml')}</p>
  <p style="margin:24px 0;"><a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">${t('resetButton')}</a></p>
  <p style="font-size:12px;color:#94a3b8;margin:0 0 8px;">${t('resetCopyFallback')}</p>
  <p style="font-size:12px;color:#94a3b8;word-break:break-all;margin:0 0 16px;"><a href="${link}" style="color:#60a5fa;">${link}</a></p>
  <p style="font-size:12px;color:#94a3b8;margin:0 0 8px;">${expiry}</p>
  <p style="font-size:12px;color:#64748b;margin:24px 0 0;">${ignore}</p>
</div></body></html>`;
    return {
        to: email,
        subject: t('resetSubject', { v0: SITE_NAME }),
        html,
        text,
    };
}

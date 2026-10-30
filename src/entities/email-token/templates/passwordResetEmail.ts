import type { EmailMessage } from '@/shared/email/types';
import { DEFAULT_LOCALE, localePath, type Locale } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';
import { SITE_HOST } from '@/shared/lib/seo';
import type { EmailTranslator } from './emailTranslator';

/**
 * `NEXT_PUBLIC_SITE_URL`이 없을 때의 사이트 기본 URL. `SITE_URL`(shared/lib/seo)과 값은 같지만
 * 그 상수를 쓰지 않는다 — 모듈 로드 시점이 아니라 호출 시점에 env를 읽어야 해서다(`buildSiteUrl`).
 */
export const DEFAULT_SITE_URL = `https://${SITE_HOST}`;

// 호출 시점에 env를 읽어 테스트가 process.env로 NEXT_PUBLIC_SITE_URL을 바꿀 수 있게 한다.
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
     * 사라진다. 착지 지점이 어긋나면 본문 언어와 무관하게
     * 링크가 잘못된 로케일로 간다.
     */
    locale?: Locale;
    /** `entities.email-token.email` 네임스페이스 번역자. */
    t: EmailTranslator;
}

const RESET_PATH = '/reset-password';

/**
 * 비밀번호 재설정 링크 메일을 만든다. 순수 함수로 발송은 하지 않으며, requestPasswordResetAction이
 * 반환값을 dispatcher에 넘긴다. 토큰이 Redis TTL로 만료돼 만료 시각은 표시하지 않고, 링크의 email·token은
 * URL 인코딩한다.
 */
export function buildPasswordResetEmail({
    email,
    token,
    locale = DEFAULT_LOCALE,
    t,
}: BuildPasswordResetEmailInput): EmailMessage {
    const link = `${buildSiteUrl()}${localePath(locale, RESET_PATH)}?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
    const heading = t('resetHeading', { v0: brandName(locale) });
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
        subject: t('resetSubject', { v0: brandName(locale) }),
        html,
        text,
    };
}

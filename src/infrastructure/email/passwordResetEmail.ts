import type { EmailMessage } from '@y0ngha/siglens-core';

// Duplicates @/lib/seo SITE_NAME/SITE_URL — update both if changed.
const SITE_NAME = 'Siglens';

// Matches SITE_URL in @/lib/seo — update both when the default URL changes.
export const DEFAULT_SITE_URL = 'https://siglens.io';

// Resolved per-call so tests can override NEXT_PUBLIC_SITE_URL via process.env (Domain #3).
function buildSiteUrl(): string {
    return (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(
        /\/$/,
        ''
    );
}

interface BuildPasswordResetEmailInput {
    to: string;
    /** 회원 이메일 — reset URL에 token과 함께 전달되어 confirmPasswordReset 검증에 사용된다. */
    email: string;
    /** 코어가 발급한 raw 토큰 (해시 전). */
    token: string;
}

const RESET_PATH = '/reset-password';
const SUBJECT = `${SITE_NAME} 비밀번호 재설정 안내`;
// Redis TTL 전환 이후 코어가 expiresAt를 전달하지 않으므로 만료 시각을 표시하지 않는다.

export function buildPasswordResetEmail({
    to,
    email,
    token,
}: BuildPasswordResetEmailInput): EmailMessage {
    const link = `${buildSiteUrl()}${RESET_PATH}?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
    const text = [
        `${SITE_NAME} 비밀번호 재설정`,
        '',
        '아래 링크를 눌러 새 비밀번호를 설정해주세요.',
        link,
        '',
        '본인이 요청하지 않았다면 본 메일을 무시해주세요. 비밀번호는 변경되지 않습니다.',
    ].join('\n');
    const html = `<!doctype html><html lang="ko"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding:32px;">
<div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;">
  <h1 style="font-size:18px;margin:0 0 16px;color:#f1f5f9;">${SITE_NAME} 비밀번호 재설정</h1>
  <p style="font-size:14px;line-height:1.6;color:#cbd5e1;margin:0 0 16px;">아래 버튼을 눌러 새 비밀번호를 설정해주세요.</p>
  <p style="margin:24px 0;"><a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">새 비밀번호 설정</a></p>
  <p style="font-size:12px;color:#94a3b8;margin:0 0 8px;">버튼이 동작하지 않으면 아래 주소를 직접 복사해 브라우저에 붙여넣어 주세요.</p>
  <p style="font-size:12px;color:#94a3b8;word-break:break-all;margin:0 0 16px;"><a href="${link}" style="color:#60a5fa;">${link}</a></p>
  <p style="font-size:12px;color:#64748b;margin:24px 0 0;">본인이 요청하지 않았다면 본 메일을 무시해주세요. 비밀번호는 변경되지 않습니다.</p>
</div></body></html>`;
    return { to, subject: SUBJECT, html, text };
}

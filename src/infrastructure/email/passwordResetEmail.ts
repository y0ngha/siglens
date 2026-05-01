import type { EmailMessage } from './types';

interface BuildPasswordResetEmailInput {
    to: string;
    token: string;
    expiresAt: Date;
    siteUrl: string;
    siteName: string;
}

const RESET_PATH = '/reset-password';

function formatExpiresAtKst(expiresAt: Date): string {
    return expiresAt.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        dateStyle: 'long',
        timeStyle: 'short',
    });
}

export function buildPasswordResetEmail({
    to,
    token,
    expiresAt,
    siteUrl,
    siteName,
}: BuildPasswordResetEmailInput): EmailMessage {
    const normalizedSiteUrl = siteUrl.replace(/\/$/, '');
    const link = `${normalizedSiteUrl}${RESET_PATH}?token=${encodeURIComponent(token)}`;
    const expiresAtLabel = formatExpiresAtKst(expiresAt);
    const subject = `${siteName} 비밀번호 재설정 안내`;
    const text = [
        `${siteName} 비밀번호 재설정`,
        '',
        '아래 링크를 눌러 새 비밀번호를 설정해주세요.',
        link,
        '',
        `링크 유효 기간: ${expiresAtLabel}까지`,
        '',
        '본인이 요청하지 않았다면 본 메일을 무시해주세요. 비밀번호는 변경되지 않습니다.',
    ].join('\n');
    const html = `<!doctype html><html lang="ko"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding:32px;">
<div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;">
  <h1 style="font-size:18px;margin:0 0 16px;color:#f1f5f9;">${siteName} 비밀번호 재설정</h1>
  <p style="font-size:14px;line-height:1.6;color:#cbd5e1;margin:0 0 16px;">아래 버튼을 눌러 새 비밀번호를 설정해주세요.</p>
  <p style="margin:24px 0;"><a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">새 비밀번호 설정</a></p>
  <p style="font-size:12px;color:#94a3b8;margin:0 0 8px;">버튼이 동작하지 않으면 아래 주소를 직접 복사해 브라우저에 붙여넣어 주세요.</p>
  <p style="font-size:12px;color:#94a3b8;word-break:break-all;margin:0 0 16px;"><a href="${link}" style="color:#60a5fa;">${link}</a></p>
  <p style="font-size:12px;color:#94a3b8;margin:0 0 8px;">링크 유효 기간: ${expiresAtLabel}까지</p>
  <p style="font-size:12px;color:#64748b;margin:24px 0 0;">본인이 요청하지 않았다면 본 메일을 무시해주세요. 비밀번호는 변경되지 않습니다.</p>
</div></body></html>`;
    return { to, subject, html, text };
}

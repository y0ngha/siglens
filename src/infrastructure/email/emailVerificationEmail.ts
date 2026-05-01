import type { EmailMessage } from '@y0ngha/siglens-core';

// Duplicates @/lib/seo SITE_NAME and passwordResetEmail.ts — update all three if changed.
const SITE_NAME = 'Siglens';

interface BuildEmailVerificationEmailInput {
    to: string;
    code: string;
}

const SUBJECT = `${SITE_NAME} 회원가입 인증 코드`;

export function buildEmailVerificationEmail({
    to,
    code,
}: BuildEmailVerificationEmailInput): EmailMessage {
    const text = [
        `${SITE_NAME} 회원가입 인증`,
        '',
        '아래 인증 코드를 회원가입 화면에 입력해주세요.',
        '',
        `인증 코드: ${code}`,
        '',
        '본 코드는 일정 시간 후 만료됩니다. 본인이 요청하지 않았다면 본 메일을 무시해주세요.',
    ].join('\n');
    const html = `<!doctype html><html lang="ko"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding:32px;">
<div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;">
  <h1 style="font-size:18px;margin:0 0 16px;color:#f1f5f9;">${SITE_NAME} 회원가입 인증</h1>
  <p style="font-size:14px;line-height:1.6;color:#cbd5e1;margin:0 0 16px;">아래 인증 코드를 회원가입 화면에 입력해주세요.</p>
  <p style="font-size:32px;line-height:1.2;letter-spacing:0.25em;font-weight:700;color:#f1f5f9;background:#0f172a;border-radius:8px;padding:16px 24px;text-align:center;margin:24px 0;font-family:ui-monospace,Menlo,Consolas,monospace;">${code}</p>
  <p style="font-size:12px;color:#94a3b8;margin:0;">본 코드는 일정 시간 후 만료됩니다.</p>
  <p style="font-size:12px;color:#64748b;margin:24px 0 0;">본인이 요청하지 않았다면 본 메일을 무시해주세요.</p>
</div></body></html>`;
    return { to, subject: SUBJECT, html, text };
}

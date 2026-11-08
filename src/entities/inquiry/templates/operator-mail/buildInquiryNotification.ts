import { escapeHtml } from '@/shared/lib/escapeHtml';
import type { EmailMessage } from '@/shared/email/types';

export interface InquiryNotificationInput {
    title: string;
    content: string;
    /** 비어 있거나 null이면 "이메일 없음"으로 표시하고 reply-to를 싣지 않는다. */
    email: string | null;
}

const NO_EMAIL_LABEL = '이메일 없음';

/** 제목에 개행이 있으면 메일 헤더가 깨질 수 있어 한 줄로 접는다. */
function toSubjectLine(title: string): string {
    return title.replace(/\s+/g, ' ').trim();
}

/**
 * 문의 접수 즉시 알림 메일. 방문자 이메일이 있으면 reply-to로 실어 운영자가 바로
 * 회신할 수 있게 한다. 본문은 사용자 입력이라 HTML에서 이스케이프한다.
 */
export function buildInquiryNotification(
    input: InquiryNotificationInput
): Omit<EmailMessage, 'to'> {
    const email = input.email?.trim() ? input.email.trim() : null;
    const emailLabel = email ?? NO_EMAIL_LABEL;
    return {
        subject: `[SIGLENS 문의] ${toSubjectLine(input.title)}`,
        text: `제목: ${input.title}\n이메일: ${emailLabel}\n\n${input.content}`,
        html:
            `<p><b>제목</b>: ${escapeHtml(input.title)}</p>` +
            `<p><b>이메일</b>: ${escapeHtml(emailLabel)}</p>` +
            `<p style="white-space:pre-wrap">${escapeHtml(input.content)}</p>`,
        ...(email !== null ? { replyTo: email } : {}),
    };
}

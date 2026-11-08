import { escapeHtml } from '@/shared/lib/escapeHtml';
import type { EmailMessage } from '@/shared/email/types';
import type { VocTrigger } from '../../types';

export interface VocNotificationInput {
    readonly surface: string;
    readonly rating: number;
    readonly comment: string | null;
    readonly trigger: VocTrigger;
    readonly pagePath: string;
    readonly locale: string;
    readonly isMember: boolean;
}

const SURFACE_LABEL: Readonly<Record<string, string>> = {
    siglens: 'siglens',
    siglens_ai: '시그렌즈 AI',
};
const TRIGGER_LABEL: Readonly<Record<VocTrigger, string>> = {
    analysis: '분석 직후',
    agent_chat: '시그렌즈 AI 대화 직후',
};

/**
 * VOC 별점 즉시 알림 메일. 회원 id나 IP는 싣지 않는다(회원 여부만).
 * 의견은 사용자 입력이라 HTML에서 이스케이프한다.
 */
export function buildVocNotification(
    input: VocNotificationInput
): Omit<EmailMessage, 'to'> {
    const stars = '★'.repeat(input.rating) + '☆'.repeat(5 - input.rating);
    const lines: [string, string][] = [
        ['별점', `${stars} (${input.rating}/5)`],
        ['표면', SURFACE_LABEL[input.surface] ?? input.surface],
        ['계기', TRIGGER_LABEL[input.trigger]],
        ['페이지', input.pagePath],
        ['언어', input.locale],
        ['사용자', input.isMember ? '회원' : '비회원'],
        ['의견', input.comment ?? '(없음)'],
    ];
    return {
        subject: `[SIGLENS] 새 VOC 별점 ${input.rating}/5`,
        text: lines.map(([k, v]) => `${k}: ${v}`).join('\n'),
        html: `<table cellpadding="4" cellspacing="0">${lines
            .map(
                ([k, v]) =>
                    `<tr><td><b>${escapeHtml(k)}</b></td><td style="white-space:pre-wrap">${escapeHtml(v)}</td></tr>`
            )
            .join('')}</table>`,
    };
}

import type { EmailMessage } from '@/shared/email/types';
import { escapeHtml } from '@/shared/lib/escapeHtml';
import { brandName } from '@/shared/lib/brandName';
import { briefTableHtml, briefTableLines } from './briefTable';
import { formatDate } from './emailFormat';
import { COLORS, FONT } from './emailTheme';
import type { BuildReportEmailInput } from './reportEmailTypes';
import { sectionHtml, sectionText } from './sectionCard';

/**
 * HTML 본문 크기 상한(바이트). Resend 권고 ~100KB — Gmail은 102KB를 넘는 메일을 잘라
 * "메시지 전체 보기"로 숨긴다. 5 카드 + 15 행 픽스처가 이 안에 드는지 테스트가 고정한다.
 */
export const REPORT_EMAIL_MAX_HTML_BYTES = 100_000;

/**
 * 정기 메일 리포트 한 통.
 *
 * 본문에 들어가는 문자열은 전부 이스케이프한다 — AI 산문과 뉴스 제목·URL은 외부에서 온
 * 값이다. 모든 메일 끝에 "투자 권유 아님" 고지와 수신거부 링크를 넣고,
 * `List-Unsubscribe`(+ `-Post`, RFC 8058) 헤더로 메일 앱의 원클릭 수신거부를 연다.
 */
export function buildReportEmail(input: BuildReportEmailInput): EmailMessage {
    const { t, locale } = input;
    const date = formatDate(input.localDate, locale);
    const heading = t('heading');
    const intro = t('intro', { v0: date });
    const disclaimer = t('disclaimer');
    // 컨플루언스 줄(점수 또는 "—")이 한 군데도 없으면 각주가 가리킬 대상이 없다.
    const showConfluenceNote =
        input.sections.some(s => s.brief.signals !== null) ||
        input.briefRows.some(r => r.brief.signals !== null);
    // 수신자 로케일의 브랜드 표기 — ko `시그렌즈`, 그 외 `SIGLENS`(`CONVENTIONS.md#I18-11`).
    const brand = brandName(locale);
    const reason = t('reason', { v0: brand });

    const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="font-family:${FONT};background:${COLORS.page};color:${COLORS.body};padding:24px 12px;margin:0;">
<div style="max-width:600px;margin:0 auto;">
  <div style="padding:8px 8px 20px;">
    <p style="font-size:13px;color:${COLORS.muted};margin:0 0 4px;">${escapeHtml(brand)}</p>
    <h1 style="font-size:22px;margin:0 0 8px;color:${COLORS.heading};">${escapeHtml(heading)}</h1>
    <p style="font-size:14px;color:${COLORS.body};margin:0;">${escapeHtml(intro)}</p>
  </div>
  ${input.sections.map(s => sectionHtml(s, t, input.signalLabel, brand)).join('\n')}
  ${briefTableHtml(input.briefRows, locale, t, input.signalLabel)}
  <div style="padding:16px 8px;border-top:1px solid ${COLORS.rule};">
    <p style="font-size:12px;line-height:1.6;color:${COLORS.muted};margin:0 0 8px;">${escapeHtml(disclaimer)}</p>
    ${showConfluenceNote ? `<p style="font-size:12px;line-height:1.6;color:${COLORS.muted};margin:0 0 8px;">${escapeHtml(t('confluenceNote'))}</p>` : ''}
    <p style="font-size:12px;line-height:1.6;color:${COLORS.faint};margin:0;">${escapeHtml(reason)} <a href="${escapeHtml(input.settingsUrl)}" style="color:${COLORS.link};">${escapeHtml(t('manage'))}</a> | <a href="${escapeHtml(input.unsubscribePageUrl)}" style="color:${COLORS.link};">${escapeHtml(t('unsubscribe'))}</a></p>
  </div>
</div></body></html>`;

    const text = [
        heading,
        intro,
        '',
        ...input.sections.flatMap(s => [
            sectionText(s, t, input.signalLabel, brand),
            '',
        ]),
        ...briefTableLines(input.briefRows, locale, t, input.signalLabel),
        '---',
        disclaimer,
        ...(showConfluenceNote ? [t('confluenceNote')] : []),
        reason,
        `${t('manage')}: ${input.settingsUrl}`,
        `${t('unsubscribe')}: ${input.unsubscribePageUrl}`,
    ].join('\n');

    return {
        to: input.to,
        subject: t('subject', { v0: brand, v1: date }),
        html,
        text,
        headers: {
            'List-Unsubscribe': `<${input.unsubscribeApiUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
    };
}

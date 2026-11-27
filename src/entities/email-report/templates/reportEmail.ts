import type { EmailMessage } from '@/shared/email/types';
import { escapeHtml } from '@/shared/lib/escapeHtml';
import { brandName } from '@/shared/lib/brandName';
import { briefTableHtml, briefTableLines } from './briefTable';
import {
    formatConsentAt,
    formatDate,
    formatSchedule,
    formatTimeZoneName,
} from './emailFormat';
import { COLORS, FONT } from './emailTheme';
import type { BuildReportEmailInput } from './reportEmailTypes';
import { sectionHtml, sectionText } from './sectionCard';

/**
 * HTML 본문 크기 상한(바이트). Resend 권고 ~100KB — Gmail은 102KB를 넘는 메일을 잘라
 * "메시지 전체 보기"로 숨긴다. 5 카드 + 15 행 픽스처가 이 안에 드는지 테스트가 고정한다.
 */
export const REPORT_EMAIL_MAX_HTML_BYTES = 100_000;

type ReportKind = 'welcome' | 'market' | 'regular';
type Translate = BuildReportEmailInput['t'];
type WelcomeInput = NonNullable<BuildReportEmailInput['welcome']>;

/**
 * 가입 첫 리포트 맨 위 안내: 일정과 동의 일시. 광고성 문구 없이 신청 결과와 발송 일정만 담는다.
 * 번역 키는 리터럴로 부른다 — 추출기가 `t(변수)`를 못 봐 키를 지운다(`I18N.md`).
 */
function buildWelcomeLines(
    welcome: WelcomeInput,
    locale: BuildReportEmailInput['locale'],
    timeZone: string,
    t: Translate
): string[] {
    const schedule = formatSchedule(
        welcome.daysOfWeek,
        welcome.sendHour,
        locale
    );
    return [
        t('welcomeIntro', {
            v0: schedule.days,
            v1: schedule.time,
            v2: formatTimeZoneName(timeZone, locale),
        }),
        t('welcomeConsentAt', {
            v0: formatConsentAt(welcome.consentedAt, timeZone, locale),
        }),
    ];
}

/** 메일 종류에 맞는 제목 줄과 본문 제목. 종류는 한 번만 정한다. */
function buildTitles(
    kind: ReportKind,
    t: Translate,
    brand: string,
    date: string
): { subject: string; heading: string } {
    switch (kind) {
        case 'welcome':
            return {
                subject: t('welcomeSubject', { v0: brand }),
                heading: t('welcomeHeading'),
            };
        case 'market':
            return {
                subject: t('marketSubject', { v0: brand, v1: date }),
                heading: t('marketHeading'),
            };
        case 'regular':
            return {
                subject: t('subject', { v0: brand, v1: date }),
                heading: t('heading'),
            };
    }
}

/**
 * 정기 메일 리포트 한 통.
 *
 * 본문에 들어가는 문자열은 전부 이스케이프한다 — AI 산문과 뉴스 제목·URL은 외부에서 온
 * 값이다. 모든 메일 끝에 "투자 권유 아님" 고지와 수신거부 링크를 넣고,
 * `List-Unsubscribe`(+ `-Post`, RFC 8058) 헤더로 메일 앱의 원클릭 수신거부를 연다.
 */
export function buildReportEmail(input: BuildReportEmailInput): EmailMessage {
    const { t, locale, marketBriefing, welcome } = input;
    const date = formatDate(input.localDate, locale);
    // 가입 첫 리포트에 실을 종목이 하나도 없으면 인사말·표 대신 안내와 샘플 링크만 둔다.
    const welcomeEmpty =
        welcome !== undefined &&
        input.sections.length === 0 &&
        input.briefRows.length === 0;
    const kind: ReportKind =
        welcome !== undefined
            ? 'welcome'
            : marketBriefing !== undefined
              ? 'market'
              : 'regular';
    // 수신자 로케일의 브랜드 표기 — ko `시그렌즈`, 그 외 `SIGLENS`(`I18N.md#I18-11`).
    const brand = brandName(locale);
    const { subject, heading } = buildTitles(kind, t, brand, date);
    // 제목 줄과 본문 제목만 kind를 따른다. 인사말 아래 소개 문구, 요약 표 제목, 시장 안내는
    // 첫 리포트에도 실제 내용(시장 브리핑 여부)을 설명해야 하므로 `marketBriefing`을 따른다.
    const reportIntro =
        marketBriefing === undefined
            ? t('intro', { v0: date })
            : t('marketIntro', { v0: date });
    const welcomeLines =
        welcome === undefined
            ? []
            : buildWelcomeLines(welcome, locale, input.timeZone, t);
    const introLines = welcomeEmpty ? [] : [reportIntro];
    const emptyNote = welcomeEmpty
        ? {
              note: t('welcomeNoData'),
              linkLabel: t('welcomeSampleLink'),
              url: welcome.sampleUrl,
          }
        : null;
    const briefHeading =
        marketBriefing === undefined ? t('sectionBrief') : t('marketSection');
    const disclaimer = t('disclaimer');
    // 컨플루언스 줄(점수 또는 "—")이 한 군데도 없으면 각주가 가리킬 대상이 없다.
    const showConfluenceNote =
        input.sections.some(s => s.brief.signals !== null) ||
        input.briefRows.some(r => r.brief.signals !== null);
    const renderContext = {
        timeZone: input.timeZone,
        skillLabel: input.skillLabel,
    };
    const reason = t('reason', { v0: brand });
    const marketHint = marketBriefing === undefined ? null : t('marketHint');
    const marketMore = marketBriefing === undefined ? null : t('marketMore');

    const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="font-family:${FONT};background:${COLORS.page};color:${COLORS.body};padding:24px 12px;margin:0;">
<div style="max-width:600px;margin:0 auto;">
  <div style="padding:8px 8px 20px;">
    <p style="font-size:13px;color:${COLORS.muted};margin:0 0 4px;">${escapeHtml(brand)}</p>
    <h1 style="font-size:22px;margin:0 0 8px;color:${COLORS.heading};">${escapeHtml(heading)}</h1>
    ${welcomeLines.map((line, i) => `<p style="font-size:14px;line-height:1.6;color:${i === 0 ? COLORS.body : COLORS.muted};margin:0 0 8px;">${escapeHtml(line)}</p>`).join('\n    ')}
    ${introLines.map(line => `<p style="font-size:14px;color:${COLORS.body};margin:0;">${escapeHtml(line)}</p>`).join('\n    ')}
    ${emptyNote !== null ? `<p style="font-size:14px;line-height:1.6;color:${COLORS.body};margin:0 0 8px;">${escapeHtml(emptyNote.note)}</p><p style="font-size:14px;margin:0;"><a href="${escapeHtml(emptyNote.url)}" style="color:${COLORS.link};font-weight:600;">${escapeHtml(emptyNote.linkLabel)} →</a></p>` : ''}
  </div>
  ${input.sections.map(s => sectionHtml(s, locale, t, input.signalLabel, brand, renderContext)).join('\n')}
  ${briefTableHtml(input.briefRows, locale, t, input.signalLabel, briefHeading)}
  ${marketBriefing !== undefined && marketHint !== null && marketMore !== null ? `<div style="padding:0 8px 16px;"><p style="font-size:14px;line-height:1.6;color:${COLORS.body};margin:0 0 8px;">${escapeHtml(marketHint)}</p><p style="font-size:14px;margin:0;"><a href="${escapeHtml(marketBriefing.marketUrl)}" style="color:${COLORS.link};font-weight:600;">${escapeHtml(marketMore)} →</a></p></div>` : ''}
  <div style="padding:16px 8px;border-top:1px solid ${COLORS.rule};">
    <p style="font-size:12px;line-height:1.6;color:${COLORS.muted};margin:0 0 8px;">${escapeHtml(disclaimer)}</p>
    ${showConfluenceNote ? `<p style="font-size:12px;line-height:1.6;color:${COLORS.muted};margin:0 0 8px;">${escapeHtml(t('confluenceNote'))}</p>` : ''}
    <p style="font-size:12px;line-height:1.6;color:${COLORS.faint};margin:0;">${escapeHtml(reason)} <a href="${escapeHtml(input.settingsUrl)}" style="color:${COLORS.link};">${escapeHtml(t('manage'))}</a> | <a href="${escapeHtml(input.unsubscribePageUrl)}" style="color:${COLORS.link};">${escapeHtml(t('unsubscribe'))}</a></p>
  </div>
</div></body></html>`;

    const text = [
        heading,
        ...welcomeLines,
        ...introLines,
        ...(emptyNote !== null
            ? [emptyNote.note, `${emptyNote.linkLabel}: ${emptyNote.url}`]
            : []),
        '',
        ...input.sections.flatMap(s => [
            sectionText(s, locale, t, input.signalLabel, brand, renderContext),
            '',
        ]),
        ...briefTableLines(
            input.briefRows,
            locale,
            t,
            input.signalLabel,
            briefHeading
        ),
        ...(marketBriefing !== undefined && marketHint !== null
            ? [marketHint, `${marketMore}: ${marketBriefing.marketUrl}`, '']
            : []),
        '---',
        disclaimer,
        ...(showConfluenceNote ? [t('confluenceNote')] : []),
        reason,
        `${t('manage')}: ${input.settingsUrl}`,
        `${t('unsubscribe')}: ${input.unsubscribePageUrl}`,
    ].join('\n');

    return {
        to: input.to,
        subject,
        html,
        text,
        headers: {
            'List-Unsubscribe': `<${input.unsubscribeApiUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
    };
}

import type { EmailMessage } from '@/shared/email/types';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { escapeHtml } from '@/shared/lib/escapeHtml';
import { SITE_NAME } from '@/shared/lib/seo';
import type {
    SymbolReport,
    SymbolReportNews,
    SymbolReportOptions,
} from '../reportModel';

/**
 * `entities.email-report.email` 네임스페이스 번역자. 템플릿은 순수 함수라 요청 스코프가
 * 없다 — 발송 cron이 회원 로케일로 `getTranslations({ locale, namespace })`를 만들어 넘긴다.
 */
export type ReportEmailTranslator = (
    key: string,
    values?: Record<string, string>
) => string;

/** 메일에 싣는 종목 한 칸 — 데이터와 그 칸의 링크. */
export interface ReportEmailSection {
    report: SymbolReport;
    chartUrl: string;
    pageUrl: string;
}

export interface BuildReportEmailInput {
    to: string;
    locale: Locale;
    /** 회원 로컬 발송일(`YYYY-MM-DD`). */
    localDate: string;
    sections: readonly ReportEmailSection[];
    unsubscribePageUrl: string;
    unsubscribeApiUrl: string;
    settingsUrl: string;
    t: ReportEmailTranslator;
}

const COLORS = {
    page: '#0f172a',
    card: '#1e293b',
    heading: '#f1f5f9',
    body: '#cbd5e1',
    muted: '#94a3b8',
    faint: '#64748b',
    link: '#60a5fa',
    rule: '#334155',
    bullish: '#26a69a',
    bearish: '#ef5350',
};
const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`;
const CHART_DISPLAY_WIDTH = 536;
const CHART_DISPLAY_HEIGHT = 268;

function formatDate(localDate: string, locale: Locale): string {
    // 정오 UTC로 만들어 어느 타임존에서 포맷해도 날짜가 하루 밀리지 않게 한다.
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${localDate}T12:00:00Z`));
}

function formatPercent(value: number, digits: number): string {
    return `${value.toFixed(digits)}%`;
}

/** 줄바꿈이 있는 산문을 문단으로 나눈다(빈 줄은 버림). */
function paragraphs(text: string): string[] {
    return text
        .split(/\n+/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

function sectionTitle(label: string): string {
    return `<p style="font-size:13px;font-weight:600;color:${COLORS.heading};margin:20px 0 8px;">${escapeHtml(label)}</p>`;
}

function prose(text: string, color: string = COLORS.body): string {
    return paragraphs(text)
        .map(
            p =>
                `<p style="font-size:14px;line-height:1.65;color:${color};margin:0 0 8px;">${escapeHtml(p)}</p>`
        )
        .join('');
}

function sentimentLabel(
    news: SymbolReportNews,
    t: ReportEmailTranslator
): string {
    if (news.sentiment === null) return '';
    const color =
        news.sentiment === 'bullish'
            ? COLORS.bullish
            : news.sentiment === 'bearish'
              ? COLORS.bearish
              : COLORS.muted;
    return `<span style="color:${color};font-weight:600;">[${escapeHtml(t(`sentiment.${news.sentiment}`))}]</span> `;
}

/** 외부 기사 URL은 http(s)만 링크로 건다 — `javascript:` 같은 스킴은 이스케이프로 막히지 않는다. */
function isHttpUrl(url: string): boolean {
    return /^https?:\/\//i.test(url);
}

function newsHtml(
    items: readonly SymbolReportNews[],
    t: ReportEmailTranslator
): string {
    if (items.length === 0) return '';
    const rows = items
        .map(
            n => `<li style="margin:0 0 10px;">
  ${
      isHttpUrl(n.url)
          ? `<a href="${escapeHtml(n.url)}" style="color:${COLORS.link};font-size:14px;line-height:1.5;text-decoration:none;">${sentimentLabel(n, t)}${escapeHtml(n.title)}</a>`
          : `<span style="color:${COLORS.heading};font-size:14px;line-height:1.5;">${sentimentLabel(n, t)}${escapeHtml(n.title)}</span>`
  }
  <span style="display:block;font-size:12px;color:${COLORS.faint};">${escapeHtml(n.source)}</span>
  ${n.summary ? `<span style="display:block;font-size:13px;line-height:1.6;color:${COLORS.body};margin-top:2px;">${escapeHtml(n.summary)}</span>` : ''}
</li>`
        )
        .join('');
    return `${sectionTitle(t('sectionNews'))}<ul style="padding-left:18px;margin:0;">${rows}</ul>`;
}

function optionsMetricLines(
    options: SymbolReportOptions,
    t: ReportEmailTranslator
): string[] {
    const lines: string[] = [];
    if (options.putCallRatio !== null) {
        lines.push(
            `${t('optionsPutCall')}: ${options.putCallRatio.toFixed(2)}`
        );
    }
    if (options.atmImpliedVolatility !== null) {
        lines.push(
            `${t('optionsIv')}: ${formatPercent(options.atmImpliedVolatility * 100, 1)}`
        );
    }
    if (options.impliedMovePercent !== null && options.expirationDate) {
        lines.push(
            `${t('optionsMove', { v0: options.expirationDate })}: ±${formatPercent(options.impliedMovePercent, 1)}`
        );
    }
    return lines;
}

function optionsHtml(
    options: SymbolReportOptions | null,
    t: ReportEmailTranslator
): string {
    if (options === null) return '';
    const metrics = optionsMetricLines(options, t);
    if (metrics.length === 0 && options.summary === null) return '';
    const metricHtml = metrics
        .map(
            line =>
                `<li style="font-size:13px;color:${COLORS.body};margin:0 0 4px;">${escapeHtml(line)}</li>`
        )
        .join('');
    return `${sectionTitle(t('sectionOptions'))}${
        metricHtml
            ? `<ul style="padding-left:18px;margin:0 0 8px;">${metricHtml}</ul>`
            : ''
    }${options.summary ? prose(options.summary) : ''}`;
}

function sectionHtml(
    section: ReportEmailSection,
    t: ReportEmailTranslator
): string {
    const { report } = section;
    const symbol = escapeHtml(report.symbol);
    const technical = report.technical;
    const analysis =
        technical === null
            ? `<p style="font-size:13px;line-height:1.6;color:${COLORS.muted};margin:16px 0 0;">${escapeHtml(t('noAnalysis'))}</p>`
            : [
                  report.plain
                      ? `${sectionTitle(t('sectionPlain'))}${prose(report.plain)}`
                      : '',
                  technical.summary
                      ? `${sectionTitle(t('sectionTechnical'))}${prose(technical.summary)}`
                      : '',
                  technical.patterns.length > 0
                      ? `${sectionTitle(t('sectionPatterns'))}${technical.patterns.map(p => prose(p)).join('')}`
                      : '',
              ].join('');
    return `<div style="background:${COLORS.card};border-radius:12px;padding:24px 32px;margin:0 0 16px;">
  <h2 style="font-size:20px;margin:0 0 12px;color:${COLORS.heading};">${symbol}</h2>
  <a href="${escapeHtml(section.pageUrl)}"><img src="${escapeHtml(section.chartUrl)}" width="${CHART_DISPLAY_WIDTH}" height="${CHART_DISPLAY_HEIGHT}" alt="${escapeHtml(t('chartAlt', { v0: report.symbol }))}" style="display:block;width:100%;max-width:${CHART_DISPLAY_WIDTH}px;height:auto;border:0;border-radius:8px;" /></a>
  ${analysis}
  ${newsHtml(report.news, t)}
  ${optionsHtml(report.options, t)}
  <p style="margin:20px 0 0;"><a href="${escapeHtml(section.pageUrl)}" style="color:${COLORS.link};font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(t('viewOnSite', { v0: SITE_NAME }))} →</a></p>
</div>`;
}

function sectionText(
    section: ReportEmailSection,
    t: ReportEmailTranslator
): string {
    const { report } = section;
    const lines = [`■ ${report.symbol}`];
    if (report.technical === null) {
        lines.push(t('noAnalysis'));
    } else {
        if (report.plain)
            lines.push('', `[${t('sectionPlain')}]`, report.plain);
        if (report.technical.summary) {
            lines.push(
                '',
                `[${t('sectionTechnical')}]`,
                report.technical.summary
            );
        }
        if (report.technical.patterns.length > 0) {
            lines.push(
                '',
                `[${t('sectionPatterns')}]`,
                ...report.technical.patterns
            );
        }
    }
    if (report.news.length > 0) {
        lines.push('', `[${t('sectionNews')}]`);
        for (const n of report.news) {
            lines.push(`- ${n.title} (${n.source})`);
            if (isHttpUrl(n.url)) lines.push(`  ${n.url}`);
            if (n.summary) lines.push(`  ${n.summary}`);
        }
    }
    if (report.options !== null) {
        const metrics = optionsMetricLines(report.options, t);
        if (metrics.length > 0 || report.options.summary) {
            lines.push('', `[${t('sectionOptions')}]`, ...metrics);
            if (report.options.summary) lines.push(report.options.summary);
        }
    }
    lines.push('', `${t('viewOnSite', { v0: SITE_NAME })}: ${section.pageUrl}`);
    return lines.join('\n');
}

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
    const reason = t('reason', { v0: SITE_NAME });

    const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="font-family:${FONT};background:${COLORS.page};color:${COLORS.body};padding:24px 12px;margin:0;">
<div style="max-width:600px;margin:0 auto;">
  <div style="padding:8px 8px 20px;">
    <p style="font-size:13px;color:${COLORS.muted};margin:0 0 4px;">${escapeHtml(SITE_NAME)}</p>
    <h1 style="font-size:22px;margin:0 0 8px;color:${COLORS.heading};">${escapeHtml(heading)}</h1>
    <p style="font-size:14px;color:${COLORS.body};margin:0;">${escapeHtml(intro)}</p>
  </div>
  ${input.sections.map(s => sectionHtml(s, t)).join('\n')}
  <div style="padding:16px 8px;border-top:1px solid ${COLORS.rule};">
    <p style="font-size:12px;line-height:1.6;color:${COLORS.muted};margin:0 0 8px;">${escapeHtml(disclaimer)}</p>
    <p style="font-size:12px;line-height:1.6;color:${COLORS.faint};margin:0;">${escapeHtml(reason)} <a href="${escapeHtml(input.settingsUrl)}" style="color:${COLORS.link};">${escapeHtml(t('manage'))}</a> · <a href="${escapeHtml(input.unsubscribePageUrl)}" style="color:${COLORS.link};">${escapeHtml(t('unsubscribe'))}</a></p>
  </div>
</div></body></html>`;

    const text = [
        heading,
        intro,
        '',
        ...input.sections.flatMap(s => [sectionText(s, t), '']),
        '---',
        disclaimer,
        reason,
        `${t('manage')}: ${input.settingsUrl}`,
        `${t('unsubscribe')}: ${input.unsubscribePageUrl}`,
    ].join('\n');

    return {
        to: input.to,
        subject: t('subject', { v0: SITE_NAME, v1: date }),
        html,
        text,
        headers: {
            'List-Unsubscribe': `<${input.unsubscribeApiUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
    };
}

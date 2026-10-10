import type { EmailMessage } from '@/shared/email/types';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { escapeHtml } from '@/shared/lib/escapeHtml';
import { brandName } from '@/shared/lib/brandName';
import {
    SIGNAL_BRIEF_MAX_LABELS,
    type SignalBrief,
    type SymbolBrief,
    type SymbolReport,
    type SymbolReportNews,
    type SymbolReportOptions,
} from '../reportModel';

/**
 * `entities.email-report.email` 네임스페이스 번역자. 템플릿은 순수 함수라 요청 스코프가
 * 없다 — 발송 cron이 회원 로케일로 `getTranslations({ locale, namespace })`를 만들어 넘긴다.
 */
export type ReportEmailTranslator = (
    key: string,
    values?: Record<string, string>
) => string;

/**
 * 신호 타입 → 사람이 읽는 라벨. 대시보드 `SignalBadge`가 쓰는 `shared.enumLabel.signalType`
 * 사전을 메일 번역자에게도 노출한 것. core가 새 `SignalType`을 추가해 사전에 없으면 `null` —
 * 템플릿은 그 타입을 **표시에서 생략**한다(심볼 키를 그대로 내보내지 않는다). 로그는
 * 리졸버를 만든 app 레이어가 남긴다(템플릿은 순수).
 */
export type SignalLabelResolver = (type: string) => string | null;

/** 메일에 싣는 종목 한 칸 — 데이터와 그 칸의 링크. */
export interface ReportEmailSection {
    report: SymbolReport;
    /** 경량 경로가 준 신호 요약. 조회 실패면 `signals: null`이고 카드의 신호 줄은 생략된다. */
    brief: SymbolBrief;
    chartUrl: string;
    pageUrl: string;
}

/** "그 외 관심종목" 표 한 행. */
export interface SymbolBriefRow {
    brief: SymbolBrief;
    pageUrl: string;
}

export interface BuildReportEmailInput {
    to: string;
    locale: Locale;
    /** 회원 로컬 발송일(`YYYY-MM-DD`). */
    localDate: string;
    sections: readonly ReportEmailSection[];
    /** 전체 카드 뒤의 요약 표. 비면 섹션을 생략한다. */
    briefRows: readonly SymbolBriefRow[];
    unsubscribePageUrl: string;
    unsubscribeApiUrl: string;
    settingsUrl: string;
    t: ReportEmailTranslator;
    signalLabel: SignalLabelResolver;
}

/**
 * HTML 본문 크기 상한(바이트). Resend 권고 ~100KB — Gmail은 102KB를 넘는 메일을 잘라
 * "메시지 전체 보기"로 숨긴다. 5 카드 + 15 행 픽스처가 이 안에 드는지 테스트가 고정한다.
 */
export const REPORT_EMAIL_MAX_HTML_BYTES = 100_000;

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

function formatSignedPercent(value: number): string {
    const sign = value > 0 ? '+' : '';
    return `${sign}${formatPercent(value, 2)}`;
}

function formatClose(value: number, locale: Locale): string {
    return new Intl.NumberFormat(INTL_LOCALE[locale], {
        maximumFractionDigits: 2,
    }).format(value);
}

function signalLabelsOf(
    types: readonly string[],
    signalLabel: SignalLabelResolver
): string[] {
    return types.map(signalLabel).filter((l): l is string => l !== null);
}

function cappedSignalList(
    labels: readonly string[],
    t: ReportEmailTranslator
): string {
    const shown = labels.slice(0, SIGNAL_BRIEF_MAX_LABELS);
    const more = labels.length - shown.length;
    return (
        more > 0 ? [...shown, t('signalMore', { v0: String(more) })] : shown
    ).join(', ');
}

function signalScorePart(signals: SignalBrief, t: ReportEmailTranslator) {
    return signals.score === null
        ? t('signalAbstain')
        : t('signalScore', { v0: String(signals.score) });
}

function signalDirectionPart(
    key: 'signalBullish' | 'signalBearish',
    types: readonly string[],
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver
): string | null {
    const labels = signalLabelsOf(types, signalLabel);
    if (labels.length === 0) return null;
    return `${t(key, { v0: String(labels.length) })} (${cappedSignalList(labels, t)})`;
}

function signalFreshPart(
    signals: SignalBrief,
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver
): string | null {
    const labels = signalLabelsOf(signals.fresh, signalLabel);
    return labels.length === 0
        ? null
        : t('signalFresh', { v0: cappedSignalList(labels, t) });
}

function signalPullbackPart(
    signals: SignalBrief,
    t: ReportEmailTranslator
): string | null {
    return signals.pullback === null
        ? null
        : t('signalPullback', { v0: t(`pullback.${signals.pullback}`) });
}

/**
 * 신호 요약 한 줄(평문). 점수(보류면 "—") · 상승 N (라벨 최대 {@link SIGNAL_BRIEF_MAX_LABELS}개, +N)
 * · 하락 N (…) · 새로 켜짐: … · 눌림목: …. 라벨 사전에 없는 타입은 개수에서도 뺀다.
 * 행동 권고로 읽히는 어휘는 번역 키에도 없다.
 */
function signalBriefText(
    signals: SignalBrief,
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver
): string {
    const parts = [
        signalScorePart(signals, t),
        signalDirectionPart('signalBullish', signals.bullish, t, signalLabel),
        signalDirectionPart('signalBearish', signals.bearish, t, signalLabel),
        signalFreshPart(signals, t, signalLabel),
        signalPullbackPart(signals, t),
    ];
    return parts.filter((p): p is string => p !== null).join(' · ');
}

function signalLineHtml(
    brief: SymbolBrief,
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver
): string {
    if (brief.signals === null) return '';
    const trend =
        brief.trend === null
            ? ''
            : `<span style="color:${COLORS.heading};font-weight:600;">${escapeHtml(t(`trendState.${brief.trend}`))}</span> · `;
    return `<p style="font-size:13px;line-height:1.6;color:${COLORS.muted};margin:0 0 12px;">${trend}${escapeHtml(signalBriefText(brief.signals, t, signalLabel))}</p>`;
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
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver,
    brand: string
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
  ${signalLineHtml(section.brief, t, signalLabel)}
  <a href="${escapeHtml(section.pageUrl)}"><img src="${escapeHtml(section.chartUrl)}" width="${CHART_DISPLAY_WIDTH}" height="${CHART_DISPLAY_HEIGHT}" alt="${escapeHtml(t('chartAlt', { v0: report.symbol }))}" style="display:block;width:100%;max-width:${CHART_DISPLAY_WIDTH}px;height:auto;border:0;border-radius:8px;" /></a>
  ${analysis}
  ${newsHtml(report.news, t)}
  ${optionsHtml(report.options, t)}
  <p style="margin:20px 0 0;"><a href="${escapeHtml(section.pageUrl)}" style="color:${COLORS.link};font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(t('viewOnSite', { v0: brand }))} →</a></p>
</div>`;
}

function sectionText(
    section: ReportEmailSection,
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver,
    brand: string
): string {
    const { report, brief } = section;
    const lines = [`■ ${report.symbol}`];
    if (brief.signals !== null) {
        const trend =
            brief.trend === null ? '' : `${t(`trendState.${brief.trend}`)} · `;
        lines.push(`${trend}${signalBriefText(brief.signals, t, signalLabel)}`);
    }
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
    lines.push('', `${t('viewOnSite', { v0: brand })}: ${section.pageUrl}`);
    return lines.join('\n');
}

function changeColorFor(pct: number | null): string {
    if (pct === null || pct === 0) return COLORS.muted;
    return pct > 0 ? COLORS.bullish : COLORS.bearish;
}

function briefRowCells(
    row: SymbolBriefRow,
    locale: Locale,
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver
): {
    close: string;
    change: string;
    changeColor: string;
    trend: string;
    signals: string;
} {
    const { brief } = row;
    if (brief.signals === null) {
        return {
            close: '—',
            change: '',
            changeColor: COLORS.muted,
            trend: '—',
            signals: t('briefNoData'),
        };
    }
    const pct = brief.changePercent;
    return {
        close: brief.close === null ? '—' : formatClose(brief.close, locale),
        change: pct === null ? '' : formatSignedPercent(pct),
        changeColor: changeColorFor(pct),
        trend: brief.trend === null ? '—' : t(`trendState.${brief.trend}`),
        signals: signalBriefText(brief.signals, t, signalLabel),
    };
}

const CELL = `padding:8px 6px;font-size:13px;line-height:1.5;color:${COLORS.body};border-bottom:1px solid ${COLORS.rule};vertical-align:top;word-break:keep-all;`;
const HEAD_CELL = `padding:0 6px 8px;font-size:12px;color:${COLORS.faint};text-align:left;border-bottom:1px solid ${COLORS.rule};`;

/**
 * "그 외 관심종목" 표. 행이 없으면 빈 문자열. 메일 클라이언트는 미디어 쿼리를 대부분
 * 무시하므로 모바일 접힘 대신 테이블을 유지하고 셀 안에서 줄바꿈한다.
 */
function briefTableHtml(
    rows: readonly SymbolBriefRow[],
    locale: Locale,
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver
): string {
    if (rows.length === 0) return '';
    const body = rows
        .map(row => {
            const cells = briefRowCells(row, locale, t, signalLabel);
            return `<tr>
  <td style="${CELL}"><a href="${escapeHtml(row.pageUrl)}" style="color:${COLORS.link};font-weight:600;text-decoration:none;">${escapeHtml(row.brief.symbol)}</a></td>
  <td style="${CELL}white-space:nowrap;">${escapeHtml(cells.close)}${cells.change ? ` <span style="color:${cells.changeColor};">${escapeHtml(cells.change)}</span>` : ''}</td>
  <td style="${CELL}">${escapeHtml(cells.trend)}</td>
  <td style="${CELL}">${escapeHtml(cells.signals)}</td>
</tr>`;
        })
        .join('');
    return `<div style="background:${COLORS.card};border-radius:12px;padding:24px 32px;margin:0 0 16px;">
  <h2 style="font-size:16px;margin:0 0 12px;color:${COLORS.heading};">${escapeHtml(t('sectionBrief'))}</h2>
  <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
    <thead><tr>
      <th scope="col" style="${HEAD_CELL}">${escapeHtml(t('briefColSymbol'))}</th>
      <th scope="col" style="${HEAD_CELL}">${escapeHtml(t('briefColPrice'))}</th>
      <th scope="col" style="${HEAD_CELL}">${escapeHtml(t('briefColTrend'))}</th>
      <th scope="col" style="${HEAD_CELL}">${escapeHtml(t('briefColSignals'))}</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>
</div>`;
}

function briefTableText(
    rows: readonly SymbolBriefRow[],
    locale: Locale,
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver
): string[] {
    if (rows.length === 0) return [];
    return [
        `■ ${t('sectionBrief')}`,
        ...rows.map(row => {
            const cells = briefRowCells(row, locale, t, signalLabel);
            return `- ${row.brief.symbol} · ${[cells.close, cells.change].filter(Boolean).join(' ')} · ${cells.trend} · ${cells.signals}\n  ${row.pageUrl}`;
        }),
        '',
    ];
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
    <p style="font-size:12px;line-height:1.6;color:${COLORS.faint};margin:0;">${escapeHtml(reason)} <a href="${escapeHtml(input.settingsUrl)}" style="color:${COLORS.link};">${escapeHtml(t('manage'))}</a> · <a href="${escapeHtml(input.unsubscribePageUrl)}" style="color:${COLORS.link};">${escapeHtml(t('unsubscribe'))}</a></p>
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
        ...briefTableText(input.briefRows, locale, t, input.signalLabel),
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

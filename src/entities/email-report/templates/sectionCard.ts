import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { escapeHtml } from '@/shared/lib/escapeHtml';
import { reportSymbolLabel } from '../lib/reportSymbolLabel';
import type { ReportLegendEntry, SymbolReport } from '../reportModel';
import { formatAnalysisDate } from './emailFormat';
import { COLORS } from './emailTheme';
import { prose, sectionTitle } from './htmlBlocks';
import { newsHtml, newsLines } from './newsSection';
import { optionsHtml, optionsLines } from './optionsSection';
import type {
    ReportEmailSection,
    ReportEmailTranslator,
    SignalLabelResolver,
    SkillLabelResolver,
} from './reportEmailTypes';
import { signalBriefText } from './signalBriefText';

const CHART_DISPLAY_WIDTH = 536;
const CHART_DISPLAY_HEIGHT = 268;
/** 범례에 적는 최대 칸 수. 넘치는 만큼은 "외 N개". */
const LEGEND_MAX_ENTRIES = 6;

/**
 * 카드 렌더에 쓰는 수신자별 값 — 분석 날짜를 수신자 달력(`timeZone`)으로 적고, 범례의 패턴 이름을 수신자 로케일
 * 표시명(`skillLabel`)으로 바꾼다.
 */
export interface SectionRenderContext {
    timeZone: string;
    skillLabel: SkillLabelResolver;
}

/** 번역 키는 리터럴로 부른다 — 추출기가 `t(변수)`를 못 봐 키를 지운다. */
function legendName(
    entry: ReportLegendEntry,
    t: ReportEmailTranslator,
    skillLabel: SkillLabelResolver
): string {
    switch (entry.kind) {
        case 'card':
            return skillLabel(entry.name);
        case 'trendUp':
            return t('legendTrendUp');
        case 'trendDown':
            return t('legendTrendDown');
        case 'fibonacci':
            return t('legendFibonacci');
        case 'divergence':
            return t('legendDivergence');
        case 'elliott':
            return t('legendElliott');
    }
}

/** 차트 아래에 적는 근거 한 줄 — 작도와 분석 글이 어느 날 분석인지(CS-18). 날짜가 하나도 없으면 `null`. */
function basisCaption(
    section: ReportEmailSection,
    locale: Locale,
    t: ReportEmailTranslator,
    timeZone: string
): string | null {
    const { report, drawings } = section;
    const drawingsDate =
        drawings === null || drawings === undefined
            ? null
            : formatAnalysisDate(drawings.analyzedAt, locale, timeZone);
    const proseDate =
        report.technical === null || report.analyzedAt === null
            ? null
            : formatAnalysisDate(report.analyzedAt, locale, timeZone);
    if (drawingsDate !== null && proseDate !== null) {
        return drawingsDate === proseDate
            ? t('analysisBasis', { v0: drawingsDate })
            : t('chartAndProseBasis', { v0: drawingsDate, v1: proseDate });
    }
    if (drawingsDate !== null)
        return t('chartDrawingsBasis', { v0: drawingsDate });
    if (proseDate !== null) return t('proseBasis', { v0: proseDate });
    return null;
}

function legendHtml(
    section: ReportEmailSection,
    t: ReportEmailTranslator,
    skillLabel: SkillLabelResolver
): string {
    const entries = section.drawings?.legend ?? [];
    if (entries.length === 0) return '';
    const shown = entries.slice(0, LEGEND_MAX_ENTRIES);
    const chips = shown.map(
        entry =>
            `<span style="display:inline-block;margin:0 14px 0 0;white-space:nowrap;"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${escapeHtml(entry.color)};margin:0 6px 0 0;vertical-align:middle;"></span>${escapeHtml(legendName(entry, t, skillLabel))}</span>`
    );
    const more =
        entries.length > shown.length
            ? `<span style="white-space:nowrap;">${escapeHtml(t('legendMore', { v0: String(entries.length - shown.length) }))}</span>`
            : '';
    return `<p style="font-size:12px;line-height:1.9;color:${COLORS.muted};margin:8px 0 0;">${chips.join('')}${more}</p>`;
}

function signalLineHtml(
    section: ReportEmailSection,
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver
): string {
    const { brief } = section;
    if (brief.signals === null) return '';
    const trend =
        brief.trend === null
            ? ''
            : `<span style="color:${COLORS.heading};font-weight:600;">${escapeHtml(t(`trendState.${brief.trend}`))}</span> | `;
    return `<p style="font-size:13px;line-height:1.6;color:${COLORS.muted};margin:0 0 12px;">${trend}${escapeHtml(signalBriefText(brief.signals, t, signalLabel))}</p>`;
}

function captionHtml(caption: string | null): string {
    return caption === null
        ? ''
        : `<p style="font-size:12px;line-height:1.6;color:${COLORS.muted};margin:6px 0 0;">${escapeHtml(caption)}</p>`;
}

function analysisHtml(report: SymbolReport, t: ReportEmailTranslator): string {
    const { technical } = report;
    if (technical === null) {
        return `<p style="font-size:13px;line-height:1.6;color:${COLORS.muted};margin:16px 0 0;">${escapeHtml(t('noAnalysis'))}</p>`;
    }
    return [
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
}

function analysisLines(
    report: SymbolReport,
    t: ReportEmailTranslator
): string[] {
    const { technical } = report;
    if (technical === null) return [t('noAnalysis')];
    return [
        ...(report.plain ? ['', `[${t('sectionPlain')}]`, report.plain] : []),
        ...(technical.summary
            ? ['', `[${t('sectionTechnical')}]`, technical.summary]
            : []),
        ...(technical.patterns.length > 0
            ? ['', `[${t('sectionPatterns')}]`, ...technical.patterns]
            : []),
    ];
}

/** 종목 한 칸의 HTML 카드 — 신호 줄, 차트, 분석, 뉴스, 옵션, 종목 페이지 링크 순. */
export function sectionHtml(
    section: ReportEmailSection,
    locale: Locale,
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver,
    brand: string,
    ctx: SectionRenderContext
): string {
    const { report } = section;
    const label = reportSymbolLabel(report.symbol, section.brief.names, locale);
    const alt =
        section.drawings === null || section.drawings === undefined
            ? t('chartAlt', { v0: label.text })
            : t('chartAltDrawings', { v0: label.text });
    return `<div style="background:${COLORS.card};border-radius:12px;padding:24px 32px;margin:0 0 16px;">
  <h2 style="font-size:20px;margin:0 0 12px;color:${COLORS.heading};">${escapeHtml(label.name)}${label.name === label.code ? '' : ` <span style="font-size:14px;font-weight:400;color:${COLORS.muted};">${escapeHtml(label.code)}</span>`}</h2>
  ${signalLineHtml(section, t, signalLabel)}
  <a href="${escapeHtml(section.pageUrl)}"><img src="${escapeHtml(section.chartUrl)}" width="${CHART_DISPLAY_WIDTH}" height="${CHART_DISPLAY_HEIGHT}" alt="${escapeHtml(alt)}" style="display:block;width:100%;max-width:${CHART_DISPLAY_WIDTH}px;height:auto;border:0;border-radius:8px;" /></a>
  ${legendHtml(section, t, ctx.skillLabel)}${captionHtml(basisCaption(section, locale, t, ctx.timeZone))}
  ${analysisHtml(report, t)}
  ${newsHtml(report.news, t)}
  ${optionsHtml(report.options, t)}
  <p style="margin:20px 0 0;"><a href="${escapeHtml(section.pageUrl)}" style="color:${COLORS.link};font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(t('viewOnSite', { v0: brand }))} →</a></p>
</div>`;
}

/** 같은 카드의 평문 버전(`text/plain` 파트). 차트 이미지는 담지 않는다. */
export function sectionText(
    section: ReportEmailSection,
    locale: Locale,
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver,
    brand: string,
    ctx: SectionRenderContext
): string {
    const { report, brief } = section;
    const names = (section.drawings?.legend ?? []).map(entry =>
        legendName(entry, t, ctx.skillLabel)
    );
    const caption = basisCaption(section, locale, t, ctx.timeZone);
    const trend =
        brief.trend === null ? '' : `${t(`trendState.${brief.trend}`)} | `;
    return [
        `■ ${reportSymbolLabel(report.symbol, brief.names, locale).text}`,
        ...(brief.signals === null
            ? []
            : [`${trend}${signalBriefText(brief.signals, t, signalLabel)}`]),
        ...(names.length === 0
            ? []
            : [
                  new Intl.ListFormat(INTL_LOCALE[locale], {
                      type: 'conjunction',
                      style: 'narrow',
                  }).format(names),
              ]),
        ...(caption === null ? [] : [caption]),
        ...analysisLines(report, t),
        ...newsLines(report.news, t),
        ...optionsLines(report.options, t),
        '',
        `${t('viewOnSite', { v0: brand })}: ${section.pageUrl}`,
    ].join('\n');
}

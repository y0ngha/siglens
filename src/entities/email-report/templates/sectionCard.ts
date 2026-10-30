import { escapeHtml } from '@/shared/lib/escapeHtml';
import type { SymbolReport } from '../reportModel';
import { COLORS } from './emailTheme';
import { prose, sectionTitle } from './htmlBlocks';
import { newsHtml, newsLines } from './newsSection';
import { optionsHtml, optionsLines } from './optionsSection';
import type {
    ReportEmailSection,
    ReportEmailTranslator,
    SignalLabelResolver,
} from './reportEmailTypes';
import { signalBriefText } from './signalBriefText';

const CHART_DISPLAY_WIDTH = 536;
const CHART_DISPLAY_HEIGHT = 268;

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
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver,
    brand: string
): string {
    const { report } = section;
    return `<div style="background:${COLORS.card};border-radius:12px;padding:24px 32px;margin:0 0 16px;">
  <h2 style="font-size:20px;margin:0 0 12px;color:${COLORS.heading};">${escapeHtml(report.symbol)}</h2>
  ${signalLineHtml(section, t, signalLabel)}
  <a href="${escapeHtml(section.pageUrl)}"><img src="${escapeHtml(section.chartUrl)}" width="${CHART_DISPLAY_WIDTH}" height="${CHART_DISPLAY_HEIGHT}" alt="${escapeHtml(t('chartAlt', { v0: report.symbol }))}" style="display:block;width:100%;max-width:${CHART_DISPLAY_WIDTH}px;height:auto;border:0;border-radius:8px;" /></a>
  ${analysisHtml(report, t)}
  ${newsHtml(report.news, t)}
  ${optionsHtml(report.options, t)}
  <p style="margin:20px 0 0;"><a href="${escapeHtml(section.pageUrl)}" style="color:${COLORS.link};font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(t('viewOnSite', { v0: brand }))} →</a></p>
</div>`;
}

/** 같은 카드의 평문 버전(`text/plain` 파트). 차트 이미지는 담지 않는다. */
export function sectionText(
    section: ReportEmailSection,
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver,
    brand: string
): string {
    const { report, brief } = section;
    const trend =
        brief.trend === null ? '' : `${t(`trendState.${brief.trend}`)} | `;
    return [
        `■ ${report.symbol}`,
        ...(brief.signals === null
            ? []
            : [`${trend}${signalBriefText(brief.signals, t, signalLabel)}`]),
        ...analysisLines(report, t),
        ...newsLines(report.news, t),
        ...optionsLines(report.options, t),
        '',
        `${t('viewOnSite', { v0: brand })}: ${section.pageUrl}`,
    ].join('\n');
}

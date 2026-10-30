import { escapeHtml } from '@/shared/lib/escapeHtml';
import type { SymbolReportOptions } from '../reportModel';
import { COLORS } from './emailTheme';
import { formatPercent } from './emailFormat';
import { prose, sectionTitle } from './htmlBlocks';
import type { ReportEmailTranslator } from './reportEmailTypes';

/**
 * 값이 있는 옵션 지표만 `라벨: 값` 줄로 만든다. 변동폭은 만기일이 비어 있으면 문구를
 * 만들 수 없어 함께 뺀다.
 */
export function optionsMetricLines(
    options: SymbolReportOptions,
    t: ReportEmailTranslator
): string[] {
    return [
        options.putCallRatio === null
            ? null
            : `${t('optionsPutCall')}: ${options.putCallRatio.toFixed(2)}`,
        options.atmImpliedVolatility === null
            ? null
            : `${t('optionsIv')}: ${formatPercent(options.atmImpliedVolatility * 100, 1)}`,
        options.impliedMovePercent === null || !options.expirationDate
            ? null
            : `${t('optionsMove', { v0: options.expirationDate })}: ±${formatPercent(options.impliedMovePercent, 1)}`,
    ].filter((line): line is string => line !== null);
}

/** 옵션 섹션 HTML. 옵션이 없거나 보여 줄 지표·요약이 모두 없으면 빈 문자열. */
export function optionsHtml(
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

/** 옵션 섹션 평문 줄. 보여 줄 지표·요약이 없으면 빈 배열. */
export function optionsLines(
    options: SymbolReportOptions | null,
    t: ReportEmailTranslator
): string[] {
    if (options === null) return [];
    const metrics = optionsMetricLines(options, t);
    if (metrics.length === 0 && !options.summary) return [];
    return [
        '',
        `[${t('sectionOptions')}]`,
        ...metrics,
        ...(options.summary ? [options.summary] : []),
    ];
}

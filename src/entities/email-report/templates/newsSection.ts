import { escapeHtml } from '@/shared/lib/escapeHtml';
import type { NewsSentiment } from '@y0ngha/siglens-core';
import type { SymbolReportNews } from '../reportModel';
import { COLORS } from './emailTheme';
import { sectionTitle } from './htmlBlocks';
import type { ReportEmailTranslator } from './reportEmailTypes';

const SENTIMENT_COLOR: Record<NewsSentiment, string> = {
    bullish: COLORS.bullish,
    bearish: COLORS.bearish,
    neutral: COLORS.muted,
};

/** 외부 기사 URL은 http(s)만 링크로 건다 — `javascript:` 같은 스킴은 이스케이프로 막히지 않는다. */
export function isHttpUrl(url: string): boolean {
    return /^https?:\/\//i.test(url);
}

function sentimentLabel(
    news: SymbolReportNews,
    t: ReportEmailTranslator
): string {
    if (news.sentiment === null) return '';
    return `<span style="color:${SENTIMENT_COLOR[news.sentiment]};font-weight:600;">[${escapeHtml(t(`sentiment.${news.sentiment}`))}]</span> `;
}

function newsTitleHtml(
    news: SymbolReportNews,
    t: ReportEmailTranslator
): string {
    const label = `${sentimentLabel(news, t)}${escapeHtml(news.title)}`;
    return isHttpUrl(news.url)
        ? `<a href="${escapeHtml(news.url)}" style="color:${COLORS.link};font-size:14px;line-height:1.5;text-decoration:none;">${label}</a>`
        : `<span style="color:${COLORS.heading};font-size:14px;line-height:1.5;">${label}</span>`;
}

/** 뉴스 목록 HTML 블록. 기사가 없으면 빈 문자열. */
export function newsHtml(
    items: readonly SymbolReportNews[],
    t: ReportEmailTranslator
): string {
    if (items.length === 0) return '';
    const rows = items
        .map(
            n => `<li style="margin:0 0 10px;">
  ${newsTitleHtml(n, t)}
  <span style="display:block;font-size:12px;color:${COLORS.faint};">${escapeHtml(n.source)}</span>
  ${n.summary ? `<span style="display:block;font-size:13px;line-height:1.6;color:${COLORS.body};margin-top:2px;">${escapeHtml(n.summary)}</span>` : ''}
</li>`
        )
        .join('');
    return `${sectionTitle(t('sectionNews'))}<ul style="padding-left:18px;margin:0;">${rows}</ul>`;
}

/** 뉴스 목록 평문 줄. 기사가 없으면 빈 배열, 있으면 앞에 빈 줄과 제목 줄이 붙는다. */
export function newsLines(
    items: readonly SymbolReportNews[],
    t: ReportEmailTranslator
): string[] {
    if (items.length === 0) return [];
    return [
        '',
        `[${t('sectionNews')}]`,
        ...items.flatMap(n => [
            `- ${n.title} (${n.source})`,
            ...(isHttpUrl(n.url) ? [`  ${n.url}`] : []),
            ...(n.summary ? [`  ${n.summary}`] : []),
        ]),
    ];
}

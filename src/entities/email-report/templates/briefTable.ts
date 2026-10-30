import type { Locale } from '@/shared/i18n/locales';
import { escapeHtml } from '@/shared/lib/escapeHtml';
import { COLORS } from './emailTheme';
import { formatClose, formatSignedPercent } from './emailFormat';
import type {
    ReportEmailTranslator,
    SignalLabelResolver,
    SymbolBriefRow,
} from './reportEmailTypes';
import { signalBriefText } from './signalBriefText';

const CELL = `padding:8px 6px;font-size:13px;line-height:1.5;color:${COLORS.body};border-bottom:1px solid ${COLORS.rule};vertical-align:top;word-break:keep-all;`;
const HEAD_CELL = `padding:0 6px 8px;font-size:12px;color:${COLORS.faint};text-align:left;border-bottom:1px solid ${COLORS.rule};`;

/** 표 한 행의 표시 문자열 — HTML 표와 평문 목록이 같은 값을 쓴다. */
export interface BriefRowCells {
    close: string;
    change: string;
    changeColor: string;
    trend: string;
    signals: string;
}

function changeColorFor(pct: number | null): string {
    if (pct === null || pct === 0) return COLORS.muted;
    return pct > 0 ? COLORS.bullish : COLORS.bearish;
}

/**
 * 한 행의 표시 값. 신호 요약이 `null`(일봉 조회 실패)이면 종가·등락도 믿을 수 없어
 * 전부 비우고 "데이터 없음"만 적는다.
 */
export function briefRowCells(
    row: SymbolBriefRow,
    locale: Locale,
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver
): BriefRowCells {
    const { brief } = row;
    if (brief.signals === null) {
        return {
            close: '-',
            change: '',
            changeColor: COLORS.muted,
            trend: '-',
            signals: t('briefNoData'),
        };
    }
    const pct = brief.changePercent;
    return {
        close: brief.close === null ? '-' : formatClose(brief.close, locale),
        change: pct === null ? '' : formatSignedPercent(pct),
        changeColor: changeColorFor(pct),
        trend: brief.trend === null ? '-' : t(`trendState.${brief.trend}`),
        signals: signalBriefText(brief.signals, t, signalLabel),
    };
}

/**
 * "그 외 관심종목" 표. 행이 없으면 빈 문자열. 메일 클라이언트는 미디어 쿼리를 대부분
 * 무시하므로 모바일 접힘 대신 테이블을 유지하고 셀 안에서 줄바꿈한다.
 */
export function briefTableHtml(
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

/** 같은 표의 평문 줄. 행이 없으면 빈 배열, 있으면 끝에 빈 줄이 붙는다. */
export function briefTableLines(
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
            return `- ${row.brief.symbol} | ${[cells.close, cells.change].filter(Boolean).join(' ')} | ${cells.trend} | ${cells.signals}\n  ${row.pageUrl}`;
        }),
        '',
    ];
}

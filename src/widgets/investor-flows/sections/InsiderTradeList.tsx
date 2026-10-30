/**
 * 내부자 매수·매도 거래 목록 — 점수 창 안 거래와, 창 밖(시작 전·끝난 뒤) 거래를 묶음으로 나눠 보인다.
 */
import { useTranslations } from 'next-intl';
import type { InvestorFlowsWindow } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { formatInteger } from '../utils/flowFormat';
import type { InsiderTableData } from '../utils/insider';
import { OutsideWindowGroup } from '../ui/insider/OutsideWindowGroup';
import { TradeRecords } from '../ui/insider/TradeRecords';
import { OmittedNote } from '../ui/notes/OmittedNote';

interface InsiderTradeListProps {
    readonly table: InsiderTableData;
    /** 점수 창 — 창 밖 묶음의 제목에 경계 날짜를 적는다. 모르면 묶음을 나누지 않는다(`buildInsiderTable`). */
    readonly scoringWindow: InvestorFlowsWindow | null;
}

/**
 * 내부자 매수·매도 거래 목록. 좁은 화면은 카드, 넓은 화면은 표(가로 스크롤 없음). 날짜는 ASCII라 mono,
 * 금액·주식 수는 로케일 축약(한글 포함)이라 `tabular-nums`만 쓴다(`DESIGN.md` 문구 규약).
 *
 * 점수 창 밖의 거래는 "집계 기간 밖" 묶음으로 따로 그린다 — 위 요약 카드의 건수·금액은 창 안 거래만 센 값이라, 섞어 두면 창 밖의
 * 매수가 "매수 0건" 아래에 보인다. 창 시작 전 거래와 창이 끝난 뒤 거래는 제목이 달라 두 묶음으로 나뉜다.
 */
export function InsiderTradeList({
    table,
    scoringWindow,
}: InsiderTradeListProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const { rows, beforeWindowRows, afterWindowRows } = table;
    const hasOutside = beforeWindowRows.length + afterWindowRows.length > 0;
    const emptyText =
        hasOutside && scoringWindow !== null
            ? t('insider.noTradesInWindow', {
                  days: formatInteger(scoringWindow.days, locale),
              })
            : t('insider.noTrades');
    const from = scoringWindow?.from ?? null;
    const to = scoringWindow?.to ?? null;
    return (
        <div>
            <h3 className={cn('mb-2', HEADING_SUBSECTION)}>
                {t('insider.tableTitle')}
            </h3>
            {rows.length === 0 ? (
                <p className="text-sm text-secondary-300">{emptyText}</p>
            ) : (
                <TradeRecords rows={rows} caption={t('insider.tableTitle')} />
            )}
            {from !== null && beforeWindowRows.length > 0 && (
                <OutsideWindowGroup
                    rows={beforeWindowRows}
                    title={t('insider.outsideWindowTitle', { from })}
                />
            )}
            {to !== null && afterWindowRows.length > 0 && (
                <OutsideWindowGroup
                    rows={afterWindowRows}
                    title={t('insider.afterWindowTitle', { to })}
                />
            )}
            {table.omittedCount > 0 && (
                <OmittedNote>
                    {t('insider.omitted', {
                        count: formatInteger(table.omittedCount, locale),
                    })}
                </OmittedNote>
            )}
            {table.omittedOtherCount > 0 && (
                <OmittedNote>
                    {t('insider.omittedOther', {
                        count: formatInteger(table.omittedOtherCount, locale),
                    })}
                </OmittedNote>
            )}
        </div>
    );
}

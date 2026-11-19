'use client';

import { useTranslations } from 'next-intl';
import type { ChatFlowsUsBlock } from '@/entities/chat-conversation/types';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { BarColumns, type ColumnGroup } from './BarColumns';
import { fillClass, signedCompactNumber } from './format';
import { VisualBlockFrame, type VisualTable } from './VisualBlockFrame';

/**
 * 미국 내부자 월별 순매수 금액 — 수급 탭에 월별 내부자 그림이 없어 새로 그린다(기관 분기 막대는 수급 탭의
 * `QuarterFlowChart`를 재사용한다). 내부자 거래가 없으면 그리지 않는다.
 */
export function InsiderFlowsBlockView({
    block,
}: {
    readonly block: ChatFlowsUsBlock;
}) {
    const t = useTranslations('widgets.chart');
    const locale = useResolvedLocale();
    const { insiderNetValue } = block;
    if (insiderNetValue.length === 0) return null;
    const groups: ColumnGroup[] = insiderNetValue.map(m => ({
        key: m.month,
        label: m.month.slice(5),
        title: `${m.month}: ${signedCompactNumber(m.value, locale)}`,
        bars: [{ id: 'net', value: m.value, fillClass: fillClass(m.value) }],
    }));
    const table: VisualTable = {
        head: [t('ChatVisual.colMonth'), t('ChatVisual.colInsiderNet')],
        rows: insiderNetValue.map(m => [
            m.month,
            signedCompactNumber(m.value, locale),
        ]),
    };
    const total = insiderNetValue.reduce((acc, m) => acc + m.value, 0);
    return (
        <VisualBlockFrame
            title={t('ChatVisual.flowsInsiderCaption')}
            ariaLabel={t('ChatVisual.flowsInsiderAria', {
                symbol: block.name ?? block.symbol,
                months: insiderNetValue.length,
                total: signedCompactNumber(total, locale),
            })}
            tableLabel={t('ChatVisual.dataTable')}
            table={table}
            asOfText={t('ChatVisual.asOf', { date: block.asOf.slice(0, 10) })}
        >
            <BarColumns
                groups={groups}
                formatAxis={v => signedCompactNumber(v, locale)}
            />
        </VisualBlockFrame>
    );
}

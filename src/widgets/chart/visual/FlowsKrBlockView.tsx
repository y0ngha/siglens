'use client';

import { useTranslations } from 'next-intl';
import type { ChatFlowsKrBlock } from '@/entities/chat-conversation/types';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { BarColumns, type ColumnGroup } from './BarColumns';
import { NO_VALUE, signedCompactNumber } from './format';
import { VisualBlockFrame, type VisualTable } from './VisualBlockFrame';

/** 한국 일별 열에서 눈금을 다는 간격(일). */
const KR_LABEL_EVERY = 5;

/**
 * 한국 수급 블록 — 투자자별(외국인·기관·개인) 일별 순매수 세 계열. 시그렌즈 수급 탭은 한국을 그리지 않아(KRX 라이선스)
 * 재사용할 위젯이 없는, 새로 그리는 그림이다.
 */
export function FlowsKrBlockView({
    block,
}: {
    readonly block: ChatFlowsKrBlock;
}) {
    const t = useTranslations('widgets.chart');
    const locale = useResolvedLocale();
    const signed = (v: number | null): string =>
        v === null ? NO_VALUE : signedCompactNumber(v, locale);
    const sum = (
        pick: (d: ChatFlowsKrBlock['days'][number]) => number | null
    ) =>
        block.days.reduce<number | null>((acc, d) => {
            const v = pick(d);
            return acc === null || v === null ? null : acc + v;
        }, 0);
    const groups: ColumnGroup[] = block.days.map((d, i) => ({
        key: d.date,
        label: i % KR_LABEL_EVERY === KR_LABEL_EVERY - 1 ? d.date.slice(5) : '',
        title: `${d.date}: ${signed(d.foreign)} / ${signed(d.institution)} / ${signed(d.individual)}`,
        bars: [
            { id: 'foreign', value: d.foreign, fillClass: 'bg-primary-400' },
            {
                id: 'institution',
                value: d.institution,
                fillClass: 'bg-ui-warning',
            },
            {
                id: 'individual',
                value: d.individual,
                fillClass: 'bg-secondary-400',
            },
        ],
    }));
    const table: VisualTable = {
        head: [
            t('ChatVisual.colDate'),
            t('ChatVisual.colForeign'),
            t('ChatVisual.colInstitution'),
            t('ChatVisual.colIndividual'),
        ],
        rows: block.days.map(d => [
            d.date,
            signed(d.foreign),
            signed(d.institution),
            signed(d.individual),
        ]),
    };
    const symbol = block.name ?? block.symbol;
    return (
        <VisualBlockFrame
            title={t('ChatVisual.flowsKrTitle', {
                symbol,
                days: block.days.length,
            })}
            ariaLabel={t('ChatVisual.flowsKrAria', {
                symbol,
                days: block.days.length,
                foreign: signed(sum(d => d.foreign) ?? 0),
                institution: signed(sum(d => d.institution) ?? 0),
                individual: signed(sum(d => d.individual)),
            })}
            tableLabel={t('ChatVisual.dataTable')}
            table={table}
            legend={[
                {
                    id: 'foreign',
                    label: t('ChatVisual.legendForeign'),
                    swatchClass: 'bg-primary-400',
                },
                {
                    id: 'institution',
                    label: t('ChatVisual.legendInstitution'),
                    swatchClass: 'bg-ui-warning',
                },
                {
                    id: 'individual',
                    label: t('ChatVisual.legendIndividual'),
                    swatchClass: 'bg-secondary-400',
                },
            ]}
            asOfText={t('ChatVisual.asOf', { date: block.asOf.slice(0, 10) })}
        >
            <BarColumns
                groups={groups}
                formatAxis={v => signedCompactNumber(v, locale)}
            />
        </VisualBlockFrame>
    );
}

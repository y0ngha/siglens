'use client';

import { useTranslations } from 'next-intl';
import type { ChatHeatmapBlock } from '@/entities/chat-conversation/types';
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { CardFieldList } from '@/shared/ui/CardFieldList';
import {
    ResponsiveRecordList,
    type RecordColumn,
} from '@/shared/ui/ResponsiveRecordList';
import { changeTextClass, NO_VALUE, signedPercentOrDash } from './format';
import { VisualBlockCard } from './VisualBlockCard';

const NUMBER_CELL = 'px-3 py-2.5 text-right tabular-nums';

/** 등락률 글자 — 상승·하락은 시세 글자색 토큰(방향은 부호로도 전한다). */
function Change({ value }: { readonly value: number | null }) {
    return (
        <span className={changeTextClass(value)}>
            {signedPercentOrDash(value)}
        </span>
    );
}

/**
 * 시장 히트맵 블록 — 섹터(이름·등락률) 또는 테마 구성 종목(이름·심볼·1·5·20일 등락률)을 표로 보인다. 좁은 화면은
 * 카드, 넓은 화면은 표다(`ResponsiveRecordList`). 섹터는 받은 순서(강한 순) 그대로, 종목은 1일 등락률이 큰 순이다.
 */
export function HeatmapBlockView({
    block,
}: {
    readonly block: ChatHeatmapBlock;
}) {
    const t = useTranslations('widgets.chart');
    const asOfText = t('ChatVisual.asOf', { date: block.asOf.slice(0, 10) });
    if (block.scope === 'sectors') {
        // 키는 리터럴 호출로 둔다 — 삼항 안의 키 문자열은 추출기가 못 봐 카탈로그에서 지워진다.
        const market =
            block.market === 'kr'
                ? t('ChatVisual.marketKr')
                : t('ChatVisual.marketUs');
        const title = t('ChatVisual.heatmapSectorsTitle', { market });
        const columns: readonly RecordColumn[] = [
            { label: t('ChatVisual.colSector'), align: 'left' },
            { label: t('ChatVisual.colDayChange'), align: 'right' },
        ];
        return (
            <VisualBlockCard title={title} asOfText={asOfText}>
                <ResponsiveRecordList
                    caption={title}
                    columns={columns}
                    cards={block.sectors.map(s => (
                        <li
                            key={s.label}
                            className={cn(
                                SURFACE_NESTED,
                                'flex items-baseline justify-between gap-2 px-3 py-2 text-sm'
                            )}
                        >
                            <span className="min-w-0 text-secondary-100">
                                {s.label}
                            </span>
                            <span className="tabular-nums">
                                <Change value={s.changePct} />
                            </span>
                        </li>
                    ))}
                    rows={block.sectors.map(s => (
                        <tr
                            key={s.label}
                            className="border-b border-secondary-700 last:border-b-0"
                        >
                            <th
                                scope="row"
                                className="py-2.5 pr-3 text-left font-medium text-secondary-100"
                            >
                                {s.label}
                            </th>
                            <td className="py-2.5 pl-3 text-right tabular-nums">
                                <Change value={s.changePct} />
                            </td>
                        </tr>
                    ))}
                />
            </VisualBlockCard>
        );
    }
    const title = t('ChatVisual.heatmapThemeTitle', { label: block.label });
    const ranked = block.members.toSorted(
        (a, b) => (b.changePct1d ?? -Infinity) - (a.changePct1d ?? -Infinity)
    );
    const columns: readonly RecordColumn[] = [
        { label: t('ChatVisual.colName'), align: 'left' },
        { label: t('ChatVisual.colSymbol'), align: 'left' },
        { label: t('ChatVisual.colDay1'), align: 'right' },
        { label: t('ChatVisual.colDay5'), align: 'right' },
        { label: t('ChatVisual.colDay20'), align: 'right' },
    ];
    return (
        <VisualBlockCard title={title} asOfText={asOfText}>
            <ResponsiveRecordList
                caption={title}
                columns={columns}
                cards={ranked.map(m => (
                    <li key={m.symbol} className={cn(SURFACE_NESTED, 'p-3')}>
                        <div className="flex items-baseline justify-between gap-2">
                            <p className="min-w-0 text-sm font-medium break-words text-secondary-100">
                                {m.name ?? m.symbol}
                            </p>
                            <span className="text-sm tabular-nums">
                                <Change value={m.changePct1d} />
                            </span>
                        </div>
                        <CardFieldList
                            fields={[
                                {
                                    label: t('ChatVisual.colSymbol'),
                                    value: m.symbol,
                                },
                                {
                                    label: t('ChatVisual.colDay5'),
                                    value: <Change value={m.changePct5d} />,
                                },
                                {
                                    label: t('ChatVisual.colDay20'),
                                    value: <Change value={m.changePct20d} />,
                                },
                            ]}
                        />
                    </li>
                ))}
                rows={ranked.map(m => (
                    <tr
                        key={m.symbol}
                        className="border-b border-secondary-700 last:border-b-0"
                    >
                        <th
                            scope="row"
                            className="max-w-xs py-2.5 pr-3 text-left font-medium break-words text-secondary-100"
                        >
                            {m.name ?? NO_VALUE}
                        </th>
                        <td className="px-3 py-2.5 font-mono text-xs text-secondary-300">
                            {m.symbol}
                        </td>
                        <td className={NUMBER_CELL}>
                            <Change value={m.changePct1d} />
                        </td>
                        <td className={NUMBER_CELL}>
                            <Change value={m.changePct5d} />
                        </td>
                        <td className="py-2.5 pl-3 text-right tabular-nums">
                            <Change value={m.changePct20d} />
                        </td>
                    </tr>
                ))}
            />
        </VisualBlockCard>
    );
}

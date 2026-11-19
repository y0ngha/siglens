'use client';

import { useTranslations } from 'next-intl';
import type { ChatPortfolioBlock } from '@/entities/chat-conversation/types';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { CardFieldList } from '@/shared/ui/CardFieldList';
import {
    ResponsiveRecordList,
    type RecordColumn,
} from '@/shared/ui/ResponsiveRecordList';
import {
    changeTextClass,
    fixedNumber,
    NO_VALUE,
    signedPercentOrDash,
} from './format';
import { VisualBlockCard } from './VisualBlockCard';

/**
 * 보유종목 블록 — 통화 그룹마다 표(이름·심볼·비중·손익률). 통화를 섞지 않아 비중은 그룹 안에서만 의미가 있다. 좁은
 * 화면은 카드, 넓은 화면은 표다(`ResponsiveRecordList`).
 */
export function PortfolioBlockView({
    block,
}: {
    readonly block: ChatPortfolioBlock;
}) {
    const t = useTranslations('widgets.chart');
    const locale = useResolvedLocale();
    const weight = (v: number | null): string =>
        v === null ? NO_VALUE : `${fixedNumber(v, 1, locale)}%`;
    const columns: readonly RecordColumn[] = [
        { label: t('ChatVisual.colName'), align: 'left' },
        { label: t('ChatVisual.colSymbol'), align: 'left' },
        { label: t('ChatVisual.colWeight'), align: 'right' },
        { label: t('ChatVisual.colPnl'), align: 'right' },
    ];
    return (
        <VisualBlockCard
            title={t('ChatVisual.portfolioTitle')}
            asOfText={t('ChatVisual.asOf', { date: block.asOf.slice(0, 10) })}
        >
            <div className="space-y-4">
                {block.groups.map(group => {
                    const groupTitle = t('ChatVisual.portfolioGroup', {
                        currency: group.currency,
                    });
                    return (
                        <section key={group.currency}>
                            <h3 className="mb-1 text-[11px] font-medium text-secondary-300">
                                {groupTitle}
                            </h3>
                            <ResponsiveRecordList
                                caption={groupTitle}
                                columns={columns}
                                cards={group.holdings.map(h => (
                                    <li
                                        key={h.symbol}
                                        className={cn(SURFACE_NESTED, 'p-3')}
                                    >
                                        <p className="min-w-0 text-sm font-medium break-words text-secondary-100">
                                            {h.name ?? h.symbol}
                                        </p>
                                        <CardFieldList
                                            fields={[
                                                {
                                                    label: t(
                                                        'ChatVisual.colSymbol'
                                                    ),
                                                    value: h.symbol,
                                                },
                                                {
                                                    label: t(
                                                        'ChatVisual.colWeight'
                                                    ),
                                                    value: weight(h.weightPct),
                                                },
                                                {
                                                    label: t(
                                                        'ChatVisual.colPnl'
                                                    ),
                                                    value: (
                                                        <span
                                                            className={changeTextClass(
                                                                h.pnlPct
                                                            )}
                                                        >
                                                            {signedPercentOrDash(
                                                                h.pnlPct
                                                            )}
                                                        </span>
                                                    ),
                                                },
                                            ]}
                                        />
                                    </li>
                                ))}
                                rows={group.holdings.map(h => (
                                    <tr
                                        key={h.symbol}
                                        className="border-b border-secondary-700 last:border-b-0"
                                    >
                                        <th
                                            scope="row"
                                            className="max-w-xs py-2.5 pr-3 text-left font-medium break-words text-secondary-100"
                                        >
                                            {h.name ?? NO_VALUE}
                                        </th>
                                        <td className="px-3 py-2.5 font-mono text-xs text-secondary-300">
                                            {h.symbol}
                                        </td>
                                        <td className="px-3 py-2.5 text-right tabular-nums">
                                            {weight(h.weightPct)}
                                        </td>
                                        <td
                                            className={cn(
                                                'py-2.5 pl-3 text-right tabular-nums',
                                                changeTextClass(h.pnlPct)
                                            )}
                                        >
                                            {signedPercentOrDash(h.pnlPct)}
                                        </td>
                                    </tr>
                                ))}
                            />
                        </section>
                    );
                })}
            </div>
        </VisualBlockCard>
    );
}

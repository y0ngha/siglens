/**
 * 상위 보유 기관 목록 본문 — 좁은 화면은 카드, 넓은 화면은 표.
 */
import { useTranslations } from 'next-intl';
import type { InstitutionalHolderChange } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { formatCompact } from '../../utils/flowFormat';
import { CardFieldList } from '../tables/CardFieldList';
import {
    ResponsiveRecordList,
    type RecordColumn,
} from '../tables/ResponsiveRecordList';
import { HolderChangeText } from './HolderChangeText';
import { StatusBadge } from './StatusBadge';

/** 같은 기관이 상태만 다른 두 행으로 올 수 있어 상태까지 키에 넣는다. */
function holderKey(holder: InstitutionalHolderChange): string {
    return `${holder.cik}-${holder.change}`;
}

/** 상위 보유 기관 목록(카드·표). */
export function HolderRecords({
    holders,
}: {
    readonly holders: readonly InstitutionalHolderChange[];
}) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const columns: readonly RecordColumn[] = [
        { label: t('holders.colName'), align: 'left' },
        { label: t('holders.colShares'), align: 'right' },
        { label: t('holders.colChange'), align: 'right' },
        { label: t('holders.colStatus'), align: 'left' },
    ];
    return (
        <ResponsiveRecordList
            caption={t('holders.title')}
            columns={columns}
            cards={holders.map(holder => (
                <li
                    key={holderKey(holder)}
                    className={cn(SURFACE_NESTED, 'p-3')}
                >
                    <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 text-sm font-medium break-words text-secondary-100">
                            {holder.filerName}
                        </p>
                        <StatusBadge change={holder.change} />
                    </div>
                    <CardFieldList
                        fields={[
                            {
                                label: t('holders.colShares'),
                                value: formatCompact(holder.shares, locale),
                            },
                            {
                                label: t('holders.colChange'),
                                value: <HolderChangeText holder={holder} />,
                            },
                        ]}
                    />
                </li>
            ))}
            rows={holders.map(holder => (
                <tr
                    key={holderKey(holder)}
                    className="border-b border-secondary-700 last:border-b-0"
                >
                    <th
                        scope="row"
                        className="max-w-xs py-2.5 pr-3 text-left font-medium break-words text-secondary-100"
                    >
                        {holder.filerName}
                    </th>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatCompact(holder.shares, locale)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                        <HolderChangeText holder={holder} />
                    </td>
                    <td className="py-2.5 pl-3">
                        <StatusBadge change={holder.change} />
                    </td>
                </tr>
            ))}
        />
    );
}

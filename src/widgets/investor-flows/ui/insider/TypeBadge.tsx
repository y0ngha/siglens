/**
 * 내부자 거래 종류 배지(매수 ▲ / 매도 ▼) — 색 + 기호 + 글자.
 */
import { useTranslations } from 'next-intl';
import type { InsiderTransaction } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';

type TradeSide = 'buy' | 'sell';

const SIDE_CLASS: Record<TradeSide, string> = {
    buy: 'bg-ui-success/10 text-ui-success-text',
    sell: 'bg-ui-danger/10 text-ui-danger-text',
};

const SIDE_MARK: Record<TradeSide, string> = {
    buy: '▲',
    sell: '▼',
};

/** 거래 표에는 매수·매도만 오므로(`buildInsiderTable`) 매수가 아니면 매도로 읽는다. */
export function TypeBadge({
    type,
}: {
    readonly type: InsiderTransaction['type'];
}) {
    const t = useTranslations('widgets.investor-flows');
    const side: TradeSide = type === 'buy' ? 'buy' : 'sell';
    const labels: Record<TradeSide, string> = {
        buy: t('insider.buy'),
        sell: t('insider.sell'),
    };
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
                SIDE_CLASS[side]
            )}
        >
            <span aria-hidden="true">{SIDE_MARK[side]}</span>
            {labels[side]}
        </span>
    );
}

/** Orchestrator of the congress trades table: row limiting, scroll hint, caption and truncation note. */
import { useTranslations } from 'next-intl';
import type { CongressTrade } from '@y0ngha/siglens-core';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { CongressTradesEmpty } from './CongressTradesEmpty';
import { TradeRow } from './ui/trades-table/TradeRow';
import { TradesTableHead } from './ui/trades-table/TradesTableHead';
import { MAX_ROWS, limitRows } from './utils/tradeRows';

interface CongressTradesTableProps {
    trades: CongressTrade[];
}

/**
 * Table of congressional trade disclosures for a symbol.
 *
 * Renders the newest `MAX_ROWS` rows and says so when the rest was cut (visible
 * note plus the screen-reader caption). Falls back to `CongressTradesEmpty` for
 * an empty list — distinct from the AI summary's `no_trades` branch.
 *
 * Has no `'use client'` directive and uses `useTranslations`, which next-intl
 * supports in server components; the `InfoTooltip` triggers are client
 * components internally.
 */
export function CongressTradesTable({ trades }: CongressTradesTableProps) {
    const t = useTranslations('widgets.congress');
    if (trades.length === 0) {
        return <CongressTradesEmpty />;
    }

    const { rows, total, truncated } = limitRows(trades);
    const countArgs = { v0: MAX_ROWS, v1: total };

    return (
        <div className={SURFACE_CARD}>
            {/*
             * 이 표는 모든 폭에서 가로로 넘친다: 열 10개가 전부 `whitespace-nowrap`이고
             * 열마다 `px-4`라 min-content가 `<main>`(`max-w-5xl`)보다 넓다. 키보드·AT는
             * `role="region"` + `tabIndex`로 닿지만 오버레이 스크롤바는 마우스 사용자에게
             * 단서를 주지 않으므로 힌트를 모든 폭에서 항상 보여 준다.
             */}
            <p className="px-4 pt-3 pb-0 text-xs text-secondary-400">
                {t('CongressTradesTable.b488b1')}
            </p>
            <div
                className="overflow-x-auto rounded-lg focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                role="region"
                aria-label={t('CongressTradesTable.373579')}
                tabIndex={0}
            >
                <table className="w-full text-sm">
                    <caption className="sr-only">
                        {truncated
                            ? t('tradesCaptionTruncated', countArgs)
                            : t('CongressTradesTable.de5545')}
                    </caption>
                    <TradesTableHead />
                    <tbody>
                        {rows.map((trade, idx) => (
                            <TradeRow
                                /* 같은 의원이 같은 날 같은 금액 구간으로 낸 중복 공시가 실제로 있어 자연 키가 없다. 목록은 서버가 정렬해 내려주고 재정렬이 없어 인덱스가 안정적이다. */
                                // react-doctor-disable-next-line react-doctor/no-array-index-as-key
                                key={idx}
                                trade={trade}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
            {truncated && (
                <p className="px-4 pb-3 text-xs text-secondary-400">
                    {t('tradesTruncated', countArgs)}
                </p>
            )}
        </div>
    );
}

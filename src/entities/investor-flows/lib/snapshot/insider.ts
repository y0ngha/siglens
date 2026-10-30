import type {
    InsiderStatistics,
    InsiderTransaction,
} from '@y0ngha/siglens-core';
import type {
    RawInsiderStatistic,
    RawInsiderTrade,
} from '@/shared/api/fmp/investorFlowsProvider.types';
import { compareIsoDate } from '../investorFlowsDates';
import { finiteNumber, nonNegative, isIsoDate } from './snapshotRows';

/** 12개월치 Form 4(대형주는 수백 건 — 대부분 `other`). */
export const SNAPSHOT_MAX_INSIDER_TRANSACTIONS = 600;

/** 분기 내부자 통계는 최근 8분기(2년)만 담는다. */
export const SNAPSHOT_MAX_INSIDER_STAT_QUARTERS = 8;

/** FMP `transactionType` → 매수/매도/기타. `P-Purchase`만 매수, `S-Sale`(+`S-Sale+OE`)만 매도다. */
export function mapInsiderTransactionType(
    raw: string | null | undefined
): InsiderTransaction['type'] {
    if (raw?.startsWith('P-Purchase')) return 'buy';
    if (raw?.startsWith('S-Sale')) return 'sell';
    return 'other';
}

/** FMP Form 4 원본 → core 내부자 거래. 날짜·수량이 유효하지 않은 행은 버리고 최근순으로 상한(`SNAPSHOT_MAX_INSIDER_TRANSACTIONS`)까지 담는다. */
export function buildInsiderTransactions(
    rows: readonly RawInsiderTrade[]
): InsiderTransaction[] {
    return rows
        .flatMap((row): InsiderTransaction[] => {
            const shares = finiteNumber(row.securitiesTransacted);
            if (
                !isIsoDate(row.transactionDate) ||
                !isIsoDate(row.filingDate) ||
                shares === null ||
                shares <= 0
            ) {
                return [];
            }
            const price = finiteNumber(row.price);
            const validPrice = price !== null && price > 0 ? price : null;
            return [
                {
                    date: row.transactionDate.slice(0, 10),
                    filingDate: row.filingDate.slice(0, 10),
                    name: row.reportingName ?? '',
                    role: row.typeOfOwner ?? '',
                    type: mapInsiderTransactionType(row.transactionType),
                    shares,
                    price: validPrice,
                    value:
                        validPrice === null
                            ? null
                            : Math.round(shares * validPrice),
                    sharesOwnedAfter: nonNegative(row.securitiesOwned),
                    url: row.url ?? '',
                },
            ];
        })
        .sort(
            (a, b) =>
                compareIsoDate(b.date, a.date) ||
                compareIsoDate(b.filingDate, a.filingDate)
        )
        .slice(0, SNAPSHOT_MAX_INSIDER_TRANSACTIONS);
}

/** 분기 번호 → 그 분기 말일(`yyyy-mm-dd`). */
const QUARTER_END = ['03-31', '06-30', '09-30', '12-31'] as const;

/** FMP 분기 내부자 통계 → core 타입. 연·분기가 유효하지 않은 행은 버린다. */
export function buildInsiderStats(
    rows: readonly RawInsiderStatistic[]
): InsiderStatistics[] {
    return rows
        .flatMap((row): InsiderStatistics[] => {
            const year = finiteNumber(row.year);
            const quarter = finiteNumber(row.quarter);
            const end = quarter === null ? undefined : QUARTER_END[quarter - 1];
            if (year === null || end === undefined) return [];
            return [
                {
                    period: `${year}-${end}`,
                    acquiredTransactions:
                        finiteNumber(row.acquiredTransactions) ?? 0,
                    disposedTransactions:
                        finiteNumber(row.disposedTransactions) ?? 0,
                    totalAcquired: finiteNumber(row.totalAcquired) ?? 0,
                    totalDisposed: finiteNumber(row.totalDisposed) ?? 0,
                },
            ];
        })
        .sort((a, b) => compareIsoDate(b.period, a.period))
        .slice(0, SNAPSHOT_MAX_INSIDER_STAT_QUARTERS)
        .reverse();
}

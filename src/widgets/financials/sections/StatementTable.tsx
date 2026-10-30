/**
 * 재무제표 표 — 기간을 열, 지표를 행으로 두는 RSC 안전 표(차트 라이브러리 없음).
 */
import { useTranslations } from 'next-intl';
import { StatementTableHead } from '../ui/statement-table/StatementTableHead';
import { StatementTableRow } from '../ui/statement-table/StatementTableRow';
import {
    DEFAULT_STATEMENT_CURRENCY,
    type StatementCurrency,
} from '../utils/statementCurrency';
import type { StatementTableRowData } from '../utils/statementTableTypes';

interface StatementTableProps {
    caption?: string;
    /** 기간 라벨 — 과거→최신(좌→우) 순서. */
    columns: string[];
    rows: StatementTableRowData[];
    /** 금액(`usd`·`perShare`)에 적용할 통화. 생략하면 USD — 미국 종목의 기본 동작. */
    currency?: StatementCurrency;
}

/**
 * 열은 회계연도/기간(과거→최신), 행은 지표다. 값이 없으면 `-`로 표기한다.
 *
 * 캡션은 화면에 내지 않는다(바로 위 h2와 중복). 필요한 이유는 따로 있다 — 스크롤 컨테이너가
 * 모두 `role="region"`이라 스크린리더 랜드마크 목록에 같은 이름이 반복된다. `aria-label`이
 * 캡션을 받아 각 랜드마크를 구분한다.
 */
export function StatementTable({
    caption,
    columns,
    rows,
    currency = DEFAULT_STATEMENT_CURRENCY,
}: StatementTableProps) {
    const t = useTranslations('widgets.financials');
    const tSection = useTranslations('widgets.financials.section');
    return (
        <>
            <p className="mb-2 text-xs text-secondary-400 sm:hidden">
                {t('StatementTable.b488b1')}
            </p>
            <div
                className="overflow-x-auto rounded-lg focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                role="region"
                aria-label={
                    caption
                        ? tSection('tableScrollHint', { v0: caption })
                        : t('StatementTable.99a09e')
                }
                tabIndex={0}
            >
                <table className="w-full text-sm">
                    {caption && (
                        <caption className="sr-only">{caption}</caption>
                    )}
                    <StatementTableHead columns={columns} />
                    <tbody>
                        {rows.map(row => (
                            <StatementTableRow
                                key={row.labelKo}
                                row={row}
                                columns={columns}
                                currency={currency}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

/**
 * 재무제표 금액에 쓰는 통화 — 스냅샷 한 장당 하나를 고른다. 공시자가 보고한 통화를 우선하고,
 * 없거나 일관되지 않으면 상장 통화로 둔다.
 */
import { currencyForSymbol } from '@/shared/config/marketProfile/registry';
import { formatCompactInCurrency } from '@/shared/lib/priceFormat';
import { normalizeReportedCurrency } from '@/shared/lib/reportedCurrency';

/** 재무 금액에 쓰는 ISO 4217 통화 코드. 상장 통화(USD·KRW) 외에 ADR의 본국 통화도 담는다. */
export type StatementCurrency = string;

/** 통화를 넘기지 않은 호출부(미국 종목)의 기본 통화. */
export const DEFAULT_STATEMENT_CURRENCY = 'USD';

interface ReportingRow {
    reportedCurrency?: string | null;
}

/** 보고 통화를 읽을 세 재무제표 행 묶음 — `FinancialsSnapshot`이 그대로 들어맞는다. */
interface ReportingRows {
    income: readonly ReportingRow[];
    balance: readonly ReportingRow[];
    cashFlow: readonly ReportingRow[];
}

/** 코드를 `Intl`이 받아들이는지 — 잘못된 코드를 화면에 붙이지 않기 위한 검사. */
function isFormattableCurrency(code: string): boolean {
    return formatCompactInCurrency(0, code, 'en') !== null;
}

/**
 * 스냅샷의 재무제표 통화를 고른다.
 *
 * ADR(TSM 등)은 상장 통화가 USD여도 본국 통화(TWD)로 보고한다 — 상장 통화로 표기하면 금액이
 * 수십 배 틀리다. 행들이 알려 주는 보고 통화가 하나로 일치하고 `Intl`이 받아들일 때만 그것을
 * 쓰고, 그 밖에는(통화 없음·서로 다른 통화·잘못된 코드) 상장 통화로 둔다.
 */
export function deriveStatementCurrency(
    snapshot: ReportingRows,
    symbol: string
): StatementCurrency {
    const reported = new Set(
        [...snapshot.income, ...snapshot.balance, ...snapshot.cashFlow]
            .map(row => normalizeReportedCurrency(row.reportedCurrency))
            .filter(code => code !== null)
            .map(code => code.toUpperCase())
    );
    const [only] = reported;
    if (reported.size !== 1 || !isFormattableCurrency(only)) {
        return currencyForSymbol(symbol);
    }
    return only;
}

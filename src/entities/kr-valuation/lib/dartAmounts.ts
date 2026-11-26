import type {
    KrReportCode,
    ShareKindCounts,
    ShareTotals,
    StatementFigures,
} from '../model';
import {
    DART_SHARE_COMMON_ROWS,
    DART_SHARE_KIND_ROWS,
    DART_SHARE_PREFERRED_ROWS,
    DART_SHARE_TOTAL_ROW,
    normalizeShareRowLabel,
} from './dartSourceTokens';

/**
 * DART `fnlttSinglAcntAll`(단일회사 전체 재무제표)와 `stockTotqySttus`(주식의 총수 현황) 응답 행에서 PER·PBR 계산에 쓰는 숫자만
 * 읽는다. 순수 함수다 — 네트워크·캐시는 `server/getKrValuationInputs.ts`가 한다.
 *
 * 계정은 **`account_id`**로 찾는다(한글 계정명은 회사마다 다르다). 열 의미는 보고서 종류마다 다르다(실측, 삼성카드·삼성전자 2026):
 * - 사업보고서(11011): `thstrm_amount` = 당기(1년), `frmtrm_amount` = 전기.
 * - 1분기(11013): `thstrm_amount` = 당기 3개월(= 누적), 전년 동기는 `frmtrm_q_amount`/`frmtrm_add_amount`.
 * - 반기(11012)·3분기(11014): `thstrm_amount` = **당기 3개월**, `thstrm_add_amount` = **당기 누적**, 전년 동기 누적 = `frmtrm_add_amount`.
 *   누적이 TTM에 필요한 값이라 `thstrm_add_amount`가 없으면 3개월 값을 누적으로 오인하지 않고 null이다.
 * - 재무상태표: `thstrm_amount` = 당기말 잔액.
 */

const NET_INCOME_OWNERS = 'ifrs-full_ProfitLossAttributableToOwnersOfParent';
const NET_INCOME_TOTAL = 'ifrs-full_ProfitLoss';
const NET_INCOME_NCI =
    'ifrs-full_ProfitLossAttributableToNoncontrollingInterests';
const EQUITY_OWNERS = 'ifrs-full_EquityAttributableToOwnersOfParent';
const EQUITY_TOTAL = 'ifrs-full_Equity';
const EQUITY_NCI = 'ifrs-full_NoncontrollingInterests';

const INCOME_STATEMENTS: readonly string[] = ['IS', 'CIS'];
const BALANCE_SHEET: readonly string[] = ['BS'];

type DartRow = Readonly<Record<string, unknown>>;

/** `'1,234'`·`'-5'` → 숫자. 빈 값·`-`·숫자 아님 → null. */
function parseDartAmount(value: unknown): number | null {
    if (typeof value !== 'string') return null;
    const text = value.replaceAll(',', '').trim();
    if (text === '' || text === '-') return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * `accountId` 행 하나. 같은 계정이 부문·구성요소별로 여러 줄 올 수 있어(`account_detail`이 `-`가 아닌 줄) 합계 줄(`-`)만 쓴다.
 * 손익은 `IS`·`CIS` 어느 쪽에 있어도 같은 값이라 먼저 나온 줄을 쓴다. 자본변동표(`SCE`)·현금흐름표(`CF`)에도 같은 계정 id가 있어
 * `sj_div`로 거른다.
 */
function findRow(
    rows: readonly DartRow[],
    accountId: string,
    statements: readonly string[]
): DartRow | undefined {
    return rows.find(
        row =>
            row.account_id === accountId &&
            typeof row.sj_div === 'string' &&
            statements.includes(row.sj_div) &&
            (row.account_detail === '-' ||
                row.account_detail === '' ||
                row.account_detail === undefined)
    );
}

const columnAmount = (
    row: DartRow | undefined,
    column: string
): number | null => (row === undefined ? null : parseDartAmount(row[column]));

/** 비지배지분이 있는 회사인가 — 지배주주 계정이 없을 때 합계 계정으로 갈음해도 되는지 가른다. */
function hasNoncontrollingInterest(rows: readonly DartRow[]): boolean {
    const equityNci = columnAmount(
        findRow(rows, EQUITY_NCI, BALANCE_SHEET),
        'thstrm_amount'
    );
    const incomeNci = findRow(rows, NET_INCOME_NCI, INCOME_STATEMENTS);
    const incomeNciAmounts = [
        'thstrm_amount',
        'thstrm_add_amount',
        'frmtrm_add_amount',
    ].map(column => columnAmount(incomeNci, column));
    return [equityNci, ...incomeNciAmounts].some(
        amount => amount !== null && amount !== 0
    );
}

interface IncomeColumns {
    ytd: string;
    priorYtd: readonly string[];
    ytdFallback?: string;
}

/** 보고서 종류별 누적 순이익이 든 열(`ytd`)과 전년 동기 누적이 든 열(`priorYtd`, 앞에서부터 처음 숫자인 것). */
const INCOME_COLUMNS: Record<KrReportCode, IncomeColumns> = {
    '11011': { ytd: 'thstrm_amount', priorYtd: ['frmtrm_amount'] },
    '11013': {
        ytd: 'thstrm_add_amount',
        ytdFallback: 'thstrm_amount',
        priorYtd: ['frmtrm_add_amount', 'frmtrm_q_amount'],
    },
    '11012': { ytd: 'thstrm_add_amount', priorYtd: ['frmtrm_add_amount'] },
    '11014': { ytd: 'thstrm_add_amount', priorYtd: ['frmtrm_add_amount'] },
};

function firstAmount(
    row: DartRow | undefined,
    columns: readonly string[]
): number | null {
    return (
        columns
            .map(column => columnAmount(row, column))
            .find(amount => amount !== null) ?? null
    );
}

/** 행이 보고 통화를 밝혔고 그것이 원(`KRW`)이 아니면 거짓. 통화 열이 없으면(옛 응답) 원으로 본다. */
function reportsInWon(rows: readonly DartRow[]): boolean {
    const currencies = rows.flatMap(row =>
        typeof row.currency === 'string' && row.currency !== ''
            ? [row.currency]
            : []
    );
    return currencies.every(currency => currency === 'KRW');
}

/**
 * 재무제표 행 → 순이익(지배주주)·자본(지배주주). 연결 재무제표는 `…AttributableToOwnersOfParent` 계정을 쓰고, 그 계정이 없을 때만
 * 합계 계정(`ProfitLoss`·`Equity`)으로 갈음한다 — 비지배지분이 실제로 있으면 갈음하지 않고 null이다(합계는 지배주주 몫이 아니다).
 * 별도 재무제표에는 지배·비지배 구분이 없어 합계 계정이 곧 답이다.
 */
export function extractStatementFigures(
    rows: readonly DartRow[],
    meta: Pick<StatementFigures, 'year' | 'reportCode' | 'fsDiv'>
): StatementFigures {
    // 원화가 아닌 통화로 공시하는 법인(예: 달러 결산 외국 법인)은 주가(원)와 단위가 달라 PER·PBR을 만들 수 없다.
    if (!reportsInWon(rows)) {
        return {
            ...meta,
            netIncomeYtd: null,
            netIncomePriorYtd: null,
            equity: null,
        };
    }
    const columns = INCOME_COLUMNS[meta.reportCode];
    const hasNci = hasNoncontrollingInterest(rows);
    const incomeRow =
        findRow(rows, NET_INCOME_OWNERS, INCOME_STATEMENTS) ??
        (hasNci
            ? undefined
            : findRow(rows, NET_INCOME_TOTAL, INCOME_STATEMENTS));
    const equityRow =
        findRow(rows, EQUITY_OWNERS, BALANCE_SHEET) ??
        (hasNci ? undefined : findRow(rows, EQUITY_TOTAL, BALANCE_SHEET));
    return {
        ...meta,
        netIncomeYtd: firstAmount(
            incomeRow,
            columns.ytdFallback === undefined
                ? [columns.ytd]
                : [columns.ytd, columns.ytdFallback]
        ),
        netIncomePriorYtd: firstAmount(incomeRow, columns.priorYtd),
        equity: columnAmount(equityRow, 'thstrm_amount'),
    };
}

const treasuryOf = (row: DartRow): number =>
    parseDartAmount(row.tesstk_co) ?? 0;

const isShareRowOf =
    (labels: readonly string[]) =>
    (row: DartRow): boolean =>
        typeof row.se === 'string' &&
        labels.includes(normalizeShareRowLabel(row.se));

/** 줄 하나의 발행·자기주식·유통주식수. 발행주식 총수가 비었거나 0이면 null. */
function shareRowCounts(row: DartRow): ShareKindCounts | null {
    const issued = parseDartAmount(row.istc_totqy);
    if (issued === null || issued <= 0) return null;
    const treasury = treasuryOf(row);
    return {
        issued,
        treasury,
        outstanding: parseDartAmount(row.distb_stock_co) ?? issued - treasury,
    };
}

/** 한 종류(보통주 또는 우선주)로 분류되는 줄들의 주식수 합. 숫자가 있는 줄이 없으면 null. */
function kindShareCounts(
    rows: readonly DartRow[],
    labels: readonly string[]
): ShareKindCounts | null {
    return rows
        .filter(isShareRowOf(labels))
        .flatMap(row => shareRowCounts(row) ?? [])
        .reduce<ShareKindCounts | null>(
            (sum, counts) =>
                sum === null
                    ? counts
                    : {
                          issued: sum.issued + counts.issued,
                          treasury: sum.treasury + counts.treasury,
                          outstanding: sum.outstanding + counts.outstanding,
                      },
            null
        );
}

/**
 * 주식의 총수 현황 행 → 합계(보통주 + 우선주)의 발행·자기주식·유통주식수와 종류별(보통주·우선주) 주식수. 합계 줄이 비었으면 보통주·우선주
 * 줄을 더한다. 종류별 줄의 구분 값은 회사마다 달라(`보통주식`·`의결권있는 주식`·`의결권 있는\n보통주` 등) `dartSourceTokens`가 정규화해 맞댄다.
 * 분기보고서는 이 표를 싣지 않는 회사가 많아 모든 줄이 `-`로 오고(실측), 그때는 null이다 — 호출부가 숫자가 있는 앞선 보고서를 찾는다.
 */
export function extractShareTotals(
    rows: readonly DartRow[]
): ShareTotals | null {
    const total = rows.find(row => row.se === DART_SHARE_TOTAL_ROW);
    const kinds = rows.filter(isShareRowOf(DART_SHARE_KIND_ROWS));
    const totalIssued =
        total === undefined ? null : parseDartAmount(total.istc_totqy);
    const rowsToSum =
        totalIssued !== null && total !== undefined ? [total] : kinds;
    const issued = rowsToSum
        .map(row => parseDartAmount(row.istc_totqy))
        .reduce<number | null>(
            (sum, amount) => (amount === null ? sum : (sum ?? 0) + amount),
            null
        );
    if (issued === null || issued <= 0) return null;
    const treasury = rowsToSum.reduce((sum, row) => sum + treasuryOf(row), 0);
    const reported = rowsToSum.map(row => parseDartAmount(row.distb_stock_co));
    const outstanding = reported.every(amount => amount !== null)
        ? reported.reduce<number>((sum, amount) => sum + (amount ?? 0), 0)
        : issued - treasury;
    if (outstanding <= 0) return null;
    const settled = rowsToSum[0]?.stlm_dt;
    return {
        issued,
        treasury,
        outstanding,
        settledOn:
            typeof settled === 'string' && settled !== '' ? settled : null,
        source: 'dart',
        common: kindShareCounts(rows, DART_SHARE_COMMON_ROWS),
        preferred: kindShareCounts(rows, DART_SHARE_PREFERRED_ROWS),
        preferredIsMixed:
            rows
                .filter(isShareRowOf(DART_SHARE_PREFERRED_ROWS))
                .filter(row => shareRowCounts(row) !== null).length > 1,
    };
}

import { KR_SHORT_CODE_RE } from '@/shared/config/ticker';
import {
    streamXmlElements,
    xmlChildText,
    type XmlChunkSource,
} from '@/shared/lib/streamXmlElements';
import {
    DART_REGISTERED_TOKEN,
    DART_REPORT_TYPE_ABBREVIATED,
    DART_REPORT_TYPE_DETAILED,
    DART_UNREGISTERED_TOKENS,
} from './dartSourceTokens';
import type {
    DartCorpCodeRow,
    DartDisclosureListRow,
    DartInsiderReportRow,
    DartMajorHoldingRow,
    DartReportForm,
    DartTradingPlanRow,
} from '../model';

/**
 * OpenDART 응답 파서(순수). 형식의 주인은 금융감독원 OpenDART(개발가이드 2019001 공시검색·2019018 고유번호·2019021
 * 대량보유·2019022 임원·주요주주, 2026-10-16 확인 — CONVENTIONS.md#CS-11):
 *  - 수량·비율은 **쉼표가 든 문자열**(`"9,999,999,999"`, `"-25,165,617"`, `"0.00"`). 값이 없으면 `"-"` 또는 빈 문자열.
 *  - 접수일은 엔드포인트마다 다르다 — `majorstock`·`list`는 `YYYYMMDD`, `elestock`은 `YYYY-MM-DD`.
 *  - 접수번호 14자리, 고유번호 8자리, 종목코드 6자리(영문 섞일 수 있음 — `KR_SHORT_CODE_PATTERN`).
 * 모르는 형태의 행은 버리고(저장하지 않는다) 호출부가 그 수를 센다. 행 객체는 검증 전이라 `unknown` 필드로 받는다.
 */

type RawRow = Readonly<Record<string, unknown>>;

const RCEPT_NO_RE = /^\d{14}$/;
const CORP_CODE_RE = /^\d{8}$/;
const COMPACT_DATE_RE = /^(\d{4})(\d{2})(\d{2})$/;
const DASHED_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** 원천이 "값 없음"을 나타내는 표기. */
const EMPTY_MARKERS: ReadonlySet<string> = new Set(['', '-']);
/** `numeric(8, 4)` 열이 담을 수 있는 절댓값 상한 — 넘는 비율은 형식 오류로 보고 버린다. */
const RATIO_ABS_LIMIT = 10_000;
/** 보고사유(`report_resn`) 저장 상한(글자). 자유 문구라 길이를 묶는다. */
export const DART_REASON_MAX_LENGTH = 2_000;

/** 문자열이면 trim, 아니면 빈 문자열. */
function text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

/** `-`·빈 값을 null로, 그 밖은 trim한 문자열. */
export function parseDartText(value: unknown): string | null {
    const trimmed = text(value);
    return EMPTY_MARKERS.has(trimmed) ? null : trimmed;
}

/** 쉼표 숫자 문자열(`"-25,165,617"`, `"7.24"`) → 유한수. `-`·빈 값·형식 오류는 null. 숫자 타입도 받는다. */
export function parseDartNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const trimmed = parseDartText(value);
    if (trimmed === null) return null;
    const normalized = trimmed.replaceAll(',', '');
    if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

/** 주식 수 — 정수만(안전한 정수 범위). 소수·형식 오류는 null. */
export function parseDartShares(value: unknown): number | null {
    const parsed = parseDartNumber(value);
    return parsed !== null && Number.isSafeInteger(parsed) ? parsed : null;
}

/** 비율(%) — `numeric(8, 4)`에 들어가는 값만. */
export function parseDartRatio(value: unknown): number | null {
    const parsed = parseDartNumber(value);
    return parsed !== null && Math.abs(parsed) < RATIO_ABS_LIMIT
        ? parsed
        : null;
}

function isCalendarDate(year: string, month: string, day: string): boolean {
    const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === `${year}-${month}-${day}`
    );
}

/** 접수일 `YYYYMMDD`(majorstock·list) 또는 `YYYY-MM-DD`(elestock) → `YYYY-MM-DD`. 없는 날짜·다른 형식은 null. */
export function parseDartDate(value: unknown): string | null {
    const raw = text(value);
    const match = COMPACT_DATE_RE.exec(raw) ?? DASHED_DATE_RE.exec(raw);
    if (match === null) return null;
    const [, year, month, day] = match;
    if (year === undefined || month === undefined || day === undefined) {
        return null;
    }
    return isCalendarDate(year, month, day) ? `${year}-${month}-${day}` : null;
}

/** 대량보유 보고구분(`report_tp`) — `일반` → detailed, `약식` → abbreviated. 그 밖은 null. */
export function parseDartReportForm(value: unknown): DartReportForm | null {
    const raw = text(value);
    if (raw.includes(DART_REPORT_TYPE_ABBREVIATED)) return 'abbreviated';
    if (raw.includes(DART_REPORT_TYPE_DETAILED)) return 'detailed';
    return null;
}

/**
 * 등기임원 여부(`isu_exctv_rgist_at`) — `등기임원` → true, `비등기임원`·`미등기임원` → false, `-`·빈 값·모르는 값 → null.
 * `비등기`·`미등기`도 `등기`를 품으므로 부정형을 먼저 본다.
 */
export function parseDartRegisteredExecutive(value: unknown): boolean | null {
    const raw = parseDartText(value);
    if (raw === null) return null;
    if (DART_UNREGISTERED_TOKENS.some(token => raw.includes(token))) {
        return false;
    }
    if (raw.includes(DART_REGISTERED_TOKEN)) return true;
    return null;
}

function receiptKey(row: { rceptNo: string; reporter: string }): string {
    return `${row.rceptNo}\u0000${row.reporter}`;
}

/** (접수번호, 보고자) 기본키 중복을 지운다 — 뒤의 행이 이긴다(한 문장의 upsert가 같은 행을 두 번 건드리지 않게). */
function dedupeByReceipt<T extends { rceptNo: string; reporter: string }>(
    rows: readonly T[]
): T[] {
    return [
        ...new Map(rows.map(row => [receiptKey(row), row] as const)).values(),
    ];
}

/** 행 공통 머리(접수번호·접수일·보고자). 하나라도 없으면 null. */
function receiptHead(
    row: RawRow
): { rceptNo: string; receiptDate: string; reporter: string } | null {
    const rceptNo = text(row.rcept_no);
    const receiptDate = parseDartDate(row.rcept_dt);
    const reporter = parseDartText(row.repror);
    if (!RCEPT_NO_RE.test(rceptNo) || receiptDate === null || reporter === null)
        return null;
    return { rceptNo, receiptDate, reporter };
}

/** 응답 행의 고유번호가 요청한 회사와 다르면(형식 변경·혼입) 그 행을 버린다. 행에 고유번호가 없으면 요청 값을 쓴다. */
function belongsTo(row: RawRow, corpCode: string): boolean {
    const own = text(row.corp_code);
    return own === '' || own === corpCode;
}

export interface ParsedRows<T> {
    rows: T[];
    /** 형식이 맞지 않아 버린 행 수. */
    skipped: number;
}

/** `majorstock.json`의 `list` → 저장 행. */
export function parseMajorStockRows(
    list: readonly RawRow[],
    corpCode: string
): ParsedRows<DartMajorHoldingRow> {
    const parsed = list.map((row): DartMajorHoldingRow | null => {
        const head = receiptHead(row);
        const reportForm = parseDartReportForm(row.report_tp);
        if (head === null || reportForm === null || !belongsTo(row, corpCode))
            return null;
        return {
            ...head,
            corpCode,
            reportForm,
            shares: parseDartShares(row.stkqy),
            sharesChange: parseDartShares(row.stkqy_irds),
            ratioPct: parseDartRatio(row.stkrt),
            ratioChangePct: parseDartRatio(row.stkrt_irds),
            reason:
                parseDartText(row.report_resn)?.slice(
                    0,
                    DART_REASON_MAX_LENGTH
                ) ?? null,
        };
    });
    const rows = parsed.filter(row => row !== null);
    return {
        rows: dedupeByReceipt(rows),
        skipped: parsed.length - rows.length,
    };
}

/** `elestock.json`의 `list` → 저장 행. */
export function parseExecutiveStockRows(
    list: readonly RawRow[],
    corpCode: string
): ParsedRows<DartInsiderReportRow> {
    const parsed = list.map((row): DartInsiderReportRow | null => {
        const head = receiptHead(row);
        if (head === null || !belongsTo(row, corpCode)) return null;
        return {
            ...head,
            corpCode,
            position: parseDartText(row.isu_exctv_ofcps),
            registered: parseDartRegisteredExecutive(row.isu_exctv_rgist_at),
            majorShareholder: parseDartText(row.isu_main_shrholdr),
            shares: parseDartShares(row.sp_stock_lmp_cnt),
            sharesChange: parseDartShares(row.sp_stock_lmp_irds_cnt),
            ratioPct: parseDartRatio(row.sp_stock_lmp_rate),
            ratioChangePct: parseDartRatio(row.sp_stock_lmp_irds_rate),
        };
    });
    const rows = parsed.filter(row => row !== null);
    return {
        rows: dedupeByReceipt(rows),
        skipped: parsed.length - rows.length,
    };
}

/** `list.json`의 `list` → 공시 행. 비상장(기타법인)은 `stockCode` null. */
export function parseDisclosureListRows(
    list: readonly RawRow[]
): ParsedRows<DartDisclosureListRow> {
    const parsed = list.map((row): DartDisclosureListRow | null => {
        const rceptNo = text(row.rcept_no);
        const corpCode = text(row.corp_code);
        const receiptDate = parseDartDate(row.rcept_dt);
        const filer = parseDartText(row.flr_nm);
        const title = parseDartText(row.report_nm);
        if (
            !RCEPT_NO_RE.test(rceptNo) ||
            !CORP_CODE_RE.test(corpCode) ||
            receiptDate === null ||
            filer === null ||
            title === null
        )
            return null;
        const stockCode = text(row.stock_code).toUpperCase();
        return {
            rceptNo,
            corpCode,
            stockCode: KR_SHORT_CODE_RE.test(stockCode) ? stockCode : null,
            receiptDate,
            filer,
            title,
        };
    });
    const rows = parsed.filter(row => row !== null);
    return { rows, skipped: parsed.length - rows.length };
}

/** D005 공시 행 → 거래계획보고서 저장 행(보고자 = 제출인). */
export function toTradingPlanRow(
    row: DartDisclosureListRow
): DartTradingPlanRow {
    return {
        rceptNo: row.rceptNo,
        corpCode: row.corpCode,
        receiptDate: row.receiptDate,
        reporter: row.filer,
        title: row.title,
    };
}

/**
 * `corpCode.xml`(zip을 푼 내용) → 상장사 행. 종목코드가 6자리 KRX 형상(`KR_SHORT_CODE_PATTERN`)인 행만 남긴다 — 비상장
 * 법인은 `<stock_code> </stock_code>`(공백)이다. 같은 종목코드가 여럿이면 `modify_date`가 늦은 행이 이긴다.
 */
export async function parseCorpCodeXml(
    source: XmlChunkSource
): Promise<ParsedRows<DartCorpCodeRow>> {
    // 파일 하나에 법인 ≈10만 행이라 요소마다 바로 거른다 — 비상장 행을 트리로 모아 두지 않는다.
    const byStock = new Map<
        string,
        { row: DartCorpCodeRow; modified: string }
    >();
    let skipped = 0;
    await streamXmlElements(source, 'list', element => {
        const stockCode = (xmlChildText(element, 'stock_code') ?? '')
            .trim()
            .toUpperCase();
        if (stockCode === '') return;
        const corpCode = (xmlChildText(element, 'corp_code') ?? '').trim();
        const corpName = (xmlChildText(element, 'corp_name') ?? '').trim();
        if (
            !KR_SHORT_CODE_RE.test(stockCode) ||
            !CORP_CODE_RE.test(corpCode) ||
            corpName === ''
        ) {
            skipped += 1;
            return;
        }
        const modified = (xmlChildText(element, 'modify_date') ?? '').trim();
        const previous = byStock.get(stockCode);
        if (previous !== undefined && previous.modified > modified) return;
        byStock.set(stockCode, {
            row: { stockCode, corpCode, corpName },
            modified,
        });
    });
    return {
        rows: [...byStock.values()].map(entry => entry.row),
        skipped,
    };
}

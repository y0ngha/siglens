import 'server-only';
import { getKrDartCorp } from '@/entities/investor-flows/server/getKrDartCorp';
import {
    fetchAlotMatter,
    isDartEnabled,
    type DartRecord,
} from '@/shared/api/dart/dartClient';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import { logToolDegrade } from './logToolDegrade';

/**
 * 한국 종목의 **사업보고서 확정 배당**(DART `alotMatter.json`, 보고서 코드 `11011`)에서 읽은 원자료.
 * 현재가에 의존하는 계산(`yieldOnLastClosePct`)은 `withAnnualReported`(`./dividends.ts`)가 나중에 한다.
 *
 * - `fiscalYear`: 그 값이 속한 사업연도(예: 2025 = 2025년 귀속 배당, 보통 이듬해 3월 정기주총에서 확정·사업보고서 공시).
 * - `dpsCommon`: **보통주** 1주당 현금배당금(원, 연간 합계). 보고서가 보통주(또는 종류 구분 없는) 행에 `-`로 적었으면
 *   "배당 없음"이라 0이다(`yieldOnLastClosePct`도 0이 된다). null은 **확인하지 못했다**는 뜻이다: 그 행이 보고서에 없거나
 *   숫자도 `-`도 아닌 값이 적혀 있을 때. 모델 설명이 `dpsCommon 0`을 무배당으로, `get_fundamentals`의 `krDpsUnknown` note가
 *   null을 미확인으로 말하므로 이 구분이 둘의 전제다.
 * - `dartYieldPct`: 보고서가 적은 `현금배당수익률(%)` — 분모가 **배당 기준일 전후 주가**(보통 사업연도 말 가까운 가격)라
 *   현재가 기준 수익률과 다르다.
 */
export interface KrAnnualDividendRaw {
    fiscalYear: number;
    dpsCommon: number | null;
    dartYieldPct: number | null;
}

/** 확정 배당은 연 1회 바뀌므로 길게 둔다. */
export const KR_ANNUAL_DIVIDEND_CACHE_TTL_SECONDS = 7 * SECONDS_PER_DAY;
/**
 * 해당 연도 보고서가 아직 없을 때(`013`)의 짧은 TTL — 3월 공시 직후 일주일 동안 직전 연도 값에 묶이지 않게 한다.
 */
export const KR_ANNUAL_DIVIDEND_MISSING_TTL_SECONDS = SECONDS_PER_DAY;
/** 최신 사업연도부터 몇 해 전까지 찾는가 — 작년, 재작년. */
const FISCAL_YEAR_LOOKBACKS = [1, 2] as const;

const SE_DPS = '주당 현금배당금(원)';
const SE_YIELD = '현금배당수익률(%)';
/** 종류주 구분이 없는 회사(보통주만 상장)는 `stock_knd`가 `-`다. */
const KIND_COMMON = '보통주';
const KIND_UNSPLIT = '-';

// 캐시 키 버전: 저장 값의 의미가 바뀌면(v2: 보통주 DPS 칸이 `-`이면 null이 아니라 0) 같은 PR에서 올린다.
// 안 올리면 옛 null이 TTL(7일) 동안 "미확인"으로 남는다.
const alotMatterKey = (corpCode: string, fiscalYear: number): string =>
    `dart:alot-matter:v2:${corpCode}:${fiscalYear}`;

/** 현재 KST 달력 연도 — 사업연도는 UTC가 아니라 한국 날짜를 따른다. */
const kstYear = (now: Date): number => Number(kstDateKey(now).split('-')[0]);

/** `'6,000'`·`'4.30'` → 숫자. `'-'`·빈 값·숫자 아님 → null. */
function parseDartNumber(value: unknown): number | null {
    if (typeof value !== 'string') return null;
    const parsed = Number(value.replaceAll(',', '').trim());
    return value.trim() !== '' && Number.isFinite(parsed) ? parsed : null;
}

/**
 * `se` 항목의 당기(`thstrm`) 값 — 보통주 행을 먼저, 없으면 종류 구분이 없는(`-`) 행의 첫 숫자. 우선주 행은 쓰지 않는다.
 * (종류 구분이 없는 회사는 같은 `se`가 우선주 칸으로 한 줄 더 오는데 그 줄은 `-` 값이라 숫자 첫 행만 취한다.)
 */
function pickCommon(rows: readonly DartRecord[], se: string): number | null {
    const matching = rows.filter(row => row.se === se);
    return (
        [KIND_COMMON, KIND_UNSPLIT]
            .flatMap(kind =>
                matching
                    .filter(row => row.stock_knd === kind)
                    .map(row => parseDartNumber(row.thstrm))
            )
            .find(value => value !== null) ?? null
    );
}

/** DART가 값이 없는 칸에 적는 표기. 보통주 DPS 칸에서는 "그 해 배당 없음"이다. */
const DART_EMPTY_VALUE = '-';

/**
 * 보통주 DPS. 숫자가 있으면 그 값. 숫자가 없을 때는 **주 행**(첫 보통주 행, 없으면 종류 구분 없는 `-` 첫 행)의 값이 `-`일 때만
 * 배당이 없던 해라 0이다. 주 행이 `-`가 아닌 알 수 없는 문자열이면 둘째 줄의 `-`(종류 구분 없는 회사의 우선주 칸 자리 표시)가
 * 있어도 null(미확인)이다. 우선주 행은 보지 않는다.
 */
function pickCommonDps(rows: readonly DartRecord[]): number | null {
    const dps = pickCommon(rows, SE_DPS);
    if (dps !== null) return dps;
    const dpsRows = rows.filter(row => row.se === SE_DPS);
    const primary =
        dpsRows.find(row => row.stock_knd === KIND_COMMON) ??
        dpsRows.find(row => row.stock_knd === KIND_UNSPLIT);
    return typeof primary?.thstrm === 'string' &&
        primary.thstrm.trim() === DART_EMPTY_VALUE
        ? 0
        : null;
}

/** 사업보고서 배당 행들 → 보통주 DPS·보고 수익률. 행이 없으면 null(= 그 연도 보고서 없음). */
export function parseAlotMatterRows(
    rows: readonly DartRecord[],
    fiscalYear: number
): KrAnnualDividendRaw | null {
    if (rows.length === 0) return null;
    return {
        fiscalYear,
        dpsCommon: pickCommonDps(rows),
        dartYieldPct: pickCommon(rows, SE_YIELD),
    };
}

async function loadFiscalYear(
    corpCode: string,
    fiscalYear: number
): Promise<KrAnnualDividendRaw | null> {
    return getOrSetCache<KrAnnualDividendRaw | null>(
        alotMatterKey(corpCode, fiscalYear),
        value =>
            value === null
                ? KR_ANNUAL_DIVIDEND_MISSING_TTL_SECONDS
                : KR_ANNUAL_DIVIDEND_CACHE_TTL_SECONDS,
        async () => {
            const rows = await fetchAlotMatter(corpCode, fiscalYear);
            return rows === null ? null : parseAlotMatterRows(rows, fiscalYear);
        }
    );
}

/**
 * 한국 종목의 최신 사업보고서 확정 배당. 작년 → 재작년 순으로 보고서가 있는 첫 연도를 쓴다(연도별 Redis 캐시).
 * 우선주는 보통주 코드로 회사를 찾기 때문에(`viaCommonShare`) 보통주 배당을 우선주 것으로 내보내지 않도록 null이다.
 * 키 없음·매핑 없음·보고서 없음은 null이고, DART 오류는 로그 후 null이다(오류는 재작년으로 내려가지 않는다). Next 동적 서버
 * 오류(제어 흐름)만 다시 던진다.
 */
export async function fetchKrAnnualDividend(
    symbol: string,
    now: Date = new Date()
): Promise<KrAnnualDividendRaw | null> {
    try {
        if (!isDartEnabled()) return null;
        const corp = await getKrDartCorp(symbol);
        if (corp === null || corp.viaCommonShare) return null;
        const currentYear = kstYear(now);
        for (const lookback of FISCAL_YEAR_LOOKBACKS) {
            const found = await loadFiscalYear(
                corp.corpCode,
                currentYear - lookback
            );
            if (found !== null) return found;
        }
        return null;
    } catch (error) {
        if (isDynamicServerError(error)) throw error;
        logToolDegrade('get_fundamentals', 'dividends_dart', error);
        return null;
    }
}

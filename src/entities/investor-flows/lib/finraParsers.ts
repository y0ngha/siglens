import type { ShortInterestRow, ShortVolumeRow } from '../model';

/** FINRA가 "계산 불가/상한"으로 쓰는 값(`999.99`). */
const DAYS_TO_COVER_CAP = 999.99;

/** FINRA 파일 심볼 → 우리 심볼. 유니버스 밖이면 null. */
export type FinraSymbolResolver = (finraSymbol: string) => string | null;

/**
 * 유니버스 심볼에서 FINRA 표기 → 우리 표기 조회를 만든다.
 *
 * FINRA는 클래스 주식을 파일마다 다르게 쓴다(2026-10 실측): 일별 거래량(CNMS)은 `BF/A`·`BF/B`,
 * 공매도 잔고는 구분자 없이 `BFA`·`BFB`. 우리 표기는 `BF.A`·`BF-B`다. 그래서 정확 일치를 먼저
 * 등록하고, 구분자를 `/`로 바꾼 것과 지운 것을 별칭으로 **정확 일치가 없을 때만** 추가한다 —
 * 별칭이 다른 유니버스 심볼의 정확 일치를 가로채면 안 된다.
 */
export function buildFinraSymbolResolver(
    universeSymbols: Iterable<string>
): FinraSymbolResolver {
    const symbols = [...universeSymbols].map(symbol => symbol.toUpperCase());
    const lookup = new Map<string, string>();
    for (const symbol of symbols) lookup.set(symbol, symbol);
    for (const symbol of symbols) {
        if (!/[.-]/.test(symbol)) continue;
        const slashed = symbol.replace(/[.-]/g, '/');
        const compact = symbol.replace(/[.-]/g, '');
        if (!lookup.has(slashed)) lookup.set(slashed, symbol);
        if (!lookup.has(compact)) lookup.set(compact, symbol);
    }
    return finraSymbol => lookup.get(finraSymbol.trim().toUpperCase()) ?? null;
}

function unquote(cell: string): string {
    const trimmed = cell.trim();
    return trimmed.length >= 2 &&
        trimmed.startsWith('"') &&
        trimmed.endsWith('"')
        ? trimmed.slice(1, -1)
        : trimmed;
}

/** 헤더 이름(소문자) → 열 번호. */
function headerIndex(headerLine: string): Map<string, number> {
    const index = new Map<string, number>();
    headerLine
        .split('|')
        .forEach((name, i) => index.set(unquote(name).toLowerCase(), i));
    return index;
}

function cellAt(
    cells: readonly string[],
    index: Map<string, number>,
    name: string
): string | null {
    const i = index.get(name);
    if (i === undefined) return null;
    const raw = cells[i];
    return raw === undefined ? null : unquote(raw);
}

function toCount(raw: string | null): number | null {
    if (raw === null || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

/** `YYYYMMDD` 또는 `YYYY-MM-DD` → `YYYY-MM-DD`. */
function toIsoDate(raw: string | null): string | null {
    if (raw === null) return null;
    if (/^\d{8}$/.test(raw)) {
        return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    }
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

/**
 * Reg SHO 일별 공매도 거래량(CNMS) 파일. 헤더 `Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market`.
 * 수량은 소수(`587563.823483`)로 올 수 있어 반올림한다. 유니버스 밖 심볼·깨진 행은 버린다.
 * 장외(TRF) 보고분만 담긴 파일이다 — 소비자는 "장외 공매도 비중"으로 표기해야 한다.
 */
export function parseCnmsShortVolume(
    text: string,
    resolveSymbol: FinraSymbolResolver
): ShortVolumeRow[] {
    const lines = text.split(/\r?\n/);
    const header = lines.shift();
    if (header === undefined) return [];
    const index = headerIndex(header);
    const bySymbol = new Map<string, ShortVolumeRow>();
    for (const line of lines) {
        if (line.trim() === '') continue;
        const cells = line.split('|');
        const finraSymbol = cellAt(cells, index, 'symbol');
        const tradeDate = toIsoDate(cellAt(cells, index, 'date'));
        const shortVolume = toCount(cellAt(cells, index, 'shortvolume'));
        const totalVolume = toCount(cellAt(cells, index, 'totalvolume'));
        if (
            finraSymbol === null ||
            tradeDate === null ||
            shortVolume === null ||
            totalVolume === null
        ) {
            continue;
        }
        const symbol = resolveSymbol(finraSymbol);
        if (symbol === null || bySymbol.has(symbol)) continue;
        bySymbol.set(symbol, { symbol, tradeDate, shortVolume, totalVolume });
    }
    return [...bySymbol.values()];
}

/**
 * 공매도 잔고(biweekly) 파일. 파이프 구분에 모든 값이 따옴표로 감싸여 있다.
 * 헤더: `accountingYearMonthNumber|symbolCode|issueName|…|currentShortPositionQuantity|
 * previousShortPositionQuantity|stockSplitFlag|averageDailyVolumeQuantity|daysToCoverQuantity|
 * revisionFlag|changePercent|changePreviousNumber|settlementDate`.
 *
 * `daysToCoverQuantity`가 `999.99`이면 평균 거래량이 0이라 계산 불가라는 FINRA의 상한 표기다 —
 * 값 그대로 저장하지 않고 null로 둔다.
 */
export function parseShortInterest(
    text: string,
    resolveSymbol: FinraSymbolResolver
): ShortInterestRow[] {
    const lines = text.split(/\r?\n/);
    const header = lines.shift();
    if (header === undefined) return [];
    const index = headerIndex(header);
    const bySymbol = new Map<string, ShortInterestRow>();
    for (const line of lines) {
        if (line.trim() === '') continue;
        const cells = line.split('|');
        const finraSymbol = cellAt(cells, index, 'symbolcode');
        const settlementDate = toIsoDate(
            cellAt(cells, index, 'settlementdate')
        );
        const shortQty = toCount(
            cellAt(cells, index, 'currentshortpositionquantity')
        );
        if (
            finraSymbol === null ||
            settlementDate === null ||
            shortQty === null
        ) {
            continue;
        }
        const symbol = resolveSymbol(finraSymbol);
        if (symbol === null || bySymbol.has(symbol)) continue;
        const daysToCoverRaw = cellAt(cells, index, 'daystocoverquantity');
        const daysToCover =
            daysToCoverRaw === null || daysToCoverRaw === ''
                ? Number.NaN
                : Number(daysToCoverRaw);
        bySymbol.set(symbol, {
            symbol,
            settlementDate,
            shortQty,
            prevShortQty: toCount(
                cellAt(cells, index, 'previousshortpositionquantity')
            ),
            avgDailyVolume: toCount(
                cellAt(cells, index, 'averagedailyvolumequantity')
            ),
            daysToCover:
                Number.isFinite(daysToCover) && daysToCover < DAYS_TO_COVER_CAP
                    ? daysToCover
                    : null,
        });
    }
    return [...bySymbol.values()];
}

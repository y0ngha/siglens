import type {
    FtdFileLink,
    FtdFileRow,
    FtdRow,
    FtdTrailer,
    ParsedFtdFile,
} from '../model';
import { normalizeCusip } from './sec13fPositions';
import type { SymbolResolver } from './symbolAliasResolver';

/**
 * SEC fails-to-deliver(CNS fails) 반월 파일 `cnsfailsYYYYMM{a|b}.txt`(zip 안의 단일 파일).
 *
 * 형식(2026-09b 파일 실측, 66,693행):
 *   헤더   `SETTLEMENT DATE|CUSIP|SYMBOL|QUANTITY (FAILS)|DESCRIPTION|PRICE`
 *   행     `20260915|084670702|BRKB|4357|BERKSHIRE HATHWY INC(HLDG CO)B|514.95`
 *   끝     파이프 없는 trailer 두 줄 — `Trailer record count 66693`, `Trailer total quantity of shares 2745043657`
 *  - 가격이 없으면 `.`이다(→ null). SYMBOL이 비어 있는 행이 있다(CNS 비적격 증권 등).
 *  - (결제일, CUSIP)마다 한 행이고 실패가 있는 날만 행이 있다.
 *  - 설명(DESCRIPTION)에 파이프가 들어가는 경우에 대비해 가격은 **마지막** 칸에서 읽는다.
 */
const FTD_MIN_CELLS = 6;
const COL_SETTLEMENT_DATE = 0;
const COL_CUSIP = 1;
const COL_SYMBOL = 2;
const COL_QUANTITY = 3;
const TRAILER_RECORD_COUNT = /^Trailer record count\s+(\d+)\s*$/i;
const TRAILER_TOTAL_QUANTITY = /^Trailer total quantity of shares\s+(\d+)\s*$/i;
const MISSING_PRICE = '.';

function toIsoDate(raw: string): string | null {
    return /^\d{8}$/.test(raw)
        ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
        : null;
}

function toPrice(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === MISSING_PRICE) return null;
    const value = Number(trimmed);
    return Number.isFinite(value) && value >= 0 ? value : null;
}

function parseRow(line: string): FtdFileRow | null {
    const cells = line.split('|');
    if (cells.length < FTD_MIN_CELLS) return null;
    const settlementDate = toIsoDate(cells[COL_SETTLEMENT_DATE]?.trim() ?? '');
    const cusip = normalizeCusip(cells[COL_CUSIP]);
    const quantityRaw = cells[COL_QUANTITY]?.trim() ?? '';
    const failsQty = /^\d+$/.test(quantityRaw) ? Number(quantityRaw) : null;
    if (settlementDate === null || cusip === null || failsQty === null) {
        return null;
    }
    const symbol = cells[COL_SYMBOL]?.trim() ?? '';
    return {
        settlementDate,
        cusip,
        fileSymbol: symbol === '' ? null : symbol,
        failsQty,
        price: toPrice(cells.at(-1) ?? ''),
    };
}

/** FTD 파일 텍스트 → 행 + trailer. 깨진 데이터 행은 버리되 `malformedLines`로 센다(trailer 대조가 그 파일을 거부한다). */
export function parseFtdFile(text: string): ParsedFtdFile {
    const lines = text.split(/\r?\n/);
    // 첫 줄은 헤더다.
    const body = lines.slice(1);
    let recordCount: number | null = null;
    let totalQuantity: number | null = null;
    const rows: FtdFileRow[] = [];
    let malformedLines = 0;
    let dataLines = 0;
    let parsedQuantity = 0;
    // 파일 하나가 수만 행이라 줄 단위로 한 번에 훑는다(CP-6 예외: 행 배열을 spread로 다시 만들면 O(N²)).
    for (const line of body) {
        if (line.trim() === '') continue;
        const count = TRAILER_RECORD_COUNT.exec(line);
        if (count !== null) {
            recordCount = Number(count[1]);
            continue;
        }
        const total = TRAILER_TOTAL_QUANTITY.exec(line);
        if (total !== null) {
            totalQuantity = Number(total[1]);
            continue;
        }
        dataLines += 1;
        const row = parseRow(line);
        if (row === null) {
            malformedLines += 1;
            continue;
        }
        rows.push(row);
        parsedQuantity += row.failsQty;
    }
    const trailer: FtdTrailer | null =
        recordCount === null || totalQuantity === null
            ? null
            : { recordCount, totalQuantity };
    return { rows, trailer, malformedLines, dataLines, parsedQuantity };
}

/**
 * trailer 대조 — 행 수와 수량 합계가 trailer와 **정확히** 같고 깨진 행이 없어야 파일을 받아들인다. 잘린 다운로드·잘린 zip
 * (`unzipSingle`은 선언 크기로 잘라 낸다)·형식 변경이 여기서 걸린다. 맞지 않으면 그 파일은 저장하지 않는다.
 */
export function ftdTrailerMatches(parsed: ParsedFtdFile): boolean {
    return (
        parsed.trailer !== null &&
        parsed.malformedLines === 0 &&
        parsed.trailer.recordCount === parsed.dataLines &&
        parsed.trailer.totalQuantity === parsed.parsedQuantity
    );
}

/** 유니버스 CUSIP → 우리 심볼·CUSIP 앞 6자리(발행사 코드) 조회. */
export interface FtdUniverse {
    /** CUSIP(9자리) → 우리 심볼. */
    symbolByCusip: ReadonlyMap<string, string>;
    /** 우리 심볼 → 그 심볼의 매핑된 CUSIP들. */
    cusipsBySymbol: ReadonlyMap<string, readonly string[]>;
    /** 파일 SYMBOL(`BRKB`) → 우리 심볼. */
    resolveSymbol: SymbolResolver;
}

const CUSIP_ISSUER_LENGTH = 6;

/**
 * 파일 행을 우리 심볼로 해석해 저장할 행만 남긴다. **CUSIP이 우선**이다(`cusip_symbol_map`). 맵에 없는 CUSIP은 파일 SYMBOL을
 * 별칭 해석(`BRKB` → `BRK-B`)한 심볼이 있고, 그 심볼의 매핑된 CUSIP과 **발행사 코드(앞 6자리)가 같을 때만** 보조로 받는다 —
 * 같은 발행사의 새 CUSIP(액면분할·재발행 뒤)은 잡고, 우연히 같은 티커를 쓰는 다른 증권(ETF·워런트)은 버린다.
 * 같은 (CUSIP, 결제일)이 두 번 나오면 첫 행만 쓴다.
 */
export function resolveFtdRows(
    rows: readonly FtdFileRow[],
    universe: FtdUniverse
): FtdRow[] {
    const seen = new Set<string>();
    return rows.flatMap(row => {
        const key = `${row.cusip}|${row.settlementDate}`;
        if (seen.has(key)) return [];
        const direct = universe.symbolByCusip.get(row.cusip);
        const fallback =
            direct === undefined && row.fileSymbol !== null
                ? universe.resolveSymbol(row.fileSymbol)
                : null;
        const sameIssuer =
            fallback !== null &&
            (universe.cusipsBySymbol.get(fallback) ?? []).some(
                cusip =>
                    cusip.slice(0, CUSIP_ISSUER_LENGTH) ===
                    row.cusip.slice(0, CUSIP_ISSUER_LENGTH)
            );
        const symbol = direct ?? (sameIssuer ? fallback : null);
        if (symbol === null) return [];
        seen.add(key);
        return [
            {
                cusip: row.cusip,
                settlementDate: row.settlementDate,
                symbol,
                failsQty: row.failsQty,
                price: row.price,
            },
        ];
    });
}

/**
 * FTD 목록 페이지 HTML에서 반월 파일 링크를 뽑는다. 파일은 대부분 `/files/data/fails-deliver-data/`에 있지만 일부 월은
 * `/files/data/other/fails-deliver-data/`이고 `cnsfails202308b_0.zip`처럼 접미사가 붙기도 한다(2026-10-16 페이지 실측) —
 * 그래서 URL을 만들지 않고 링크에서 읽는다. 같은 파일 키가 여러 번 나오면 **처음** 링크를 쓴다. 키 내림차순(최신 먼저).
 */
export function extractFtdFileLinks(html: string): FtdFileLink[] {
    const pattern =
        /href="(\/files\/[^"]*?\/cnsfails(\d{4})(0[1-9]|1[0-2])([ab])(?:_\d+)?\.zip)"/gi;
    const byKey = new Map<string, FtdFileLink>();
    for (const match of html.matchAll(pattern)) {
        const [, path, year, month, half] = match as unknown as [
            string,
            string,
            string,
            string,
            string,
        ];
        const fileKey = `${year}${month}${half.toLowerCase()}`;
        if (!byKey.has(fileKey)) byKey.set(fileKey, { fileKey, path });
    }
    return [...byKey.values()].sort((a, b) =>
        a.fileKey < b.fileKey ? 1 : a.fileKey > b.fileKey ? -1 : 0
    );
}

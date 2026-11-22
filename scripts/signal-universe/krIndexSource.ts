import { KR_SHORT_CODE_RE } from '@/shared/config/ticker';
import {
    KR_INDEX_COUNT_TOLERANCE,
    KR_INDEX_SIZE,
} from '@/shared/config/signalScanUniverse/signalScanUniverseConstants';

/**
 * 코스피 200·코스닥 150 스냅샷 생성기의 순수 부분. 네트워크는 `build-kr-index.ts`가 맡는다.
 *
 * 출처 우선순위: (1) KRX 정보데이터시스템 공개 엔드포인트(지수 구성종목, 로그인 없음) — 공식 목록이라
 * 개수가 정확히 200/150이어야 한다. (2) 거절되면(2026-11 현재 `LOGOUT`) KODEX 200 / KODEX 코스닥150 ETF의
 * 보유 종목 파일 — 지수 자체가 아니라 **프록시**라서 스냅샷에 그렇게 표시하고 개수는 ±5까지 받는다.
 * (3) 운영자가 내려받은 KRX CSV(`--kospi200`, `--kosdaq150`)가 있으면 그것이 우선한다.
 */

export interface KrConstituent {
    readonly symbol: string;
    readonly koreanName: string;
}

export type KrSourceKind = 'krx' | 'etf-proxy' | 'csv';

export interface KrSnapshotData {
    readonly asOf: string;
    readonly sourceKind: KrSourceKind;
    /** 출처 설명(어느 엔드포인트·ETF에서 어떤 기준일로 읽었나). */
    readonly sourceDetail: string;
    readonly kospi200: readonly KrConstituent[];
    readonly kosdaq150: readonly KrConstituent[];
}

export class KrIndexSourceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'KrIndexSourceError';
    }
}

interface RawRow {
    readonly code: string;
    readonly name: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function rowsToConstituents(
    rows: readonly RawRow[],
    suffix: '.KS' | '.KQ'
): KrConstituent[] {
    const bad = rows.find(row => !KR_SHORT_CODE_RE.test(row.code));
    if (bad !== undefined)
        throw new KrIndexSourceError(`unexpected stock code "${bad.code}"`);
    const unique = new Map(
        rows.map(row => [row.code, row.name.trim()] as const)
    );
    if (unique.size !== rows.length)
        throw new KrIndexSourceError('duplicate stock code in one list');
    return [...unique.entries()]
        .map(([code, name]) => ({
            symbol: `${code}${suffix}`,
            koreanName: name,
        }))
        .sort((a, b) => (a.symbol < b.symbol ? -1 : 1));
}

/** KRX JSON(`OutBlock_1`: `ISU_SRT_CD`, `ISU_ABBRV`) → 행. 형식이 다르면 던진다(→ 폴백). */
export function parseKrxIndexJson(json: unknown): RawRow[] {
    const block = isRecord(json) ? json.OutBlock_1 : undefined;
    if (!Array.isArray(block) || block.length === 0)
        throw new KrIndexSourceError('krx: OutBlock_1 missing or empty');
    return block.map(item => {
        const code = isRecord(item) ? item.ISU_SRT_CD : undefined;
        const name = isRecord(item) ? item.ISU_ABBRV : undefined;
        if (typeof code !== 'string' || typeof name !== 'string')
            throw new KrIndexSourceError('krx: row without code or name');
        return { code: code.trim(), name };
    });
}

/**
 * 삼성자산운용 KODEX 보유 종목 JSON(`pdf.list`) → 행. 종목이 아닌 줄(원화예금 등 코드가 6자리 단축코드가
 * 아닌 것)은 버린다. 신규 상장 종목은 `0126Z0`처럼 영문이 섞인다.
 */
export function parseEtfHoldingsJson(json: unknown): {
    readonly rows: RawRow[];
    readonly holdingsDate: string;
} {
    const pdf = isRecord(json) ? json.pdf : undefined;
    const list = isRecord(pdf) ? pdf.list : undefined;
    const date = isRecord(pdf) ? pdf.gijunYMD : undefined;
    if (!Array.isArray(list) || typeof date !== 'string')
        throw new KrIndexSourceError('etf: pdf.list or gijunYMD missing');
    const rows = list.flatMap((item): RawRow[] => {
        const code = isRecord(item) ? item.itmNo : undefined;
        const name = isRecord(item) ? item.secNm : undefined;
        return typeof code === 'string' &&
            typeof name === 'string' &&
            KR_SHORT_CODE_RE.test(code.trim())
            ? [{ code: code.trim(), name }]
            : [];
    });
    return {
        rows,
        holdingsDate: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
    };
}

/** CSV 한 줄 → 칸. 큰따옴표로 감싼 칸과 `""` 이스케이프를 읽는다. */
function splitCsvLine(line: string): string[] {
    const cells = Array.from(
        line.matchAll(/("(?:[^"]|"")*"|[^,]*)(,|$)/g),
        m => m[1] ?? ''
    );
    return cells
        .slice(0, -1)
        .map(cell =>
            cell.startsWith('"')
                ? cell.slice(1, -1).replaceAll('""', '"')
                : cell
        );
}

/** UTF-8로 읽고, 깨지면 EUC-KR(KRX 내려받기 기본 인코딩)로 읽는다. */
export function decodeCsvBytes(bytes: Uint8Array): string {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        return new TextDecoder('euc-kr').decode(bytes);
    }
}

/** KRX 지수구성종목 CSV(열: 종목코드, 종목명) → 행. */
export function parseKrxCsv(text: string): RawRow[] {
    const [headerLine, ...lines] = text
        .replace(/^﻿/, '')
        .split(/\r?\n/)
        .filter(line => line.trim() !== '');
    if (headerLine === undefined)
        throw new KrIndexSourceError('csv: empty file');
    const header = splitCsvLine(headerLine).map(h => h.trim());
    const codeColumn = header.indexOf('종목코드');
    const nameColumn = header.indexOf('종목명');
    if (codeColumn < 0 || nameColumn < 0)
        throw new KrIndexSourceError('csv: 종목코드/종목명 column missing');
    return lines.map(line => {
        const cells = splitCsvLine(line);
        const code = (cells[codeColumn] ?? '').trim();
        const name = (cells[nameColumn] ?? '').trim();
        if (code === '' || name === '')
            throw new KrIndexSourceError('csv: row without code or name');
        return { code, name };
    });
}

/** 한 목록의 개수 검사. 공식 목록은 정확히, 프록시는 허용 폭 안에서. */
export function assertKrCount(
    label: 'kospi200' | 'kosdaq150',
    count: number,
    exact: boolean
): void {
    const size = KR_INDEX_SIZE[label];
    const tolerance = exact ? 0 : KR_INDEX_COUNT_TOLERANCE;
    if (Math.abs(count - size) > tolerance)
        throw new KrIndexSourceError(
            `${label}: ${count} stocks, expected ${size} (±${tolerance})`
        );
}

/** 두 목록을 스냅샷 데이터로 만든다. 개수 검사 + 두 목록 사이 중복 거부. */
export function buildKrSnapshot(input: {
    readonly asOf: string;
    readonly sourceKind: KrSourceKind;
    readonly sourceDetail: string;
    readonly kospiRows: readonly RawRow[];
    readonly kosdaqRows: readonly RawRow[];
}): KrSnapshotData {
    const kospi200 = rowsToConstituents(input.kospiRows, '.KS');
    const kosdaq150 = rowsToConstituents(input.kosdaqRows, '.KQ');
    const exact = input.sourceKind !== 'etf-proxy';
    assertKrCount('kospi200', kospi200.length, exact);
    assertKrCount('kosdaq150', kosdaq150.length, exact);
    const kospiCodes = new Set(kospi200.map(c => c.symbol.slice(0, 6)));
    const overlap = kosdaq150.find(c => kospiCodes.has(c.symbol.slice(0, 6)));
    if (overlap !== undefined)
        throw new KrIndexSourceError(
            `${overlap.symbol} is in both kospi200 and kosdaq150`
        );
    return {
        asOf: input.asOf,
        sourceKind: input.sourceKind,
        sourceDetail: input.sourceDetail,
        kospi200,
        kosdaq150,
    };
}

function renderList(name: string, items: readonly KrConstituent[]): string {
    const lines = items
        .map(
            item =>
                `        { symbol: '${item.symbol}', koreanName: '${item.koreanName.replaceAll("'", "\\'")}' },`
        )
        .join('\n');
    return `    ${name}: [\n${lines}\n    ],`;
}

/** 생성 파일 본문. */
export function renderKrSnapshotFile(
    snapshot: KrSnapshotData,
    command: string
): string {
    const proxy = snapshot.sourceKind === 'etf-proxy';
    return `/**
 * 신호 스캔 대상 — 코스피 200 + 코스닥 150(한국) 스냅샷. 직접 고치지 않는다.
 * 생성: \`${command}\`
 * 출처 ${snapshot.sourceKind}: ${snapshot.sourceDetail}
 * 기준일 ${snapshot.asOf}, 코스피 200 ${snapshot.kospi200.length}종목, 코스닥 150 ${snapshot.kosdaq150.length}종목.
 * ${proxy ? 'ETF 보유 종목은 지수 자체가 아닌 프록시다(`proxy: true`) — 정기변경 직전·직후 한두 종목이 지수와 다를 수 있고,\n * 분할·합병으로 생긴 종목이나 변경 대기 종목을 지수 크기(200/150)보다 더 들고 있을 수 있다(허용 폭 ±5).\n * 운영자가 KRX CSV로 다시 만들면(`--kospi200`, `--kosdaq150`) 공식 목록으로 대체된다.' : '지수 구성종목 공식 목록이다.'}
 * 6월·12월 KRX 정기변경 뒤 다시 만든다 — 기준일이 200일을 넘으면 기록기가 로그로 알린다.
 */
export const KR_INDEX_UNIVERSE_SNAPSHOT = {
    asOf: '${snapshot.asOf}',
    source: '${snapshot.sourceKind}',
    sourceDetail: '${snapshot.sourceDetail.replaceAll("'", "\\'")}',
    proxy: ${proxy},
${renderList('kospi200', snapshot.kospi200)}
${renderList('kosdaq150', snapshot.kosdaq150)}
} as const;
`;
}

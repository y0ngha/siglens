import 'server-only';
import { readBoundedBody } from '@/shared/lib/readBoundedBody';

/**
 * 미국 3대 지수 구성종목 — Wikipedia 구성종목 표.
 *
 * FMP `*-constituent` 엔드포인트는 현재 요금제에서 402이고, 웹 검색은 "EXC는 Nasdaq-100에 없다"처럼
 * 틀린 답을 냈다. 표가 가장 최신으로 유지되는 곳이 Wikipedia라 이쪽을 읽는다.
 *
 * 페이지 구조(2026-10-24 실측): S&P 500은 본 문서에 `Symbol` 열이 있는 표가 있고, Nasdaq-100·Dow는
 * 본 문서에서 구성종목 표가 빠져 별도 목록 문서(`List of NASDAQ-100 companies`,
 * `List of Dow Jones Industrial Average companies`)에 있다. 표 위치가 아니라 **열 이름**으로 찾는다
 * (표가 늘거나 순서가 바뀌어도 맞게). 구조가 바뀌어 표를 못 찾거나 개수가 범위를 벗어나면 던진다 —
 * 호출부가 그 값을 캐시하지 않는다.
 *
 * 재확인(행 수 = 종목 수 + 머리글 1행): `curl -s -A 'SiglensBot/1.0 (https://siglens.io)' <url> | grep -c '<tr'`
 * (2026-10-24 실측: S&P 500 503종목, Nasdaq-100 101종목, Dow 30종목). 표가 여럿인 문서는 이 수가 더 크게
 * 나오므로 정확한 종목 수는 `parseConstituentSymbols`의 결과 길이로 본다. 허용 범위는 이 실측에 여유를 둔 값이다.
 */

export const INDEX_IDS = ['sp500', 'nasdaq100', 'dowJones'] as const;
export type IndexId = (typeof INDEX_IDS)[number];

interface IndexSource {
    readonly url: string;
    /** 심볼이 든 열의 머리글 후보. */
    readonly symbolHeaders: readonly string[];
    readonly minCount: number;
    readonly maxCount: number;
}

const WIKI_BASE = 'https://en.wikipedia.org/wiki/';

export const INDEX_SOURCES: Readonly<Record<IndexId, IndexSource>> = {
    sp500: {
        url: `${WIKI_BASE}List_of_S%26P_500_companies`,
        symbolHeaders: ['Symbol', 'Ticker'],
        minCount: 495,
        maxCount: 510,
    },
    nasdaq100: {
        url: `${WIKI_BASE}List_of_NASDAQ-100_companies`,
        symbolHeaders: ['Ticker', 'Symbol'],
        minCount: 98,
        maxCount: 104,
    },
    // 다우는 정확히 30종목이다.
    dowJones: {
        url: `${WIKI_BASE}List_of_Dow_Jones_Industrial_Average_companies`,
        symbolHeaders: ['Symbol', 'Ticker'],
        minCount: 30,
        maxCount: 30,
    },
};

/** Wikipedia API 정책: 연락 가능한 식별 User-Agent가 필요하다. */
export const WIKIPEDIA_USER_AGENT =
    'SiglensBot/1.0 (https://siglens.io; contact via site)';
/** 선택적 보강용이라 도구의 임계 경로를 늘리지 않게 짧게 둔다. */
export const WIKIPEDIA_REQUEST_TIMEOUT_MS = 3_000;
/**
 * 가장 큰 문서(S&P 500)가 2026-10-24 실측 91,089바이트(약 89KB)다. 상한 2MiB는 그 약 23배다.
 * 재측정: `curl -s -A 'SiglensBot/1.0 (https://siglens.io)' https://en.wikipedia.org/wiki/List_of_S%26P_500_companies | wc -c`
 */
export const WIKIPEDIA_MAX_BODY_BYTES = 2 * 1024 * 1024;

export class IndexConstituentsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'IndexConstituentsError';
    }
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
};

function decodeEntities(text: string): string {
    return text.replace(
        /&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi,
        (whole, hex?: string, dec?: string, name?: string) => {
            if (hex !== undefined)
                return String.fromCodePoint(Number.parseInt(hex, 16));
            if (dec !== undefined)
                return String.fromCodePoint(Number.parseInt(dec, 10));
            return NAMED_ENTITIES[(name ?? '').toLowerCase()] ?? whole;
        }
    );
}

/** 셀 HTML → 보이는 텍스트. 주석(`<!-- … -->`)과 각주(`<sup>`)는 버린다. */
function cellText(html: string): string {
    const withoutNoise = html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<sup[\s\S]*?<\/sup>/gi, '');
    return decodeEntities(withoutNoise.replace(/<[^>]+>/g, ''))
        .replace(/\s+/g, ' ')
        .trim();
}

const TABLE_RE = /<table[^>]*>[\s\S]*?<\/table>/gi;
const ROW_RE = /<tr[\s\S]*?<\/tr>/gi;
const CELL_RE = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;

function cellsOf(rowHtml: string): string[] {
    return Array.from(rowHtml.matchAll(CELL_RE), m => cellText(m[1] ?? ''));
}

/**
 * 클래스 주식 구분자를 레포 심볼 형식(`BRK.B`)으로 맞춘다. Wikipedia는 `BRK.B`지만 공급처에 따라
 * `BRK-B`도 쓰므로 `-`·`/`·공백을 `.`으로 모은다.
 */
export function normalizeIndexSymbol(raw: string): string {
    return raw
        .trim()
        .toUpperCase()
        .replace(/[-/\s]+/g, '.');
}

const SYMBOL_SHAPE = /^[A-Z0-9]{1,6}(\.[A-Z])?$/;

/**
 * 표 하나에서 심볼 열을 뽑는다. 머리글에 심볼 열이 없으면 `null`(후보 아님). 본문 행의 셀 수가 머리글과
 * 다르면(colspan·rowspan이 열을 밀어낸다) 던진다 — 틀린 열을 읽어 "정상 목록"으로 보이는 것보다 낫다.
 */
function symbolsOfTable(
    table: string,
    wanted: readonly string[]
): string[] | null {
    const [headerRow, ...bodyRows] = table.match(ROW_RE) ?? [];
    if (headerRow === undefined) return null;
    const header = cellsOf(headerRow);
    const column = header.findIndex(h => wanted.includes(h.toLowerCase()));
    if (column < 0) return null;
    const symbols = bodyRows.flatMap(row => {
        const cells = cellsOf(row);
        if (cells.length !== header.length)
            throw new IndexConstituentsError('row cell count mismatch');
        const cell = cells[column] ?? '';
        return cell === '' ? [] : [normalizeIndexSymbol(cell)];
    });
    if (symbols.some(s => !SYMBOL_SHAPE.test(s)))
        throw new IndexConstituentsError('unexpected symbol cell shape');
    return Array.from(new Set(symbols));
}

interface TableResult {
    symbols: string[] | null;
    error: IndexConstituentsError | null;
}

/**
 * HTML에서 심볼 열 머리글을 가진 표들 중 심볼이 가장 많은 표의 심볼을 뽑는다(정규화·중복 제거, 등장
 * 순서 유지). `Selected changes`처럼 같은 머리글을 쓰는 작은 변동 표가 구성종목 표 앞에 있어도 본표를
 * 고르기 위함이다. 구조가 어긋난 후보 표(셀 수 불일치·심볼 모양 아님)는 건너뛰고, 쓸 수 있는 표가 하나도
 * 없으면 던진다 — 표 구조가 바뀐 것이지 "구성종목이 아님"이 아니다.
 */
export function parseConstituentSymbols(
    html: string,
    symbolHeaders: readonly string[]
): string[] {
    const wanted = symbolHeaders.map(h => h.toLowerCase());
    const results = (html.match(TABLE_RE) ?? []).map((table): TableResult => {
        try {
            return { symbols: symbolsOfTable(table, wanted), error: null };
        } catch (error) {
            if (!(error instanceof IndexConstituentsError)) throw error;
            return { symbols: null, error };
        }
    });
    const failures = results.flatMap(r => (r.error === null ? [] : [r.error]));
    const candidates = results.flatMap(r =>
        r.symbols !== null && r.symbols.length > 0 ? [r.symbols] : []
    );
    const best = candidates.reduce<string[] | null>(
        (top, c) => (top === null || c.length > top.length ? c : top),
        null
    );
    if (best !== null) return best;
    throw (
        failures[0] ??
        new IndexConstituentsError('constituents table not found')
    );
}

/** 개수가 허용 범위 밖이면 던진다 — 부분 로드·표 구조 변경을 "정상 목록"으로 캐시하지 않기 위한 가드. */
export function assertConstituentCount(
    index: IndexId,
    symbols: readonly string[]
): void {
    const { minCount, maxCount } = INDEX_SOURCES[index];
    if (symbols.length < minCount || symbols.length > maxCount)
        throw new IndexConstituentsError(
            `${index} constituent count ${symbols.length} outside [${minCount}, ${maxCount}]`
        );
}

/** 한 지수의 구성종목 심볼을 Wikipedia에서 읽는다. HTTP 오류·구조 변경·개수 이상은 던진다. */
export async function fetchIndexConstituents(
    index: IndexId
): Promise<string[]> {
    const { url, symbolHeaders } = INDEX_SOURCES[index];
    const res = await fetch(url, {
        cache: 'no-store',
        headers: {
            'User-Agent': WIKIPEDIA_USER_AGENT,
            'Accept-Encoding': 'gzip',
        },
        signal: AbortSignal.timeout(WIKIPEDIA_REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
        await res.body?.cancel().catch(() => undefined);
        throw new IndexConstituentsError(`wikipedia ${index} ${res.status}`);
    }
    const html = new TextDecoder('utf-8').decode(
        await readBoundedBody(res, WIKIPEDIA_MAX_BODY_BYTES)
    );
    const symbols = parseConstituentSymbols(html, symbolHeaders);
    assertConstituentCount(index, symbols);
    return symbols;
}

import {
    assertConstituentCount,
    INDEX_SOURCES,
    IndexConstituentsError,
    normalizeIndexSymbol,
    parseConstituentSymbols,
} from '@/shared/api/wikipedia/indexConstituents';

/**
 * S&P 500 스냅샷 생성기의 순수 부분. 네트워크는 `build-us-sp500.ts`가 맡고, 여기는 HTML → 심볼 목록만 한다.
 * 심볼 추출·개수 가드는 에이전트 도구가 쓰는 `indexConstituents.ts`를 그대로 쓴다(두 군데가 따로 틀어지지 않게).
 *
 * `indexConstituents.ts`는 `server-only`를 import하므로 이 코드는 `NODE_OPTIONS=--conditions=react-server`로
 * 실행한다(다른 스크립트와 같다).
 */

/**
 * 한 발행사가 두 종류 주식으로 올라 있을 때 남길 쪽. 같은 회사가 신호 목록에 두 줄로 나오는 걸 막는다
 * (마지막 확인 때 GOOG/GOOGL, FOX/FOXA, NWS/NWSA). 여기 없는 중복 발행사가 나오면 생성이 실패한다 —
 * 어느 쪽을 남길지 사람이 정해야 한다.
 */
export const KEEP_SHARE_CLASS: Readonly<Record<string, string>> = {
    'Alphabet Inc.': 'GOOGL',
    'Fox Corporation': 'FOXA',
    'News Corp': 'NWSA',
};

const TABLE_RE = /<table[^>]*>[\s\S]*?<\/table>/gi;
const ROW_RE = /<tr[\s\S]*?<\/tr>/gi;
const CELL_RE = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;

function cellText(html: string): string {
    return html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<sup[\s\S]*?<\/sup>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** 심볼 열과 `Security`(회사명) 열이 모두 있는 표에서 심볼 → 회사명을 읽는다. 표가 없으면 빈 맵. */
export function parseSecurityNames(html: string): ReadonlyMap<string, string> {
    const entries = (html.match(TABLE_RE) ?? []).flatMap(table => {
        const [headerRow, ...bodyRows] = table.match(ROW_RE) ?? [];
        if (headerRow === undefined) return [];
        const cellsOf = (row: string) =>
            Array.from(row.matchAll(CELL_RE), m => cellText(m[1] ?? ''));
        const header = cellsOf(headerRow);
        const symbolColumn = header.findIndex(h => h === 'Symbol');
        const nameColumn = header.findIndex(h => h === 'Security');
        if (symbolColumn < 0 || nameColumn < 0) return [];
        return bodyRows.flatMap(row => {
            const cells = cellsOf(row);
            const symbol = cells[symbolColumn];
            const name = cells[nameColumn];
            return symbol && name
                ? [[normalizeIndexSymbol(symbol), name] as const]
                : [];
        });
    });
    return new Map(entries);
}

const CLASS_SUFFIX_RE = /\s*\(Class [A-Z]\)\s*$/;

/** `Alphabet Inc. (Class A)` → `Alphabet Inc.`. 클래스 표기가 없으면 그대로. */
export function issuerOf(securityName: string): string {
    return securityName.replace(CLASS_SUFFIX_RE, '');
}

/**
 * 같은 발행사의 주식 종류가 여럿이면 {@link KEEP_SHARE_CLASS}에 정한 한 종류만 남긴다. 표에 없는 중복
 * 발행사, 또는 남기기로 한 심볼이 표에 없는 경우는 던진다. 결과는 심볼 순이다.
 */
export function dropSecondShareClasses(
    symbols: readonly string[],
    names: ReadonlyMap<string, string>
): string[] {
    const byIssuer = new Map<string, string[]>();
    symbols.forEach(symbol => {
        const name = names.get(symbol);
        if (name === undefined)
            throw new IndexConstituentsError(
                `no Security name for symbol ${symbol}`
            );
        const issuer = issuerOf(name);
        byIssuer.set(issuer, [...(byIssuer.get(issuer) ?? []), symbol]);
    });
    const kept = [...byIssuer.entries()].flatMap(([issuer, group]) => {
        if (group.length === 1) return group;
        const keep = KEEP_SHARE_CLASS[issuer];
        if (keep === undefined || !group.includes(keep))
            throw new IndexConstituentsError(
                `duplicate issuer "${issuer}" (${group.join(', ')}) has no keep rule`
            );
        return [keep];
    });
    return kept.sort();
}

export interface UsSnapshot {
    readonly asOf: string;
    readonly symbols: readonly string[];
}

/** Wikipedia HTML → 스냅샷 데이터. 개수 가드와 중복 발행사 정리를 거친다. */
export function buildUsSnapshot(html: string, asOf: string): UsSnapshot {
    const { symbolHeaders } = INDEX_SOURCES.sp500;
    const parsed = parseConstituentSymbols(html, symbolHeaders);
    assertConstituentCount('sp500', parsed);
    const symbols = dropSecondShareClasses(parsed, parseSecurityNames(html));
    return { asOf, symbols };
}

export const US_SNAPSHOT_SOURCE = 'wikipedia:List_of_S&P_500_companies';

/** 생성 파일 본문. 한 줄에 하나씩 적어 포매터가 다시 흔들지 않는 형태로 쓴다. */
export function renderUsSnapshotFile(
    snapshot: UsSnapshot,
    command: string
): string {
    const lines = snapshot.symbols.map(s => `        '${s}',`).join('\n');
    return `/**
 * 신호 스캔 대상 — S&P 500(미국) 스냅샷. 직접 고치지 않는다.
 * 생성: \`${command}\` (출처 ${US_SNAPSHOT_SOURCE}, 기준일 ${snapshot.asOf}, ${snapshot.symbols.length}종목)
 * 한 발행사가 두 종류 주식으로 올라 있으면 한 종류만 남긴다(\`KEEP_SHARE_CLASS\`).
 * 분기마다(S&P 정기변경 뒤) 다시 만든다 — 기준일이 200일을 넘으면 기록기가 로그로 알린다.
 */
export const US_SP500_SNAPSHOT = {
    asOf: '${snapshot.asOf}',
    source: '${US_SNAPSHOT_SOURCE}',
    symbols: [
${lines}
    ],
} as const;
`;
}

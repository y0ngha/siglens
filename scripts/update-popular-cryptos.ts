/**
 * 인기 암호화폐 갱신 스크립트 (수동 실행)
 *
 * FMP cryptocurrency-list API로 후보 풀을 검증한 뒤,
 * 각 심볼의 단건 quote 엔드포인트에서 marketCap을 수집하여
 * 시가총액 상위 MAX_POPULAR_CRYPTOS 개를 선정하고,
 * 그중 기존 POPULAR_CRYPTOS에 없는 심볼만 누적 추가합니다.
 *
 * FMP 플랜 제약:
 *   - batch-crypto-quotes → HTTP 402 (플랜 미지원). 사용 불가.
 *   - quote?symbol=<SYM> → HTTP 200, marketCap/volume/price 반환. 심볼별 단건 호출.
 *   - cryptocurrency-list → 전체 유니버스(symbol/name/circulatingSupply). 후보 유효성 검증용.
 *   - 크립토 스크리너는 플랜 미지원이므로 자동 발견 불가 → CRYPTO_CANDIDATE_POOL 수동 관리.
 *
 * 사용법:
 *   npx tsx scripts/update-popular-cryptos.ts
 *
 * 환경변수 (.env.local):
 *   FMP_API_KEY
 *
 * 결과:
 *   src/shared/config/popular-cryptos.ts에 누적 추가합니다(update-popular-tickers.ts와 동일 방식).
 *   매 실행마다 시가총액 상위 N개 중 기존 목록에 없는 심볼만
 *   "// --- Trending (YYYY-MM-DD) ---" 섹션으로 배열 끝에 append하며,
 *   기존 심볼은 삭제하지 않습니다. 같은 날짜에 재실행하면 중복 방지를 위해 스킵합니다.
 *   파일이 없으면(최초 부트스트랩) 상위 N개로 새로 생성합니다.
 */

import { execSync } from 'child_process';
import { config } from 'dotenv';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    rmSync,
    writeFileSync,
} from 'fs';
import { dirname, resolve } from 'path';

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';

/**
 * 실행 1회당 시가총액 기준 상위 선정 개수(누적 모델의 top-N 크기).
 * popular-cryptos.ts의 실제 심볼 수는 매 실행마다 신규 심볼만 append되어 계속 늘어나므로
 * 이 값과 같지 않고, 항상 이 값 이상이다(하한).
 * 변경 시 함께 검토: src/shared/config/popular-cryptos.ts
 */
export const MAX_POPULAR_CRYPTOS = 15;

/**
 * Stablecoins are dollar-pegged — no meaningful price action for technical analysis,
 * so excluded from the popular list.
 */
export const STABLECOINS: ReadonlySet<string> = new Set([
    'USDT',
    'USDC',
    'DAI',
    'BUSD',
    'TUSD',
    'USDD',
    'FDUSD',
]);

/**
 * API 호출 간 딜레이(ms). FMP 무료/엔트리 플랜의 rate limit을 준수하기 위해
 * 심볼별 순차 호출 사이에 삽입한다.
 */
const REQUEST_DELAY_MS = 250;

/**
 * 후보 풀 — 유지 관리 필요.
 *
 * FMP 플랜에 crypto screener가 없어 시가총액 기준 자동 발견이 불가하므로,
 * 주요 *USD 심볼을 수동으로 관리하는 넓은 후보 집합이다. 현재 POPULAR_CRYPTOS의
 * 15종 + 잘 알려진 추가 코인을 포함한다. 랭킹에 새 코인을 반영하려면 여기에 추가.
 *
 * 기준:
 *   - FMP cryptocurrency-list에 존재하는 *USD 심볼
 *   - 이름 변경/폐지 코인은 제거: 예) MATICUSD → POLUSD (Polygon rebranding, 제거 완료)
 */
export const CRYPTO_CANDIDATE_POOL: readonly string[] = [
    // Top-10 by market cap (as of mid-2025 typical rankings, stablecoins excluded)
    'BTCUSD',
    'ETHUSD',
    'BNBUSD',
    'SOLUSD',
    'XRPUSD',
    'DOGEUSD',
    'ADAUSD',
    'TRXUSD',
    // Established layer-1s / large caps
    'AVAXUSD',
    'LINKUSD',
    'DOTUSD',
    'POLUSD',
    'LTCUSD',
    'BCHUSD',
    'XLMUSD',
    'ATOMUSD',
    'ALGOUSD',
    // DeFi / ecosystem tokens
    'UNIUSD',
    'AAVEUSD',
    'MKRUSD',
    'COMPUSD',
    // Layer-2 / scaling
    'ARBUSD',
    'OPUSD',
    'IMXUSD',
    // Emerging layer-1s
    'APTUSD',
    'SUIUSD',
    'SEIUSD',
    'NEARUSD',
    'TONUSD',
    'INJUSD',
    'TIAUSD',
    'JASMYUSD',
    // Memes & high-cap speculative
    'SHIBUSD',
    'PEPEUSD',
    'FLOKIUSD',
    // Other well-known
    'FILUSD',
    'GRTUSD',
    'SANDUSD',
    'MANAUSD',
    'APEUSD',
];

const POPULAR_CRYPTOS_PATH = resolve(
    process.cwd(),
    'src/shared/config/popular-cryptos.ts'
);

/**
 * popular-cryptos.ts를 최초 부트스트랩(파일 부재)할 때만 사용하는 헤더 주석.
 *
 * 파일이 이미 존재하면 스크립트는 배열에만 심볼을 누적 append하고 헤더는 건드리지 않는다.
 * 따라서 라이브 파일 헤더의 WHY(아래 제약 두 가지)는 그대로 보존된다:
 *   1. FMP 심볼은 *USD 접미사(BTCUSD) 형태를 사용한다.
 *   2. batch-crypto-quotes 엔드포인트는 HTTP 402(플랜 미지원)이므로
 *      단건 quote 엔드포인트를 심볼별로 순차 호출하는 방식으로 시가총액을 수집한다.
 */
export const FILE_HEADER = `// 큐레이션된 인기 암호화폐 — 홈 디스커버리 + sitemap popular 엔트리.
// FMP 심볼은 *USD 접미사(BTCUSD)를 쓴다. batch-crypto-quotes가 HTTP 402(플랜 미지원)이라
// 단건 quote를 심볼별로 호출하여 시가총액 상위 N개를 선정한다(update-popular-cryptos.ts).
// 갱신은 누적 방식이다: 매 실행마다 시총 상위 N개 중 기존 목록에 없는 심볼만
// "// --- Trending (YYYY-MM-DD) ---" 섹션으로 배열 끝에 추가하며, 기존 심볼은 삭제하지 않는다.
// 심볼 후보를 늘리려면 scripts/update-popular-cryptos.ts의 CRYPTO_CANDIDATE_POOL을 수정하라.`;

// popular-cryptos.ts 배열 경계 마커 — 기존 파일에서 심볼을 추출·중복제거·append할 때 기준점.
const POPULAR_CRYPTOS_DECLARATION = 'export const POPULAR_CRYPTOS = [';
const POPULAR_CRYPTOS_END = '] as const;';
// crypto 심볼 리터럴 한 줄 매칭: 들여쓰기 + 'BTCUSD', + 선택적 후행 주석.
// Trending 섹션 헤더(// --- ... ---) 같은 비-심볼 줄은 매칭되지 않는다.
const CRYPTO_LITERAL_LINE_PATTERN =
    /^(\s*)['"]([A-Z][A-Z0-9.-]*)['"],?(\s*(?:\/\/.*)?)?$/;

interface FmpCryptoListEntry {
    symbol: string;
    name: string;
    circulatingSupply: number | null;
}

interface FmpQuoteResult {
    symbol: string;
    price: number | null;
    marketCap: number | null;
    volume: number | null;
}

export interface CryptoRankEntry {
    symbol: string;
    marketCap: number;
}

export interface CandidateFilterResult {
    valid: string[];
    dropped: string[];
}

export interface DeduplicateCryptoEntriesResult {
    content: string;
    removedSymbols: readonly string[];
}

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

export function formatMarketCap(cap: number): string {
    if (cap >= 1_000_000_000_000) return `$${(cap / 1_000_000_000_000).toFixed(2)}T`;
    if (cap >= 1_000_000_000) return `$${(cap / 1_000_000_000).toFixed(2)}B`;
    if (cap >= 1_000_000) return `$${(cap / 1_000_000).toFixed(2)}M`;
    return `$${cap.toFixed(0)}`;
}

async function fetchCryptoList(apiKey: string): Promise<FmpCryptoListEntry[]> {
    const url = `${FMP_BASE_URL}/cryptocurrency-list?apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(
            `cryptocurrency-list API error: ${res.status} ${res.statusText}`
        );
    }

    // FMP returns unvalidated JSON; runtime guard before trusting shape
    const raw: unknown = await res.json();
    if (!Array.isArray(raw)) return [];
    const typed = raw as FmpCryptoListEntry[]; // Array.isArray guard above; element shape trusts the stable FMP cryptocurrency-list contract
    return typed;
}

async function fetchSingleQuote(
    apiKey: string,
    symbol: string
): Promise<FmpQuoteResult | null> {
    const url = `${FMP_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);

    if (!res.ok) {
        console.warn(`  quote fetch failed for ${symbol}: ${res.status}`);
        return null;
    }

    // FMP quote endpoint returns an array; runtime guard before trusting shape
    const raw: unknown = await res.json();
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const first = raw[0] as FmpQuoteResult; // Array.isArray + length>0 guards above; element shape trusts the stable FMP quote API contract
    if (typeof first?.symbol !== 'string') return null;
    return first;
}

function isEligible(symbol: string, listedSymbols: ReadonlySet<string>): boolean {
    const upper = symbol.toUpperCase();
    const base = upper.endsWith('USD') ? upper.slice(0, -3) : upper;
    return listedSymbols.has(upper) && !STABLECOINS.has(base);
}

/**
 * cryptocurrency-list로부터 유효 심볼 집합을 구성한다.
 * 풀에 있으나 리스트에 없는 심볼은 폐지/이름변경된 것으로 간주, 제거한다.
 * 스테이블코인(STABLECOINS)은 가격 변동이 없어 기술적 분석이 무의미하므로 제외한다.
 */
export function filterValidCandidates(
    pool: readonly string[],
    cryptoList: FmpCryptoListEntry[]
): CandidateFilterResult {
    const listedSymbols = new Set(cryptoList.map(e => e.symbol.toUpperCase()));

    // Compute eligibility once per element — O(N), isEligible called exactly once per symbol.
    const validSet = new Set(pool.filter(s => isEligible(s, listedSymbols)));

    return {
        valid: pool.filter(s => validSet.has(s)),
        dropped: pool.filter(s => !validSet.has(s)),
    };
}

/**
 * marketCap 기준 내림차순으로 정렬한 뒤 상위 topN 개를 반환한다.
 * marketCap이 null이거나 0인 항목은 제외한다.
 */
export function rankByMarketCap(
    entries: CryptoRankEntry[],
    topN: number
): CryptoRankEntry[] {
    return entries
        .filter(e => e.marketCap > 0)
        .toSorted((a, b) => b.marketCap - a.marketCap)
        .slice(0, topN);
}

/**
 * 심볼 하나를 POPULAR_CRYPTOS 배열 리터럴 줄 포맷으로 렌더링한다.
 * renderPopularCryptosFile과 insertCryptoTrendingSection이 공유해 포맷 drift를 방지한다.
 */
function formatCryptoSymbolLine(symbol: string): string {
    return `    '${symbol}',`;
}

/**
 * popular-cryptos.ts 파일 내용을 렌더링한다.
 * 헤더 주석은 보존하고 POPULAR_CRYPTOS 배열만 교체한다.
 */
export function renderPopularCryptosFile(symbols: readonly string[]): string {
    const lines = symbols.map(formatCryptoSymbolLine).join('\n');
    const body = lines.length > 0 ? `${lines}\n` : '';

    return `${FILE_HEADER}
export const POPULAR_CRYPTOS = [
${body}] as const;
`;
}

/**
 * 기존 popular-cryptos.ts 내용에서 POPULAR_CRYPTOS 배열에 이미 존재하는 심볼 집합을 추출한다.
 * deduplicateCryptoEntries와 동일하게 POPULAR_CRYPTOS_END를 배열 끝 경계로 사용해,
 * 배열 뒤에 다른 export/주석이 추가되어도 관련 없는 따옴표 문자열을 심볼로 오인하지 않는다.
 * 선언 마커나 종료 마커를 찾지 못하면 빈 집합을 반환한다(신규 심볼 전부를 추가 대상으로 간주).
 */
export function extractExistingCryptos(fileContent: string): Set<string> {
    const arrayStart = fileContent.indexOf(POPULAR_CRYPTOS_DECLARATION);
    if (arrayStart === -1) return new Set();

    const arrayEnd = fileContent.indexOf(POPULAR_CRYPTOS_END, arrayStart);
    if (arrayEnd === -1) return new Set();

    const popularSection = fileContent.slice(arrayStart, arrayEnd);
    const matches = popularSection.match(/['"]([A-Z][A-Z0-9.-]*)['"]/g);
    return new Set(matches ? matches.map(m => m.slice(1, -1)) : []);
}

/**
 * POPULAR_CRYPTOS 배열 내부의 중복 심볼 줄을 첫 등장만 남기고 제거한다.
 * 배열 경계 밖의 내용(헤더 주석 등)과 Trending 섹션 헤더 줄은 보존한다.
 */
export function deduplicateCryptoEntries(
    fileContent: string
): DeduplicateCryptoEntriesResult {
    const arrayStart = fileContent.indexOf(POPULAR_CRYPTOS_DECLARATION);
    const arrayEnd = fileContent.indexOf(POPULAR_CRYPTOS_END, arrayStart);

    if (arrayStart === -1 || arrayEnd === -1) {
        return { content: fileContent, removedSymbols: [] };
    }

    const sectionStart = arrayStart + POPULAR_CRYPTOS_DECLARATION.length;
    const beforeSection = fileContent.slice(0, sectionStart);
    const section = fileContent.slice(sectionStart, arrayEnd);
    const afterSection = fileContent.slice(arrayEnd);

    interface DedupAcc {
        keptLines: readonly string[];
        removed: readonly string[];
        seen: ReadonlySet<string>;
    }
    const initialAcc: DedupAcc = { keptLines: [], removed: [], seen: new Set() };

    // CRLF-safe split — defensive, since this repo is LF-normalized by prettier
    // but the file may originate from a non-normalized source (e.g. Windows checkout).
    const { keptLines, removed } = section.split(/\r?\n/).reduce(
        (acc, line): DedupAcc => {
            const symbolMatch = line.match(CRYPTO_LITERAL_LINE_PATTERN);
            if (!symbolMatch) {
                return { ...acc, keptLines: [...acc.keptLines, line] };
            }

            const symbol = symbolMatch[2]!;
            if (acc.seen.has(symbol)) {
                return { ...acc, removed: [...acc.removed, symbol] };
            }

            return {
                keptLines: [...acc.keptLines, line],
                removed: acc.removed,
                seen: new Set(acc.seen).add(symbol),
            };
        },
        initialAcc
    );

    const deduplicatedSection = keptLines.join('\n');

    return {
        content: `${beforeSection}${deduplicatedSection}${afterSection}`,
        removedSymbols: removed,
    };
}

/**
 * 신규 심볼을 "// --- Trending (YYYY-MM-DD) ---" 섹션으로 배열 끝(] as const;) 앞에 삽입한다.
 * 같은 날짜 섹션이 이미 있으면 중복 방지를 위해 원본을 그대로 반환한다.
 */
export function insertCryptoTrendingSection(
    fileContent: string,
    newSymbols: readonly string[]
): string {
    const date = new Date().toISOString().slice(0, 10);
    const sectionHeader = `// --- Trending (${date}) ---`;

    if (fileContent.includes(sectionHeader)) {
        console.warn(
            `Trending section for ${date} already exists. Skipping to avoid duplicates.`
        );
        return fileContent;
    }

    const symbolLines = newSymbols.map(formatCryptoSymbolLine).join('\n');
    const section = `\n    ${sectionHeader}\n${symbolLines}\n`;

    // Same boundary strategy as deduplicateCryptoEntries/extractExistingCryptos:
    // find the declaration first, then search for the end marker from there on,
    // instead of lastIndexOf (which could match an unrelated "] as const;" elsewhere in the file).
    const arrayStart = fileContent.indexOf(POPULAR_CRYPTOS_DECLARATION);
    const insertionPoint = fileContent.indexOf(POPULAR_CRYPTOS_END, arrayStart);
    if (insertionPoint === -1) {
        throw new Error('Could not find "] as const;" in popular-cryptos.ts');
    }

    return (
        fileContent.slice(0, insertionPoint) +
        section +
        fileContent.slice(insertionPoint)
    );
}

function writeAndFormatFileAtomically(
    path: string,
    fileContent: string
): string {
    const tempPath = `${path}.${process.pid}.${Date.now()}.tmp.ts`;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(tempPath, fileContent, 'utf-8');

    try {
        execSync(`yarn prettier --write "${tempPath}"`, { stdio: 'inherit' });
    } catch {
        console.warn(
            `Prettier failed for ${path} — temp file was written but may need manual formatting.`
        );
    }

    return tempPath;
}

function commitFileAtomically(path: string, fileContent: string): void {
    const tempPath = writeAndFormatFileAtomically(path, fileContent);

    try {
        renameSync(tempPath, path);
        console.log(`\nUpdated ${path}`);
    } finally {
        try {
            rmSync(tempPath, { force: true });
        } catch (cleanupError) {
            console.warn(`[update-popular-cryptos] temp file cleanup failed: ${tempPath}`, cleanupError);
        }
    }
}

const TABLE_RANK_COL_WIDTH = 4;
const TABLE_SYMBOL_COL_WIDTH = 9;
const TABLE_MARKET_CAP_COL_WIDTH = 14;
const COLUMN_DIVIDER = ' | ';

// Separator spans the full data row: rank + ' | ' + symbol + ' | ' + market-cap.
const TABLE_SEPARATOR_WIDTH =
    TABLE_RANK_COL_WIDTH +
    COLUMN_DIVIDER.length +
    TABLE_SYMBOL_COL_WIDTH +
    COLUMN_DIVIDER.length +
    TABLE_MARKET_CAP_COL_WIDTH;

function printResults(ranked: CryptoRankEntry[]): void {
    console.log(`\n--- Top ${ranked.length} Cryptos by Market Cap ---\n`);
    console.log('Rank | Symbol    | Market Cap');
    console.log('-'.repeat(TABLE_SEPARATOR_WIDTH));

    ranked.forEach((e, i) => {
        const rank = String(i + 1).padStart(TABLE_RANK_COL_WIDTH);
        const symbol = e.symbol.padEnd(TABLE_SYMBOL_COL_WIDTH);
        const cap = formatMarketCap(e.marketCap).padStart(TABLE_MARKET_CAP_COL_WIDTH);
        console.log(`${rank}${COLUMN_DIVIDER}${symbol}${COLUMN_DIVIDER}${cap}`);
    });
}

async function main(): Promise<void> {
    config({ path: resolve(process.cwd(), '.env.local') });

    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) {
        throw new Error('FMP_API_KEY must be set in .env.local');
    }

    console.log('\n=== Update Popular Cryptos ===\n');
    console.log(`Candidate pool size: ${CRYPTO_CANDIDATE_POOL.length}`);

    console.log('\nFetching cryptocurrency-list for candidate validation...');
    const cryptoList = await fetchCryptoList(apiKey);
    console.log(`cryptocurrency-list returned: ${cryptoList.length} entries`);

    const { valid, dropped } = filterValidCandidates(
        CRYPTO_CANDIDATE_POOL,
        cryptoList
    );

    if (dropped.length > 0) {
        console.log(
            `\nDropped (not in cryptocurrency-list): ${dropped.join(', ')}`
        );
    }
    console.log(`Valid candidates after validation: ${valid.length}`);

    console.log(`\nFetching quotes for ${valid.length} candidates...`);

    // Sequential rate-limited fetch accumulated immutably (mirrors update-popular-tickers.ts).
    const ranked = await valid.reduce(
        async (accPromise, symbol, i) => {
            const acc = await accPromise;
            process.stdout.write(
                `  [${i + 1}/${valid.length}] ${symbol.padEnd(10)}`
            );

            const quote = await fetchSingleQuote(apiKey, symbol);

            if (i < valid.length - 1) {
                await sleep(REQUEST_DELAY_MS);
            }

            if (quote === null || !quote.marketCap || quote.marketCap <= 0) {
                console.log('→ skipped (no marketCap)');
                return acc;
            }

            console.log(`→ ${formatMarketCap(quote.marketCap)}`);
            return [...acc, { symbol, marketCap: quote.marketCap }];
        },
        Promise.resolve([] as CryptoRankEntry[]) // empty array literal satisfies any element type — safe seed for the accumulator
    );

    const topCryptos = rankByMarketCap(ranked, MAX_POPULAR_CRYPTOS);

    if (topCryptos.length === 0) {
        throw new Error(
            'No cryptos with valid marketCap found. Aborting to avoid overwriting the file with an empty list.'
        );
    }

    printResults(topCryptos);

    const topSymbols = topCryptos.map(e => e.symbol);

    if (!existsSync(POPULAR_CRYPTOS_PATH)) {
        commitFileAtomically(
            POPULAR_CRYPTOS_PATH,
            renderPopularCryptosFile(topSymbols)
        );
        console.log(
            `\nDone! Bootstrapped POPULAR_CRYPTOS with ${topSymbols.length} symbols: ${topSymbols.join(', ')}`
        );
        return;
    }

    // 누적 갱신: 기존 파일을 읽어 중복을 정리한 뒤,
    // 상위 심볼 중 아직 목록에 없는 것만 날짜 Trending 섹션으로 추가한다.
    const originalFileContent = readFileSync(POPULAR_CRYPTOS_PATH, 'utf-8');
    const initialDeduplication = deduplicateCryptoEntries(originalFileContent);
    const existingCryptos = extractExistingCryptos(
        initialDeduplication.content
    );
    console.log(`\nExisting cryptos: ${existingCryptos.size}`);

    if (initialDeduplication.removedSymbols.length > 0) {
        console.log(
            `Duplicate symbols removed before update: ${initialDeduplication.removedSymbols.join(', ')}`
        );
    }

    const newSymbols = topSymbols.filter(s => !existingCryptos.has(s));
    console.log(
        `New symbols (in top ${MAX_POPULAR_CRYPTOS}, not already listed): ${newSymbols.length}`
    );

    if (newSymbols.length === 0) {
        if (initialDeduplication.content !== originalFileContent) {
            commitFileAtomically(
                POPULAR_CRYPTOS_PATH,
                initialDeduplication.content
            );
            console.log('\nDone! No new cryptos — duplicates cleaned up.');
        } else {
            console.log('\nDone! No new cryptos — file already up to date.');
        }
        return;
    }

    const contentWithTrendingSection = insertCryptoTrendingSection(
        initialDeduplication.content,
        newSymbols
    );
    const addedSymbols =
        contentWithTrendingSection === initialDeduplication.content
            ? []
            : newSymbols;
    const finalDeduplication = deduplicateCryptoEntries(
        contentWithTrendingSection
    );

    if (finalDeduplication.removedSymbols.length > 0) {
        console.log(
            `Duplicate symbols removed after update: ${finalDeduplication.removedSymbols.join(', ')}`
        );
    }

    commitFileAtomically(POPULAR_CRYPTOS_PATH, finalDeduplication.content);

    if (addedSymbols.length > 0) {
        console.log(
            `\nDone! Added ${addedSymbols.length} cryptos: ${addedSymbols.join(', ')}`
        );
    } else {
        console.log('\nDone! Crypto list updated after cleanup.');
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exit(1);
    });
}

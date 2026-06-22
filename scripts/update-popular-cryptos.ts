/**
 * 인기 암호화폐 갱신 스크립트 (수동 실행)
 *
 * FMP cryptocurrency-list API로 후보 풀을 검증한 뒤,
 * 각 심볼의 단건 quote 엔드포인트에서 marketCap을 수집하여
 * 시가총액 상위 MAX_POPULAR_CRYPTOS 개를 POPULAR_CRYPTOS로 덮어씁니다.
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
 *   시가총액 기준 상위 N개로 src/shared/config/popular-cryptos.ts를 완전 교체합니다.
 *   (누적 추가가 아니라 매 실행마다 현재 상위 코인으로 리프레시)
 */

import { execSync } from 'child_process';
import { config } from 'dotenv';
import {
    mkdirSync,
    renameSync,
    rmSync,
    writeFileSync,
} from 'fs';
import { dirname, resolve } from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';

/**
 * 최대 인기 암호화폐 수. 현재 popular-cryptos.ts의 큐레이션 목록과 동일.
 * 변경 시 함께 검토: src/shared/config/popular-cryptos.ts
 */
export const MAX_POPULAR_CRYPTOS = 15;

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
    // Top-10 by market cap (as of mid-2025 typical rankings)
    'BTCUSD',
    'ETHUSD',
    'USDTUSD',
    'BNBUSD',
    'SOLUSD',
    'XRPUSD',
    'USDCUSD',
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
 * popular-cryptos.ts에 기록되는 헤더 주석.
 *
 * 이 스크립트를 실행할 때마다 파일 전체를 이 헤더 + 새 배열로 교체하므로,
 * 라이브 파일 헤더의 WHY(아래 제약 두 가지)를 반드시 보존해야 한다:
 *   1. FMP 심볼은 *USD 접미사(BTCUSD) 형태를 사용한다.
 *   2. batch-crypto-quotes 엔드포인트는 HTTP 402(플랜 미지원)이므로
 *      단건 quote 엔드포인트를 심볼별로 순차 호출하는 방식으로 시가총액을 수집한다.
 */
const FILE_HEADER = `// 큐레이션된 인기 암호화폐 — 홈 디스커버리 + sitemap popular 엔트리.
// FMP 심볼은 *USD 접미사(BTCUSD)를 쓴다. batch-crypto-quotes가 HTTP 402(플랜 미지원)이라
// 단건 quote를 심볼별로 호출하여 시가총액 기준 상위 N개를 자동 선정한다(update-popular-cryptos.ts).
// 수동으로 순서를 바꾸거나 심볼을 추가/제거할 수 있습니다.`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

function formatMarketCap(cap: number): string {
    if (cap >= 1_000_000_000_000) return `$${(cap / 1_000_000_000_000).toFixed(2)}T`;
    if (cap >= 1_000_000_000) return `$${(cap / 1_000_000_000).toFixed(2)}B`;
    if (cap >= 1_000_000) return `$${(cap / 1_000_000).toFixed(2)}M`;
    return `$${cap.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// FMP API
// ---------------------------------------------------------------------------

async function fetchCryptoList(apiKey: string): Promise<FmpCryptoListEntry[]> {
    const url = `${FMP_BASE_URL}/cryptocurrency-list?apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(
            `cryptocurrency-list API error: ${res.status} ${res.statusText}`
        );
    }

    // FMP returns unvalidated JSON; shape matches FmpCryptoListEntry
    const raw = (await res.json()) as FmpCryptoListEntry[];
    if (!Array.isArray(raw)) return [];
    return raw;
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

    // FMP quote endpoint returns an array; first element is the result
    const raw = (await res.json()) as FmpQuoteResult[];
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw[0] ?? null;
}

// ---------------------------------------------------------------------------
// Core logic (exported for testability)
// ---------------------------------------------------------------------------

/**
 * cryptocurrency-list로부터 유효 심볼 집합을 구성한다.
 * 풀에 있으나 리스트에 없는 심볼은 폐지/이름변경된 것으로 간주, 제거한다.
 */
export function filterValidCandidates(
    pool: readonly string[],
    cryptoList: FmpCryptoListEntry[]
): { valid: string[]; dropped: string[] } {
    const listedSymbols = new Set(cryptoList.map(e => e.symbol.toUpperCase()));
    const valid: string[] = [];
    const dropped: string[] = [];

    for (const symbol of pool) {
        if (listedSymbols.has(symbol.toUpperCase())) {
            valid.push(symbol);
        } else {
            dropped.push(symbol);
        }
    }

    return { valid, dropped };
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
        .slice()
        .sort((a, b) => b.marketCap - a.marketCap)
        .slice(0, topN);
}

/**
 * popular-cryptos.ts 파일 내용을 렌더링한다.
 * 헤더 주석은 보존하고 POPULAR_CRYPTOS 배열만 교체한다.
 */
export function renderPopularCryptosFile(symbols: readonly string[]): string {
    const lines = symbols.map(s => `    '${s}',`).join('\n');
    const body = lines.length > 0 ? `${lines}\n` : '';

    return `${FILE_HEADER}
export const POPULAR_CRYPTOS = [
${body}] as const;
`;
}

// ---------------------------------------------------------------------------
// File write
// ---------------------------------------------------------------------------

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
        } catch {
            // best-effort cleanup
        }
    }
}

// ---------------------------------------------------------------------------
// Result display
// ---------------------------------------------------------------------------

/**
 * 결과 테이블 구분선 너비.
 * "Rank | Symbol    | Market Cap" 헤더의 컬럼 패딩 합산값(4+3+9+3+14 = 33 + 구분자 9 = 42).
 */
const TABLE_SEPARATOR_WIDTH = 42;

function printResults(ranked: CryptoRankEntry[]): void {
    console.log(`\n--- Top ${ranked.length} Cryptos by Market Cap ---\n`);
    console.log('Rank | Symbol    | Market Cap');
    console.log('-'.repeat(TABLE_SEPARATOR_WIDTH));

    ranked.forEach((e, i) => {
        const rank = String(i + 1).padStart(4);
        const symbol = e.symbol.padEnd(9);
        const cap = formatMarketCap(e.marketCap).padStart(14);
        console.log(`${rank} | ${symbol} | ${cap}`);
    });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
    config({ path: resolve(process.cwd(), '.env.local') });

    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) {
        throw new Error('FMP_API_KEY must be set in .env.local');
    }

    console.log('\n=== Update Popular Cryptos ===\n');
    console.log(`Candidate pool size: ${CRYPTO_CANDIDATE_POOL.length}`);

    // 1. Validate candidates against the full crypto list (drop delisted/renamed)
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

    // 2. Fetch single quote per valid candidate for marketCap
    console.log(`\nFetching quotes for ${valid.length} candidates...`);

    const ranked: CryptoRankEntry[] = [];

    for (let i = 0; i < valid.length; i++) {
        const symbol = valid[i]!;
        process.stdout.write(
            `  [${i + 1}/${valid.length}] ${symbol.padEnd(10)}`
        );

        const quote = await fetchSingleQuote(apiKey, symbol);

        if (quote === null || !quote.marketCap || quote.marketCap <= 0) {
            console.log('→ skipped (no marketCap)');
        } else {
            console.log(`→ ${formatMarketCap(quote.marketCap)}`);
            ranked.push({ symbol, marketCap: quote.marketCap });
        }

        if (i < valid.length - 1) {
            await sleep(REQUEST_DELAY_MS);
        }
    }

    // 3. Rank and select top N
    const topCryptos = rankByMarketCap(ranked, MAX_POPULAR_CRYPTOS);

    if (topCryptos.length === 0) {
        throw new Error(
            'No cryptos with valid marketCap found. Aborting to avoid overwriting the file with an empty list.'
        );
    }

    // 4. Display results
    printResults(topCryptos);

    // 5. Render and atomically write the config file
    const topSymbols = topCryptos.map(e => e.symbol);
    const fileContent = renderPopularCryptosFile(topSymbols);
    commitFileAtomically(POPULAR_CRYPTOS_PATH, fileContent);

    console.log(
        `\nDone! POPULAR_CRYPTOS updated to top ${topCryptos.length} by market cap.`
    );
    console.log(`Symbols: ${topSymbols.join(', ')}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exit(1);
    });
}

/**
 * 주간 인기 종목 업데이트 스크립트
 *
 * FMP API에서 주간 거래량 Top 종목을 조회하여
 * popular-tickers.ts의 POPULAR_TICKERS에 누적 추가합니다.
 *
 * 사용법:
 *   npx tsx scripts/update-popular-tickers.ts              # 개별 주식만
 *   npx tsx scripts/update-popular-tickers.ts --include-etf # ETF 포함
 *
 * 환경변수 (.env.local):
 *   FMP_API_KEY
 *
 * Trending 섹션:
 *   매 실행마다 "// --- Trending (YYYY-MM-DD) ---" 날짜별 섹션이 누적 추가됩니다.
 *   기존 섹션은 삭제하지 않으며, 같은 날짜에 재실행하면 중복 방지를 위해 스킵합니다.
 *   수동 정리가 필요하면 해당 섹션의 티커를 테마별 섹션으로 이동하거나 삭제하세요.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { execSync } from 'child_process';

config({ path: resolve(process.cwd(), '.env.local') });

// --- Constants ---

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';
const MIN_PRICE = 5;
const MAX_DAILY_CHANGE_PCT = 20;
const MAX_NEW_TICKERS = 10;
const REQUEST_DELAY_MS = 200;
const SCREENER_LIMIT = 100;
const SCREENER_MIN_MARKET_CAP = 2_000_000_000;
const SCREENER_MIN_VOLUME = 5_000_000;
const EOD_LOOKBACK_DAYS = 10;
const EOD_FETCH_CAP = 30;

const POPULAR_TICKERS_PATH = resolve(
    process.cwd(),
    'src/domain/constants/popular-tickers.ts'
);

// --- Types ---

interface ScreenerResult {
    symbol: string;
    companyName: string;
    marketCap: number | null;
    price: number;
    volume: number;
    exchangeShortName: string;
    isEtf: boolean;
}

interface EodBar {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface TickerWeeklyVolume {
    symbol: string;
    companyName: string;
    weeklyVolume: number;
    price: number;
    marketCap: number | null;
    maxDailyChangePct: number;
}

// --- CLI ---

function parseArgs(): { includeEtf: boolean } {
    return { includeEtf: process.argv.includes('--include-etf') };
}

// --- Utilities ---

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

function formatVolume(volume: number): string {
    if (volume >= 1_000_000_000)
        return `${(volume / 1_000_000_000).toFixed(1)}B`;
    if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M`;
    if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}K`;
    return String(volume);
}

function formatMarketCap(cap: number | null): string {
    if (cap === null) return 'N/A';
    if (cap >= 1_000_000_000_000)
        return `$${(cap / 1_000_000_000_000).toFixed(1)}T`;
    if (cap >= 1_000_000_000) return `$${(cap / 1_000_000_000).toFixed(1)}B`;
    return `$${(cap / 1_000_000).toFixed(0)}M`;
}

// EOD_LOOKBACK_DAYS is calendar days (not trading days).
// 10 calendar days covers at least 5 trading days even with weekends/holidays.
function getLookbackDateRange(): { from: string; to: string } {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - EOD_LOOKBACK_DAYS);

    return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
    };
}

// --- File operations ---

function extractExistingTickers(fileContent: string): Set<string> {
    const arrayStart = fileContent.indexOf('export const POPULAR_TICKERS');
    if (arrayStart === -1) return new Set();

    const popularSection = fileContent.slice(arrayStart);
    const matches = popularSection.match(/['"]([A-Z][A-Z0-9.]+)['"]/g);
    return new Set(matches ? matches.map(m => m.slice(1, -1)) : []);
}

function insertTrendingSection(
    fileContent: string,
    newTickers: string[]
): string {
    const date = new Date().toISOString().slice(0, 10);
    const sectionHeader = `// --- Trending (${date}) ---`;

    if (fileContent.includes(sectionHeader)) {
        console.warn(
            `Trending section for ${date} already exists. Skipping to avoid duplicates.`
        );
        return fileContent;
    }

    const tickerLines = newTickers.map(t => `    '${t}',`).join('\n');
    const section = `\n    ${sectionHeader}\n${tickerLines}\n`;

    const insertionPoint = fileContent.lastIndexOf('] as const;');
    if (insertionPoint === -1) {
        throw new Error('Could not find "] as const;" in popular-tickers.ts');
    }

    return (
        fileContent.slice(0, insertionPoint) +
        section +
        fileContent.slice(insertionPoint)
    );
}

// --- FMP API ---

async function fetchScreenerResults(
    apiKey: string,
    includeEtf: boolean
): Promise<ScreenerResult[]> {
    const params = new URLSearchParams({
        marketCapMoreThan: String(SCREENER_MIN_MARKET_CAP),
        volumeMoreThan: String(SCREENER_MIN_VOLUME),
        priceMoreThan: String(MIN_PRICE),
        exchange: 'NASDAQ,NYSE',
        isFund: 'false',
        isActivelyTrading: 'true',
        limit: String(SCREENER_LIMIT),
        apikey: apiKey,
    });

    if (!includeEtf) {
        params.set('isEtf', 'false');
    }

    const url = `${FMP_BASE_URL}/company-screener?${params}`;
    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(`Screener API error: ${res.status} ${res.statusText}`);
    }

    // FMP API returns unvalidated JSON; shape is consistent with ScreenerResult contract
    const raw = (await res.json()) as ScreenerResult[];

    if (!Array.isArray(raw)) return [];
    return raw.filter(r => typeof r.symbol === 'string' && r.symbol.length > 0);
}

async function fetchEodBars(
    apiKey: string,
    symbol: string,
    from: string,
    to: string
): Promise<EodBar[]> {
    const params = new URLSearchParams({
        symbol,
        from,
        to,
        apikey: apiKey,
    });

    const url = `${FMP_BASE_URL}/historical-price-eod/full?${params}`;
    const res = await fetch(url);

    if (!res.ok) {
        console.warn(`  EOD fetch failed for ${symbol}: ${res.status}`);
        return [];
    }

    // FMP API returns unvalidated JSON; shape is consistent with EodBar contract
    const raw = (await res.json()) as EodBar[];

    if (!Array.isArray(raw)) return [];
    return raw;
}

// --- Core logic ---

function calculateWeeklyVolume(bars: EodBar[]): number {
    if (bars.length === 0) return 0;
    return bars.reduce((sum, bar) => sum + bar.volume, 0);
}

function calculateMaxDailyChangePct(bars: EodBar[]): number {
    if (bars.length === 0) return 0;
    return Math.max(
        ...bars.map(bar => Math.abs(((bar.close - bar.open) / bar.open) * 100))
    );
}

function filterAndRank(tickers: TickerWeeklyVolume[]): TickerWeeklyVolume[] {
    return tickers
        .filter(t => t.maxDailyChangePct < MAX_DAILY_CHANGE_PCT)
        .toSorted((a, b) => b.weeklyVolume - a.weeklyVolume)
        .slice(0, MAX_NEW_TICKERS);
}

function printResults(tickers: TickerWeeklyVolume[]): void {
    console.log(`\n--- Top ${tickers.length} Weekly Volume Tickers ---\n`);
    console.log(
        'Rank | Symbol   | Name                           | Weekly Vol  | Price    | MCap'
    );
    console.log('-'.repeat(85));

    tickers.forEach((t, i) => {
        const rank = String(i + 1).padStart(4);
        const symbol = t.symbol.padEnd(8);
        const companyName = t.companyName.slice(0, 30).padEnd(30);
        const vol = formatVolume(t.weeklyVolume).padStart(11);
        const price = `$${t.price.toFixed(2)}`.padStart(8);
        const mcap = formatMarketCap(t.marketCap).padStart(8);
        console.log(
            `${rank} | ${symbol} | ${companyName} | ${vol} | ${price} | ${mcap}`
        );
    });
}

// --- Main ---

async function main(): Promise<void> {
    const { includeEtf } = parseArgs();
    const apiKey = process.env.FMP_API_KEY;

    if (!apiKey) {
        throw new Error('FMP_API_KEY must be set in .env.local');
    }

    console.log('\n=== Update Popular Tickers ===');
    console.log(`ETF: ${includeEtf ? 'included' : 'excluded'}\n`);

    // 1. Read existing tickers
    const fileContent = readFileSync(POPULAR_TICKERS_PATH, 'utf-8');
    const existingTickers = extractExistingTickers(fileContent);
    console.log(`Existing tickers: ${existingTickers.size}`);

    // 2. Fetch screener candidates
    console.log('Fetching screener candidates...');
    const screenerResults = await fetchScreenerResults(apiKey, includeEtf);
    console.log(`Screener returned: ${screenerResults.length} candidates`);

    // 3. Exclude existing tickers
    const newCandidates = screenerResults.filter(
        r => !existingTickers.has(r.symbol)
    );
    console.log(
        `New candidates (not in POPULAR_TICKERS): ${newCandidates.length}`
    );

    if (newCandidates.length === 0) {
        console.log('\nNo new candidates found. Nothing to update.');
        return;
    }

    // 4. Fetch weekly volume (capped at EOD_FETCH_CAP to limit API calls)
    const cappedCandidates = newCandidates.slice(0, EOD_FETCH_CAP);
    const { from, to } = getLookbackDateRange();
    console.log(
        `\nFetching EOD data for ${cappedCandidates.length} candidates (${from} ~ ${to})...`
    );

    const weeklyVolumes = await cappedCandidates.reduce(
        async (accPromise, candidate) => {
            const acc = await accPromise;
            const bars = await fetchEodBars(apiKey, candidate.symbol, from, to);
            await sleep(REQUEST_DELAY_MS);
            if (bars.length === 0) return acc;
            return [
                ...acc,
                {
                    symbol: candidate.symbol,
                    companyName: candidate.companyName,
                    weeklyVolume: calculateWeeklyVolume(bars),
                    price: candidate.price,
                    marketCap: candidate.marketCap,
                    maxDailyChangePct: calculateMaxDailyChangePct(bars),
                },
            ];
        },
        Promise.resolve([] as TickerWeeklyVolume[])
    );

    console.log(`EOD data fetched for ${weeklyVolumes.length} tickers`);

    // 5. Filter and rank
    const topTickers = filterAndRank(weeklyVolumes);

    if (topTickers.length === 0) {
        console.log('\nNo tickers passed filters. Nothing to update.');
        return;
    }

    // 6. Display results
    printResults(topTickers);

    // 7. Update file
    const newSymbols = topTickers.map(t => t.symbol);
    const updatedContent = insertTrendingSection(fileContent, newSymbols);

    if (updatedContent === fileContent) {
        console.log('\nFile unchanged — already up to date for today.');
        return;
    }

    writeFileSync(POPULAR_TICKERS_PATH, updatedContent, 'utf-8');
    console.log(`\nUpdated ${POPULAR_TICKERS_PATH}`);

    // 8. Format
    try {
        console.log('Running prettier...');
        execSync(`yarn prettier --write "${POPULAR_TICKERS_PATH}"`, {
            stdio: 'inherit',
        });
    } catch {
        console.warn(
            'Prettier failed — file was written but may need manual formatting.'
        );
    }

    console.log(
        `\nDone! Added ${newSymbols.length} tickers: ${newSymbols.join(', ')}`
    );
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});

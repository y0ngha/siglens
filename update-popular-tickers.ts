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
import { toYahooSymbol } from '@/shared/lib/yahooSymbol';
import YahooFinance from 'yahoo-finance2';
import { CANONICAL_KOREAN_NAMES } from '@/shared/config/canonical-korean-names';
import {
    insertKrTrendingItems,
    type KrTrendingItem,
} from './scripts/lib/krTrendingInsert';
import {
    classifyVisitSymbol,
    extractExistingKrTickers,
    selectVisitCandidates,
} from './scripts/lib/visitCandidates';
import {
    loadVisitSources,
    type VisitSources,
} from './scripts/lib/visitSources';

// --- Constants ---

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';
const MIN_PRICE = 5;
const MAX_DAILY_CHANGE_PCT = 20;
const MAX_NEW_TICKERS = 10;
const REQUEST_DELAY_MS = 200;
const OPTIONS_PROBE_CONCURRENCY = 5;
const OPTIONS_PROBE_BATCH_DELAY_MS = 100;
const SCREENER_LIMIT = 100;
const SCREENER_MIN_MARKET_CAP = 2_000_000_000;
const SCREENER_MIN_VOLUME = 5_000_000;
const EOD_LOOKBACK_DAYS = 10;
const EOD_FETCH_CAP = 30;

// 알려진 오탐 심볼 (SEO 감사 라운드 2 회귀 가드, popular-tickers.test.ts 참고).
// 스크리너는 심볼 문자열만 보고 스캔하므로 이런 케이스를 자동으로 걸러내지 못한다.
const EXCLUDED_TICKERS = new Set([
    'SPCX', // SpaceX 아님 — SPAC/신규 발행 ETF
    'SKHY', // 000660.KS(SK하이닉스)와 동일 회사인 OTC ADR
]);

/** 방문 후보(US)가 속해야 할 거래소. 크립토(`CRYPTO`)·OTC 잡주를 거른다. */
const VISIT_ALLOWED_EXCHANGES: ReadonlySet<string> = new Set([
    'NASDAQ',
    'NYSE',
    'AMEX',
]);

/**
 * 방문 후보(KR) 최소 시총(KRW). KR 후보는 곧 sitemap·색인 판정·프리웜 대상이 되므로
 * 소형주 롱테일 재개방을 막는다(US `SCREENER_MIN_MARKET_CAP` $2B ≈ 2.8조보다 낮게 —
 * 한국 대형주 풀이 작다).
 */
export const MIN_VISIT_KR_MARKET_CAP_KRW = 1_000_000_000_000;

const POPULAR_TICKERS_PATH = resolve(
    process.cwd(),
    'src/shared/config/popular-tickers.ts'
);
const POPULAR_OPTIONS_TICKERS_PATH = resolve(
    process.cwd(),
    'src/entities/sitemap-entry/config/popular-options-tickers.ts'
);
const POPULAR_TICKERS_DECLARATION = 'export const POPULAR_TICKERS = [';
const POPULAR_TICKERS_END = '] as const;';
const TICKER_LITERAL_LINE_PATTERN =
    /^(\s*)['"]([A-Z][A-Z0-9.-]*)['"],?(\s*(?:\/\/.*)?)?$/;

// --- Types ---

/** FMP stable `profile` 응답에서 쓰는 필드 (2026-09-24 실키 확인: SOXL). 없는 심볼은 `[]`. */
export interface FmpProfile {
    symbol: string;
    price: number | null;
    marketCap: number | null;
    isEtf: boolean;
    isFund: boolean;
    isActivelyTrading: boolean;
    exchange: string;
    companyName: string;
}

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

export interface DeduplicatePopularTickersResult {
    content: string;
    removedTickers: readonly string[];
}

export type OptionsMarketProbe = (symbol: string) => Promise<boolean>;

export interface YahooOptionsProbeClient {
    options(
        symbol: string,
        queryOptions?: unknown,
        moduleOptions?: { validateResult?: boolean }
    ): Promise<unknown>;
}

export interface PopularTickerArtifactWriters {
    writeAll: (
        popularContent: string,
        optionsContent: string
    ) => void | Promise<void>;
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
    const arrayStart = fileContent.indexOf(POPULAR_TICKERS_DECLARATION);
    if (arrayStart === -1) return new Set();

    const popularSection = fileContent.slice(arrayStart);
    const matches = popularSection.match(/['"]([A-Z][A-Z0-9.-]*)['"]/g);
    return new Set(matches ? matches.map(m => m.slice(1, -1)) : []);
}

export async function collectPopularOptionsTickers(
    tickers: readonly string[],
    probe: OptionsMarketProbe
): Promise<string[]> {
    const normalized = [
        ...new Set(tickers.map(ticker => ticker.toUpperCase())),
    ].sort();
    const collected: string[] = [];

    for (let i = 0; i < normalized.length; i += OPTIONS_PROBE_CONCURRENCY) {
        const chunk = normalized.slice(i, i + OPTIONS_PROBE_CONCURRENCY);
        const results = await Promise.all(chunk.map(ticker => probe(ticker)));

        for (const [index, ticker] of chunk.entries()) {
            if (results[index]) {
                collected.push(ticker);
            }
        }

        if (i + OPTIONS_PROBE_CONCURRENCY < normalized.length) {
            await sleep(OPTIONS_PROBE_BATCH_DELAY_MS);
        }
    }

    return collected;
}

export function renderPopularOptionsTickersFile(
    tickers: readonly string[]
): string {
    const lines = tickers.map(ticker => `    '${ticker}',`).join('\n');
    const body = lines.length > 0 ? `${lines}\n` : '';

    return `// Generated by update-popular-tickers.ts. Do not edit manually.
export const POPULAR_OPTIONS_TICKERS = [
${body}] as const;
`;
}

export async function writePopularTickerArtifacts(
    popularContent: string,
    tickers: readonly string[],
    probe: OptionsMarketProbe,
    writers: PopularTickerArtifactWriters
): Promise<void> {
    const popularOptionsTickers = await collectPopularOptionsTickers(
        tickers,
        probe
    );
    const optionsContent = renderPopularOptionsTickersFile(
        popularOptionsTickers
    );

    await writers.writeAll(popularContent, optionsContent);
}

export function createYahooOptionsProbe(
    client: YahooOptionsProbeClient = new YahooFinance({
        suppressNotices: ['yahooSurvey'],
    })
): OptionsMarketProbe {
    const yahooFinance = client;

    return async (symbol: string): Promise<boolean> => {
        try {
            const yahooSymbol = toYahooSymbol(symbol);
            const response = (await yahooFinance.options(
                yahooSymbol,
                undefined,
                {
                    validateResult: false,
                }
            )) as { expirationDates?: unknown } | undefined;

            // validateResult:false lets Yahoo schema-validation failures through
            // instead of throwing (e.g. malformed/incomplete quote data); an
            // undefined or malformed response here means no options market data,
            // not a probe failure.
            if (!response || !Array.isArray(response.expirationDates)) {
                return false;
            }

            return response.expirationDates.length > 0;
        } catch (error) {
            throw new Error(
                `Failed to probe options for ${symbol}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    };
}

export function deduplicatePopularTickerEntries(
    fileContent: string
): DeduplicatePopularTickersResult {
    const arrayStart = fileContent.indexOf(POPULAR_TICKERS_DECLARATION);
    const arrayEnd = fileContent.indexOf(POPULAR_TICKERS_END, arrayStart);

    if (arrayStart === -1 || arrayEnd === -1) {
        return { content: fileContent, removedTickers: [] };
    }

    const sectionStart = arrayStart + POPULAR_TICKERS_DECLARATION.length;
    const beforeSection = fileContent.slice(0, sectionStart);
    const section = fileContent.slice(sectionStart, arrayEnd);
    const afterSection = fileContent.slice(arrayEnd);
    const seenTickers = new Set<string>();
    const removedTickers: string[] = [];

    const deduplicatedSection = section
        .split('\n')
        .filter(line => {
            const tickerMatch = line.match(TICKER_LITERAL_LINE_PATTERN);
            if (!tickerMatch) return true;

            const ticker = tickerMatch[2]!;
            if (!seenTickers.has(ticker)) {
                seenTickers.add(ticker);
                return true;
            }

            removedTickers.push(ticker);
            return false;
        })
        .join('\n');

    return {
        content: `${beforeSection}${deduplicatedSection}${afterSection}`,
        removedTickers,
    };
}

export function insertTrendingSection(
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

    const insertionPoint = fileContent.lastIndexOf(POPULAR_TICKERS_END);
    if (insertionPoint === -1) {
        throw new Error('Could not find "] as const;" in popular-tickers.ts');
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
        execSync(`yarn oxfmt "${tempPath}"`, {
            stdio: 'inherit',
        });
    } catch {
        console.warn(
            `Prettier failed for ${path} — temp file was written but may need manual formatting.`
        );
    }

    return tempPath;
}

function commitArtifactPairAtomically(
    popularPath: string,
    popularContent: string,
    optionsPath: string,
    optionsContent: string
): void {
    const previousPopular = existsSync(popularPath)
        ? readFileSync(popularPath, 'utf-8')
        : null;
    const previousOptions = existsSync(optionsPath)
        ? readFileSync(optionsPath, 'utf-8')
        : null;
    const stagedPopular = writeAndFormatFileAtomically(
        popularPath,
        popularContent
    );
    const stagedOptions = writeAndFormatFileAtomically(
        optionsPath,
        optionsContent
    );

    try {
        renameSync(stagedPopular, popularPath);
        renameSync(stagedOptions, optionsPath);
        console.log(`\nUpdated ${popularPath}`);
        console.log(`Updated ${optionsPath}`);
    } catch (error) {
        if (previousPopular === null) {
            rmSync(popularPath, { force: true });
        } else {
            writeFileSync(popularPath, previousPopular, 'utf-8');
        }

        if (previousOptions === null) {
            rmSync(optionsPath, { force: true });
        } else {
            writeFileSync(optionsPath, previousOptions, 'utf-8');
        }

        throw error;
    } finally {
        for (const tempPath of [stagedPopular, stagedOptions]) {
            try {
                rmSync(tempPath, { force: true });
            } catch {
                // best-effort cleanup
            }
        }
    }
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
        exchange: 'NASDAQ,NYSE,AMEX,CBOE,OTC,PNK',
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

async function fetchProfile(
    apiKey: string,
    symbol: string
): Promise<FmpProfile | null> {
    const params = new URLSearchParams({ symbol, apikey: apiKey });
    const res = await fetch(`${FMP_BASE_URL}/profile?${params}`);
    if (!res.ok) {
        console.warn(`  profile fetch failed for ${symbol}: ${res.status}`);
        return null;
    }
    // FMP returns unvalidated JSON; unknown symbols come back as []
    const raw: unknown = await res.json();
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw[0] as FmpProfile;
}

interface YahooQuoteClient {
    quote(
        symbol: string,
        queryOptions?: unknown,
        moduleOptions?: { validateResult?: boolean }
    ): Promise<unknown>;
}

async function fetchKrMarketCap(
    client: YahooQuoteClient,
    symbol: string
): Promise<number | null> {
    try {
        const quote = (await client.quote(toYahooSymbol(symbol), undefined, {
            validateResult: false,
        })) as { marketCap?: unknown } | undefined;
        return typeof quote?.marketCap === 'number' ? quote.marketCap : null;
    } catch {
        return null;
    }
}

/** 방문 후보(US)를 검증해 통과 심볼만 돌려준다. 탈락 사유는 콘솔에 남긴다. */
async function collectVisitUsSymbols(
    apiKey: string,
    visit: VisitSources,
    existing: ReadonlySet<string>,
    includeEtf: boolean
): Promise<string[]> {
    const candidates = selectVisitCandidates(
        visit.tallies,
        'us',
        new Set([...existing, ...EXCLUDED_TICKERS]),
        s => classifyVisitSymbol(s, visit.cryptoSymbols)
    );
    const { from, to } = getLookbackDateRange();
    const passed: string[] = [];
    for (const { symbol, views } of candidates) {
        const profile = await fetchProfile(apiKey, symbol);
        await sleep(REQUEST_DELAY_MS);
        const bars =
            profile === null
                ? []
                : await fetchEodBars(apiKey, symbol, from, to);
        const change =
            bars.length === 0 ? null : calculateMaxDailyChangePct(bars);
        const reason = visitUsRejection(profile, change, includeEtf);
        console.log(
            `  [visit:us] ${symbol.padEnd(8)} views=${views} → ${reason ?? 'PASS'}`
        );
        if (reason === null) passed.push(symbol);
    }
    return passed;
}

/** 방문 후보(KR)를 검증해 카테고리 항목으로 돌려준다. */
async function collectVisitKrItems(
    visit: VisitSources,
    existingKr: ReadonlySet<string>,
    client: YahooQuoteClient
): Promise<KrTrendingItem[]> {
    const candidates = selectVisitCandidates(
        visit.tallies,
        'kr',
        existingKr,
        s => classifyVisitSymbol(s, visit.cryptoSymbols)
    );
    const passed: KrTrendingItem[] = [];
    for (const { symbol, views } of candidates) {
        const listedName = visit.krNames.get(symbol);
        const marketCap =
            listedName === undefined
                ? null
                : await fetchKrMarketCap(client, symbol);
        const reason = visitKrRejection(listedName, marketCap);
        console.log(
            `  [visit:kr] ${symbol.padEnd(10)} views=${views} → ${reason ?? 'PASS'}`
        );
        if (reason === null && listedName !== undefined) {
            // 홈 카드 이름은 정규명을 따른다(canonical-korean-names.test.ts).
            passed.push({
                symbol,
                name: CANONICAL_KOREAN_NAMES.get(symbol) ?? listedName,
            });
        }
    }
    return passed;
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
    return (
        tickers
            .filter(t => t.maxDailyChangePct < MAX_DAILY_CHANGE_PCT)
            // toSorted not available in ES2017 target — slice() preserves immutability
            .slice()
            .sort((a, b) => b.weeklyVolume - a.weeklyVolume)
            .slice(0, MAX_NEW_TICKERS)
    );
}

/** 방문 후보(US) 탈락 사유. 통과면 null. 순서 = 싸고 결정적인 검사 먼저. */
export function visitUsRejection(
    profile: FmpProfile | null,
    maxDailyChangePct: number | null,
    includeEtf: boolean
): string | null {
    if (profile === null) return 'no FMP profile';
    if (!profile.isActivelyTrading) return 'not actively trading';
    if (!VISIT_ALLOWED_EXCHANGES.has(profile.exchange)) {
        return `exchange ${profile.exchange}`;
    }
    if (profile.isFund) return 'fund';
    if (profile.isEtf && !includeEtf) return 'ETF (pass --include-etf)';
    if ((profile.price ?? 0) < MIN_PRICE) return `price < $${MIN_PRICE}`;
    if ((profile.marketCap ?? 0) < SCREENER_MIN_MARKET_CAP) {
        return 'market cap < $2B';
    }
    if (maxDailyChangePct === null) return 'no EOD bars';
    if (maxDailyChangePct >= MAX_DAILY_CHANGE_PCT) {
        return `max daily change ≥ ${MAX_DAILY_CHANGE_PCT}%`;
    }
    return null;
}

/** 방문 후보(KR) 탈락 사유. `name` undefined = 상장 목록에 없음. */
export function visitKrRejection(
    name: string | undefined,
    marketCapKrw: number | null
): string | null {
    if (name === undefined) return 'not listed in korean_tickers';
    if (marketCapKrw === null) return 'no market cap';
    if (marketCapKrw < MIN_VISIT_KR_MARKET_CAP_KRW) return 'market cap < ₩1조';
    return null;
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
    config({ path: resolve(process.cwd(), '.env.local') });

    const { includeEtf } = parseArgs();
    const apiKey = process.env.FMP_API_KEY;

    if (!apiKey) {
        throw new Error('FMP_API_KEY must be set in .env.local');
    }

    console.log('\n=== Update Popular Tickers ===');
    console.log(`ETF: ${includeEtf ? 'included' : 'excluded'}\n`);

    // 1. Read existing tickers
    const originalFileContent = readFileSync(POPULAR_TICKERS_PATH, 'utf-8');
    const initialDeduplication =
        deduplicatePopularTickerEntries(originalFileContent);
    const fileContent = initialDeduplication.content;
    const existingTickers = extractExistingTickers(fileContent);
    console.log(`Existing tickers: ${existingTickers.size}`);

    if (initialDeduplication.removedTickers.length > 0) {
        console.log(
            `Duplicate tickers removed before update: ${initialDeduplication.removedTickers.join(', ')}`
        );
    }

    // 2. Load visit sources (부가 신호 — 실패해도 계속)
    const visit = await loadVisitSources();
    if (visit !== null) {
        console.log(
            `Visit tallies (≥ threshold, last 7d): ${visit.tallies.length}`
        );
    }

    // 3. Fetch screener candidates
    console.log('Fetching screener candidates...');
    const screenerResults = await fetchScreenerResults(apiKey, includeEtf);
    console.log(`Screener returned: ${screenerResults.length} candidates`);

    const newCandidates = screenerResults.filter(
        r => !existingTickers.has(r.symbol) && !EXCLUDED_TICKERS.has(r.symbol)
    );
    console.log(
        `New candidates (not in POPULAR_TICKERS): ${newCandidates.length}`
    );

    // 4. Volume candidates (기존 흐름)
    let volumeSymbols: string[] = [];
    if (newCandidates.length > 0) {
        const cappedCandidates = newCandidates.slice(0, EOD_FETCH_CAP);
        const { from, to } = getLookbackDateRange();
        console.log(
            `\nFetching EOD data for ${cappedCandidates.length} candidates (${from} ~ ${to})...`
        );

        const weeklyVolumes = await cappedCandidates.reduce(
            async (accPromise, candidate) => {
                const acc = await accPromise;
                const bars = await fetchEodBars(
                    apiKey,
                    candidate.symbol,
                    from,
                    to
                );
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
        const topTickers = filterAndRank(weeklyVolumes);
        if (topTickers.length > 0) printResults(topTickers);
        volumeSymbols = topTickers.map(t => t.symbol);
    }

    // 5. Visit candidates (US·KR) — 거래량 후보와 별도 할당
    let visitUsSymbols: string[] = [];
    let visitKrItems: KrTrendingItem[] = [];
    if (visit !== null) {
        console.log('\nValidating visit candidates...');
        visitUsSymbols = await collectVisitUsSymbols(
            apiKey,
            visit,
            new Set([...existingTickers, ...volumeSymbols]),
            includeEtf
        );
        visitKrItems = await collectVisitKrItems(
            visit,
            extractExistingKrTickers(fileContent),
            new YahooFinance({ suppressNotices: ['yahooSurvey'] })
        );
    }

    // 6. Update file content
    const newSymbols = [...volumeSymbols, ...visitUsSymbols];
    let updatedPopularContent = fileContent;
    let addedSymbols: readonly string[] = [];

    if (newSymbols.length > 0) {
        const contentWithTrendingSection = insertTrendingSection(
            updatedPopularContent,
            newSymbols
        );
        addedSymbols =
            contentWithTrendingSection === updatedPopularContent
                ? []
                : newSymbols;
        updatedPopularContent = contentWithTrendingSection;
    }

    if (visitKrItems.length > 0) {
        const before = updatedPopularContent;
        updatedPopularContent = insertKrTrendingItems(
            updatedPopularContent,
            visitKrItems
        );
        if (updatedPopularContent !== before) {
            addedSymbols = [
                ...addedSymbols,
                ...visitKrItems.map(i => i.symbol),
            ];
        }
    }

    if (updatedPopularContent !== fileContent) {
        const finalDeduplication = deduplicatePopularTickerEntries(
            updatedPopularContent
        );
        updatedPopularContent = finalDeduplication.content;
        if (finalDeduplication.removedTickers.length > 0) {
            console.log(
                `Duplicate tickers removed after update: ${finalDeduplication.removedTickers.join(', ')}`
            );
        }
    } else {
        console.log('\nNo new tickers. Checking for file cleanup only.');
    }

    // 프리웜 유니버스 입력이 늘어난다(append-only) — 커밋 전에 사람이 보게 한다.
    console.log(
        `\nAdded — volume: ${volumeSymbols.length}, visit US: ${visitUsSymbols.length}, visit KR: ${visitKrItems.length}`
    );

    const finalPopularTickers = [
        ...extractExistingTickers(updatedPopularContent),
    ];

    await writePopularTickerArtifacts(
        updatedPopularContent,
        finalPopularTickers,
        createYahooOptionsProbe(),
        {
            writeAll: (popularContent, optionsContent) =>
                commitArtifactPairAtomically(
                    POPULAR_TICKERS_PATH,
                    popularContent,
                    POPULAR_OPTIONS_TICKERS_PATH,
                    optionsContent
                ),
        }
    );

    console.log(
        `POPULAR_TICKERS size: ${extractExistingTickers(originalFileContent).size + extractExistingKrTickers(originalFileContent).size} → ${finalPopularTickers.length + extractExistingKrTickers(updatedPopularContent).size}`
    );

    if (updatedPopularContent === originalFileContent) {
        console.log('\nFile unchanged — already up to date for today.');
    } else if (addedSymbols.length > 0) {
        console.log(
            `\nDone! Added ${addedSymbols.length} tickers: ${addedSymbols.join(', ')}`
        );
    } else {
        console.log('\nDone! Popular tickers updated after cleanup.');
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exit(1);
    });
}

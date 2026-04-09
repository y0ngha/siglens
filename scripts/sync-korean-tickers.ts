/**
 * Redis ↔ Korean ticker seed 데이터 동기화 스크립트
 *
 * 사용법:
 *   npx tsx scripts/sync-korean-tickers.ts seed    # seed 데이터 → Redis 업로드
 *   npx tsx scripts/sync-korean-tickers.ts export  # Redis → seed 데이터 파일 내보내기
 *
 * 환경변수 (.env.local):
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from '@upstash/redis';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { KOREAN_TICKERS_SEED } from './korean-tickers-data';
import type { KoreanTickerEntry } from '../src/domain/types';

config({ path: resolve(process.cwd(), '.env.local') });

const KOREAN_TICKERS_KEY = 'korean:tickers';
const KOREAN_NAMES_CACHE_TTL = 365 * 24 * 60 * 60;

function createRedis(): Redis {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
        throw new Error(
            'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in .env.local'
        );
    }
    return new Redis({ url, token });
}

async function seed(): Promise<void> {
    const redis = createRedis();

    const existing =
        (await redis.get<KoreanTickerEntry[]>(KOREAN_TICKERS_KEY)) ?? [];
    const existingSymbols = new Set(existing.map(e => e.symbol));

    const newEntries = KOREAN_TICKERS_SEED.filter(
        e => !existingSymbols.has(e.symbol)
    );

    if (newEntries.length === 0) {
        console.log('No new entries to seed. Redis already up to date.');
        return;
    }

    const merged = [...existing, ...newEntries].sort((a, b) =>
        a.symbol.localeCompare(b.symbol)
    );

    await redis.set(KOREAN_TICKERS_KEY, merged, { ex: KOREAN_NAMES_CACHE_TTL });
    console.log(
        `Seeded ${newEntries.length} new entries. Total: ${merged.length}`
    );
}

async function exportToFile(): Promise<void> {
    const redis = createRedis();

    const entries =
        (await redis.get<KoreanTickerEntry[]>(KOREAN_TICKERS_KEY)) ?? [];

    if (entries.length === 0) {
        console.log('No entries in Redis. Nothing to export.');
        return;
    }

    const sorted = [...entries].sort((a, b) =>
        a.symbol.localeCompare(b.symbol)
    );

    const entryLines = sorted
        .map(
            e =>
                `    {\n        symbol: '${e.symbol}',\n        koreanName: '${e.koreanName}',\n        name: '${e.name.replace(/'/g, "\\'")}',\n        exchange: '${e.exchange}',\n        exchangeFullName: '${e.exchangeFullName}',\n    },`
        )
        .join('\n');

    const content = `import type { KoreanTickerEntry } from '../src/domain/types';

/**
 * 주요 US 종목 한국어 이름 seed 데이터.
 * sync-korean-tickers.ts 스크립트로 Redis에 로드하거나 Redis에서 내보낼 때 사용.
 *
 * 사용법:
 *   npx tsx scripts/sync-korean-tickers.ts seed    # Redis에 업로드
 *   npx tsx scripts/sync-korean-tickers.ts export  # Redis에서 이 파일로 내보내기
 */
export const KOREAN_TICKERS_SEED: readonly KoreanTickerEntry[] = [
${entryLines}
];
`;

    const outputPath = resolve(process.cwd(), 'scripts/korean-tickers-data.ts');
    writeFileSync(outputPath, content, 'utf-8');
    console.log(
        `Exported ${sorted.length} entries to scripts/korean-tickers-data.ts`
    );
}

async function main(): Promise<void> {
    const command = process.argv[2];

    if (command === 'seed') {
        await seed();
    } else if (command === 'export') {
        await exportToFile();
    } else {
        console.error(
            'Usage: npx tsx scripts/sync-korean-tickers.ts <seed|export>'
        );
        process.exit(1);
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});

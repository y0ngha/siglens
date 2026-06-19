import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import {
    normalizeEconomicCalendar,
    type EconomicCalendarEvent,
} from '@y0ngha/siglens-core';

import { economicCalendar } from '../src/shared/db/schema';
import { economicCalendarId } from '../src/entities/economy/lib/economicCalendarId';
import { CALENDAR_COUNTRY } from '../src/entities/economy/lib/economyCalendarConstants';
import { chunkDateRange } from './lib/chunkDateRange';
import { normalizeIndicatorBaseName } from './lib/normalizeIndicatorBaseName';

const FMP_API_KEY = process.env.FMP_API_KEY;
const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!FMP_API_KEY) {
    throw new Error('FMP_API_KEY env var required');
}
if (!databaseUrl) {
    throw new Error('DATABASE_URL env var required');
}
const CHUNK_DAYS = 90; // 3-month chunks
const BACKFILL_DAYS_EACH_SIDE = 365; // now ± 1yr
const FMP_BASE = 'https://financialmodelingprep.com/stable';
const OUTPUT_DIR = path.join(process.cwd(), 'scripts', 'output');
const OUTPUT_FILE = path.join(
    OUTPUT_DIR,
    'economic-calendar-indicator-names.json'
);

function isoDate(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function fetchCalendarChunk(
    from: string,
    to: string
): Promise<EconomicCalendarEvent[]> {
    const params = new URLSearchParams({ from, to, apikey: FMP_API_KEY! });
    const res = await fetch(
        `${FMP_BASE}/economic-calendar?${params.toString()}`
    );
    if (!res.ok) {
        throw new Error(
            `FMP economic-calendar ${from}..${to} → HTTP ${res.status}`
        );
    }
    const raw = (await res.json()) as unknown;
    return normalizeEconomicCalendar(raw);
}

async function run(): Promise<void> {
    const client = postgres(databaseUrl!, { max: 1 });
    const db = drizzle(client);

    const now = new Date();
    const start = isoDate(
        new Date(now.getTime() - BACKFILL_DAYS_EACH_SIDE * 86_400_000)
    );
    const end = isoDate(
        new Date(now.getTime() + BACKFILL_DAYS_EACH_SIDE * 86_400_000)
    );
    const chunks = chunkDateRange(start, end, CHUNK_DAYS);
    console.log(
        `Backfilling ${CALENDAR_COUNTRY} calendar ${start}..${end} in ${chunks.length} chunk(s)`
    );

    const baseNames = new Set<string>();
    let upserted = 0;

    for (const { from, to } of chunks) {
        const events = await fetchCalendarChunk(from, to);
        console.log(`  ${from}..${to}: ${events.length} US events`);
        for (const event of events) {
            baseNames.add(normalizeIndicatorBaseName(event.event));
        }
        // id(country+date+event) 기준 dedup — 단일 배치에 중복 id가 있으면
        // ON CONFLICT가 "cannot affect row a second time"로 실패한다.
        const uniqueRows = new Map<string, (typeof events)[number]>();
        for (const event of events) {
            uniqueRows.set(
                economicCalendarId(CALENDAR_COUNTRY, event.date, event.event),
                event
            );
        }
        if (uniqueRows.size === 0) continue;

        // 멱등 upsert(fetchedAt 제외) — 데이터 필드 동일 시 행 내용은 그대로, fetchedAt만 갱신.
        await db
            .insert(economicCalendar)
            .values(
                [...uniqueRows.entries()].map(([id, event]) => ({
                    id,
                    country: CALENDAR_COUNTRY,
                    dateEt: event.date,
                    event: event.event,
                    impact: event.impact,
                    estimate: event.estimate,
                    previous: event.previous,
                    actual: event.actual,
                    unit: event.unit,
                }))
            )
            .onConflictDoUpdate({
                target: economicCalendar.id,
                set: {
                    impact: sql`excluded.impact`,
                    estimate: sql`excluded.estimate`,
                    previous: sql`excluded.previous`,
                    actual: sql`excluded.actual`,
                    unit: sql`excluded.unit`,
                    fetchedAt: sql`now()`,
                },
            });
        upserted += uniqueRows.size;
    }

    const sortedNames = [...baseNames].toSorted((a, b) => a.localeCompare(b));
    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(OUTPUT_FILE, `${JSON.stringify(sortedNames, null, 2)}\n`);

    console.log(
        `Done — upserted ${upserted} event rows; dumped ${sortedNames.length} distinct base indicator names to ${OUTPUT_FILE}`
    );
    await client.end();
}

run().catch(error => {
    console.error('[backfillEconomicCalendar] failed:', error);
    process.exitCode = 1;
});

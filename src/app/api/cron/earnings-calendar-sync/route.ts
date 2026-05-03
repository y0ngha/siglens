// Cron route: sync FMP earnings calendar to DB. Schedule + auth in docs/CRON.md.
import { constants } from 'node:http2';
import { NextResponse } from 'next/server';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { FmpNewsClient } from '@/infrastructure/fmp/newsClient';
import { DrizzleEarningsCalendarRepository } from '@/infrastructure/db/earningsCalendarRepository';

const { HTTP_STATUS_UNAUTHORIZED } = constants;

/** Fetch full FMP earnings calendar, bulk-upsert into `earnings_calendar`; returns `{ inserted: number }` or 401. */
export async function PATCH(req: Request): Promise<Response> {
    const cronSecret = process.env.CRON_SECRET;
    const auth = req.headers.get('authorization');
    if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
        return new NextResponse('unauthorized', {
            status: HTTP_STATUS_UNAUTHORIZED,
        });
    }

    const client = new FmpNewsClient();
    const items = await client.fetchEarningsCalendarAll();

    const { db } = getDatabaseClient();
    const repo = new DrizzleEarningsCalendarRepository(db);
    await repo.upsertMany(items);

    return NextResponse.json({ inserted: items.length });
}

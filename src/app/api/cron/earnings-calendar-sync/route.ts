/**
 * Vercel Cron route: sync the FMP earnings calendar to the DB.
 *
 * Scheduled at 06:00 UTC (= 15:00 KST) — after U.S. market close.
 * HTTP method: PATCH (idempotent batch upsert, REST 형식에 맞춰 GET → PATCH).
 *
 * Authentication: Vercel Cron sets `Authorization: Bearer <CRON_SECRET>` on
 * every invocation. Any other caller receives 401.
 *
 * @see https://vercel.com/docs/cron-jobs
 */
import { NextResponse } from 'next/server';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { FmpNewsClient } from '@/infrastructure/fmp/newsClient';
import { DrizzleEarningsCalendarRepository } from '@/infrastructure/db/earningsCalendarRepository';

/**
 * PATCH /api/cron/earnings-calendar-sync
 *
 * Fetches the full FMP earnings calendar and bulk-upserts all items into the
 * `earnings_calendar` table. Returns `{ inserted: number }` on success.
 *
 * HTTP method is PATCH (idempotent batch upsert — partial resource update semantics).
 *
 * @param req - Incoming HTTP request; must carry a valid Vercel Cron bearer token.
 * @returns 200 JSON `{ inserted: number }` on success, 401 when unauthorised.
 */
export async function PATCH(req: Request): Promise<Response> {
    const cronSecret = process.env.CRON_SECRET;
    const auth = req.headers.get('authorization');
    if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
        return new NextResponse('unauthorized', { status: 401 });
    }

    const client = new FmpNewsClient();
    const items = await client.fetchEarningsCalendarAll();

    const { db } = getDatabaseClient();
    const repo = new DrizzleEarningsCalendarRepository(db);
    await repo.upsertMany(items);

    return NextResponse.json({ inserted: items.length });
}

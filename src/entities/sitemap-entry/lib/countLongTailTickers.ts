import 'server-only';

import { unstable_cache } from 'next/cache';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleLongTailTickerSource } from '../api';

export function countLongTailTickers(): Promise<number> {
    return unstable_cache(
        async () => {
            const client = getDatabaseClient();
            const source = new DrizzleLongTailTickerSource(client.db);
            return source.count();
        },
        ['sitemap:longtail:count:v1'],
        { revalidate: SECONDS_PER_DAY }
    )();
}

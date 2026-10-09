import 'server-only';

import { lt } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { funnelEvents } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type {
    FunnelEvent,
    FunnelEventContext,
} from '@/shared/lib/funnel/funnelEvents';
import { withRetry } from '@/shared/lib/withRetry';

/** `record`가 남기는 한 행. `occurredAt`·`id`는 DB 기본값. */
export interface FunnelEventRecord {
    visitorHash: string;
    /** 로그인 회원이면 id, 아니면 null. */
    userId: string | null;
    event: FunnelEvent;
    context: FunnelEventContext;
}

/** `occurred_at`은 timestamptz라 KST 날짜 키를 그날 자정 시각으로 바꿔 비교한다. */
function kstMidnight(dateKey: string): Date {
    return new Date(`${dateKey}T00:00:00+09:00`);
}

export interface FunnelEventRepository {
    record(event: FunnelEventRecord): Promise<void>;
    /** `cutoffDate`(KST) **이전** 행을 지운다. 개인정보처리방침 §4의 보존 기간 집행. */
    pruneOlderThan(cutoffDate: string): Promise<void>;
}

export class DrizzleFunnelEventRepository implements FunnelEventRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async record(event: FunnelEventRecord): Promise<void> {
        await withRetry(
            () => this.db.insert(funnelEvents).values(event),
            DB_TRANSIENT_RETRY
        );
    }

    async pruneOlderThan(cutoffDate: string): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .delete(funnelEvents)
                    .where(
                        lt(funnelEvents.occurredAt, kstMidnight(cutoffDate))
                    ),
            DB_TRANSIENT_RETRY
        );
    }
}

import { and, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { notices } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { NoticeRecord } from './model/types';

/** 활성 공지 조회 repository. */
export interface NoticeRepository {
    /** 노출 조건(활성 + 시간창)을 만족하는 공지를 priority/최신순으로 반환. */
    findActive(): Promise<NoticeRecord[]>;
}

/** Drizzle ORM-backed 구현. */
export class DrizzleNoticeRepository implements NoticeRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async findActive(): Promise<NoticeRecord[]> {
        // findActive는 non-critical 경로(공지)라 withRetry를 쓰지 않는다.
        // 호출부(getActiveNoticesAction)가 실패를 빈 배열로 흡수한다.
        const rows = await this.db
            .select({
                id: notices.id,
                title: notices.title,
                body: notices.body,
                linkUrl: notices.linkUrl,
                linkLabel: notices.linkLabel,
                pathPattern: notices.pathPattern,
                createdAt: notices.createdAt,
            })
            .from(notices)
            .where(
                and(
                    eq(notices.isActive, true),
                    or(
                        isNull(notices.startsAt),
                        lte(notices.startsAt, sql`NOW()`)
                    ),
                    or(isNull(notices.endsAt), gte(notices.endsAt, sql`NOW()`))
                )
            )
            .orderBy(desc(notices.priority), desc(notices.createdAt));

        return rows;
    }
}

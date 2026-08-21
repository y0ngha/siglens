'use server';

import { tryGetDatabaseClient } from '@/shared/db/client';
import { resolveRequestLocale } from '@/shared/i18n/requestLocale';
import { DrizzleNoticeRepository } from '../api';
import type { NoticeRecord } from '../model/types';

/**
 * 활성 공지 목록을 반환한다(우선순위/최신순). 공지는 부가 기능이므로 DB 미설정
 * 또는 조회 실패 시 빈 배열로 graceful degrade 한다. 긴급 반영을 위해 캐시하지
 * 않는다(server action은 기본 비캐시).
 *
 * 문구는 요청 로케일로 해석해서 나간다 — 폴백 규칙은
 * `shared/db/contentLocale.ts` 한 곳에만 있다.
 */

export async function getActiveNoticesAction(): Promise<NoticeRecord[]> {
    try {
        const client = tryGetDatabaseClient();
        if (client === null) return [];
        const repo = new DrizzleNoticeRepository(client.db);
        return await repo.findActive(await resolveRequestLocale());
    } catch (err) {
        console.error('[getActiveNoticesAction] unexpected error:', err);
        return [];
    }
}

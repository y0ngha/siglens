'use server';

import { getDatabaseClient } from '@/shared/db/client';
import { resolveRequestLocale } from '@/shared/i18n/requestLocale';
import { NEWS_ROW_SERIALIZATION_LIMIT } from '@/shared/config/newsSerialization';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { DrizzleNewsRepository } from '../api';
import { NEWS_LOOKBACK_MS } from '../lib/newsLookback';

/**
 * Server Action: 카드별 분석 상태의 최신 스냅샷을 DB에서 읽는다.
 *
 * 클라이언트의 `useNewsCardPolling`·`useWaitForNewsCards`가 백그라운드 분석이 대기 카드
 * (sentiment / priceImpact 없음)를 보강했는지 감지하려고 3초마다 부른다. 최근
 * `attachAnalysis` 쓰기가 반영되어야 하므로 의도적으로 캐시하지 않는다.
 *
 * 카드 표시 컬럼만 읽는다(`listCardsBySymbol`) — 3초 폴링 경로라 `bodyEn`을 읽어서 버리면
 * 낭비가 매 tick 반복된다. 행 수 상한(`NEWS_ROW_SERIALIZATION_LIMIT`)도 여기서 건다:
 * 화면이 다루지 않는 행까지 매 tick 실어 보내면 한 번 실리는 RSC 페이로드보다 누적이
 * 커진다(AAPL 기준 1,417행). `compress: true` 이후로는 그 응답이 매번 오리진에서 gzip되기까지
 * 해서 버스터블 인스턴스의 CPU 크레딧을 직접 갉는다.
 */
export async function getNewsCardsAction(
    symbol: string
): Promise<NewsDisplayItem[]> {
    const { db } = getDatabaseClient();
    const repo = new DrizzleNewsRepository(db);
    const rows = await repo.listCardsBySymbol(
        symbol,
        NEWS_LOOKBACK_MS,
        await resolveRequestLocale()
    );
    return rows.length > NEWS_ROW_SERIALIZATION_LIMIT
        ? rows.slice(0, NEWS_ROW_SERIALIZATION_LIMIT)
        : rows;
}

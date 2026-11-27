import 'server-only';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import {
    DrizzleSignalHistoryRepository,
    SIGNAL_HISTORY_CACHE_TAG,
} from '@/entities/signal-history/api';
import {
    orderForDisplay,
    signalHubWindowStart,
} from '@/entities/signal-history/lib/signalHubRows';
import { SIGNAL_HUB_MAX_ROWS_PER_MARKET } from '@/entities/signal-history/lib/signalHubs';
import type {
    SignalEpisodeRow,
    SignalHubSymbolCounts,
} from '@/entities/signal-history/types';
import { isOfflineBuild } from '@/shared/api/offlineBuild';
import {
    shortenRevalidateForRuntimeDegrade,
    shortenRevalidateIfDatabaseMissingAtBuild,
} from '@/shared/cache/buildDegradedRevalidate';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { isDatabaseMissingAtBuild } from '@/shared/db/config';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

export interface SignalHubData {
    /**
     * 종목마다 가장 최근 에피소드 한 줄, 화면 순서(미국 → 한국, 시장 안에서 첫 포착 최신순). 시장마다
     * `SIGNAL_HUB_MAX_ROWS_PER_MARKET`개까지만 담는다.
     */
    readonly rows: readonly SignalEpisodeRow[];
    /**
     * 기간 안에 이 신호가 잡힌 서로 다른 종목 수(시장별) — 상한으로 잘리기 전의 전체다. 색인 판정과
     * 사이트맵(`recentCountsByType`)이 같은 수를 보고, 목록이 잘렸는지 알리는 문구가 쓴다.
     */
    readonly counts: SignalHubSymbolCounts;
    /** 기록을 못 읽었다(DB 장애·오프라인 빌드). 빈 목록과 구분한다 — 이때는 색인도 하지 않는다. */
    readonly degraded: boolean;
}

/** 기록을 못 읽었을 때의 값 — 빈 목록과 구분하려고 `degraded`를 켠다. */
const DEGRADED_HUB: SignalHubData = {
    rows: [],
    counts: { us: 0, kr: 0 },
    degraded: true,
};

/**
 * 신호 페이지 데이터. DB 읽기는 `unstable_cache` 안에서만 한다(`src/app/CLAUDE.md` 축 1 — 캐시 밖 DB
 * 읽기는 ISR을 동적으로 뒤집는다). 실패는 캐시 **밖**에서 잡는다 — 안에서 빈 값을 돌려주면 장애가
 * TTL 동안 캐시된다. 메타데이터와 본문이 같은 요청 안에서 한 번만 읽도록 `cache`로 묶는다.
 *
 * 기록기가 기록을 바꾸면 `SIGNAL_HISTORY_CACHE_TAG`를 `'max'` 프로필로 무효화한다 — 캐시를 stale로
 * 표시할 뿐이라, 무효화 뒤 첫 요청은 옛 목록을 받고 그 요청이 백그라운드 재생성을 일으킨다(SWR). 그래서
 * 반영은 "1시간 TTL보다 이르게"이지 즉시가 아니다.
 */
export const loadSignalHub = cache(
    async (signalType: string): Promise<SignalHubData> => {
        if (isOfflineBuild()) return DEGRADED_HUB;
        if (isDatabaseMissingAtBuild()) {
            await shortenRevalidateIfDatabaseMissingAtBuild();
            return DEGRADED_HUB;
        }
        const since = signalHubWindowStart(new Date());
        try {
            const { rows, counts } = await unstable_cache(
                async () => {
                    const { db } = getDatabaseClient();
                    const repository = new DrizzleSignalHistoryRepository(db);
                    const [hubRows, hubCounts] = await Promise.all([
                        repository.listHubRows(
                            signalType,
                            since,
                            SIGNAL_HUB_MAX_ROWS_PER_MARKET
                        ),
                        repository.countHubSymbols(signalType, since),
                    ]);
                    return { rows: hubRows, counts: hubCounts };
                },
                ['signal-hub', 'v3', signalType, since],
                {
                    revalidate: SECONDS_PER_HOUR,
                    tags: [SIGNAL_HISTORY_CACHE_TAG],
                }
            )();
            return { rows: orderForDisplay(rows), counts, degraded: false };
        } catch (error) {
            console.error(
                '[signal-hub] 기록 조회 실패',
                signalType,
                redactDbErrorForLog(error)
            );
            await shortenRevalidateForRuntimeDegrade();
            return DEGRADED_HUB;
        }
    }
);

import 'server-only';

import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import {
    DrizzleSignalHistoryRepository,
    SIGNAL_HISTORY_CACHE_TAG,
} from '@/entities/signal-history/api';
import {
    latestEpisodePerSymbol,
    orderForDisplay,
    signalHubWindowStart,
} from '@/entities/signal-history/lib/signalHubRows';
import type { SignalEpisodeRow } from '@/entities/signal-history/types';
import { isOfflineBuild } from '@/shared/api/offlineBuild';
import {
    shortenRevalidateForRuntimeDegrade,
    shortenRevalidateIfDatabaseMissingAtBuild,
} from '@/shared/cache/buildDegradedRevalidate';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { isDatabaseMissingAtBuild } from '@/shared/db/config';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/**
 * 한 페이지가 읽는 최대 에피소드 수 — 폭주 방어용 상한이다. 스캐너 대상은 미국 약 100·한국 약 30종목이고
 * 한 종목이 30일 안에 같은 신호를 여러 번 열 수 있어(끊겼다 다시 잡힘) 에피소드는 종목 수보다 많다.
 * 상한에 걸려 오래된 쪽이 잘려도 종목별 최신 에피소드만 남기므로 화면에는 최근 종목이 남는다.
 *
 * 전제: 사이트맵 집계(`recentCountsByType`)는 상한 없이 `count(distinct)`로 종목을 센다. 지금 규모(약 130종목)에서는
 * 상한에 닿지 않아 두 값이 같다. 스캐너 대상이 크게 늘어 상한에 걸리면 페이지 종목 수가 사이트맵 집계보다 적어져
 * 색인 판정(`isSignalHubDataIndexable`·사이트맵)이 갈릴 수 있으니, 그때는 상한을 대상 수에 맞춰 올린다.
 */
const MAX_EPISODES = 600;

export interface SignalHubData {
    /** 종목마다 가장 최근 에피소드 한 줄, 화면 순서(미국 → 한국, 시장 안에서 첫 포착 최신순). */
    readonly rows: readonly SignalEpisodeRow[];
    /** 기록을 못 읽었다(DB 장애·오프라인 빌드). 빈 목록과 구분한다 — 이때는 색인도 하지 않는다. */
    readonly degraded: boolean;
}

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
        if (isOfflineBuild()) return { rows: [], degraded: true };
        if (isDatabaseMissingAtBuild()) {
            await shortenRevalidateIfDatabaseMissingAtBuild();
            return { rows: [], degraded: true };
        }
        const since = signalHubWindowStart(new Date());
        try {
            const rows = await unstable_cache(
                () => {
                    const { db } = getDatabaseClient();
                    return new DrizzleSignalHistoryRepository(
                        db
                    ).listRecentEpisodes(signalType, since, MAX_EPISODES);
                },
                ['signal-hub', 'v2', signalType, since],
                {
                    revalidate: SECONDS_PER_HOUR,
                    tags: [SIGNAL_HISTORY_CACHE_TAG],
                }
            )();
            return {
                rows: orderForDisplay(latestEpisodePerSymbol(rows)),
                degraded: false,
            };
        } catch (error) {
            console.error(
                '[signal-hub] 기록 조회 실패',
                signalType,
                redactDbErrorForLog(error)
            );
            await shortenRevalidateForRuntimeDegrade();
            return { rows: [], degraded: true };
        }
    }
);

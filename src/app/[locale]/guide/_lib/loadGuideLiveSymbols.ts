import 'server-only';

import { unstable_cache } from 'next/cache';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';
import { GUIDE_CACHE_TAG } from '@/entities/guide/api';
import type { GuideEntry } from '@/entities/guide/types';
import { getSectorSignalsStatic } from '@/entities/sector-signal/api/sectorSignalsStaticCache';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import { TWICE_WEEKLY_MAX_GAP_MS } from '@/entities/seo-snapshot/lib/freshness';
import {
    DrizzleSignalHistoryRepository,
    SIGNAL_HISTORY_CACHE_TAG,
} from '@/entities/signal-history/api';
import { lookupTickerDisplayNames } from '@/entities/ticker/server/koreanNameStore';
import { isOfflineBuild } from '@/shared/api/offlineBuild';
import {
    shortenRevalidateForRuntimeDegrade,
    shortenRevalidateIfDatabaseMissingAtBuild,
} from '@/shared/cache/buildDegradedRevalidate';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import { dashboardScopeOf } from '@/shared/config/dashboardScope';
import {
    MS_PER_DAY,
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
} from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import {
    resolveLiveTargets,
    selectLiveSymbols,
    type HistoryInput,
    type LiveMarket,
    type LiveSymbolGroup,
    type ScannerInput,
    type SnapshotPatternHit,
    withDisplayNames,
} from '@/views/guide/lib/liveSymbols';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/** 데이터원 하나의 결과. 실패하면 `value`는 대신 넣은 빈 값이고 `failed`가 참이다. */
interface Settled<T> {
    readonly value: T;
    readonly failed: boolean;
}

/** 시장당 보여 줄 최대 행 수. */
const LIMIT_PER_MARKET = 5;
/**
 * 스냅샷 창. 조회가 적은 종목은 차트 탭 산문을 주 2회 주기로 굽는다(`QUIET_CADENCE_TABS`) — 그 주기의 가장
 * 긴 간격(`TWICE_WEEKLY_MAX_GAP_MS`)에 하루를 더해야 하루 이틀 밀린 종목도 창에 남는다. 예전 48시간 창은
 * 조용한 종목이 주 3일쯤 풀에서 빠졌다.
 */
const SNAPSHOT_WINDOW_MS = TWICE_WEEKLY_MAX_GAP_MS + MS_PER_DAY;
/** 스캐너가 보는 시장. 크립토는 가이드 본문이 주식 전제라 뺀다. */
const SCANNER_MARKETS: readonly LiveMarket[] = ['us', 'kr'];
/**
 * 시장별 스냅샷 읽기 한도 배수. 스냅샷은 시장마다 따로 읽어(저장소가 심볼 형상으로 시장을 가른다)
 * 한 시장이 다른 시장의 한도를 잡아먹지 않는다. `selectLiveSymbols`가 스캐너 행과 겹치는 심볼을
 * 걸러 내므로 시장당 상한 `LIMIT_PER_MARKET`을 채울 수 있도록 여유를 둔다.
 */
const SNAPSHOT_HEADROOM_FACTOR = 2;

/**
 * 스냅샷 캐시 키 접두. 캐시 값의 모양(`SnapshotPatternHit`)이 바뀌면 버전을 올려 옛 모양 항목이 서빙되지 않게 한다.
 * v2: `detectedPatterns` 추가.
 */
const SNAPSHOT_CACHE_KEY_PARTS = ['guide-live', 'patterns', 'v2'] as const;
/**
 * 신호 기록 캐시 키 접두. 값 모양(`SignalLatestEpisodeRow`)이 바뀌면 버전을 올린다.
 */
const HISTORY_CACHE_KEY_PARTS = ['guide-live', 'history', 'v1'] as const;
/**
 * 기록 읽기 한도 배수. 한 종목에 같은 신호의 에피소드가 여럿(또는 이 항목의 신호가 여럿)일 수 있어 종목으로
 * 접으면 행이 줄어든다 — 시장당 상한을 채울 수 있게 여유를 둔다.
 */
const HISTORY_HEADROOM_FACTOR = 3;
/** 한국어 이름은 거의 안 바뀌어 하루 창을 쓴다. */
const NAMES_REVALIDATE_SECONDS = SECONDS_PER_DAY;

/**
 * 스냅샷 DB 읽기는 ISR 정적 렌더 안이라 반드시 `unstable_cache` 안에서 한다(`src/app/CLAUDE.md` 축 1).
 * 값은 JSON으로 캐시되므로 `Date`를 ISO 문자열로 바꿔서 돌려준다. 키는 패턴 집합이다(시장 목록은 모듈 상수라 클로저 입력은 키로 모두 덮인다).
 * 실패 처리는 캐시 함수 밖(호출부)에서 해서 실패가 TTL 동안 캐시되지 않게 한다.
 */
function loadSnapshotHits(
    patternNames: readonly string[]
): Promise<SnapshotPatternHit[]> {
    const key = [...patternNames].toSorted().join(',');
    return unstable_cache(
        async () => {
            const { db } = getDatabaseClient();
            const repo = new DrizzleSeoSnapshotRepository(db);
            const since = new Date(Date.now() - SNAPSHOT_WINDOW_MS);
            const perMarket = await Promise.all(
                SCANNER_MARKETS.map(market =>
                    repo.listSymbolsWithDetectedPatterns(patternNames, {
                        since,
                        limit: LIMIT_PER_MARKET * SNAPSHOT_HEADROOM_FACTOR,
                        market,
                    })
                )
            );
            return perMarket.flat().map(hit => ({
                symbol: hit.symbol,
                generatedAt: hit.generatedAt.toISOString(),
                detectedPatterns: hit.detectedPatterns,
            }));
        },
        [...SNAPSHOT_CACHE_KEY_PARTS, key],
        { revalidate: SECONDS_PER_HOUR, tags: [GUIDE_CACHE_TAG] }
    )();
}

/**
 * 신호 기록(`signal_events`) 읽기 — 그 시장의 가장 최근 완료 세션까지 이어진 에피소드. ISR 정적 렌더 안이라
 * `unstable_cache` 안에서 읽고, 기록기가 새 행을 넣으면 신호 기록 태그로, 가이드를 갱신하면 가이드 태그로
 * 무효화된다. 실패는 던져서 캐시에 남지 않게 하고 호출부 `settle`이 스캐너로 넘어간다(0064 표가 아직 없는
 * 환경의 `42P01`도 같은 길이다). 빈 결과는 정상 값이라 캐시된다 — 호출부가 비면 스캐너로 대신한다.
 */
function loadHistoryRows(
    market: LiveMarket,
    signalTypes: readonly string[]
): Promise<HistoryInput['rows']> {
    const key = [...signalTypes].toSorted().join(',');
    return unstable_cache(
        async () => {
            const { db } = getDatabaseClient();
            return new DrizzleSignalHistoryRepository(
                db
            ).listLatestSessionEpisodes(
                signalTypes,
                market,
                LIMIT_PER_MARKET * HISTORY_HEADROOM_FACTOR
            );
        },
        [...HISTORY_CACHE_KEY_PARTS, market, key],
        {
            revalidate: SECONDS_PER_HOUR,
            tags: [SIGNAL_HISTORY_CACHE_TAG, GUIDE_CACHE_TAG],
        }
    )();
}

/**
 * 보여 줄 심볼들의 한국어 이름(정본 오버라이드 포함). `korean_tickers` 읽기는 ISR 정적 렌더 안이라 `unstable_cache` 안에서 한다.
 * 키는 정렬한 심볼 목록이다. 심볼 집합은 스캐너 결과에 따라 바뀌어 항목이 늘 수 있으나, 시장당 상한(`LIMIT_PER_MARKET`)이 있어
 * 조합 수가 유한하다. 이름은 거의 안 바뀌므로 창을 하루로 늘리고, 가이드 재검증 태그를 달아 가이드를 갱신할 때 함께 새로고친다.
 * 조회 실패(`null`)는 던져서 캐시에 남지 않게 한다 — 던진 실패는 호출부 `settle`이 잡아
 * 이름 없이(코드 표기로) 렌더한다.
 */
function loadDisplayNames(
    symbols: readonly string[]
): Promise<Record<string, string>> {
    const sorted = [...new Set(symbols)].toSorted();
    return unstable_cache(
        async () => {
            const found = await lookupTickerDisplayNames(sorted);
            if (found === null) throw new Error('korean_tickers lookup failed');
            return Object.fromEntries(
                Object.entries(found).flatMap(([symbol, { koreanName }]) =>
                    koreanName === null ? [] : [[symbol, koreanName]]
                )
            );
        },
        ['guide-live', 'names', sorted.join(',')],
        { revalidate: NAMES_REVALIDATE_SECONDS, tags: [GUIDE_CACHE_TAG] }
    )();
}

/**
 * 한 데이터원의 실패가 다른 데이터원을 죽이지 않게 개별로 잡는다(`loadMarketSignals`가
 * `getSectorSignalsStatic` 호출마다 catch하는 것과 같다). 실패하면 경고를 남기고 `fallback`으로 대신한다.
 */
async function settle<T>(
    source: string,
    run: () => Promise<T>,
    fallback: T
): Promise<Settled<T>> {
    try {
        return { value: await run(), failed: false };
    } catch (error) {
        console.warn(
            `[guide-live] ${source} 조회 실패 — 비운 채로 진행한다`,
            redactDbErrorForLog(error)
        );
        return { value: fallback, failed: true };
    }
}

interface SignalSource {
    readonly market: LiveMarket;
    /** 기록에서 읽은 행. 기록을 쓰지 않았으면 빈 배열이다. */
    readonly historyRows: HistoryInput['rows'];
    /** 스캐너 결과. 기록을 썼으면 부르지 않아 null이다. */
    readonly result: SectorSignalsResult | null;
    /** 기록(DB) 읽기가 던졌다 — 스캐너로 대신했더라도 이 렌더는 DB 장애 렌더다. */
    readonly historyFailed: boolean;
    /** 이 시장의 데이터원이 모두 실패했다 — 기록이 실패·빔 → 스캐너까지 실패. */
    readonly failed: boolean;
}

/**
 * 한 시장의 신호 대상 데이터원. 기록(`signal_events`)에 행이 있으면 그것만 쓰고 스캐너는 부르지 않는다.
 * 기록 읽기가 던지거나 비면(예: 완료 세션이 아직 없음) 스캐너로 대신한다.
 */
async function loadSignalSource(
    market: LiveMarket,
    signalTypes: readonly string[]
): Promise<SignalSource> {
    const history = await settle<HistoryInput['rows']>(
        `${market} history`,
        () => loadHistoryRows(market, signalTypes),
        []
    );
    if (history.value.length > 0) {
        return {
            market,
            historyRows: history.value,
            result: null,
            historyFailed: false,
            failed: false,
        };
    }
    const scanner = await settle<SectorSignalsResult | null>(
        `${market} scanner`,
        () =>
            getSectorSignalsStatic(
                dashboardScopeOf(market),
                DEFAULT_DASHBOARD_TIMEFRAME
            ),
        null
    );
    return {
        market,
        historyRows: [],
        result: scanner.value,
        historyFailed: history.failed,
        failed: scanner.failed,
    };
}

/**
 * 항목 페이지의 "지금 이 신호가 나온 종목" 데이터. 대상이 없거나(모듈 생략), 오프라인 빌드거나,
 * 모든 데이터원이 실패했거나, 고른 결과가 비면 `null` — 페이지는 모듈 없이 정상 렌더한다(500 금지).
 * 데이터원(시장별 신호 기록→스캐너·스냅샷)은 개별로 실패를 잡으므로 하나가 죽어도 나머지 행은 남는다.
 */
export async function loadGuideLiveSymbols(
    entry: GuideEntry,
    catalog: readonly GuideEntry[]
): Promise<LiveSymbolGroup[] | null> {
    if (isOfflineBuild()) return null;
    // DB 없이 도는 빌드면 기록·스냅샷·이름 읽기가 모두 던져 스캐너만 남은(또는 빈) 렌더가 굳는다 — 이 렌더의
    // revalidate를 60초로 낮춰 배포 직후 첫 요청이 실데이터로 다시 굽게 한다(`loadSignalHub`와 같다).
    await shortenRevalidateIfDatabaseMissingAtBuild();
    const targets = resolveLiveTargets(entry, catalog);
    const wantsScanner = targets.signalTypes.length > 0;
    const wantsSnapshot = targets.patternNames.length > 0;
    if (!wantsScanner && !wantsSnapshot) return null;

    // 신호 대상은 시장마다 기록을 먼저 읽고, 읽기가 실패했거나 비어 있으면 그 시장만 스캐너로 대신한다.
    const [signalSources, snapshot] = await Promise.all([
        Promise.all(
            (wantsScanner ? SCANNER_MARKETS : []).map(market =>
                loadSignalSource(market, targets.signalTypes)
            )
        ),
        wantsSnapshot
            ? settle<SnapshotPatternHit[]>(
                  'snapshot',
                  () => loadSnapshotHits(targets.patternNames),
                  []
              )
            : Promise.resolve<Settled<SnapshotPatternHit[]>>({
                  value: [],
                  failed: false,
              }),
    ]);

    // 런타임에 DB 읽기가 실패해 대신한 렌더도 라우트 revalidate로 굳지 않게 한다.
    if (signalSources.some(r => r.historyFailed) || snapshot.failed) {
        await shortenRevalidateForRuntimeDegrade();
    }

    const failures = [
        ...signalSources.map(r => r.failed),
        ...(wantsSnapshot ? [snapshot.failed] : []),
    ];
    const allFailed = failures.every(Boolean);
    if (allFailed) return null;

    const scanner = signalSources.flatMap(({ market, result }) =>
        result === null ? [] : [{ market, result } satisfies ScannerInput]
    );
    const history = signalSources.flatMap(({ market, historyRows }) =>
        historyRows.length === 0
            ? []
            : [{ market, rows: historyRows } satisfies HistoryInput]
    );
    const groups = selectLiveSymbols({
        targets,
        scanner,
        history,
        snapshotHits: snapshot.value,
        limitPerMarket: LIMIT_PER_MARKET,
    });
    if (groups.length === 0) return null;
    const names = await settle<Record<string, string>>(
        'names',
        () => loadDisplayNames(groups.flatMap(g => g.rows.map(r => r.symbol))),
        {}
    );
    return withDisplayNames(groups, names.value);
}

import 'server-only';

import { unstable_cache } from 'next/cache';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';
import { GUIDE_CACHE_TAG } from '@/entities/guide/api';
import type { GuideEntry } from '@/entities/guide/types';
import { getSectorSignalsStatic } from '@/entities/sector-signal/api/sectorSignalsStaticCache';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import { lookupTickerDisplayNames } from '@/entities/ticker/server/koreanNameStore';
import { isOfflineBuild } from '@/shared/api/offlineBuild';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import { dashboardScopeOf } from '@/shared/config/dashboardScope';
import {
    MS_PER_HOUR,
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
} from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import {
    resolveLiveTargets,
    selectLiveSymbols,
    type LiveMarket,
    type LiveSymbolGroup,
    type ScannerInput,
    type SnapshotPatternHit,
    withDisplayNames,
} from '@/views/guide/lib/liveSymbols';

/** 데이터원 하나의 결과. 실패하면 `value`는 대신 넣은 빈 값이고 `failed`가 참이다. */
interface Settled<T> {
    readonly value: T;
    readonly failed: boolean;
}

/** 시장당 보여 줄 최대 행 수. */
const LIMIT_PER_MARKET = 5;
/** 스냅샷은 야간에 한 번 구워지므로 이틀 창이면 직전 거래일이 반드시 들어온다. */
const SNAPSHOT_WINDOW_MS = 48 * MS_PER_HOUR;
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
            error
        );
        return { value: fallback, failed: true };
    }
}

/**
 * 항목 페이지의 "지금 이 신호가 나온 종목" 데이터. 대상이 없거나(모듈 생략), 오프라인 빌드거나,
 * 모든 데이터원이 실패했거나, 고른 결과가 비면 `null` — 페이지는 모듈 없이 정상 렌더한다(500 금지).
 * 데이터원(us 스캐너·kr 스캐너·스냅샷)은 개별로 실패를 잡으므로 하나가 죽어도 나머지 행은 남는다.
 */
export async function loadGuideLiveSymbols(
    entry: GuideEntry,
    catalog: readonly GuideEntry[]
): Promise<LiveSymbolGroup[] | null> {
    if (isOfflineBuild()) return null;
    const targets = resolveLiveTargets(entry, catalog);
    const wantsScanner = targets.signalTypes.length > 0;
    const wantsSnapshot = targets.patternNames.length > 0;
    if (!wantsScanner && !wantsSnapshot) return null;

    const [scannerResults, snapshot] = await Promise.all([
        Promise.all(
            (wantsScanner ? SCANNER_MARKETS : []).map(async market => {
                const { value, failed } =
                    await settle<SectorSignalsResult | null>(
                        `${market} scanner`,
                        () =>
                            getSectorSignalsStatic(
                                dashboardScopeOf(market),
                                DEFAULT_DASHBOARD_TIMEFRAME
                            ),
                        null
                    );
                return { market, result: value, failed };
            })
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

    const failures = [
        ...scannerResults.map(r => r.failed),
        ...(wantsSnapshot ? [snapshot.failed] : []),
    ];
    const allFailed = failures.every(Boolean);
    if (allFailed) return null;

    const scanner = scannerResults.flatMap(({ market, result }) =>
        result === null ? [] : [{ market, result } satisfies ScannerInput]
    );
    const groups = selectLiveSymbols({
        targets,
        scanner,
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

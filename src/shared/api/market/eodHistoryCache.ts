import type { Bar, GetBarsOptions } from '@y0ngha/siglens-core';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { MS_PER_SECOND, SECONDS_PER_DAY } from '@/shared/config/time';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { utcMidnightSeconds } from './barsWindow';
import {
    type EodHistoryEntry,
    type EodServeContext,
    canExtendIncrementally,
    hasSuspiciousGap,
    isEntryServable,
    mergeIncremental,
    overlapStatus,
    trimToWindow,
} from './eodHistoryMerge';
import {
    HISTORY_MEMORY_TTL_CAP_SECONDS,
    type HistoryMemory,
} from './historyCache';

/** {@link getEodHistory}가 기대는 외부 — 업스트림 일봉 조회와 인스턴스의 히스토리 L1. */
export interface EodHistoryDeps {
    getBars: (options: GetBarsOptions) => Promise<Bar[]>;
    memory: HistoryMemory;
}

/**
 * 경고 로그 접두사. 분리 전 로그와 같은 문자열로 검색되도록 `CachedMarketDataProvider`
 * 이름을 일부러 유지한다.
 */
const EOD_HISTORY_LOG_PREFIX = '[CachedMarketDataProvider] eodhist';

/**
 * EOD history 키 접두사. 종목당 키 하나(`bars:eodhist:v3:<SYM>`)에 {@link EodHistoryEntry}를
 * 담는다. `v2`(세션 날짜가 키에 든 `Bar[]`)와 값 모양이 달라 접두사를 올렸다 — 같은 키를
 * 재사용하면 배포 직후 옛 엔트리를 새 모양으로 잘못 읽는다. 옛 키는 읽는 코드가 없어 각자의
 * TTL로 저절로 사라진다. 올리는 비용은 종목당 전체 창을 한 번 더 받는 것(평소의 세션 롤 한 번)과
 * 같지만, 전 종목이 같은 시점에 겹치므로 배포 직후 FMP 호출이 한꺼번에 몰린다.
 *
 * ## 증분 갱신 (2026-10)
 *
 * 예전에는 키가 세션 날짜(`lastClosed`)별이라 세션이 넘어갈 때마다 활성 종목 전부가 5년치
 * (~1,260봉, 압축 ~41KB)를 FMP `historical-price-eod/full`에서 통째로 다시 받았다 — 엔드포인트별
 * 바이트 1위였다. 이제 세션이 바뀌면 **마지막 캐시 봉의 날짜부터** 겹쳐 받아 새 봉만 이어 붙인다
 * (`getEodHistory`). 키가 세션과 무관하니 종목당 한 벌만 남는다 — 날짜별 사본이 쌓이지 않는다
 * (날짜 키를 7일 TTL로 쌓아 두던 시절 326MB — 2026-10-04 운영). 보관 기간은 아래 TTL 참고.
 */
const EOD_HISTORY_KEY_PREFIX = 'bars:eodhist:v3';

/**
 * EOD history 엔트리의 Redis TTL. 이제 세션 롤이 아니라 엔트리 안의 `asOf`가 유효성을 정하므로
 * TTL은 "오래 안 보는 종목을 치우는" 정리용 상한이다. 엔트리가 사라져도 정확성은 그대로이고
 * (다음 요청이 전체 창을 한 번 받는다) 증분의 이득만 잃는다. 쓸 때마다 갱신된다.
 *
 * 5일은 저장량과 증분 이득의 절충이다. 매일 조회되는 종목은 쓸 때마다 갱신돼 사라지지 않는다.
 * 고정 TTL은 쓴 시각부터 세므로, 금요일 저녁(~20:00 ET)에 쓴 엔트리는 월요일이 휴장인 연휴 뒤
 * 화요일 롤(~4일 뒤)까지 살아 있어야 한다 — 4일이면 그 직전에 만료돼 시장 전체가 한꺼번에
 * 전체 창을 받는다. 5일은 일반 주말(금→월 롤)과 월·금요일 휴장 연휴(사흘 연휴)를 덮는다.
 * 덮지 못하는 것은 그보다 긴 휴장(KRX 추석 등)으로, 그 뒤에는 종목당 한 번 전체 창을 받는다
 * (예전과 같은 비용). 그보다 길게 안 보이는 롱테일 종목까지 붙들면 그 수만큼 5년치 봉이
 * Redis에 남는다(종목당 ~41KB) — 예전 날짜 키는 롤 + 1시간이면 사라졌다.
 */
const EOD_HISTORY_TTL_SECONDS = 5 * SECONDS_PER_DAY;

/**
 * 일봉 EOD 히스토리를 읽는다: L1 → Redis(`getOrSetCache`) → 증분 갱신 또는 전체 fetch.
 *
 * 엔트리가 `isEntryServable`이면 업스트림 호출 없이 낸다. 아니면(세션이 바뀜, 불완전 쿨다운
 * 만료, 요청 창을 못 덮음) 낡은 엔트리를 밑천으로 `refreshEodHistory`가 겹쳐 받아 이어 붙이거나,
 * 이어 붙일 수 없으면 고정 창 전체를 받는다. 빈 결과는 어디에도 두지 않는다.
 *
 * ## 동시성: 왜 `getOrSetCache`의 `isFresh` 클로저로 낡은 엔트리를 붙잡는가
 *
 * 세션이 넘어가는 순간 차트·분석·fear&greed·섹터 스캔·프리웜이 같은 종목을 동시에 요청한다.
 * 증분인지 전체인지 정하려면 캐시 값을 먼저 봐야 하는데, 별도로 GET하면 41KB를 한 번 더 받고
 * 단일 비행(single-flight)도 직접 만들어야 한다. `getOrSetCache`는 같은 키의 miss를 하나의
 * fetch로 접으므로(`inFlight`), 그 `isFresh` 판정 자리에서 "낡은 값이었다"를 클로저 변수에
 * 담아 두면 소유자의 fetcher가 그 값을 밑천으로 쓴다 — GET은 한 번이고 업스트림 호출도 키당
 * 하나다. 대기자는 소유자 결과가 자기 기준에 맞으면 그대로 받고, 안 맞으면(세션 경계에서
 * 서로 `lastClosed`가 다름, 더 이른 `from`) 소유자 결과를 밑천 삼아 직접 갱신한다(캐시에는
 * 쓰지 않는다 — `getOrSetCache` 규약).
 *
 * Redis가 없거나 GET이 실패하면 L1의 낡은 엔트리가 밑천이다(L1이 비어 있으면 전체 fetch).
 */
export async function getEodHistory(
    deps: EodHistoryDeps,
    options: GetBarsOptions,
    ctx: EodServeContext
): Promise<Bar[]> {
    const key = `${EOD_HISTORY_KEY_PREFIX}:${options.symbol.toUpperCase()}`;
    const memo = deps.memory.get(key);
    let stale: EodHistoryEntry | undefined;
    if (memo !== undefined && !Array.isArray(memo)) {
        if (isEntryServable(memo, ctx)) return memo.bars;
        stale = memo;
    }

    const entry = await getOrSetCache<EodHistoryEntry>(
        key,
        EOD_HISTORY_TTL_SECONDS,
        () => refreshEodHistory(deps.getBars, options, ctx, stale),
        fetched => fetched.bars.length > 0,
        cached => {
            const servable = isEntryServable(cached, ctx);
            // 낡았지만 읽힌 값은 증분 갱신의 밑천이다. 같은 키에 둘 이상이면 가장 최근
            // `checkedAt`이 더 많은 봉을 안다.
            if (
                !servable &&
                (stale === undefined || cached.checkedAt >= stale.checkedAt)
            ) {
                stale = cached;
            }
            return servable;
        }
    );
    if (entry.bars.length > 0 && isEntryServable(entry, ctx)) {
        deps.memory.set(
            key,
            entry,
            HISTORY_MEMORY_TTL_CAP_SECONDS * MS_PER_SECOND
        );
    }
    return entry.bars;
}

/**
 * 낡은 엔트리(`stale`) 뒤를 이어 붙이거나, 못 하면 고정 창 전체를 받아 새 엔트리를 만든다.
 *
 * 증분: `from` = 마지막 캐시 봉의 날짜(포함)로 `before=lastClosed`까지 받는다. 그 봉이 캐시와
 * 같으면(`overlapStatus`) 이후 봉만 이어 붙이고 새 창 앞쪽을 자른다(`fullAt`은 이어받는다). 다르거나 응답에 없으면
 * 분할 등으로 과거가 소급 조정됐거나 알 수 없는 상태이므로 전체 창을 다시 받는다 — 분할 뒤
 * 단순 이어 붙이기는 차트·지표를 조용히 망가뜨리기 때문이다. 증분 호출이 던지면 그대로
 * 전파한다(전체 fetch와 같은 장애 정책, 장애를 캐시하지 않는다).
 */
async function refreshEodHistory(
    getBars: (options: GetBarsOptions) => Promise<Bar[]>,
    options: GetBarsOptions,
    ctx: EodServeContext,
    stale: EodHistoryEntry | undefined
): Promise<EodHistoryEntry> {
    const fromThreshold = utcMidnightSeconds(ctx.fetchFrom);
    const build = (bars: Bar[], fullAt: number): EodHistoryEntry => ({
        asOf: ctx.lastClosed,
        from: ctx.fetchFrom,
        checkedAt: ctx.nowMs,
        fullAt,
        bars,
    });
    const fetchBars = (from: string): Promise<Bar[]> =>
        getBars({ ...options, from, before: ctx.lastClosed });

    const cachedLast = stale?.bars.at(-1);
    if (
        stale !== undefined &&
        cachedLast !== undefined &&
        canExtendIncrementally(stale, ctx, fromThreshold)
    ) {
        // `from`을 포함하는지는 실측으로 확인했다(2026-10): FMP `eod/full`은 `from` 날짜 봉을
        // 포함하고, yahoo chart는 `period1 = '2026-10-07'`에 2026-10-07T00:00:00Z 봉을 준다
        // (005930.KS). 두 공급자 모두 겹침 봉이 응답에 들어온다.
        const fetched = await fetchBars(
            toUtcIsoDate(new Date(cachedLast.time * MS_PER_SECOND))
        );
        const status = overlapStatus(cachedLast, fetched);
        if (status === 'match' && !hasSuspiciousGap(cachedLast, fetched)) {
            return build(
                trimToWindow(
                    mergeIncremental(stale.bars, fetched, cachedLast.time),
                    fromThreshold
                ),
                stale.fullAt
            );
        }
        if (status === 'match') {
            // 겹친 봉은 그대로인데 새 봉이 직전 종가에서 크게 뛰었다 — 공급자가 분할 후 봉을
            // 먼저 내고 과거 봉 조정은 나중에 하면 겹침 비교만으로는 못 잡는다(`hasSuspiciousGap`).
            // 지금 전체를 다시 받고, `fullAt`을 0으로 둬 다음 롤에서도 한 번 더 전체를 받는다 —
            // 조정이 하루 늦게 반영돼도 그때 바로잡힌다(예전 매일 전체 조회와 같은 상한).
            // 실제 급등락이면 전체 조회 두 번이 비용의 전부이고 결과는 같다.
            console.warn(
                `${EOD_HISTORY_LOG_PREFIX} price gap, full refetch:`,
                options.symbol.toUpperCase()
            );
            return build(await fetchBars(ctx.fetchFrom), 0);
        }
        // 영구적으로 반복되면(경계 의미가 다른 공급자 등) 증분의 이득이 사라지므로 보이게 남긴다.
        console.warn(
            `${EOD_HISTORY_LOG_PREFIX} overlap mismatch, full refetch:`,
            options.symbol.toUpperCase(),
            status
        );
    }
    return build(await fetchBars(ctx.fetchFrom), ctx.nowMs);
}

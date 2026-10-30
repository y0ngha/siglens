import {
    type Bar,
    type GetBarsOptions,
    type MarketSessionSpec,
    US_EQUITY_SESSION,
} from '@y0ngha/siglens-core';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import {
    ISO_DATE_LENGTH,
    MS_PER_SECOND,
    SECONDS_PER_MINUTE,
} from '@/shared/config/time';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import {
    extendedTailTtlSeconds,
    filterOutOfSessionBars,
    isExtendedBarTimeframe,
} from './extendedBarsSession';
import {
    EMPTY_INTRADAY_TAIL_MAX_TTL_SECONDS,
    INTRADAY_HISTORY_TTL_SECONDS,
    readCachedHistory,
    type HistoryMemory,
} from './historyCache';
import { mergeBarsByTime } from './mergeBarsByTime';

/**
 * 확장(프리·애프터마켓) 인트라데이 히스토리 L1 상한. 정규장 히스토리 L1(`historyMemory`)과 **따로**
 * 둔다 — 확장 봉은 정규장보다 봉이 훨씬 많아(5분봉 하루 192 vs 78) 같은 LRU에 섞으면 값어치가 더 큰
 * 5년 일봉 히스토리를 밀어낸다. 정규장 밖 봉만 남겨(`filterOutOfSessionBars`) 한 벌이 ~60KB 안팎이라
 * 32개면 ~2MB다.
 */
export const EXTENDED_HISTORY_MEMORY_MAX_ENTRIES = 32;

/**
 * 확장 봉 히스토리 키 접두사 — 정규장 `bars:intrahist:`와 **절대 겹치지 않게** 다른 문자열이다.
 * 같은 키를 쓰면 정규장 `Bar[]`와 확장 `Bar[]`가 서로를 덮어 차트·분석이 시간외 봉을 지표에 섞는다.
 */
const EXTENDED_HISTORY_KEY_PREFIX = 'bars:intrahist-ext';

/**
 * 확장 봉 tail이 "새 봉이 생기는 중"일 때의 TTL(초). 정규장 장중 TTL(60초)과 같은 값이다 —
 * `CachedMarketDataProvider.ttl()`을 쓰면 정규장 밖에서 "다음 개장까지"가 나와 프리·애프터마켓 봉이 가려지므로 상수로 둔다.
 */
const EXTENDED_TAIL_LIVE_TTL_SECONDS = SECONDS_PER_MINUTE;

/** 확장 봉 tail 키 접두사(정규장 `bars:raw:`와 분리). */
const EXTENDED_TAIL_KEY_PREFIX = 'bars:raw-ext';

/** {@link readExtendedBars}가 기대는 외부 — 요청마다 바뀌지 않는 provider 설정과 확장 봉 L1. */
export interface ExtendedBarsDeps {
    /** inner provider가 날짜 인자를 해석하는 타임존; 없으면 확장 봉 계통이 꺼져 있다. */
    timeZone: string | undefined;
    session: MarketSessionSpec;
    /** inner의 확장 봉 조회; inner가 지원하지 않으면 `undefined`. */
    fetchExtended: ((options: GetBarsOptions) => Promise<Bar[]>) | undefined;
    memory: HistoryMemory;
}

/**
 * 프리·애프터마켓 인트라데이 봉(**정규장 밖 봉만**) — 표시 전용 계통이다.
 *
 * `getCachedIntradayBars`의 거울이지만 **키 계통이 다르다**: 히스토리 `bars:intrahist-ext:<SYM>:<tf>:
 * <fromDate>:<today>:<limit>`(24h), tail `bars:raw-ext:<SYM>:<tf>:<today>::<limit>`. 기존
 * `bars:intrahist`·`bars:raw`·`bars:eodhist:v3`는 건드리지 않는다 — 키를 바꾸면 배포 직후 전 종목
 * 캐시가 비어 FMP 429가 몰린다. 새 키 계통은 처음에 비어 있지만 정규장 키는 그대로라 그 위험이 없고,
 * 확장 봉은 사용자가 인트라데이 차트를 열었을 때만 채워진다(봇·SSR·프리웜은 부르지 않는다).
 *
 * 미국 주식 세션(`US_EQUITY_SESSION`)·FMP 날짜 해석 타임존(`intradayDateTimeZone`)·확장 봉을
 * 지원하는 inner·인트라데이 타임프레임에서만 동작하고, 그 밖에는 FMP를 **부르지 않고** 빈 배열이다.
 * Redis에는 정규장 밖 봉만 저장한다(`filterOutOfSessionBars`) — 정규장 구간은 정규 경로가 이미 갖고 있다.
 *
 * tail TTL은 정규장 TTL이 아니라 `extendedTailTtlSeconds`다 — 프리·애프터마켓에도 새 봉이 생긴다.
 */
export async function readExtendedBars(
    deps: ExtendedBarsDeps,
    options: GetBarsOptions
): Promise<Bar[]> {
    const { timeZone, session, memory } = deps;
    const { timeframe, from } = options;
    // 좁힌 const로 들고 간다 — 클로저 안에서 `deps.fetchExtended`의 undefined 검사가 풀리지 않게.
    const innerGetExtendedBars = deps.fetchExtended;
    if (
        timeZone === undefined ||
        session !== US_EQUITY_SESSION ||
        innerGetExtendedBars === undefined ||
        !isExtendedBarTimeframe(timeframe) ||
        from === undefined
    ) {
        return [];
    }
    const fetchExtended = (o: GetBarsOptions): Promise<Bar[]> =>
        innerGetExtendedBars(o);
    const now = new Date();
    const today = zonedDate(now, timeZone);
    const fromDate = from.slice(0, ISO_DATE_LENGTH);
    const symbolKey = options.symbol.toUpperCase();
    const limitKey = options.limit ?? '';
    const tailOptions: GetBarsOptions = {
        ...options,
        from: fromDate < today ? today : fromDate,
        before: undefined,
    };
    const liveTtl = extendedTailTtlSeconds(now, EXTENDED_TAIL_LIVE_TTL_SECONDS);

    const [history, tail] = await Promise.all([
        fromDate < today
            ? readCachedHistory(
                  memory,
                  `${EXTENDED_HISTORY_KEY_PREFIX}:${symbolKey}:${timeframe}:${fromDate}:${today}:${limitKey}`,
                  () => INTRADAY_HISTORY_TTL_SECONDS,
                  async () =>
                      filterOutOfSessionBars(
                          await fetchExtended({
                              ...options,
                              from: fromDate,
                              before: today,
                          }),
                          timeframe
                      ).filter(
                          b =>
                              zonedDate(
                                  new Date(b.time * MS_PER_SECOND),
                                  timeZone
                              ) < today
                      ),
                  bars => bars.length > 0
              )
            : Promise.resolve<Bar[]>([]),
        getOrSetCache<Bar[]>(
            `${EXTENDED_TAIL_KEY_PREFIX}:${symbolKey}:${timeframe}:${tailOptions.from}::${limitKey}`,
            bars =>
                bars.length > 0
                    ? liveTtl
                    : Math.min(liveTtl, EMPTY_INTRADAY_TAIL_MAX_TTL_SECONDS),
            async () =>
                filterOutOfSessionBars(
                    await fetchExtended(tailOptions),
                    timeframe
                )
        ),
    ]);
    return mergeBarsByTime(history, tail);
}

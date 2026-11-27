import 'server-only';
import {
    computePriceStats,
    priceStatsEarliestDate,
    type AgentHistoryIndex,
    type PriceStatsRequest,
    type PriceStatsSubjectInput,
    type PriceStatsSubjectView,
} from '@y0ngha/siglens-core';
import type { ToolExecutor } from '@/app/api/ai/chat/tools/chatTools';
import {
    loadIndexPriceStatsCloses,
    loadPriceStatsCloses,
    type PriceStatsCloses,
} from '@/entities/bars/server/loadPriceStatsCloses';
import { INDEX_SOURCES } from '@/entities/index-history/lib/indexSources';
import { marketProfileForAssetInfo } from '@/entities/ticker/lib/resolveMarketProfile';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import {
    getDescriptor,
    profileIdForSymbol,
} from '@/shared/config/marketProfile/registry';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import type { AssetInfo } from '@/shared/lib/types';
import { staleKrListingDate } from './freshness';
import { logToolDegrade } from './logToolDegrade';
import {
    parsePriceStatsArgs,
    type PriceStatsInvalidArgs,
} from './priceStatsArgs';
import {
    resolveAssetLookup,
    resolvedInstrumentFields,
} from './resolveAssetInfo';

const TOOL = 'get_price_stats';
const SOURCE =
    'SIGLENS daily closes (price only, split-adjusted, dividends excluded)';

type Market = 'us' | 'kr' | 'crypto';
const MARKET_OF: Record<MarketProfileId, Market> = {
    'us-equity': 'us',
    'kr-equity': 'kr',
    crypto: 'crypto',
};

/** 한 주체(종목 또는 지수)를 읽기 전에 정해지는 것: 시장 프로필·세션·거래소 현지 오늘 날짜. */
interface Subject {
    label: string;
    profile: MarketProfileId;
    session: ReturnType<typeof sessionSpecFor>;
    /** 거래소 현지 날짜(코인은 UTC). `ytd`가 가리키는 해와 마지막 종가 뒤 날짜의 판정이 이 값을 따른다. */
    today: string;
    /** 종목이면 자산 정보(조회 실패면 `null`), 지수면 `null`. */
    asset: AssetInfo | null;
    /** 자산 조회가 성공해 모르는 심볼이라고 답했다(조회가 던진 `null`이 아니다). 이때만 이력 없음을 잠시 기억한다. */
    unknownSymbol: boolean;
    index: AgentHistoryIndex | null;
}

type Failure =
    | { subject: string; found: false }
    | {
          subject: string;
          found: false;
          error: 'stale_listing';
          lastTradeDate: string;
      }
    | { subject: string; available: false; reason: 'provider_failed' };

type Loaded =
    | { ok: true; subject: Subject; input: PriceStatsSubjectInput }
    | { ok: false; subject: Subject; failure: Failure };

const todayOf = (session: Subject['session'], now: Date): string =>
    session.kind === 'always-open'
        ? toUtcIsoDate(now)
        : zonedDate(now, session.timeZone);

async function resolveSymbol(symbol: string, now: Date): Promise<Subject> {
    const { asset, lookupFailed } = await resolveAssetLookup(symbol, TOOL);
    // 자산 조회가 실패하면 심볼 형상으로 시장을 고른다(`get_swing_history`와 같다).
    const profile =
        asset === null
            ? profileIdForSymbol(symbol)
            : marketProfileForAssetInfo(asset);
    const session = sessionSpecFor(profile);
    return {
        label: symbol,
        profile,
        session,
        today: todayOf(session, now),
        asset,
        unknownSymbol: asset === null && !lookupFailed,
        index: null,
    };
}

/** `year`·`from`이 이 주체의 거래소 현지 날짜로 아직 오지 않았으면 그 인자를 가리키는 `invalid_args`, 아니면 `null`이다. */
function futureWindowError(
    window: PriceStatsRequest['window'],
    subject: Subject
): PriceStatsInvalidArgs | null {
    if (
        window.kind === 'year' &&
        window.year > Number(subject.today.slice(0, 4))
    )
        return {
            error: 'invalid_args',
            argument: 'year',
            reason: `year ${window.year} is after the current year for ${subject.label} (market date ${subject.today})`,
        };
    if (window.kind === 'range' && window.from > subject.today)
        return {
            error: 'invalid_args',
            argument: 'from',
            reason: `from ${window.from} is after the market date for ${subject.label} (${subject.today})`,
        };
    return null;
}

function resolveIndex(index: AgentHistoryIndex, now: Date): Subject {
    const { profile } = INDEX_SOURCES[index];
    const session = sessionSpecFor(profile);
    return {
        label: index,
        profile,
        session,
        today: todayOf(session, now),
        asset: null,
        unknownSymbol: false,
        index,
    };
}

const notFound = (subject: Subject): Loaded => ({
    ok: false,
    subject,
    failure: { subject: subject.label, found: false },
});

function readCloses(
    subject: Subject,
    request: PriceStatsRequest,
    now: Date
): Promise<PriceStatsCloses | null> {
    if (subject.index !== null)
        return loadIndexPriceStatsCloses(subject.index, now);
    return loadPriceStatsCloses({
        symbol: subject.label,
        ...(subject.asset?.fmpSymbol === undefined
            ? {}
            : { fmpSymbol: subject.asset.fmpSymbol }),
        profile: subject.profile,
        session: subject.session,
        assetKnown: !subject.unknownSymbol,
        // 필요 날짜는 읽은 시리즈의 실제 마지막 종가를 기준으로 구한다 — `computePriceStats`가 창을 재는 기준과 같다.
        earliestFor: lastClose =>
            priceStatsEarliestDate(request, lastClose, subject.today),
        now,
    });
}

async function loadSubject(
    subject: Subject,
    request: PriceStatsRequest,
    now: Date
): Promise<Loaded> {
    const loaded = await readCloses(subject, request, now).catch(
        (error: unknown) => {
            logToolDegrade(TOOL, 'daily closes', error);
            return undefined;
        }
    );
    if (loaded === undefined)
        return {
            ok: false,
            subject,
            failure: {
                subject: subject.label,
                available: false,
                reason: 'provider_failed',
            },
        };
    const lastDate = loaded?.closes.at(-1)?.date;
    if (loaded === null || lastDate === undefined) return notFound(subject);
    // 한국의 죽은 리스팅은 묵은 종가를 수익률로 내보내지 않고 데이터 오류로 돌린다.
    const lastTradeDate = staleKrListingDate(
        subject.profile,
        Date.parse(`${lastDate}T00:00:00Z`),
        now.getTime()
    );
    if (lastTradeDate !== null)
        return {
            ok: false,
            subject,
            failure: {
                subject: subject.label,
                found: false,
                error: 'stale_listing',
                lastTradeDate,
            },
        };
    return {
        ok: true,
        subject,
        input: {
            label: subject.label,
            closes: loaded.closes,
            market: MARKET_OF[subject.profile],
            alwaysOpen: subject.session.kind === 'always-open',
            sessionInProgress: loaded.sessionInProgress,
            today: subject.today,
        },
    };
}

/** core의 한 주체 결과에 통화·이름을 덧붙인다(종목은 해석된 상품 이름·제공자 심볼, 지수는 지수 이름). */
function annotate(
    view: PriceStatsSubjectView,
    subject: Subject
): PriceStatsSubjectView & Record<string, unknown> {
    return {
        ...view,
        ...(subject.index === null
            ? {}
            : { name: INDEX_SOURCES[subject.index].name }),
        // 지수 값은 통화가 아니라 포인트다 — 통화를 붙이면 "5,000달러"처럼 읽힌다.
        currency:
            subject.index === null
                ? getDescriptor(subject.profile).priceFormat.currency
                : null,
        ...resolvedInstrumentFields(subject.asset),
    };
}

/**
 * 종목(1~3개)·주가 지수의 기간 통계(core `computePriceStats`): 기간 수익률·연환산·종가 고저·최대 낙폭·특정 날짜 종가, 둘 이상이면
 * 상관계수. 마감된 세션의 가격 기준 종가만 쓰고(분할 보정, 배당 제외), 종가는 5년 일봉 캐시가 요청 기간에 닿으면 그것을, 아니면 전체
 * 이력을 읽는다(`loadPriceStatsCloses`). 못 읽은 주체는 입력 위치를 지켜 `found: false`·`stale_listing`·`provider_failed`로
 * 싣고 나머지로 계산한다. 인자 오류는 `invalid_args`로 거절한다. 절대 던지지 않는다.
 */
export const getPriceStatsTool: ToolExecutor = async args => {
    const parsed = parsePriceStatsArgs(args);
    if ('error' in parsed) return parsed;
    const { request } = parsed;
    const now = new Date();
    const subjects: Subject[] = [
        ...(await Promise.all(parsed.symbols.map(s => resolveSymbol(s, now)))),
        ...(parsed.index === null ? [] : [resolveIndex(parsed.index, now)]),
    ];
    // 연도와 `from`은 어느 한 주체의 거래소 현지 달력으로라도 아직 오지 않았으면 거절한다(자르지 않는다).
    const futureError = subjects
        .map(subject => futureWindowError(request.window, subject))
        .find(error => error !== null);
    if (futureError !== undefined) return futureError;

    // 동시 로드는 주체 수(`AGENT_PRICE_STATS_MAX_SUBJECTS` = 3)까지다. 전체 이력 로드의 프로세스 전역 상한
    // (`FULL_HISTORY_CONCURRENCY`)이 FMP 동시 요청을 따로 묶는다(SERVER.md#CC-1·CC-10).
    const loaded = await Promise.all(
        subjects.map(subject => loadSubject(subject, request, now))
    );
    const okInputs = loaded.flatMap(item => (item.ok ? [item.input] : []));
    const computed =
        okInputs.length === 0 ? null : computePriceStats(okInputs, request);
    const viewOf = new Map(
        (computed?.subjects ?? []).map(view => [view.subject, view])
    );
    return {
        source: SOURCE,
        ...computed,
        subjects: loaded.map(item => {
            if (!item.ok) return item.failure;
            const view = viewOf.get(item.subject.label);
            return view === undefined
                ? { subject: item.subject.label, found: false }
                : annotate(view, item.subject);
        }),
    };
};

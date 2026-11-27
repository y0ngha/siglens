import 'server-only';
import type { InvestorFlowsSnapshot } from '@y0ngha/siglens-core';
import type { ToolExecutor } from '@/app/api/ai/chat/tools/chatTools';
import {
    loadKrInvestorTrend,
    type KrInvestorTrendView,
} from '@/app/api/ai/chat/tools/krInvestorTrend';
import {
    EMPTY_COLLECTING_SNAPSHOT,
    isKrDisclosureCollecting,
    maskUncollectedSections,
    resolveCollectingArms,
} from '@/entities/investor-flows/lib/investorFlowsReadiness';
import { summarizeInvestorFlows } from '@/entities/investor-flows/lib/summarizeInvestorFlows';
import { summarizeKrInvestorFlows } from '@/entities/investor-flows/lib/summarizeKrInvestorFlows';
import {
    HOLDER_QUERY_MAX_CHARS,
    type CollectingArms,
    type HolderLookupView,
    type InvestorFlowsDegradedPart,
    type InvestorFlowsPipelineReadiness,
} from '@/entities/investor-flows/model';
import { getHolderLookup } from '@/entities/investor-flows/server/getHolderLookup';
import {
    getInvestorFlowsScorecard,
    type InvestorFlowsScorecardResult,
} from '@/entities/investor-flows/server/getInvestorFlowsScorecard';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import {
    getYahooOwnershipShares,
    type YahooOwnershipShares,
} from '@/shared/api/yahoo/yahooOwnershipSource';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { logToolDegrade } from './logToolDegrade';

const BASE_SOURCE =
    'SEC 13F (institutions and their put/call options, quarterly, filed up to ~45 days after quarter end), Form 4 and 13D/13G via FMP, SEC Form 144, registration/offering filings and fails-to-deliver';
const FINRA_SOURCE = 'FINRA short interest/volume';
const EXCHANGE_LIST_SOURCE = 'Nasdaq/NYSE/Cboe Reg SHO threshold lists';
const KR_SOURCE =
    'DART (Korea Financial Supervisory Service) disclosures: 5%+ major-holder reports (detailed/abbreviated form), executive and major-shareholder ownership reports, trading-plan reports';
const KR_NOT_PROVIDED =
    'SIGLENS tools do not carry Korean investor-type net buying (institutional, foreign, individual) right now. If web_search is available, you may use it for this - cite the publisher and date; otherwise say it could not be confirmed. Never estimate.';
const KR_TREND_NOTE =
    'krInvestorTrend is 네이버 금융 (Naver Finance) data: net buying by foreign / institution / individual investors in shares, newest first. Cite the source as 네이버 금융 and the asOf date; the latest session appears only after the close.';
const KR_PREFERRED_SHARE_NOTE =
    'This is a preferred share. DART ownership filings are company-level, so these are the same reports as the common share.';
const KR_COLLECTING_NOTE =
    'The initial DART collection is still running. No reports here means not collected yet, not that there were no filings - say the data is still being collected.';
const TEMPORARILY_UNAVAILABLE_NOTE =
    'These parts could not be loaded right now because of a temporary data-provider error (largeHolders = 13D/13G filings, float = shares float, so short interest as % of float). They are unavailable at the moment, not absent - never say the stock has no such filings or no data; say they could not be loaded right now.';
const COLLECTING_NOTE =
    'Initial collection is still running for the sources marked collecting. Empty or insufficient data there means not collected yet, not that the stock has no such activity - say the data is still being collected.';

/** 갈래 이름 — 수집 중인 갈래만 `dataStatus`에 키로 실린다. */
type CollectingSource = keyof CollectingArms;

/** 수집 중인 갈래에만 키가 있고, 값은 항상 `'collecting'` 리터럴이다. */
type InvestorFlowsDataStatus = Partial<
    Readonly<Record<CollectingSource, 'collecting'>>
> & { readonly note: string };

/**
 * `dataStatus`에 실을 수 있는 갈래 — `Record<CollectingSource, true>`라 `CollectingArms`에 갈래가 늘면 여기서 컴파일 오류가 나
 * 새 갈래가 조용히 빠지지 않는다. 키 순서가 출력 순서다.
 */
const COLLECTING_SOURCE_SET: Readonly<Record<CollectingSource, true>> = {
    institutional: true,
    short: true,
    failsToDeliver: true,
    proposedSales: true,
    offerings: true,
    thresholdList: true,
};

// 안전한 캐스트: `Object.keys`는 `string[]`로 넓히지만 값은 위 `Record<CollectingSource, true>`의 키뿐이다.
const COLLECTING_SOURCES = Object.keys(
    COLLECTING_SOURCE_SET
) as CollectingSource[];

/**
 * 수집 파이프라인 상태를 모델에 알린다. `collecting`인 갈래의 빈 데이터는 "활동 없음"이 아니라 "아직 못 모았다"이므로
 * 모델이 그렇게 말해야 한다. **어느 한 갈래라도 수집 중일 때만** 싣는다 — 정상 상태(전부 `ready`/`unknown`)에서는
 * 키를 생략해 응답이 예전과 같다(도구 결과는 6,000자 상한이라 매번 싣는 비용이 크다).
 * 그 종목의 해당 구간이 실제로 비어 있는 갈래만 싣는다(화면과 같은 `resolveCollectingArms` 판정) — 데이터가 있으면
 * 수집 중 표시여도, `unknown`(상태를 못 읽음)·플래그 꺼짐이어도 그 갈래는 없다. 예외는 13F다: 백필 중의 부분 집계라 행이 있어도
 * 수집 중이면 싣고, 본문의 기관 구간도 같은 판정으로 비운다(`maskUncollectedSections`).
 */
function buildDataStatus(
    snapshot: InvestorFlowsSnapshot | null,
    readiness: InvestorFlowsPipelineReadiness,
    flags: { readonly finraEnabled: boolean; readonly regShoEnabled: boolean }
): InvestorFlowsDataStatus | undefined {
    const arms = resolveCollectingArms({
        readiness,
        snapshot: snapshot ?? EMPTY_COLLECTING_SNAPSHOT,
        ...flags,
    });
    const collecting = COLLECTING_SOURCES.filter(source => arms[source]);
    if (collecting.length === 0) return undefined;
    return {
        ...Object.fromEntries(
            collecting.map(source => [source, 'collecting' as const])
        ),
        note: COLLECTING_NOTE,
    };
}

/**
 * FMP 일시 오류로 이번에만 비운 부분(`snapshot.degraded`)을 모델에 알린다 — 13D/G가 `null`, 유통주식 대비 비율이 없는 것은
 * "그런 공시가 없다"가 아니라 "지금 못 불러왔다"이다. degrade가 없으면 키를 생략한다(정상 응답은 예전과 같다).
 */
function buildTemporarilyUnavailable(
    degraded: readonly InvestorFlowsDegradedPart[] | undefined
):
    | {
          readonly parts: readonly InvestorFlowsDegradedPart[];
          readonly note: string;
      }
    | undefined {
    if (degraded === undefined || degraded.length === 0) return undefined;
    return { parts: degraded, note: TEMPORARILY_UNAVAILABLE_NOTE };
}

function sourceLine(finraEnabled: boolean, regShoEnabled: boolean): string {
    return [
        BASE_SOURCE,
        ...(finraEnabled ? [FINRA_SOURCE] : []),
        ...(regShoEnabled ? [EXCHANGE_LIST_SOURCE] : []),
    ].join(', ');
}

/**
 * 한국 종목(DART) 결과. 미국 갈래(13F·FINRA·SEC)의 수집 상태는 보지 않는다 — DART 백필이 끝나지 않았고 이 종목 목록이 비어 있을 때만
 * `dataStatus.dart: 'collecting'`이다. 우선주는 지분공시가 보통주와 같다는 안내를 붙인다. 기관·외국인 순매수 미제공은 항상 밝힌다.
 */
async function krResult(
    symbol: string,
    result: InvestorFlowsScorecardResult,
    krTrendPending: Promise<KrInvestorTrendView | null> | null
): Promise<Record<string, unknown>> {
    const { snapshot, scorecard, readiness, krCompany } = result;
    // `null` 약속 = 비공식 소스 비허용(공개 API): 네이버를 읽지 않고, `krInvestorTrend`·`trendNote` 키 자체를 싣지 않는다.
    const krInvestorTrend =
        krTrendPending === null ? null : await krTrendPending;
    const collecting = isKrDisclosureCollecting(readiness, snapshot);
    const envelope = {
        source: KR_SOURCE,
        symbol,
        market: 'kr' as const,
        available: true,
        // 값이 있으면 출처 안내(`trendNote`), 없으면 "미제공/확인 불가" 안내(`notProvided`)다.
        ...(krInvestorTrend === null
            ? { notProvided: KR_NOT_PROVIDED }
            : { trendNote: KR_TREND_NOTE }),
        ...(krTrendPending === null ? {} : { krInvestorTrend }),
        ...(krCompany?.viaCommonShare === true
            ? { shareClassNote: KR_PREFERRED_SHARE_NOTE }
            : {}),
        ...(collecting
            ? {
                  dataStatus: {
                      dart: 'collecting' as const,
                      note: KR_COLLECTING_NOTE,
                  },
              }
            : {}),
    };
    if (snapshot === null || scorecard === null)
        return { asOf: new Date().toISOString(), ...envelope, noData: true };
    return {
        asOf: snapshot.asOf,
        ...envelope,
        noData: false,
        ...summarizeKrInvestorFlows(snapshot, scorecard),
    };
}

/** core `get_investor_flows` 설명의 `ownershipShares` 모양. 못 읽었으면 `null`. */
function ownershipView(shares: YahooOwnershipShares | null) {
    return shares === null ? null : { ...shares, source: 'yahoo' as const };
}

/** 보유 비율(Yahoo)을 실을 때 결과 `source`에 덧붙이는 출처 — 모델이 SEC 13F 값으로 오인하지 않게 한다. */
const OWNERSHIP_SOURCE_NOTE = '; ownership shares: Yahoo Finance aggregate';

/** `holder` 인자 → 조회어. 문자열이 아니거나 비어 있으면 `null`(조회 안 함), 앞뒤 공백을 떼고 `HOLDER_QUERY_MAX_CHARS`로 자른다. */
export function readHolderQuery(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const query = raw.trim().slice(0, HOLDER_QUERY_MAX_CHARS).trim();
    return query === '' ? null : query;
}

/**
 * 이름 지정 기관의 13F 포지션 조회 결과를 `holderLookup` 키 하나짜리 객체로 낸다. `holder`가 없으면 `{}`(키 자체가 없다 — 결과가
 * 예전과 같다). `period`는 같은 결과의 보유 기관 목록이 쓴 분기(`topHoldersPeriod`)라 조회가 그 목록과 다른 분기를 말하지 못한다.
 * 던지지 않는다: DB 실패는 로그만 남기고 `{}`로 낮춰 나머지 수급 결과는 살린다.
 */
async function holderLookupField(
    symbol: string,
    raw: unknown,
    period: string | null
): Promise<{ holderLookup?: HolderLookupView }> {
    const query = readHolderQuery(raw);
    if (query === null) return {};
    try {
        return { holderLookup: await getHolderLookup(symbol, query, period) };
    } catch (error) {
        logToolDegrade('get_investor_flows', 'holder lookup', error);
        return {};
    }
}

/**
 * 수급 요약. 미국 주식은 기관 13F·풋콜 · 내부자 Form 4·Form 144 · 5% 대량보유 · 증자·희석 공시 · FINRA 공매도 · SEC FTD ·
 * Reg SHO 과열 목록 · 숏스퀴즈 점수, 한국 주식은 DART 대량보유(5%)·임원·주요주주 소유보고·거래계획보고서(`krResult`, `market: 'kr'`)다.
 *
 * 서버 LLM을 부르지 않는다 — DB에 쌓인 13F·FINRA·DART와 FMP 내부자 데이터를 읽어 `evaluateInvestorFlows`
 * 점수표(코드 계산)를 압축할 뿐이라 공개 API(`/api/v1`)에 그대로 내보내도 서버 키 비용이 없다. 한국 종목은 DB의 DART 테이블만
 * 읽는다(DART를 직접 부르지 않는다). 탭 게이트는 `get_congress_trades`/`get_options_summary`와 같다: 크립토 심볼에는 수급 탭이 없다.
 *
 * `dataStatus`는 초기 수집이 아직 끝나지 않은 갈래가 있을 때만 실린다(그 갈래 키에 `'collecting'`). 그때 해당 구간이 비어
 * 있는 것은 그 종목에 활동이 없어서가 아니므로 "데이터를 모으는 중"이라고 말해야 한다. 키가 없으면 수집이 끝난 정상 상태다.
 *
 * FINRA·과열 목록은 플래그가 켜져 있을 때만 출처로 밝힌다(라이선스 — 꺼진 응답이 그 데이터를 쓴 것처럼 말하면 안 된다).
 *
 * `temporarilyUnavailable`은 FMP 일시 오류로 일부(13D/G·유통주식수)만 이번에 못 불러왔을 때만 실린다 — 그 부분은 "없음"이 아니라
 * "지금은 조회 불가"라고 말해야 한다.
 *
 * `degraded:true`(인프라 장애)는 `available:false`로, 정상적인 "이 종목은 수급 데이터 없음"은
 * `available:true` + `noData:true`로 갈라 모델이 장애를 "데이터 없음"으로 말하지 않게 한다.
 */
export const getInvestorFlowsTool: ToolExecutor = async (args, _ctx, rt) => {
    const symbol = String(args.symbol).toUpperCase();
    if (!(await isTabAllowedForSymbol(symbol, 'flows')))
        return { symbol, available: false, reason: 'tab_not_available' };

    // 네이버 호출(타임아웃 8초)이 스코어카드 뒤에 직렬로 붙지 않도록 먼저 시작한다. 로더는 던지지 않고(`null`로 낮춤),
    // 한국 심볼이 아니면 요청 없이 곧바로 `null`이다.
    const krTrendPending =
        rt.allowUnofficialSources === false
            ? null
            : loadKrInvestorTrend(symbol);
    // 미국 종목 보유 비율(Yahoo)도 스코어카드와 겹쳐 읽는다. 공개 API는 비공식 출처를 쓰지 않으므로 부르지 않는다. 로더는
    // 던지지 않는다(`null`). 한국 종목이면 아래 분기에서 쓰지 않고 버린다.
    const ownershipPending =
        rt.allowUnofficialSources === false || isKrEquitySymbol(symbol)
            ? null
            : getYahooOwnershipShares(symbol);
    const result = await getInvestorFlowsScorecard(symbol);
    if (result.degraded)
        return { symbol, available: false, reason: 'provider_failed' };
    // 한국 종목은 Yahoo 보유 비율 집계가 없다 — core 설명대로 `null`을 실어 "없음"을 밝힌다(보유 지분은 DART 공시로 답한다).
    // 공개 API는 비공식 출처 필드를 싣지 않으므로 키도 없다.
    if (result.market === 'kr')
        return {
            ...(await krResult(symbol, result, krTrendPending)),
            ...(await holderLookupField(symbol, args.holder, null)),
            ...(rt.allowUnofficialSources === false
                ? {}
                : { ownershipShares: null }),
        };

    const { snapshot, scorecard, finraEnabled, regShoEnabled, readiness } =
        result;

    const source = sourceLine(finraEnabled, regShoEnabled);
    const dataStatus = buildDataStatus(snapshot, readiness, {
        finraEnabled,
        regShoEnabled,
    });
    const ownership =
        ownershipPending === null
            ? {}
            : { ownershipShares: ownershipView(await ownershipPending) };
    const resultSource =
        ownershipPending === null
            ? source
            : `${source}${OWNERSHIP_SOURCE_NOTE}`;
    if (snapshot === null || scorecard === null)
        return {
            asOf: new Date().toISOString(),
            source: resultSource,
            symbol,
            available: true,
            noData: true,
            ...(dataStatus === undefined ? {} : { dataStatus }),
            ...ownership,
            ...(await holderLookupField(symbol, args.holder, null)),
        };

    const temporarilyUnavailable = buildTemporarilyUnavailable(
        snapshot.degraded
    );
    const listed = maskUncollectedSections(snapshot, readiness);
    const holderField = await holderLookupField(
        symbol,
        args.holder,
        listed.institutional.topHoldersPeriod
    );
    return {
        asOf: snapshot.asOf,
        source: resultSource,
        symbol,
        available: true,
        noData: false,
        ...(dataStatus === undefined ? {} : { dataStatus }),
        ...(temporarilyUnavailable === undefined
            ? {}
            : { temporarilyUnavailable }),
        ...summarizeInvestorFlows(listed, scorecard),
        ...ownership,
        ...holderField,
    };
};

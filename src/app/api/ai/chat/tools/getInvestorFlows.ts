import 'server-only';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import {
    getInvestorFlowsScorecard,
    type InvestorFlowsScorecardResult,
} from '@/entities/investor-flows/server/getInvestorFlowsScorecard';
import {
    EMPTY_COLLECTING_SNAPSHOT,
    isKrDisclosureCollecting,
    maskUncollectedSections,
    resolveCollectingArms,
} from '@/entities/investor-flows/lib/investorFlowsReadiness';
import { summarizeInvestorFlows } from '@/entities/investor-flows/lib/summarizeInvestorFlows';
import { summarizeKrInvestorFlows } from '@/entities/investor-flows/lib/summarizeKrInvestorFlows';
import type { InvestorFlowsSnapshot } from '@y0ngha/siglens-core';
import type { InvestorFlowsPipelineReadiness } from '@/entities/investor-flows/model';
import type { CollectingArms } from '@/entities/investor-flows/lib/investorFlowsReadiness';
import type { ToolExecutor } from '@/app/api/ai/chat/tools/chatTools';

const BASE_SOURCE =
    'SEC 13F (institutions and their put/call options, quarterly, filed up to ~45 days after quarter end), Form 4 and 13D/13G via FMP, SEC Form 144, registration/offering filings and fails-to-deliver';
const FINRA_SOURCE = 'FINRA short interest/volume';
const EXCHANGE_LIST_SOURCE = 'Nasdaq/NYSE/Cboe Reg SHO threshold lists';
const KR_SOURCE =
    'DART (Korea Financial Supervisory Service) disclosures: 5%+ major-holder reports (detailed/abbreviated form), executive and major-shareholder ownership reports, trading-plan reports';
const KR_NOT_PROVIDED =
    'Institutional and foreign net buying, short selling and offering filings are not provided for Korean stocks - say so and never estimate them.';
const KR_PREFERRED_SHARE_NOTE =
    'This is a preferred share. DART ownership filings are company-level, so these are the same reports as the common share.';
const KR_COLLECTING_NOTE =
    'The initial DART collection is still running. No reports here means not collected yet, not that there were no filings - say the data is still being collected.';
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
function krResult(
    symbol: string,
    result: InvestorFlowsScorecardResult
): Record<string, unknown> {
    const { snapshot, scorecard, readiness, krCompany } = result;
    const collecting = isKrDisclosureCollecting(readiness, snapshot);
    const envelope = {
        source: KR_SOURCE,
        symbol,
        market: 'kr' as const,
        available: true,
        notProvided: KR_NOT_PROVIDED,
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
 * `degraded:true`(인프라 장애)는 `available:false`로, 정상적인 "이 종목은 수급 데이터 없음"은
 * `available:true` + `noData:true`로 갈라 모델이 장애를 "데이터 없음"으로 말하지 않게 한다.
 */
export const getInvestorFlowsTool: ToolExecutor = async args => {
    const symbol = String(args.symbol).toUpperCase();
    if (!(await isTabAllowedForSymbol(symbol, 'flows')))
        return { symbol, available: false, reason: 'tab_not_available' };

    const result = await getInvestorFlowsScorecard(symbol);
    if (result.degraded)
        return { symbol, available: false, reason: 'provider_failed' };
    if (result.market === 'kr') return krResult(symbol, result);

    const { snapshot, scorecard, finraEnabled, regShoEnabled, readiness } =
        result;

    const source = sourceLine(finraEnabled, regShoEnabled);
    const dataStatus = buildDataStatus(snapshot, readiness, {
        finraEnabled,
        regShoEnabled,
    });
    if (snapshot === null || scorecard === null)
        return {
            asOf: new Date().toISOString(),
            source,
            symbol,
            available: true,
            noData: true,
            ...(dataStatus === undefined ? {} : { dataStatus }),
        };

    return {
        asOf: snapshot.asOf,
        source,
        symbol,
        available: true,
        noData: false,
        ...(dataStatus === undefined ? {} : { dataStatus }),
        ...summarizeInvestorFlows(
            maskUncollectedSections(snapshot, readiness),
            scorecard
        ),
    };
};

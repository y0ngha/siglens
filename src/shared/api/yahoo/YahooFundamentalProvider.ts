import 'server-only';
import type {
    EarningsReport,
    FundamentalAnalystEstimateInput,
    FundamentalCashFlowInput,
    FundamentalFinancialScoresInput,
    FundamentalGradesConsensusInput,
    FundamentalGrowthInput,
    FundamentalPeerInput,
    FundamentalPriceTargetConsensusInput,
    FundamentalPriceTargetSummaryInput,
    FundamentalProfile,
    FundamentalRatiosInput,
    FundamentalSectorHistoricalInput,
    FundamentalSectorPerformanceInput,
    FundamentalValuationMetrics,
    GradesEvent,
} from '@y0ngha/siglens-core';
import type { FundamentalProviderWithRawPeers } from '@/shared/api/fmp/fundamentalProvider.types';
import type { FmpEarningsReportItem } from '@/shared/api/fmp/fundamentalClient';
import { getYahooFundamentals } from './yahooFundamentalSource';
import {
    mapAnalystEstimate,
    mapCashFlow,
    mapEarningsReports,
    mapGradesConsensus,
    mapIncomeGrowth,
    mapKeyMetrics,
    mapPriceTargetConsensus,
    mapProfile,
    mapRatios,
    type YahooEarningsItem,
} from './yahooFundamentalMap';

/** FMP 어댑터의 `EARNINGS_REPORT_LIMIT`과 같은 기본값. */
const DEFAULT_EARNINGS_LIMIT = 8;

/**
 * yahoo 실적 항목을 `FmpEarningsReportItem` 형태로 맞춘다.
 *
 * `rawPayload`는 FMP 원본 응답을 담는 필드라 yahoo에는 대응물이 없다. `symbol`과
 * `earningsDate`만 채우고, 예정일이 yahoo 추정인지(`isEstimate`)를 함께 실어 상위가
 * "예정(추정)"으로 구분해 렌더할 수 있게 한다 — 확정 공시일처럼 보이면 안 된다.
 */
function toFmpShape(item: YahooEarningsItem): FmpEarningsReportItem {
    const { isEstimatedDate, ...rest } = item;
    return {
        ...rest,
        rawPayload: {
            symbol: item.symbol,
            earningsDate: item.earningsDate,
            ...(isEstimatedDate ? { isEstimate: true } : {}),
        } as FmpEarningsReportItem['rawPayload'],
    };
}

/**
 * KRX 종목용 `FundamentalProvider` — yahoo-finance2 백엔드.
 *
 * FMP 플랜이 KRX를 커버하지 않아 한국 종목의 펀더멘털 탭이 전부 빈 값이 되던 것을
 * 채운다. yahoo가 제공하지 않는 항목은 `null`/빈 배열로 degrade하며, 그 경로는
 * 미국 종목에서 FMP가 값을 못 줄 때와 동일하다(상위 정규화가 이미 결측을 다룬다).
 *
 * 제공되지 않는 항목과 이유:
 * - **재무 건전성 점수**(Altman Z / Piotroski): yahoo가 산출해 주지 않는다. 두 지표
 *   모두 재무제표에서 계산 가능하지만 계산식은 분석 도메인이라 `siglens-core` 영역이다
 *   (`SCOPE.md §0`) — 어댑터에서 구현하면 지표 로직이 다시 siglens로 샌다.
 * - **동종업계 비교**(peers): yahoo에 대응 엔드포인트가 없다. 섹터로 유사 종목을
 *   추려낼 수는 있으나 종목 마스터가 필요해 KRX 시드 이후로 미룬다.
 * - **섹터 퍼포먼스**: `industryTrend`가 KRX 종목에 빈 배열을 돌려준다(실측).
 * - **롤링 목표주가**(1M/3M/12M): yahoo는 단일 시점 컨센서스만 준다.
 * - **개별 등급 변경 이벤트**(`getGrades`): `upgradeDowngradeHistory`가 KRX 종목에
 *   `No fundamentals data found`로 실패한다(실측). 집계값인 `getGradesConsensus`는 제공한다.
 *
 * 모든 메서드가 같은 `getYahooFundamentals(symbol)`를 호출하며, 그 안의 dedup이
 * 병렬 호출을 한 번의 네트워크 왕복으로 접는다.
 */
export class YahooFundamentalProvider implements FundamentalProviderWithRawPeers {
    async getProfile(symbol: string): Promise<FundamentalProfile | null> {
        return mapProfile(symbol, await getYahooFundamentals(symbol));
    }

    async getKeyMetricsTtm(
        symbol: string
    ): Promise<FundamentalValuationMetrics | null> {
        return mapKeyMetrics(await getYahooFundamentals(symbol));
    }

    async getRatiosTtm(symbol: string): Promise<FundamentalRatiosInput | null> {
        return mapRatios(await getYahooFundamentals(symbol));
    }

    async getCashFlowStatement(
        symbol: string
    ): Promise<FundamentalCashFlowInput | null> {
        return mapCashFlow(await getYahooFundamentals(symbol));
    }

    async getIncomeStatementGrowth(
        symbol: string
    ): Promise<FundamentalGrowthInput | null> {
        return mapIncomeGrowth(await getYahooFundamentals(symbol));
    }

    async getGradesConsensus(
        symbol: string
    ): Promise<FundamentalGradesConsensusInput | null> {
        return mapGradesConsensus(await getYahooFundamentals(symbol));
    }

    async getPriceTargetConsensus(
        symbol: string
    ): Promise<FundamentalPriceTargetConsensusInput | null> {
        return mapPriceTargetConsensus(await getYahooFundamentals(symbol));
    }

    /**
     * 롤링 평균 목표주가(1개월/3개월/12개월)는 yahoo가 시점별로 나눠 주지 않는다.
     * 단일 컨센서스만 있으므로 이 요약은 제공하지 않는다 — 같은 값을 세 창에 복제하면
     * "1개월과 12개월 목표가가 동일"이라는 잘못된 신호가 된다.
     */
    async getPriceTargetSummary(): Promise<FundamentalPriceTargetSummaryInput | null> {
        return null;
    }

    async getFinancialScores(): Promise<FundamentalFinancialScoresInput | null> {
        return null;
    }

    async getStockPeers(): Promise<FundamentalPeerInput[]> {
        return [];
    }

    async getStockPeersRaw(): Promise<FundamentalPeerInput[]> {
        return [];
    }

    async getAnalystEstimates(
        symbol: string
    ): Promise<FundamentalAnalystEstimateInput | null> {
        return mapAnalystEstimate(await getYahooFundamentals(symbol));
    }

    async getGrades(): Promise<GradesEvent[]> {
        return [];
    }

    async getSectorPerformanceSnapshot(): Promise<
        FundamentalSectorPerformanceInput[]
    > {
        return [];
    }

    async getHistoricalSectorPerformance(): Promise<
        FundamentalSectorHistoricalInput[]
    > {
        return [];
    }

    /** 가장 가까운 실적 일정 1건. `getEarningsReports`의 첫 행을 그대로 쓴다(FMP 어댑터와 동일). */
    async getEarningsReport(symbol: string): Promise<EarningsReport | null> {
        const [first] = await this.getEarningsReports(symbol, 1);
        return first
            ? { symbol: first.symbol, earningsDate: first.earningsDate }
            : null;
    }

    async getEarningsReports(
        symbol: string,
        limit = DEFAULT_EARNINGS_LIMIT
    ): Promise<FmpEarningsReportItem[]> {
        const items = mapEarningsReports(
            symbol,
            await getYahooFundamentals(symbol),
            limit
        );
        return items.map(toFmpShape);
    }
}

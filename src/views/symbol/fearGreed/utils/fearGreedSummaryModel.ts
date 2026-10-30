/**
 * `FearGreedFactsSummary`의 계산 부분. 컴포넌트는 번역자를 만들어 넘기고 결과를 그리기만 해서, 문장
 * 조립은 렌더 없이 단위 테스트한다(`fearGreed/__tests__/fearGreedSummaryModel.test.ts`).
 */
import type {
    Bar,
    BuySellVolumeResult,
    FearGreedReading,
    FearGreedSnapshot,
} from '@y0ngha/siglens-core';
import { computeSymbolFearGreedSeries } from '@/entities/bars/lib/symbolFearGreed';
import { scoredHistory } from '@/entities/bars/lib/fearGreedWindow';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';
import type { SeoTranslator } from '@/shared/lib/seo';
import type { Locale } from '@/shared/i18n/locales';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { MS_PER_SECOND } from '@/shared/config/time';
import {
    buildExtremeZoneRecord,
    buildFearGreedFactorRankingLine,
    buildFearGreedFactorTable,
    buildFearGreedGroupComparisonLine,
    buildFearGreedMarketGapLine,
    buildFearGreedPeriodComparisonLine,
    buildFearGreedRegimeDistributionLine,
    buildFearGreedTransitionLine,
    buildFearGreedYearRangeLine,
    type ExtremeZoneRecord,
    type FearGreedFactorTable,
} from './fearGreedFacts';

/** 이 종목이 속한 시장의 최신 판독과 그 시장 이름(예: `미국 증시`). */
export interface FearGreedMarketReading {
    readonly reading: FearGreedReading;
    readonly label: string;
}

/** 요약이 쓰는 번역자 묶음. 모두 컴포넌트가 리터럴 네임스페이스로 만든다. */
export interface FearGreedSummaryTranslators {
    /** `shared.enumLabel` */
    readonly tLabel: EnumLabelTranslator;
    /** `views.symbol.fearGreedFacts` */
    readonly tFacts: SeoTranslator;
    /** `shared.lib.fearGreedFactor` */
    readonly tFactor: SeoTranslator;
}

interface FearGreedSummaryInputs {
    readonly bars: Bar[];
    readonly buySellVolume: BuySellVolumeResult[];
    readonly market: FearGreedMarketReading | null;
    readonly locale: Locale;
}

/** 요약 한 벌. 스냅샷을 계산할 수 없으면 `buildFearGreedSummaryModel`이 null을 낸다. */
export interface FearGreedSummaryModel {
    readonly snapshot: FearGreedSnapshot;
    /** 반올림한 현재 점수. */
    readonly score: number;
    /** 마지막 봉의 UTC 날짜(`YYYY-MM-DD`). 봉이 없으면 null. */
    readonly asOfLabel: string | null;
    /** 날짜·점수·체류일이 들어간 시계열 문장(없는 문장은 빠진다). */
    readonly timeSeriesLines: readonly string[];
    readonly groupComparisonLine: string | null;
    readonly factorRankingLine: string | null;
    readonly factorTable: FearGreedFactorTable;
    readonly extremeZoneRecord: ExtremeZoneRecord | null;
}

/**
 * 헤더 배지·색인 게이트·클라이언트 seed와 같은 계산(`computeSymbolFearGreedSeries`, 요청 스코프
 * 메모)을 공유하고, 그 한 `history`로 문장·표·극단 구간 기록을 모두 만든다 — 문장과 기록 표의
 * 기간이 갈리지 않는다.
 *
 * 기준 시점(`asOfLabel`)을 밝히는 이유: seed 봉은 형성 중인 마지막 봉을 떼어낸 상태라 장중에는
 * 실시간 봉을 포함한 클라이언트 게이지와 점수가 다르다. 기준을 적어 두 수치가 모순이 아니라
 * "종가 기준 vs 실시간"으로 읽히게 한다.
 */
export function buildFearGreedSummaryModel(
    { bars, buySellVolume, market, locale }: FearGreedSummaryInputs,
    { tLabel, tFacts, tFactor }: FearGreedSummaryTranslators
): FearGreedSummaryModel | null {
    const { snapshot, history } = computeSymbolFearGreedSeries(
        bars,
        buySellVolume
    );
    if (!snapshot) return null;

    const asOf = bars.at(-1)?.time;
    const points = scoredHistory(history);
    const timeSeriesLines = [
        buildFearGreedPeriodComparisonLine(points, tLabel, tFacts),
        buildFearGreedYearRangeLine(points, tFacts),
        buildFearGreedRegimeDistributionLine(points, tLabel, tFacts),
        buildFearGreedTransitionLine(history, tLabel, tFacts),
        market === null
            ? null
            : buildFearGreedMarketGapLine(
                  history,
                  market.reading,
                  market.label,
                  tFacts
              ),
    ].filter((line): line is string => line !== null);

    return {
        snapshot,
        score: Math.round(snapshot.score),
        asOfLabel:
            asOf === undefined
                ? null
                : toUtcIsoDate(new Date(asOf * MS_PER_SECOND)),
        timeSeriesLines,
        groupComparisonLine: buildFearGreedGroupComparisonLine(
            snapshot,
            tFacts
        ),
        factorRankingLine: buildFearGreedFactorRankingLine(
            snapshot,
            tFacts,
            tFactor
        ),
        factorTable: buildFearGreedFactorTable(snapshot, tFactor, locale),
        extremeZoneRecord: buildExtremeZoneRecord(history, tLabel, tFacts),
    };
}

/**
 * 공매도 구간(FINRA 잔고·일별 비중)의 화면용 데이터 — 시계열 정리, 증감 방향, 급증/급감 표식.
 */
import type {
    InvestorFlowsScorecard,
    ShortInterestPoint,
    ShortVolumePoint,
} from '@y0ngha/siglens-core';
import { compareIsoDate } from '@/entities/investor-flows/lib/investorFlowsDates';
import { computePreviousSettlementChange } from '@/entities/investor-flows/lib/shortInterestChange';
import type { PreviousSettlementChange } from '@/entities/investor-flows/model';

/** 일별 공매도 비중 그래프가 그리는 최대 거래일 수와, 평균선의 기준 거래일 수. */
export const SHORT_VOLUME_CHART_DAYS = 60;

/** 공매도 잔고 행 하나(결제일 기준). */
export interface ShortInterestRow {
    settlementDate: string;
    shortQty: number;
    /** 유통주식 대비 %. 유통주식 수를 모르면 `null`. */
    pctOfFloat: number | null;
    daysToCover: number | null;
}

/**
 * 결제일 오름차순 잔고 행. `pctOfFloat`은 **추이 그래프의 점마다** 필요해서 여기서 계산한다 — 최신 값의
 * 요약 숫자(카드·에이전트 도구)는 점수표(`scorecard.short.metrics`)의 값을 쓴다.
 */
export function buildShortInterestRows(
    points: readonly ShortInterestPoint[],
    floatShares: number | null
): ShortInterestRow[] {
    const sorted = points.toSorted((a, b) =>
        compareIsoDate(a.settlementDate, b.settlementDate)
    );
    return sorted.map(point => ({
        settlementDate: point.settlementDate,
        shortQty: point.shortQty,
        pctOfFloat:
            floatShares !== null && floatShares > 0
                ? (point.shortQty / floatShares) * 100
                : null,
        daysToCover: point.daysToCover,
    }));
}

/** 공매도 잔고 블록이 쓰는 데이터. */
export interface ShortInterestView {
    /** 결제일 오름차순 행(추이 그래프용). */
    rows: ShortInterestRow[];
    /** 최신 결제일의 직전 결제일 대비 변화 — 에이전트 도구 요약과 같은 함수의 값. 비교할 결제일이 없으면 `null`. */
    previousChange: PreviousSettlementChange | null;
}

/** 공매도 잔고 블록이 쓰는 데이터를 한 번에 만든다(훅이 아니라 순수 util — 위젯 `.tsx`가 entity lib를 직접 부르지 않는다). */
export function buildShortInterestView(
    points: readonly ShortInterestPoint[],
    floatShares: number | null
): ShortInterestView {
    return {
        rows: buildShortInterestRows(points, floatShares),
        previousChange: computePreviousSettlementChange(points),
    };
}

/** 증감 배지 방향. */
export type ChangeDirection = 'up' | 'down' | 'flat';

/** 증감 배지 방향. 소수 첫째 자리에서 0이면 "변화 없음"으로 본다. */
export function changeDirection(changePct: number): ChangeDirection {
    const rounded = Math.round(changePct * 10) / 10;
    if (rounded > 0) return 'up';
    if (rounded < 0) return 'down';
    return 'flat';
}

/** 일별 공매도 비중 행 하나. */
export interface ShortVolumeRow {
    date: string;
    /** 장외(TRF) 공매도 거래량 / 전체 거래량(0~1). 거래량이 0이면 `null`. */
    ratio: number | null;
}

/** 일별 공매도 비중 시계열과 평균. */
export interface ShortVolumeSeries {
    rows: ShortVolumeRow[];
    /** 그려진 구간의 평균 비중(0~1). 비중을 계산할 수 있는 날이 없으면 `null`. */
    average: number | null;
    /** 평균에 실제로 들어간 거래일 수 — 비중을 계산할 수 있던 날만 센다(`rows` 길이와 다를 수 있다). */
    averagedDays: number;
    latest: ShortVolumeRow | null;
}

/** 최근 `SHORT_VOLUME_CHART_DAYS` 거래일의 일별 공매도 비중과 그 평균. */
export function buildShortVolumeSeries(
    points: readonly ShortVolumePoint[]
): ShortVolumeSeries {
    const rows = points
        .toSorted((a, b) => compareIsoDate(a.date, b.date))
        .slice(-SHORT_VOLUME_CHART_DAYS)
        .map<ShortVolumeRow>(point => ({
            date: point.date,
            ratio:
                point.totalVolume > 0
                    ? point.shortVolume / point.totalVolume
                    : null,
        }));
    const ratios = rows
        .map(row => row.ratio)
        .filter((ratio): ratio is number => ratio !== null);
    return {
        rows,
        averagedDays: ratios.length,
        average:
            ratios.length === 0
                ? null
                : ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length,
        latest: rows.at(-1) ?? null,
    };
}

/** 최근 비중의 급증/급감 표식. */
export type ShortVolumeMarker = 'surge' | 'drop' | null;

/**
 * 최근 비중이 평소보다 급증/급감했는지 — **core 판정(`off_exchange_short_ratio_z` 신호)을 그대로 따른다.**
 * 화면이 임계값을 따로 두면 점수표·AI 해석과 다른 말을 하게 된다. 신호가 없으면 평소 수준이다.
 * 방향: 비중↑ = 공매도 압력↑ = bearish 신호, 비중↓ = bullish 신호.
 */
export function shortVolumeMarker(
    scorecard: InvestorFlowsScorecard
): ShortVolumeMarker {
    const signal = scorecard.short.signals.find(
        s => s.id === 'off_exchange_short_ratio_z'
    );
    if (signal === undefined) return null;
    if (signal.direction === 'bearish') return 'surge';
    if (signal.direction === 'bullish') return 'drop';
    return null;
}

/** FINRA 구간(잔고·일별 비중)을 그릴 데이터가 하나라도 있는지. 플래그가 꺼져 있으면 항상 `false`. */
export function hasShortData(
    finraEnabled: boolean,
    shortInterest: readonly ShortInterestPoint[] | null,
    shortVolume: readonly ShortVolumePoint[] | null
): boolean {
    if (!finraEnabled) return false;
    return (shortInterest?.length ?? 0) > 0 || (shortVolume?.length ?? 0) > 0;
}

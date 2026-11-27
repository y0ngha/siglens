/**
 * "한눈에 보기" 카드의 표시 모델 — 분석 결과가 이미 담고 있는 값에서 추세와 세 가격대만 뽑는다.
 *
 * 이 파일에는 판정·임계값·재계산이 없다(분석 도메인은 `@y0ngha/siglens-core` 몫이다).
 * - 저항·지지: core `clusterKeyLevels`가 이미 정렬해 둔 배열의 첫 값. 저항은 오름차순, 지지는
 *   내림차순이다(`KeyLevelsSection`이 같은 배열을 그린다). 다만 core는 레벨이 현재가의 어느 쪽에
 *   있는지까지 보장하지 않으므로(가격이 레벨을 넘은 뒤에는 인덱스 0이 "가장 가까운" 레벨이 아닐 수
 *   있다) 화면 라벨은 "가까운"을 붙이지 않는다. 쪽을 고르는 일은 분석 정규화라 core 몫이다 —
 *   여기서 걸러 내거나 다시 정렬하지 않는다.
 * - 무효화 기준: 보정값 우선인 `resolveEffectiveActionLevels`의 손절. `actionRecommendation.stopLoss`를
 *   직접 읽으면 core가 거부한 손절을 집어 오므로 이 함수만 거친다.
 * - 진입가·목표가·진입 판단·리스크 등급은 카드에 싣지 않는다.
 */
import type {
    AnalysisResponse,
    ClusteredKeyLevels,
    Trend,
} from '@y0ngha/siglens-core';
import { resolveEffectiveActionLevels } from '@/entities/analysis/lib/effectiveActionLevels';
import type { LockedSections } from './lockedSections';
import { TREND_LABEL_KEY } from './trendUtils';

export type ConclusionValue =
    | { kind: 'price'; price: number }
    | { kind: 'locked' }
    | { kind: 'none' };

export interface ConclusionModel {
    /** 알 수 없는 값이면 `null` — 화면은 "추세 정보 없음"을 그린다. */
    trend: Trend | null;
    resistance: ConclusionValue;
    support: ConclusionValue;
    invalidation: ConclusionValue;
    /** `planCheck.belowStopLoss === true`이고 무효화 기준이 보일 때만 참. */
    isPlanVoid: boolean;
}

interface BuildConclusionModelInput {
    analysis: AnalysisResponse;
    keyLevels: ClusteredKeyLevels;
    locked: LockedSections;
}

const LOCKED: ConclusionValue = { kind: 'locked' };
const NONE: ConclusionValue = { kind: 'none' };

function isTrend(value: unknown): value is Trend {
    return typeof value === 'string' && Object.hasOwn(TREND_LABEL_KEY, value);
}

function priceOrNone(price: number | undefined): ConclusionValue {
    return price === undefined ? NONE : { kind: 'price', price };
}

export function buildConclusionModel({
    analysis,
    keyLevels,
    locked,
}: BuildConclusionModelInput): ConclusionModel {
    const resistance = locked.hasLockedPartialDetail
        ? LOCKED
        : priceOrNone(keyLevels.resistance?.[0]?.price);
    const support = locked.hasLockedPartialDetail
        ? LOCKED
        : priceOrNone(keyLevels.support?.[0]?.price);
    const invalidation = locked.hasLockedActionDetail
        ? LOCKED
        : priceOrNone(
              resolveEffectiveActionLevels(analysis.actionRecommendation)
                  .stopLoss
          );

    return {
        trend: isTrend(analysis.trend) ? analysis.trend : null,
        resistance,
        support,
        invalidation,
        isPlanVoid:
            invalidation.kind === 'price' &&
            analysis.actionRecommendation?.planCheck?.belowStopLoss === true,
    };
}

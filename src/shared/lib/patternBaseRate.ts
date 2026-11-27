/**
 * 패턴 카드의 실측 base rate를 화면용으로 고르는 규칙 — 카드 본문과 차트 목표선이
 * 같은 판정을 써야 "참고 거리"로 흐려진 선과 카드 문구가 어긋나지 않는다.
 */
import {
    PATTERN_BASE_RATES,
    measuredBaseRateFor,
    type MeasuredBaseRate,
    type PatternResult,
    type Timeframe,
} from '@y0ngha/siglens-core';

import { patternIdForSkill } from '@/shared/lib/guideLinkLookup';

const PERCENT = 100;

/**
 * 표를 찾을 패턴 id. core가 카드에 붙일 때와 같게 스킬 카탈로그의 정본 id(스킬 이름으로
 * 찾는다)를 쓴다. 카드의 `patternName`은 모델이 쓴 문자열이라 믿지 않고, 카탈로그에 스킬이
 * 없을 때만 그 값이 정본 `ChartPatternId`와 정확히 같은 경우에 한해 쓴다. 둘 다 아니면 빈
 * 키 — 표가 전체 패턴 행으로 대신한다.
 */
function canonicalPatternId(
    pattern: Pick<PatternResult, 'skillName' | 'patternName'>
): string {
    return (
        patternIdForSkill(pattern.skillName) ??
        (Object.hasOwn(PATTERN_BASE_RATES, pattern.patternName)
            ? pattern.patternName
            : '')
    );
}

/**
 * 카드가 보여 줄 base rate. core가 카드에 붙인 값(`null`은 일봉이 아니라 측정 안 됨)을
 * 그대로 쓰고, 붙이기 전에 저장된 옛 결과(필드 없음)만 같은 표에서 직접 채운다.
 */
export function resolvePatternBaseRate(
    pattern: Pick<PatternResult, 'skillName' | 'patternName' | 'baseRate'>,
    timeframe: Timeframe
): MeasuredBaseRate | null {
    return (
        pattern.baseRate ??
        (pattern.baseRate === null
            ? null
            : measuredBaseRateFor(
                  'chart_pattern',
                  canonicalPatternId(pattern),
                  timeframe
              ))
    );
}

/**
 * 이 패턴의 목표가가 위약(같은 거리의 다른 날 가격)을 이긴다고 확인되지 않았는가.
 * 확인되지 않은 목표선은 예측이 아니라 "참고 거리"로 그린다. 측정이 없어도(`null`) 같다.
 */
export function isTargetReferenceOnly(
    baseRate: MeasuredBaseRate | null | undefined
): boolean {
    return baseRate?.verdict !== 'beats_placebo';
}

/** 0~1 비율을 소수 한 자리 퍼센트 숫자 문자열로("0.226" → "22.6"). */
export function formatShareAsPercent(share: number): string {
    return (share * PERCENT).toFixed(1);
}

/** 측정 범위의 시작·끝 연도("2018-03-14" → "2018"). */
export function baseRateScopeYears(rate: MeasuredBaseRate): {
    from: string;
    to: string;
} {
    return {
        from: rate.scope.from.slice(0, 4),
        to: rate.scope.to.slice(0, 4),
    };
}

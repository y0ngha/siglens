import type { PriorAnalysis, RiskLevel, Trend } from '@y0ngha/siglens-core';
import { resolveEffectiveActionLevels } from './effectiveActionLevels';

/**
 * `Trend` / `RiskLevel`의 허용 값 집합.
 *
 * `typeof === 'string'`만으로는 부족하다. 이 행들은 몇 달 전 스키마가 쓴 것일 수
 * 있고, 유니온에 없는 문자열(`'sideways'` 등)이 들어 있으면 캐스트로는 걸러지지 않은
 * 채 **AI 프롬프트에 사실처럼 주입된다.** 값이 실제로 유니온에 속하는지 확인해야
 * 하고, 아니면 그 행은 버린다.
 */
const TRENDS: ReadonlySet<string> = new Set<Trend>([
    'bullish',
    'bearish',
    'neutral',
]);
const RISK_LEVELS: ReadonlySet<string> = new Set<RiskLevel>([
    'low',
    'medium',
    'high',
]);

const isTrend = (value: unknown): value is Trend =>
    typeof value === 'string' && TRENDS.has(value);

const isRiskLevel = (value: unknown): value is RiskLevel =>
    typeof value === 'string' && RISK_LEVELS.has(value);

/** 저장된 jsonb 객체에서 필드를 `unknown`으로 읽는다. 없으면 `undefined`. */
function readField(source: object, key: string): unknown {
    return Reflect.get(source, key);
}

/**
 * `analysis_history.result` jsonb를 core의 `PriorAnalysis` 투영으로 바꾼다.
 *
 * `result`는 타입상 `unknown`이고 몇 달 전 스키마가 쓴 값일 수 있어 단순 캐스트가 아니라
 * 방어적으로 읽는다: `trend`/`riskLevel`이 없거나 허용 값이 아닌 행은 쓸 수 있는 이전
 * 분석이 아니므로 쓰레기 필드를 흘리지 않고 `null`로 버린다. `actionRecommendation`
 * 아래 숫자 필드는 개별 값 단위로 거른다 — `NaN`/`Infinity` 하나는 그 값만 떨어뜨리고
 * 행 전체를 버리지 않는다. 비유한 값이 프롬프트로 가지 못하게 하는 core의 가드와 같다.
 *
 * 저장(`saveAnalysisHistory`)이 "읽기가 버릴 행은 쓰지 않는다"를 이 함수로 판정하므로
 * 읽기·쓰기 판정이 한 곳에서 갈리지 않는다.
 */
export function toPriorAnalysis(row: {
    result: unknown;
    generatedAt: Date;
}): PriorAnalysis | null {
    if (typeof row.result !== 'object' || row.result === null) return null;
    const trend = readField(row.result, 'trend');
    const riskLevel = readField(row.result, 'riskLevel');
    if (!isTrend(trend) || !isRiskLevel(riskLevel)) return null;

    const actionRecommendation = readField(row.result, 'actionRecommendation');
    // 진입가 검증 + 손절/익절 보정값 우선 — 근거는 `resolveEffectiveActionLevels` JSDoc.
    const { entryPrices, stopLoss, takeProfitPrices } =
        resolveEffectiveActionLevels(
            typeof actionRecommendation === 'object'
                ? (actionRecommendation ?? undefined)
                : undefined
        );

    return {
        generatedAt: row.generatedAt,
        trend,
        riskLevel,
        ...(entryPrices !== undefined ? { entryPrices } : {}),
        ...(stopLoss !== undefined ? { stopLoss } : {}),
        ...(takeProfitPrices !== undefined ? { takeProfitPrices } : {}),
    };
}

/**
 * `actionRecommendation`에서 **실효** 손절·익절을 뽑는다 — 보정값 우선.
 *
 * core는 AI가 낸 손절·익절이 무효할 때(예: 롱인데 손절가가 진입가 위, 익절
 * 사다리에 말이 안 되는 값이 섞임) 원본을 **그대로 두고** 도메인 보정값을
 * `reconciledLevels`에 따로 붙인다 — "The original AI fields above are never
 * mutated — consumers can compare and decide which values to display".
 * 그래서 원본 필드만 읽는 소비자는 core가 이미 거부한 값을 집어 온다.
 *
 * 그게 조용한 오보로 이어진다: 무효 익절가 `1`이 그대로 흘러가면 채점기가
 * `high >= takeProfitPrices[0]`으로 판정하므로 **항상 "target reached"**가 되고,
 * 실제로는 미달한 목표를 달성했다고 사실처럼 싣는다. 손절도 마찬가지로 거부된
 * 레벨 기준으로 채점·표시된다.
 *
 * ⚠️ core의 `extractReconciledActionLines`와 혼동하지 말 것. 그쪽은 차트 오버레이
 * 전용이라 **AI 원본과 값이 다른 인덱스만** 담는다(중복 라인 렌더 방지). 여기서
 * 필요한 건 표시·채점에 쓸 **완전한** 레벨 집합이다.
 *
 * 자매 레포(siglens-trader)의 `safe-extract.ts`도 같은 이유로 보정값을 우선한다.
 */

/**
 * 실효 레벨을 뽑을 수 있는 최소 구조. core `ActionRecommendation`이 그대로 맞고,
 * 저장된 jsonb를 좁히는 쪽(`analysisHistoryRepository`)도 이 타입을 재사용한다 —
 * 필드를 전부 `unknown`으로 둔 이유가 그것이다. 몇 달 전 스키마가 쓴 행이 무엇을
 * 담고 있든 받아 낸 뒤 값 단위로 검증한다.
 */
export interface ActionLevelsSource {
    readonly entryPrices?: unknown;
    readonly stopLoss?: unknown;
    readonly takeProfitPrices?: unknown;
    readonly reconciledLevels?: {
        readonly stopLoss?: unknown;
        readonly takeProfitPrices?: unknown;
    };
}

/** 보정 반영이 끝난 손절·익절. 유효한 값이 없으면 해당 키는 `undefined`. */
export interface EffectiveActionLevels {
    /**
     * 진입가. core는 진입가를 보정하지 않으므로(`reconciledLevels`에 없다)
     * 원본에서 유효값만 걸러 낸다 — 검증 자체는 손절·익절과 동일하게 필요하다.
     */
    readonly entryPrices: number[] | undefined;
    readonly stopLoss: number | undefined;
    readonly takeProfitPrices: number[] | undefined;
}

/**
 * 가격으로 쓸 수 있는 값인가 — 유한할 뿐 아니라 **양수**여야 한다.
 *
 * 유한성만 보면 `0`이 통과한다. 그런데 `0`은 가격이 아니라 "값이 없다"를 잘못
 * 인코딩한 흔적이고, 통과시키면 조용히 거짓을 만든다: 목표가가 `0`이면
 * `high >= 0`이 **항상 참**이라 달성한 적 없는 목표가 달성으로 판정된다
 * (`SL 0.00` / `entry 0.00`도 마찬가지). core의 프롬프트가 모델에게 "`null`이나
 * `0`을 placeholder 가격으로 쓰지 말라"고 명시할 만큼 알려진 실패 모드다.
 * 자매 레포(siglens-trader)의 `isFinitePositive`와 같은 기준이다.
 */
function isPositivePrice(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * 보정값이 있으면 그쪽을, 없으면 AI 원본을 쓰되 양쪽 모두 개별 값 단위로
 * 검증한다. 사다리에 든 하나의 `NaN`/`0`은 그 항목만 떨어뜨리고 나머지는 남긴다.
 */
export function resolveEffectiveActionLevels(
    action: ActionLevelsSource | undefined
): EffectiveActionLevels {
    const reconciled = action?.reconciledLevels;

    const entryPrices = Array.isArray(action?.entryPrices)
        ? action.entryPrices.filter(isPositivePrice)
        : undefined;

    const takeProfitSource = Array.isArray(reconciled?.takeProfitPrices)
        ? reconciled.takeProfitPrices
        : action?.takeProfitPrices;
    const takeProfitPrices = Array.isArray(takeProfitSource)
        ? takeProfitSource.filter(isPositivePrice)
        : undefined;

    // 후보를 우선순위 순으로 늘어놓고 첫 유효값을 취한다. `let`+`if`(MISTAKES §14)도,
    // 중첩 삼항(FF 1-E)도 쓰지 않으면서 "보정값 우선"이 배열 순서로 드러난다.
    const stopLoss = [reconciled?.stopLoss, action?.stopLoss].find(
        isPositivePrice
    );

    return { entryPrices, stopLoss, takeProfitPrices };
}

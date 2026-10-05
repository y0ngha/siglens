import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';

/**
 * `EconomyIndicatorMeta.unit` 중 카탈로그 키로 대체된 한국어 카운터 단위만
 * `shared.enumLabel.economyUnit`으로 조회한다. 예전엔 이 값이 `'천명'`·`'건'`
 * 리터럴이라 `/en/economy`가 `vs. Previous Period +41천명`·`-6000건`을 그대로
 * 찍었다. `'%'`·`'pt'`·`'B$'` 같은 로케일 불변 기호는 맵에 없으므로 그대로
 * 통과한다.
 */
const ECONOMY_UNIT_LABEL_KEY: Partial<Record<string, string>> = {
    thousandPeople: 'economyUnit.thousandPeople',
    count: 'economyUnit.count',
};

/** 값(레벨)에 붙는 단위. */
export function unitLabel(unit: string, tLabel: EnumLabelTranslator): string {
    const key = ECONOMY_UNIT_LABEL_KEY[unit];
    return key ? tLabel(key) : unit;
}

/** `%` 지표의 변화량 단위 — 수익률·비율의 차이는 퍼센트가 아니라 퍼센트포인트다. */
const PERCENT_UNIT = '%';
const PERCENTAGE_POINT_KEY = 'economyUnit.percentagePoint';

/**
 * 변화량(델타)에 붙는 단위.
 *
 * 금리 3.58% → 3.63%의 변화는 `+0.05%`(상대 변화율처럼 읽힌다)가 아니라
 * `+0.05%p`다. `%`만 퍼센트포인트로 바꾸고 나머지(`pt`, `B$`, `천명`…)는 값 단위를
 * 그대로 쓴다. 영어 등 `p`를 안 쓰는 로케일의 표기는 카탈로그가 정한다.
 */
export function deltaUnitLabel(
    unit: string,
    tLabel: EnumLabelTranslator
): string {
    return unit === PERCENT_UNIT
        ? tLabel(PERCENTAGE_POINT_KEY)
        : unitLabel(unit, tLabel);
}

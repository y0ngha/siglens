/**
 * `/backtesting#record` 구역이 그릴 행을 core 측정 상수에서 고른다. 값은 한 글자도 다시
 * 계산하지 않고 core가 내보낸 행을 그대로 쓴다. 행 순서는 상수의 키 순서이며 비율로
 * 정렬하지 않는다 — 비율순 정렬은 잘 나온 행을 위로 올리는 선택이 된다.
 */
import { PATTERN_ID_BY_SKILL_NAME } from '@/shared/config/guideLinks.generated';
import { isPooledBaseRate } from '@/shared/lib/patternBaseRate';
import {
    PATTERN_BASE_RATES,
    PATTERN_POOLED_BASE_RATE,
    PRICE_LEVEL_BASE_RATE,
    PRICE_LEVEL_FAMILY_BASE_RATES,
    priceLevelFamilyBaseRateFor,
    type MeasuredBaseRate,
} from '@y0ngha/siglens-core';

const SKILL_NAME_BY_PATTERN_ID: Readonly<Record<string, string>> =
    Object.fromEntries(
        Object.entries(PATTERN_ID_BY_SKILL_NAME).map(([name, id]) => [id, name])
    );

/**
 * 패턴 id의 스킬 이름. 분석 카드가 쓰는 표시명(`shared.skillName`)의 키라서 표의 이름이 카드와
 * 같은 철자가 된다. 카탈로그에 없는 새 id는 id 그대로 돌려준다.
 */
export function patternSkillName(id: string): string {
    return Object.hasOwn(SKILL_NAME_BY_PATTERN_ID, id)
        ? (SKILL_NAME_BY_PATTERN_ID[id] ?? id)
        : id;
}

export interface MeasuredRecordRow {
    /** 패턴 id 또는 가격대 유형 id. 라벨은 호출부가 id로 찾는다. */
    readonly id: string;
    /** `null`이면 그 유형에는 자기 측정이 없다(표본 부족). */
    readonly rate: MeasuredBaseRate | null;
}

export interface PatternRecord {
    /** 자기 표본이 충분한 패턴만, `PATTERN_BASE_RATES` 키 순서대로. */
    readonly own: readonly MeasuredRecordRow[];
    /** 표본이 적어 합산 행으로 대신하는 패턴 id들(키 순서). */
    readonly pooledIds: readonly string[];
    /** 전체 패턴 합산 행. 대신하는 패턴이 없어도 항상 싣는다. */
    readonly pooled: MeasuredBaseRate;
}

/**
 * 패턴 유형별 행과 합산 행. 합산 행은 전체 패턴을 합친 측정(`PATTERN_POOLED_BASE_RATE`) 그대로다.
 * 소표본 패턴 항목의 'pooled' 행은 같은 숫자의 복사본이지만 판정은 그 패턴 하나의 표본 부족이라
 * 전체 측정의 판정이 아니므로 읽지 않고, 어떤 패턴이 합산으로 대신하는지(`pooledIds`)에만 쓴다.
 */
export function patternRecord(): PatternRecord {
    const entries = Object.entries(PATTERN_BASE_RATES).flatMap(([id, rate]) =>
        rate === undefined ? [] : [{ id, rate }]
    );
    const pooledIds = entries
        .filter(({ rate }) => isPooledBaseRate(rate))
        .map(({ id }) => id);
    return {
        own: entries
            .filter(({ rate }) => !isPooledBaseRate(rate))
            .map(({ id, rate }) => ({ id, rate })),
        pooledIds,
        pooled: PATTERN_POOLED_BASE_RATE,
    };
}

export interface LevelRecord {
    /** 가격대 유형별 행, 상수의 키 순서. 자기 측정이 없는 유형은 `rate: null`. */
    readonly families: readonly MeasuredRecordRow[];
    /** 모든 가격대를 합산한 행. */
    readonly pooled: MeasuredBaseRate;
}

/** 가격대 유형별 행. 유형 행은 접근자로만 읽는다(표본 부족·합산 행은 `null`). */
export function levelRecord(): LevelRecord {
    return {
        families: Object.keys(PRICE_LEVEL_FAMILY_BASE_RATES).map(id => ({
            id,
            rate: priceLevelFamilyBaseRateFor(id),
        })),
        pooled: PRICE_LEVEL_BASE_RATE,
    };
}
